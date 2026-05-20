import { ipcMain, shell, app, dialog, autoUpdater, webContents } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import { IPC } from '@shared/ipc'
import { store } from '../store'
import type { PopupWindow } from '../windows/PopupWindow'
import type { TabManager } from '../managers/TabManager'
import type { ProfileManager } from '../managers/ProfileManager'
import type { CollectionsManager } from '../managers/CollectionsManager'
import type { ShortcutManager } from '../managers/ShortcutManager'
import type { OverlayWindow } from '../windows/OverlayWindow'
import { DEFAULT_HOMEPAGE, DEFAULT_SHORTCUTS } from '@shared/types'
import type { BookmarkPopupPayload, AchievementPayload, CollectionsPopupPayload, LinkOverflowPayload, MemoryPopupPayload, Settings, Shortcuts } from '@shared/types'
import { getVisibleGames } from '../utils/getVisibleGames'
import { crashLogPath, ensureLogsDir, logCrash } from '../utils/crashLogger'

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
function ensureUpdater(): void {
  if (updaterReady || !app.isPackaged) return
  updaterReady = true
  const feedUrl = `https://update.electronjs.org/overframeApp-arch/Overframe/win32/${app.getVersion()}`
  autoUpdater.setFeedURL({ url: feedUrl })
  autoUpdater.on('checking-for-update', () => broadcastUpdateStatus({ status: 'checking' }))
  autoUpdater.on('update-not-available', () => broadcastUpdateStatus({ status: 'up-to-date' }))
  autoUpdater.on('update-available', () => broadcastUpdateStatus({ status: 'available', version: '' }))
  autoUpdater.on('update-downloaded', (_e, _notes, releaseName) =>
    broadcastUpdateStatus({ status: 'downloaded', version: releaseName ?? '' })
  )
  autoUpdater.on('error', (err: Error) =>
    broadcastUpdateStatus({ status: 'error', message: err.message })
  )
}

// Only these protocols are safe to load in a WebContentsView
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

