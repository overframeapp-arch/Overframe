import { ipcMain, shell, app, dialog, autoUpdater, webContents, nativeTheme, Notification } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { IPC } from '@shared/ipc'
import { store } from '../store'
import type { PopupWindow } from '../windows/PopupWindow'
import type { TabManager } from '../managers/TabManager'
import type { ProfileManager } from '../managers/ProfileManager'
import type { CollectionsManager } from '../managers/CollectionsManager'
import type { ShortcutManager } from '../managers/ShortcutManager'
import type { OverlayWindow } from '../windows/OverlayWindow'
import { DEFAULT_HOMEPAGE, DEFAULT_SHORTCUTS, CREATOR_PLATFORMS, MAX_CREATOR_LINKS, MAX_COLLECTION_SECTIONS } from '@shared/types'
import { WebView2View } from '../managers/tabs/WebView2View'
import type { BookmarkPopupPayload, AchievementPayload, CollectionAuthor, CollectionsPopupPayload, LinkOverflowPayload, MemoryPopupPayload, Settings, Shortcuts, IGPromoPayload } from '@shared/types'
import { getVisibleGames } from '../utils/getVisibleGames'
import { crashLogPath, ensureLogsDir, logCrash } from '../utils/crashLogger'
import { logConsole, readLog } from '../utils/devLogger'

// ── Auto-updater ───────────────────────────────────────────────────────────
// Only functional in packaged builds. In dev mode we immediately reply with
// a 'dev' status so the UI can show a friendly message instead of an error.

type UpdateStatus =
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'dev' }

function broadcastUpdateStatus(payload: UpdateStatus): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(IPC.EventUpdateStatus, payload)
  }
}

let updaterReady = false
let updateNotified = false

/**
 * Attach the update-status listeners (and the one-shot Windows notification)
 * to Electron's autoUpdater singleton. update-electron-app drives the actual
 * check/download cycle (hourly, silent) on this same singleton, so this must
 * run at boot — not only on a manual "Check for updates" click — otherwise the
 * background updater downloads new versions without the UI ever hearing of it.
 * Overframe lives in the tray and rarely gets restarted: without a signal, a
 * downloaded update can sit unapplied for weeks.
 */
export function ensureUpdater(): void {
  if (updaterReady || !app.isPackaged) return
  updaterReady = true
  const feedUrl = `https://update.electronjs.org/overframeApp-arch/Overframe/win32/${app.getVersion()}`
  autoUpdater.setFeedURL({ url: feedUrl })
  autoUpdater.on('checking-for-update', () => broadcastUpdateStatus({ status: 'checking' }))
  autoUpdater.on('update-not-available', () => broadcastUpdateStatus({ status: 'up-to-date' }))
  autoUpdater.on('update-available', () => broadcastUpdateStatus({ status: 'available', version: '' }))
  autoUpdater.on('update-downloaded', (_e, _notes, releaseName) => {
    broadcastUpdateStatus({ status: 'downloaded', version: releaseName ?? '' })
    // Inform, never interrupt: no click action and no auto-restart — the user
    // may be mid-game. Applying the update stays a deliberate act (the
    // "Restart to update" button in the home footer, or the next app restart).
    if (!updateNotified && Notification.isSupported()) {
      updateNotified = true
      new Notification({
        title: releaseName ? `Overframe ${releaseName} is ready` : 'Overframe update ready',
        body: 'The new version is downloaded. Restart Overframe whenever you want to apply it.',
      }).show()
    }
  })
  autoUpdater.on('error', (err: Error) =>
    broadcastUpdateStatus({ status: 'error', message: err.message })
  )
}

// Only these protocols are safe to load in a browser tab (WebView2)
function isSafeUrl(url: string): boolean {
  try {
    const proto = new URL(url).protocol
    return proto === 'http:' || proto === 'https:'
  } catch {
    return false
  }
}

// ── Input length guards ─────────────────────────────────────────────────────
// Prevent oversized payloads from a misbehaving / compromised renderer.
// Values are well above any legitimate UX scenario but small enough to fail
// fast on accidental megabyte payloads (e.g. a paste of a giant URL).
const MAX_URL_LENGTH = 4096
const MAX_NAME_LENGTH = 200
const MAX_NOTE_LENGTH = 2000
/** Base64 export blob: a single collection with hundreds of links is ~50–100 KB. */
const MAX_IMPORT_BASE64_LENGTH = 1_000_000 // ~750 KB decoded

/** Share API — Cloudflare Worker. Override with OVERFRAME_SHARE_URL env var for self-hosting. */
const SHARE_API_URL = process.env.OVERFRAME_SHARE_URL ?? 'https://share.overframe.app'

/** Returns true if the input is a non-empty string under the given length. */
function isBoundedString(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.length > 0 && input.length <= maxLength
}

/**
 * Returns true for a plausible store id coming from the renderer (uuid-sized,
 * non-empty string). Non-string ids are harmless no-ops in the managers today,
 * but rejecting them at the boundary keeps that a guarantee, not an accident.
 */
function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64
}

/**
 * Strict image-URL check: a plain string that is either an inline data:image/
 * payload (base64 images can be large — 8× the URL cap) or a safe http(s) URL.
 * No String() coercion: validating a coerced copy and storing the raw value
 * would let a non-string (array, stateful-toString object) into the store.
 */
function isValidImageUrl(v: unknown): v is string {
  return typeof v === 'string'
    && v.length <= MAX_URL_LENGTH * 8
    && (v.startsWith('data:image/') || isSafeUrl(v))
}

/** Returns true if `url` passes both the protocol whitelist and the length cap. */
function isSafeBoundedUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length <= MAX_URL_LENGTH && isSafeUrl(url)
}

/** Resolve a share input (raw base64 export, or an 8-char short code) to a base64 payload, or null. */
async function resolveShareInput(input: unknown): Promise<string | null> {
  if (typeof input !== 'string' || input.length === 0) return null
  let base64 = input
  // Short code (8 lowercase alphanumeric chars) — resolve via the share worker.
  if (/^[a-z0-9]{8}$/.test(input)) {
    try {
      const res = await fetch(`${SHARE_API_URL}/${input}`)
      if (!res.ok) return null
      base64 = Buffer.from(await res.text(), 'utf8').toString('base64')
    } catch {
      return null
    }
  }
  return base64.length > MAX_IMPORT_BASE64_LENGTH ? null : base64
}

// Profile-specific limits — well above any legitimate UX scenario.
const MAX_PROCESS_NAMES = 50
const MAX_PROCESS_NAME_LENGTH = 128
const MAX_EXE_PATHS = 20
const MAX_EXE_PATH_LENGTH = 4096

/** Validates a profile processNames array — returns true if every entry is a non-empty bounded string. */
function isValidProcessNames(arr: unknown): arr is string[] {
  return Array.isArray(arr)
    && arr.length <= MAX_PROCESS_NAMES
    && arr.every((n) => typeof n === 'string' && n.length > 0 && n.length <= MAX_PROCESS_NAME_LENGTH)
}

/** Validates a profile exePaths array. */
function isValidExePaths(arr: unknown): arr is string[] {
  return Array.isArray(arr)
    && arr.length <= MAX_EXE_PATHS
    && arr.every((p) => typeof p === 'string' && p.length > 0 && p.length <= MAX_EXE_PATH_LENGTH)
}

// Strict allowlist of Settings keys that may be written via IPC
const SETTINGS_ALLOWLIST: ReadonlySet<keyof Settings> = new Set([
  'shortcuts',
  'startWithWindows',
  'activeProfileId',
  'hasCompletedOnboarding',
  'showMemoryUsage',
  'performanceMode',
  'blockedProcesses',
  'nonGameDirs',
  'launcherExceptions',
  'launcherPatterns',
  'gamePathHints',
  'searchEngine',
  'autoCreateProfiles',
  'autoSwitchProfile',
  'applyDarkMode',
  'homepageUrl',
  'igAutoAffiliate',
  'showIGPromo',
  'protectedDomains',
  'quickLinks',
  'adBlockEnabled',
  'creatorHandle',
  'creatorColor',
  'creatorLinks',
])

/** User-configurable string list caps — prevents storing pathological lists. */
const MAX_CUSTOM_LIST_ENTRIES = 200
const MAX_CUSTOM_LIST_ENTRY_LENGTH = 256

function isBoundedStringList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= MAX_CUSTOM_LIST_ENTRIES
    && value.every((s) => typeof s === 'string' && s.length > 0 && s.length <= MAX_CUSTOM_LIST_ENTRY_LENGTH)
}

interface Deps {
  overlay: OverlayWindow
  popup: PopupWindow
  tabs: TabManager
  profiles: ProfileManager
  collections: CollectionsManager
  shortcuts: ShortcutManager
  setStartupWithWindows: (enabled: boolean) => void
}