/** Returns true if `url` passes both the protocol whitelist and the length cap. */
function isSafeBoundedUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length <= MAX_URL_LENGTH && isSafeUrl(url)
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
  'gamePathHints',
  'searchEngine',
  'autoCreateProfiles',
  'autoSwitchProfile',
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

  ipcMain.handle(IPC.AchievementNotify, (_e, payload: AchievementPayload) => {
    if (!payload || typeof payload.title !== 'string' || payload.title.length > 200) return
    popup.openAchievementNotification(payload)
  })
  ipcMain.handle(IPC.OpenPanelFromPopup, (e, panelId?: string, collectionId?: string, prefillNewProfile?: { name: string; processName: string }) => {
    if (e.sender === popup.getWebContents()) {
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
    const target = isSafeBoundedUrl(url) ? url : (profiles.getActive().homepageUrl || DEFAULT_HOMEPAGE)
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
    else wc.openDevTools({ mode: 'detach' })
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
  ipcMain.handle(IPC.OverlayToggleMaximize, () => overlay.toggleMaximize())
  ipcMain.handle(IPC.OverlayIsMaximized, () => overlay.isMaximized())
  ipcMain.handle(IPC.OverlayUnmaximize, () => overlay.unmaximize())
  ipcMain.on(IPC.OverlaySetPosition, (_e, x: number, y: number) => overlay.setPositionXY(x, y))
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
    if (input.iconUrl !== undefined) {
      const u = String(input.iconUrl)
      if (u.length > MAX_URL_LENGTH * 8) return null
      if (!u.startsWith('data:image/') && !isSafeUrl(u)) return null
    }
    return collections.create(input)
  })
  ipcMain.handle(IPC.CollectionsRemove, (_e, id: string) => collections.remove(id))
  ipcMain.handle(IPC.CollectionsRename, (_e, id: string, name: string) => {
    if (!isBoundedString(name, MAX_NAME_LENGTH)) return null
    return collections.rename(id, name)
  })
  ipcMain.handle(IPC.CollectionsAddLink, (_e, collectionId: string, link) => {
    if (!link || !isSafeBoundedUrl(link.url)) return null
    if (link.title !== undefined && !isBoundedString(link.title, MAX_NAME_LENGTH)) return null
    if (link.note !== undefined && typeof link.note === 'string' && link.note.length > MAX_NOTE_LENGTH) return null
    return collections.addLink(collectionId, link)
  })
  ipcMain.handle(IPC.CollectionsRemoveLink, (_e, collectionId: string, linkId: string) =>
    collections.removeLink(collectionId, linkId)
  )
  ipcMain.handle(IPC.CollectionsUpdateLink, (_e, collectionId: string, linkId: string, patch) => {
    if (patch?.url !== undefined && !isSafeBoundedUrl(patch.url)) return null
    if (patch?.title !== undefined && !isBoundedString(String(patch.title), MAX_NAME_LENGTH)) return null
    if (patch?.note !== undefined && typeof patch.note === 'string' && patch.note.length > MAX_NOTE_LENGTH) return null
    return collections.updateLink(collectionId, linkId, patch)
  })
  ipcMain.handle(IPC.CollectionsTogglePin, (_e, collectionId: string, linkId: string) =>
    collections.togglePin(collectionId, linkId)
  )
  ipcMain.handle(IPC.CollectionsExport, (_e, id: string) => collections.export(id))

  // Upload the full collection JSON (including embedded images) to the share worker
  // and return the 8-char short code. Falls back to null on network error.
  ipcMain.handle(IPC.CollectionsShare, async (_e, id: string) => {
    const b64 = collections.export(id)
    if (!b64) return null
    const json = Buffer.from(b64, 'base64').toString('utf8')
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

  ipcMain.handle(IPC.CollectionsImport, async (_e, input: string, profileId: string) => {
    if (typeof input !== 'string' || input.length === 0) return null
    let base64 = input
    // Short code (8 lowercase alphanumeric chars) — resolve via share worker
    if (/^[a-z0-9]{8}$/.test(input)) {
      try {
        const res = await fetch(`${SHARE_API_URL}/${input}`)
        if (!res.ok) return null
        const json = await res.text()
        base64 = Buffer.from(json, 'utf8').toString('base64')
      } catch {
        return null
      }
    }
    if (base64.length > MAX_IMPORT_BASE64_LENGTH) return null
    return collections.import(base64, profileId)
  })
  ipcMain.handle(IPC.CollectionsSetIconUrl, (_e, id: string, iconUrl: string | null) => {
    if (iconUrl !== null && iconUrl !== undefined) {
      const u = String(iconUrl)
      if (u.length > MAX_URL_LENGTH * 8) return null
      if (!u.startsWith('data:image/') && !isSafeUrl(u)) return null
    }
    return collections.setIconUrl(id, iconUrl ?? null)
  })
  ipcMain.handle(IPC.CollectionsReorderLinks, (_e, collectionId: string, linkIds: unknown) => {
    if (!Array.isArray(linkIds) || !linkIds.every((x) => typeof x === 'string')) return null
    return collections.reorderLinks(collectionId, linkIds as string[])
  })
  ipcMain.handle(IPC.CollectionsReorder, (_e, collectionIds: unknown) => {
    if (!Array.isArray(collectionIds) || !collectionIds.every((x) => typeof x === 'string')) return null
    collections.reorder(collectionIds as string[])
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
  ipcMain.handle(IPC.ProfilesRemove, (_e, id: string, mode: 'delete' | 'exclude' = 'exclude') => profiles.remove(id, mode))
  ipcMain.handle(IPC.ProfilesUpdate, (_e, id: string, patch) => {
    if (!patch || typeof patch !== 'object') return null
    if (patch?.homepageUrl !== undefined && !isSafeBoundedUrl(patch.homepageUrl)) return null
    if (patch?.name !== undefined && !isBoundedString(String(patch.name), MAX_NAME_LENGTH)) return null
    if (patch?.processNames !== undefined && !isValidProcessNames(patch.processNames)) return null
    if (patch?.exePaths !== undefined && !isValidExePaths(patch.exePaths)) return null
    if (patch?.priority !== undefined && (typeof patch.priority !== 'number' || !Number.isFinite(patch.priority))) return null
    if (patch?.iconUrl !== undefined) {
      const u = String(patch.iconUrl)
      if (u.length > MAX_URL_LENGTH * 8) return null  // data URLs (image base64) can be large
      if (!u.startsWith('data:image/') && !isSafeUrl(u)) return null
    }
    return profiles.update(id, patch)
  })
  ipcMain.handle(IPC.ProfilesSetActive, (_e, id: string) => profiles.setActive(id, true))
  ipcMain.handle(IPC.ProfilesGetExcluded, () => profiles.getExcluded())
  ipcMain.handle(IPC.ProfilesUnexclude, (_e, name: string) => profiles.unexclude(name))
  ipcMain.handle(IPC.ProfilesExclude, (_e, name: string) => {
    if (typeof name !== 'string' || !name.trim()) return
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
  ipcMain.handle(IPC.ProfilesRemoveCustomGamePath, (_e, p: string) => {
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
      'gamePathHints',
    ])
    if (LIST_KEYS.has(key as keyof Settings) && !isBoundedStringList(value)) return null

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
      broadcastUpdateStatus({ status: 'dev' })
      return
    }
    ensureUpdater()
    autoUpdater.checkForUpdates()
  })
  ipcMain.handle(IPC.SystemPickFolder, async (_e) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
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