export function registerIpcHandlers(deps: Deps): void {
  const { overlay, popup, tabs, profiles, collections, shortcuts, setStartupWithWindows } = deps

  // ─── Popup windows ───────────────────────────────────────────────────
  ipcMain.handle(IPC.PopupOpen, (_e, type: 'bookmark' | 'memory', data: BookmarkPopupPayload | MemoryPopupPayload) => {
    popup.open({ type, data } as Parameters<typeof popup.open>[0])
  })

  ipcMain.handle(IPC.PopupOpenLinkOverflow, (_e, data: LinkOverflowPayload) => {
    if (!data || typeof data.anchorX !== 'number' || !Array.isArray(data.links)) return
    popup.open({ type: 'linkOverflow', data })
  })
  ipcMain.on(IPC.PopupClose, (e) => {
    // Only the popup window itself should trigger this
    if (e.sender === popup.getWebContents()) {
      popup.close()
    }
  })
  ipcMain.on(IPC.PopupCloseNotification, () => popup.closeNotification())

  ipcMain.handle(IPC.AchievementNotify, async (_e, payload: AchievementPayload) => {
    if (!payload || typeof payload.title !== 'string' || payload.title.length > 200) return
    const scrollbar = await tabs.measureActiveScrollbarWidth()
    popup.openAchievementNotification(payload, scrollbar)
  })

  ipcMain.handle(IPC.IGPromoShow, async (_e, payload: IGPromoPayload) => {
    if (!payload || typeof payload.purchaseHint !== 'string' || typeof payload.browseUrl !== 'string') return
    // Measure the active tab's scrollbar so the promo keeps an equal gap to the
    // visible content edge on the right and bottom.
    const scrollbar = await tabs.measureActiveScrollbarWidth()
    popup.openIGPromo(payload, scrollbar)
  })
  ipcMain.on(IPC.IGPromoClose, (_e, dismissed: boolean) => {
    popup.closeIGPromo()
    if (dismissed) overlay.win.webContents.send(IPC.IGPromoDismissed)
  })

  ipcMain.handle(IPC.NavigateHomeFromPopup, (e, tab: string) => {
    if (popup.ownsWebContents(e.sender)) {
      popup.close()
      overlay.win.webContents.send(IPC.EventNavigateHome, tab)
    }
  })

  ipcMain.handle(IPC.OpenPanelFromPopup, (e, panelId?: string, collectionId?: string, prefillNewProfile?: { name: string; processName: string }) => {
    // Accept both the main popup AND the game-detection notification window —
    // "Create profile" on an unrecognised game is fired from the notification.
    if (popup.ownsWebContents(e.sender)) {
      popup.close()
      const b = overlay.win.getBounds()
      const anchorX = Math.round(b.width / 2)
      // Route to the correct level in the unified CollectionsPopup
      const initialLevel = panelId === 'profiles' ? 'profiles' : panelId === 'links' ? 'links' : 'collections'
      const data: CollectionsPopupPayload = { anchorX, anchorY: 80, initialLevel }
      if (collectionId) data.initialCollectionId = collectionId
      if (prefillNewProfile) data.prefillNewProfile = prefillNewProfile
      popup.open({ type: 'collections', data })
    }
  })

  // ─── Tabs ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.TabsCreate, (_e, url?: string) => {
    const target = isSafeBoundedUrl(url) ? url : (store.get('settings').homepageUrl || DEFAULT_HOMEPAGE)
    return tabs.create(target)
  })
  ipcMain.handle(IPC.TabsClose, (_e, id: string) => tabs.close(id))
  ipcMain.handle(IPC.TabsNavigate, (_e, id: string, url: string) => {
    if (!isSafeBoundedUrl(url)) return null
    return tabs.navigate(id, url)
  })
  ipcMain.handle(IPC.TabsGoBack, (_e, id: string) => tabs.goBack(id))
  ipcMain.handle(IPC.TabsGoForward, (_e, id: string) => tabs.goForward(id))
  ipcMain.handle(IPC.TabsReload, (_e, id: string) => tabs.reload(id))
  ipcMain.handle(IPC.TabsStop,   (_e, id: string) => tabs.stop(id))
  ipcMain.handle(IPC.TabsSetActive, (_e, id: string) => tabs.setActive(id))
  ipcMain.handle(IPC.TabsDeactivate, () => tabs.deactivate())
  ipcMain.handle(IPC.TabsReorder, (_e, ids: string[]) => {
    if (Array.isArray(ids) && ids.every((x) => typeof x === 'string')) {
      tabs.reorder(ids)
    }
  })
  ipcMain.handle(IPC.TabsGetAll, () => ({
    tabs: tabs.getAll(),
    activeId: tabs.getActiveId()
  }))
  ipcMain.handle(IPC.TabsGetMemoryUsage, () => tabs.getMemorySnapshot())
  ipcMain.handle(IPC.TabsSetZoom, (_e, id: string, factor: number) => {
    if (typeof id !== 'string') return
    if (typeof factor !== 'number' || !Number.isFinite(factor)) return
    tabs.setZoom(id, factor)
  })
  ipcMain.handle(IPC.TabsSetMuted, (_e, id: string, muted: boolean) => {
    if (typeof id !== 'string') return
    if (typeof muted !== 'boolean') return
    tabs.setMuted(id, muted)
  })
  // ─── System ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SystemToggleDevTools, () => {
    const wc = overlay.win.webContents
    if (wc.isDevToolsOpened()) wc.closeDevTools()
    else {
      popup.retractIGPromo()
      // `activate: false` opens DevTools WITHOUT bringing it to the foreground.
      // A detached DevTools window that steals foreground triggers a focus /
      // activation reshuffle over the transparent overlay + WebView2 children,
      // which trips Chromium's hwnd_util GetClassName FATAL 1400 (same family as
      // the Alt+B crash). Not stealing focus avoids that reshuffle.
      wc.openDevTools({ mode: 'detach', activate: false })
    }
  })
  ipcMain.handle(IPC.DevStoreReset, () => {
    if (app.isPackaged) return // safety guard — dev only
    store.clear()
    app.relaunch()
    app.exit(0)
  })
  // Renderer sends the keyboard layout map (physicalCode → logicalChar) on startup.
  // We forward it to ShortcutManager so logical letters resolve to the correct
  // physical keycodes for the user's keyboard layout (AZERTY, DVORAK, etc.).
  ipcMain.on(IPC.SystemLayoutMap, (_e, map: Record<string, string>) => {
    shortcuts.setLayoutMap(map)
    const settings = store.get('settings')
    const merged: Shortcuts = { ...DEFAULT_SHORTCUTS, ...(settings.shortcuts ?? {}) }
    shortcuts.apply(merged)
  })

  // ─── Overlay ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.OverlaySetOpacity, (_e, value: number) => {
    overlay.setOpacity(value)
    const active = profiles.getActive()
    profiles.update(active.id, { opacity: overlay.getOpacity() })
  })
  ipcMain.handle(IPC.OverlayHide, () => overlay.hide())
  ipcMain.on(IPC.OverlayShow, () => overlay.show())
  ipcMain.handle(IPC.OverlayGetState, () => overlay.getState())
  // Reclaim OS keyboard focus from WebView2 back to the Electron renderer.
  // Uses sendSync so the renderer blocks until ::SetFocus(chromiumRenderWidgetHwnd)
  // completes — ensuring keyboard input reaches the address bar before any key is pressed.
  ipcMain.on(IPC.RendererClaimFocus, (e) => {
    // Exclude the embedded child windows (IG promo + achievement) — each has its
    // own render-widget HWND that must not capture focus, or the address bar
    // becomes untypeable while one is shown.
    WebView2View.claimFocus(overlay.win.getNativeWindowHandle(), ...popup.getEmbeddedHwnds())
    e.returnValue = null // required for sendSync
  })
  ipcMain.handle(IPC.OverlayToggleMaximize, () => overlay.toggleMaximize())
  ipcMain.handle(IPC.OverlayIsMaximized, () => overlay.isMaximized())
  ipcMain.handle(IPC.OverlayUnmaximize, () => overlay.unmaximize())
  ipcMain.on(IPC.OverlaySetPosition, (_e, x: number, y: number) => overlay.setPositionXY(x, y))
  ipcMain.on(IPC.OverlayMoveByDelta, (_e, dx: number, dy: number) => overlay.moveByDelta(dx, dy))
  ipcMain.on(IPC.OverlaySetBounds, (_e, b: { x: number; y: number; width: number; height: number }) => {
    if ([b?.x, b?.y, b?.width, b?.height].every(Number.isFinite)) overlay.setBounds(b)
  })
  // Renderer resize-handle drag: hide the IG promo for the whole drag and bring
  // it back at mouseup. PopupWindow also debounces the overlay 'resize' event
  // itself as the authoritative fallback (OS-native resize, lost mouseup).
  ipcMain.on(IPC.OverlayResizeStart, () => popup.beginResizeHold())
  ipcMain.on(IPC.OverlayResizeEnd, () => popup.endResizeHold())
  ipcMain.on(IPC.OverlaySetWebViewBounds, (_e, x: number, y: number, w: number, h: number) =>
    tabs.setActiveViewBounds(x, y, w, h)
  )
  ipcMain.on(IPC.OverlaySetMouseInteractive, (_e, interactive: boolean) =>
    overlay.setMouseInteractive(interactive)
  )
  ipcMain.on(IPC.OverlayRequestClickThrough, () => overlay.enterClickThrough())
  ipcMain.on(IPC.OverlayLeaveClickThrough, () => overlay.leaveClickThrough())
  ipcMain.on(IPC.OverlaySetPanelWidth, (_e, w: number) => overlay.setPanelWidth(w))
  ipcMain.on(IPC.OverlaySetChromeHeight, (_e, h: number) => overlay.setChromeHeight(h))

  // ─── Collections ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.CollectionsGetAll, () => collections.getAll())
  ipcMain.handle(IPC.CollectionsCreate, (_e, input) => {
    if (!input || !isBoundedString(input.name, MAX_NAME_LENGTH)) return null
    // profileId is mandatory in NewCollection — an undefined one would persist a
    // collection invisible to every getForProfile() query.
    if (!isBoundedString(input.profileId, MAX_NAME_LENGTH)) return null
    if (input.iconUrl !== undefined && !isValidImageUrl(input.iconUrl)) return null
    if (input.source !== undefined && !['user', 'publisher', 'community'].includes(input.source)) return null
    return collections.create(input)
  })
  ipcMain.handle(IPC.CollectionsRemove, (_e, id: unknown) => {
    if (!isId(id)) return null
    return collections.remove(id)
  })
  ipcMain.handle(IPC.CollectionsRename, (_e, id: unknown, name: string) => {
    if (!isId(id) || !isBoundedString(name, MAX_NAME_LENGTH)) return null
    return collections.rename(id, name)
  })
  ipcMain.handle(IPC.CollectionsAddLink, (_e, collectionId: unknown, link) => {
    if (!isId(collectionId) || !link || !isSafeBoundedUrl(link.url)) return null
    if (link.title !== undefined && (typeof link.title !== 'string' || link.title.length > MAX_NAME_LENGTH)) return null
    // Strict string check: a truthy non-string (object/array) must be rejected,
    // not silently forwarded to the store.
    if (link.note !== undefined && (typeof link.note !== 'string' || link.note.length > MAX_NOTE_LENGTH)) return null
    // Favicons can legitimately be data:image/ URLs captured from the live tab.
    if (link.favicon !== undefined && link.favicon !== null && !isValidImageUrl(link.favicon)) return null
    if (link.pinned !== undefined && typeof link.pinned !== 'boolean') return null
    return collections.addLink(collectionId, link)
  })
  ipcMain.handle(IPC.CollectionsRemoveLink, (_e, collectionId: unknown, linkId: unknown) => {
    if (!isId(collectionId) || !isId(linkId)) return null
    return collections.removeLink(collectionId, linkId)
  })
  ipcMain.handle(IPC.CollectionsUpdateLink, (_e, collectionId: unknown, linkId: unknown, patch) => {
    if (!isId(collectionId) || !isId(linkId)) return null
    if (patch === null || typeof patch !== 'object') return null
    if (patch.url !== undefined && !isSafeBoundedUrl(patch.url)) return null
    // No String() coercion: it would let a raw object pass the bound check and
    // then be stored as-is (Link.title corrupted to a non-string).
    if (patch.title !== undefined && !isBoundedString(patch.title, MAX_NAME_LENGTH)) return null
    if (patch.note !== undefined && (typeof patch.note !== 'string' || patch.note.length > MAX_NOTE_LENGTH)) return null
    if (patch.section !== undefined && patch.section !== null
      && (typeof patch.section !== 'string' || patch.section.length > MAX_NAME_LENGTH)) return null
    if (patch.pinned !== undefined && typeof patch.pinned !== 'boolean') return null
    if (patch.order !== undefined && (typeof patch.order !== 'number' || !Number.isFinite(patch.order))) return null
    if (patch.favicon !== undefined && patch.favicon !== null && !isValidImageUrl(patch.favicon)) return null
    // Whitelist the patch keys — a raw spread would let the renderer inject
    // arbitrary fields (including overwriting the link id) into the stored Link.
    const clean: Record<string, unknown> = {}
    for (const k of ['title', 'url', 'note', 'pinned', 'favicon', 'order', 'section'] as const) {
      if ((patch as Record<string, unknown>)[k] !== undefined) clean[k] = (patch as Record<string, unknown>)[k]
    }
    return collections.updateLink(collectionId, linkId, clean)
  })
  ipcMain.handle(IPC.CollectionsTogglePin, (_e, collectionId: unknown, linkId: unknown) => {
    if (!isId(collectionId) || !isId(linkId)) return null
    return collections.togglePin(collectionId, linkId)
  })
  ipcMain.handle(IPC.CollectionsExport, (_e, id: unknown) => {
    if (!isId(id)) return null
    return collections.export(id)
  })

  // Upload the full collection JSON (including embedded images) to the share worker
  // and return the 8-char short code. Falls back to null on network error.
  ipcMain.handle(IPC.CollectionsShare, async (_e, id: unknown) => {
    if (!isId(id)) return null
    const json = collections.exportJson(id)
    if (!json) return null
    try {
      const res = await fetch(SHARE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      })
      if (!res.ok) return null
      const data = await res.json() as { code?: string }
      return typeof data.code === 'string' ? data.code : null
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.CollectionsImport, async (_e, input: string, profileId: unknown) => {
    if (!isBoundedString(profileId, MAX_NAME_LENGTH)) return null
    const base64 = await resolveShareInput(input)
    if (!base64) return null
    return collections.import(base64, profileId)
  })
  // Decode + sanitize a shared payload for a trustworthy preview, WITHOUT persisting it.
  ipcMain.handle(IPC.CollectionsPreviewImport, async (_e, input: string) => {
    const base64 = await resolveShareInput(input)
    if (!base64) return null
    return collections.previewImport(base64)
  })
  ipcMain.handle(IPC.CollectionsSetIconUrl, (_e, id: unknown, iconUrl: unknown) => {
    if (!isId(id)) return null
    if (iconUrl !== null && iconUrl !== undefined && !isValidImageUrl(iconUrl)) return null
    return collections.setIconUrl(id, (iconUrl as string | null) ?? null)
  })
  ipcMain.handle(IPC.CollectionsSetBannerUrl, (_e, id: unknown, bannerUrl: unknown) => {
    if (!isId(id)) return null
    if (bannerUrl !== null && bannerUrl !== undefined && !isValidImageUrl(bannerUrl)) return null
    return collections.setBannerUrl(id, (bannerUrl as string | null) ?? null)
  })
  ipcMain.handle(IPC.CollectionsSetBannerFocus, (_e, id: unknown, focus: unknown) => {
    if (!isId(id)) return null
    if (focus !== null && focus !== undefined) {
      if (typeof focus !== 'object') return null
      const f = focus as Record<string, unknown>
      const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
      if (!finite(f.x) || !finite(f.y) || !finite(f.zoom)) return null
    }
    return collections.setBannerFocus(id, focus as { x: number; y: number; zoom: number } | null)
  })
  ipcMain.handle(IPC.CollectionsSetIconFocus, (_e, id: unknown, focus: unknown) => {
    if (!isId(id)) return null
    if (focus !== null && focus !== undefined) {
      if (typeof focus !== 'object') return null
      const f = focus as Record<string, unknown>
      const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
      if (!finite(f.x) || !finite(f.y) || !finite(f.zoom)) return null
    }
    return collections.setIconFocus(id, focus as { x: number; y: number; zoom: number } | null)
  })
  ipcMain.handle(IPC.CollectionsSetDescription, (_e, id: unknown, description: unknown) => {
    if (!isId(id)) return null
    if (description !== null && description !== undefined
      && (typeof description !== 'string' || description.length > MAX_NOTE_LENGTH)) return null
    return collections.setDescription(id, (description as string | null) ?? null)
  })
  ipcMain.handle(IPC.CollectionsSetAuthor, (_e, id: unknown, author: unknown) => {
    if (!isId(id)) return null
    if (author !== null && author !== undefined) {
      if (typeof author !== 'object') return null
      const a = author as { handle?: unknown; color?: unknown }
      if (typeof a.handle !== 'string' || a.handle.length > MAX_NAME_LENGTH) return null
      if (a.color !== undefined && (typeof a.color !== 'string' || a.color.length > 32)) return null
    }
    return collections.setAuthor(id, (author as CollectionAuthor | null) ?? null)
  })
  ipcMain.handle(IPC.CollectionsReorderLinks, (_e, collectionId: unknown, linkIds: unknown) => {
    if (!isId(collectionId)) return null
    if (!Array.isArray(linkIds) || linkIds.length > 2000 || !linkIds.every(isId)) return null
    return collections.reorderLinks(collectionId, linkIds)
  })
  ipcMain.handle(IPC.CollectionsReorder, (_e, collectionIds: unknown) => {
    if (!Array.isArray(collectionIds) || collectionIds.length > 500 || !collectionIds.every(isId)) return null
    collections.reorder(collectionIds)
  })
  ipcMain.handle(IPC.CollectionsSetSections, (_e, collectionId: unknown, sections: unknown) => {
    if (!isId(collectionId)) return null
    if (!Array.isArray(sections) || sections.length > MAX_COLLECTION_SECTIONS
      || !sections.every((x) => typeof x === 'string' && x.length <= MAX_NAME_LENGTH)) return null
    return collections.setSections(collectionId, sections as string[])
  })
  ipcMain.handle(IPC.CollectionsRenameSection, (_e, collectionId: unknown, oldName: string, newName: string) => {
    if (!isId(collectionId)) return null
    if (typeof oldName !== 'string' || oldName.length > MAX_NAME_LENGTH) return null
    if (typeof newName !== 'string' || newName.length > MAX_NAME_LENGTH) return null
    return collections.renameSection(collectionId, oldName, newName)
  })
  ipcMain.handle(IPC.CollectionsDeleteSection, (_e, collectionId: unknown, name: string) => {
    if (!isId(collectionId)) return null
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) return null
    return collections.deleteSection(collectionId, name)
  })
  ipcMain.handle(IPC.CollectionsMoveLink, (_e, collectionId: unknown, linkId: unknown, targetSection: unknown, insertBeforeLinkId: unknown) => {
    if (!isId(collectionId) || !isId(linkId)) return null
    if (targetSection !== null && (typeof targetSection !== 'string' || targetSection.length > MAX_NAME_LENGTH)) return null
    if (insertBeforeLinkId !== null && !isId(insertBeforeLinkId)) return null
    return collections.moveLink(collectionId, linkId, targetSection as string | null, insertBeforeLinkId)
  })

  // ─── Profiles ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.ProfilesGetAll, () => profiles.getAll())
  ipcMain.handle(IPC.ProfilesGetCurrent, () => profiles.getActive())
  ipcMain.handle(IPC.ProfilesCreate, (_e, input) => {
    if (!input || typeof input !== 'object') return null
    if (!isBoundedString(input.name, MAX_NAME_LENGTH)) return null
    if (!isValidProcessNames(input.processNames)) return null
    if (input.exePaths !== undefined && !isValidExePaths(input.exePaths)) return null
    if (input.homepageUrl !== undefined && !isSafeBoundedUrl(input.homepageUrl)) return null
    if (input.priority !== undefined && (typeof input.priority !== 'number' || !Number.isFinite(input.priority))) return null
    return profiles.create(input)
  })
  ipcMain.handle(IPC.ProfilesCreateDetected, (_e, input) => {
    if (!input || typeof input !== 'object') return null
    if (!isBoundedString(input.processName, MAX_PROCESS_NAME_LENGTH)) return null
    if (!isBoundedString(input.exePath, MAX_EXE_PATH_LENGTH)) return null
    if (input.displayName !== undefined &&
        (typeof input.displayName !== 'string' || input.displayName.length > MAX_NAME_LENGTH)) return null
    return profiles.createDetectedProfile(input)
  })
  ipcMain.handle(IPC.ProfilesRemove, (_e, id: unknown, mode: unknown = 'exclude') => {
    if (!isId(id)) return null
    if (mode !== 'delete' && mode !== 'exclude') return null
    return profiles.remove(id, mode)
  })
  ipcMain.handle(IPC.ProfilesUpdate, (_e, id: unknown, patch) => {
    if (!isId(id)) return null
    if (!patch || typeof patch !== 'object') return null
    if (patch?.homepageUrl !== undefined && !isSafeBoundedUrl(patch.homepageUrl)) return null
    // No String() coercion — a non-string name must be rejected, not stored raw.
    if (patch?.name !== undefined && !isBoundedString(patch.name, MAX_NAME_LENGTH)) return null
    if (patch?.processNames !== undefined && !isValidProcessNames(patch.processNames)) return null
    if (patch?.exePaths !== undefined && !isValidExePaths(patch.exePaths)) return null
    if (patch?.priority !== undefined && (typeof patch.priority !== 'number' || !Number.isFinite(patch.priority))) return null
    if (patch?.iconUrl !== undefined && !isValidImageUrl(patch.iconUrl)) return null
    if (patch?.opacity !== undefined && (typeof patch.opacity !== 'number'
      || !Number.isFinite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) return null
    if (patch?.gameDisplayName !== undefined
      && (typeof patch.gameDisplayName !== 'string' || patch.gameDisplayName.length > MAX_NAME_LENGTH)) return null
    if (patch?.windowBounds !== undefined) {
      const b = patch.windowBounds as Record<string, unknown> | null
      const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
      if (!b || typeof b !== 'object' || !fin(b.x) || !fin(b.y) || !fin(b.width) || !fin(b.height)) return null
    }
    // Whitelist the patch keys — a raw spread would let the renderer persist
    // arbitrary fields into the stored Profile.
    const clean: Record<string, unknown> = {}
    for (const k of ['name', 'homepageUrl', 'processNames', 'exePaths', 'priority',
      'iconUrl', 'opacity', 'windowBounds', 'gameDisplayName'] as const) {
      if ((patch as Record<string, unknown>)[k] !== undefined) clean[k] = (patch as Record<string, unknown>)[k]
    }
    return profiles.update(id, clean)
  })
  ipcMain.handle(IPC.ProfilesSetActive, (_e, id: unknown) => {
    if (!isId(id)) return null
    return profiles.setActive(id, true)
  })
  ipcMain.handle(IPC.ProfilesGetExcluded, () => profiles.getExcluded())
  ipcMain.handle(IPC.ProfilesUnexclude, (_e, name: unknown) => {
    if (!isBoundedString(name, MAX_PROCESS_NAME_LENGTH)) return null
    return profiles.unexclude(name)
  })
  ipcMain.handle(IPC.ProfilesExclude, (_e, name: string) => {
    if (typeof name !== 'string' || !name.trim() || name.length > MAX_PROCESS_NAME_LENGTH) return
    const key = name.toLowerCase().replace(/\.exe$/i, '').trim()
    const current = store.get('excludedProcessNames') ?? []
    if (!current.includes(key)) store.set('excludedProcessNames', [...current, key])
  })
  ipcMain.handle(IPC.ProfilesGetCustomGamePaths, () => store.get('customGamePaths') ?? [])
  ipcMain.handle(IPC.ProfilesAddCustomGamePath, (_e, p: string) => {
    if (typeof p !== 'string' || !p.trim() || p.length > 512) return
    const normalized = p.trim().toLowerCase().replace(/\//g, '\\')
    const current = store.get('customGamePaths') ?? []
    if (!current.some((c) => c.toLowerCase() === normalized))
      store.set('customGamePaths', [...current, p.trim()])
  })
  ipcMain.handle(IPC.ProfilesRemoveCustomGamePath, (_e, p: unknown) => {
    if (typeof p !== 'string') return
    const current = store.get('customGamePaths') ?? []
    store.set('customGamePaths', current.filter((c) => c !== p))
  })
  ipcMain.handle(IPC.ProfilesGetVisibleGames, () => getVisibleGames())
  ipcMain.handle(IPC.ProfilesForceDetect, () => profiles.forceDetect())

  // ─── Settings ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SettingsGet, () => store.get('settings'))
  ipcMain.handle(IPC.SettingsSet, (_e, key: string, value: unknown) => {
    if (!SETTINGS_ALLOWLIST.has(key as keyof Settings)) return null

    // Per-key validation for list-typed settings (defence-in-depth).
    const LIST_KEYS: ReadonlySet<keyof Settings> = new Set([
      'blockedProcesses',
      'nonGameDirs',
      'launcherExceptions',
      'launcherPatterns',
      'gamePathHints',
      'protectedDomains',
    ])
    if (LIST_KEYS.has(key as keyof Settings) && !isBoundedStringList(value)) return null
    if (key === 'homepageUrl' && (typeof value !== 'string' || !isSafeBoundedUrl(value as string))) return null
    if (key === 'creatorLinks') {
      const VALID_PLATFORMS = new Set<string>(CREATOR_PLATFORMS)
      if (!Array.isArray(value) || (value as unknown[]).length > MAX_CREATOR_LINKS) return null
      const valid = (value as unknown[]).every((item) =>
        typeof item === 'object' && item !== null &&
        VALID_PLATFORMS.has(String((item as Record<string, unknown>).platform)) &&
        isSafeBoundedUrl((item as Record<string, unknown>).url)
      )
      if (!valid) return null
    }
    if (key === 'quickLinks') {
      if (!Array.isArray(value) || (value as unknown[]).length > 30) return null
      const valid = (value as unknown[]).every((item) => {
        const it = item as Record<string, unknown>
        return typeof item === 'object' && item !== null &&
          typeof it.id === 'string' && it.id.length > 0 && it.id.length <= 100 &&
          typeof it.name === 'string' && it.name.length <= 100 &&
          isSafeBoundedUrl(it.url) &&
          (it.description === undefined || (typeof it.description === 'string' && it.description.length <= 140))
      })
      if (!valid) return null
    }

    const settings = store.get('settings')
    const next = { ...settings, [key]: value } as Settings
    store.set('settings', next)

    // Broadcast to overlay so its Zustand store stays in sync in real-time
    overlay.win.webContents.send(IPC.EventSettingsChanged, next)

    if (key === 'shortcuts') {
      // Always merge with defaults so shortcuts added in newer app versions
      // are never silently dropped when the user saves partial stored shortcuts.
      const merged: Shortcuts = { ...DEFAULT_SHORTCUTS, ...(value as Shortcuts) }
      shortcuts.apply(merged)
    }
    if (key === 'startWithWindows' && typeof value === 'boolean') {
      setStartupWithWindows(value)
    }
    if (key === 'applyDarkMode') {
      const dark = value !== false
      nativeTheme.themeSource = dark ? 'dark' : 'light'
      WebView2View.setColorScheme(dark ? 2 : 1)
      tabs.setDarkMode(dark)
    }
    if (key === 'adBlockEnabled') {
      const extPath = path.join(app.getAppPath(), 'public', 'extensions', 'ublock')
      if (fs.existsSync(extPath)) {
        WebView2View.addExtension(extPath, value === true).catch((e: unknown) => {
          console.error('[AdBlock] addExtension failed:', e)
        })
      }
    }
    return next
  })

  // ─── System ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SystemOpenExternal, (_e, url: string) => {
    if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return null
    try {
      const proto = new URL(url).protocol
      if (proto === 'http:' || proto === 'https:' || proto === 'mailto:') {
        return shell.openExternal(url)
      }
    } catch {
      // ignore
    }
    return null
  })
  ipcMain.handle(IPC.AppGetVersion, () => app.getVersion())
  ipcMain.handle(IPC.AppCheckForUpdates, () => {
    if (!app.isPackaged) {
      broadcastUpdateStatus({ status: 'up-to-date' })
      return
    }
    ensureUpdater()
    autoUpdater.checkForUpdates()
  })
  ipcMain.handle(IPC.AppRestartToUpdate, () => {
    if (!app.isPackaged) return
    autoUpdater.quitAndInstall()
  })
  ipcMain.handle(IPC.SystemPickFolder, async (_e) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.SystemPickExecutable, async (_e) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executable', extensions: ['exe'] }],
    })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.SystemOpenFolder, (_e, target: 'userData' | 'app' | 'logs') => {
    let folderPath: string
    if (target === 'userData') {
      folderPath = app.getPath('userData')
    } else if (target === 'logs') {
      ensureLogsDir()
      folderPath = path.dirname(crashLogPath())
    } else {
      folderPath = path.dirname(app.getPath('exe'))
    }
    return shell.openPath(folderPath)
  })

  ipcMain.handle(IPC.DevSimulateCrash, () => {
    if (app.isPackaged) return
    logCrash('simulated', new Error('Test crash written from developer tools'))
  })

  // ── Dev: renderer console → log file ────────────────────────────────────────
  if (!app.isPackaged) {
    overlay.win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      logConsole('renderer', level, message, line, sourceId)
    })
  }

  // ── Dev: screenshot & log reading ───────────────────────────────────────────
  ipcMain.handle(IPC.DevScreenshot, async () => {
    if (app.isPackaged) return null
    const image = await overlay.win.webContents.capturePage()
    const dest = path.join(app.getPath('temp'), 'overframe-dev-screenshot.png')
    fs.writeFileSync(dest, image.toPNG())
    return dest
  })

  ipcMain.handle(IPC.DevReadLog, (_e, source: 'renderer' | 'webview' | 'crash', lines = 200) => {
    if (app.isPackaged) return null
    return readLog(source, lines)
  })

  ipcMain.handle(IPC.SystemResetData, async (_e) => {
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Reset all data',
      message: 'Reset Overframe to factory defaults?',
      detail: 'This will permanently delete all profiles, collections, bookmarks, shortcuts and settings. The app will relaunch. This cannot be undone.',
      buttons: ['Reset everything', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response !== 0) return
    store.clear()
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle(IPC.SystemUninstall, async (_e) => {
    // Guard: only works in a packaged (Squirrel) build
    if (!app.isPackaged) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Uninstall',
        message: 'Uninstall is only available in the packaged build, not in development mode.',
        buttons: ['OK'],
      })
      return
    }

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Uninstall Overframe',
      message: 'Are you sure you want to uninstall Overframe?',
      detail: 'This will remove the application from your system. Your settings and data will be deleted.',
      buttons: ['Uninstall', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response !== 0) return

    try {
      // Squirrel.Windows: Update.exe sits one level above the versioned app folder
      // e.g. %LOCALAPPDATA%\overframe\Update.exe
      const updateExe = path.resolve(path.dirname(app.getPath('exe')), '..', 'Update.exe')
      spawn(updateExe, ['--uninstall', '-s'], { detached: true, stdio: 'ignore' }).unref()
      app.quit()
    } catch {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Uninstall failed',
        message: 'Could not find the uninstaller.',
        detail: 'Please uninstall Overframe manually via Windows Settings → Apps.',
        buttons: ['OK'],
      })
    }
  })
}
