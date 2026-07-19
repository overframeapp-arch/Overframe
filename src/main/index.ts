import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { updateElectronApp } from 'update-electron-app'

/**
 * Squirrel.Windows event guard — must run before app.whenReady() so no window
 * is created during install / update / uninstall phases. When this returns
 * true the process is on its way to exit; skip all further initialisation.
 */
import { handleSquirrelEvents } from './lifecycle/squirrel'
const isSquirrelEvent = handleSquirrelEvents()

import { OverlayWindow } from './windows/OverlayWindow'
import { PopupWindow } from './windows/PopupWindow'
import { TrayManager } from './windows/TrayManager'
import { ShortcutManager } from './managers/ShortcutManager'
import { TabManager } from './managers/TabManager'
import { WebView2View } from './managers/tabs/WebView2View'
import { ProfileManager } from './managers/ProfileManager'
import { CollectionsManager } from './managers/CollectionsManager'
import { SessionManager } from './managers/SessionManager'
import { startGlobalHooks, stopGlobalHooks } from './managers/uiohook'
import { store, migrateStore } from './store'
import { registerIpcHandlers, ensureUpdater } from './ipc/handlers'
import { installChromeCsp } from './lifecycle/csp'
import { buildShortcutActions } from './lifecycle/shortcutActions'
import { IPC } from '@shared/ipc'
import { DEFAULT_SHORTCUTS, DEFAULT_PROFILE_ID, DEFAULT_PROTECTED_DOMAINS, type Shortcuts } from '@shared/types'
import { logCrash } from './utils/crashLogger'
import { startDevServer } from './utils/devServer'
import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * Bump when public/extensions/ublock's default filter-list selection changes
 * (see download-ublock.mjs) — existing profiles keep whatever was selected on
 * their first run, so this triggers a one-time uninstall+reinstall to pick up
 * the new defaults. See the adBlockListGeneration migration in app.whenReady().
 */
const ADBLOCK_LIST_GENERATION = 1

/** Single-instance lock — a second launch focuses the existing instance. */
const gotLock = isSquirrelEvent ? true : app.requestSingleInstanceLock()
if (!gotLock) app.quit()

/** Last-resort safety net so an unhandled rejection doesn't silently kill the main process. */
process.on('unhandledRejection', (reason) => {
  console.error('[overframe] unhandledRejection:', reason)
  logCrash('unhandledRejection', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[overframe] uncaughtException:', err)
  logCrash('uncaughtException', err)
})

let overlay: OverlayWindow | null = null
let popup: PopupWindow | null = null
let tray: TrayManager | null = null
let shortcuts: ShortcutManager | null = null
let tabs: TabManager | null = null
let profiles: ProfileManager | null = null
let collections: CollectionsManager | null = null
let sessionManager: SessionManager | null = null
let memorySnapshotInterval: NodeJS.Timeout | null = null

function setStartupWithWindows(enabled: boolean): void {
  if (!app.isPackaged) {
    // Never register the raw dev electron binary as a Windows startup item.
    // Also actively remove any stale entry that a previous dev session may have set.
    app.setLoginItemSettings({ openAtLogin: false })
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}

app.on('second-instance', () => {
  if (overlay) overlay.show()
})

// Windows taskbar / notification grouping — must be set before app.whenReady().
app.setAppUserModelId('app.overframe')

// Auto-update from GitHub releases — only runs in packaged builds.
if (app.isPackaged) {
  updateElectronApp({ updateInterval: '1 hour', notifyUser: false })
  // Attach the UI status listeners + downloaded-notification right away, so the
  // silent hourly cycle above is actually visible to the user (home footer state
  // and a one-shot Windows notification). Before this, the UI only heard about
  // updates after a manual "Check for updates" click.
  ensureUpdater()
}

app.whenReady().then(() => {
  const initialSettings = store.get('settings')
  const initialDark = initialSettings.applyDarkMode ?? true
  nativeTheme.themeSource = initialDark ? 'dark' : 'light'
  // Store the preference so newly created WebView2 tabs inherit the correct color scheme.
  // The static call has no effect at boot (no tabs exist yet); createTab picks up g_colorScheme.
  WebView2View.setColorScheme(initialDark ? 2 : 1)

  // Sync uBlock Origin state with the setting on every startup.
  // addExtension() is idempotent: it installs if not present and sets the enabled
  // state. Called unconditionally so a disabled-then-reenabled extension is
  // properly synced without requiring manual profile cleanup.
  // The C++ layer defers AddBrowserExtension until the first CreateTab call, and
  // the returned promise resolves once that install genuinely completes — not
  // awaited here since nothing yet exists to create that first tab.
  {
    const extPath = path.join(app.getAppPath(), 'public', 'extensions', 'ublock')
    if (existsSync(extPath)) {
      const adBlockEnabled = initialSettings.adBlockEnabled ?? false
      const needsListReset = store.get('adBlockListGeneration', 0) < ADBLOCK_LIST_GENERATION
      void WebView2View.addExtension(extPath, adBlockEnabled)
        .then(async () => {
          if (!needsListReset) return
          // uBlock only picks its default filter-list selection on first run, and this
          // profile already has one persisted from before — uninstall (wiping storage)
          // and reinstall once so it re-picks the current defaults (see
          // download-ublock.mjs). One-time only, gated by adBlockListGeneration.
          await WebView2View.removeExtension()
          await WebView2View.addExtension(extPath, adBlockEnabled)
          store.set('adBlockListGeneration', ADBLOCK_LIST_GENERATION)
        })
        .catch((e: unknown) => {
          console.error('[AdBlock] startup addExtension failed:', e)
        })
    }
  }

  // Enable standard edit shortcuts (Ctrl+Z/Y/X/C/V/A) in the BrowserWindow renderer.
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu' }]))

  // Apply strict CSP to all overlay / popup BrowserWindows (not WebContentsView tabs).
  installChromeCsp()

  migrateStore()

  setStartupWithWindows(store.get('settings').startWithWindows)

  profiles = new ProfileManager()
  collections = new CollectionsManager()
  shortcuts = new ShortcutManager()

  const active = profiles.getActive()
  overlay = new OverlayWindow(active.windowBounds)
  overlay.setOpacity(active.opacity)
  popup = new PopupWindow(overlay.win)
  tabs = new TabManager(overlay)
  tabs.setDarkMode(initialDark)
  sessionManager = new SessionManager(tabs)

  store.set('sessionDirty', true)

  // WH_KEYBOARD_LL hook — fires before any app receives the keystroke,
  // including games elevated by anti-cheat (same mechanism as Discord push-to-talk).
  startGlobalHooks()

  const broadcastOpacity = (value: number): void => {
    if (!overlay?.win.isDestroyed()) overlay!.win.webContents.send(IPC.EventOpacityChanged, value)
    popup?.getWebContents()?.send(IPC.EventOpacityChanged, value)
  }

  // Merge with DEFAULT_SHORTCUTS so keys added in newer versions are always
  // registered even when the user's stored shortcuts predate them.
  const storedShortcuts = store.get('settings').shortcuts
  const currentShortcuts: Shortcuts = { ...DEFAULT_SHORTCUTS, ...(storedShortcuts ?? {}) }

  shortcuts.init(
    currentShortcuts,
    buildShortcutActions({
      overlay,
      tabs,
      profiles,
      broadcastOpacity,
    }),
  )

  tray = new TrayManager(overlay, profiles)
  tray.init()

  registerIpcHandlers({ overlay, popup, tabs, profiles, collections, shortcuts, setStartupWithWindows })
  startDevServer({ overlay, tabs, profiles })

  // ── Tab events ─────────────────────────────────────────────────────────────

  let saveDebounce: NodeJS.Timeout | null = null
  const debouncedSave = (): void => {
    if (saveDebounce) clearTimeout(saveDebounce)
    saveDebounce = setTimeout(() => {
      saveDebounce = null
      if (profiles && sessionManager) sessionManager.save(profiles.getActive().id)
    }, 300)
  }

  // Stable local reference: `tabs` (the outer `let`) is non-null here, but a mutable
  // module-level binding can't be narrowed inside a closure that runs later.
  const tabManager = tabs
  tabManager.on((event) => {
    if (!overlay) return
    const wc = overlay.win.webContents
    if (event.type === 'updated') wc.send(IPC.EventTabUpdated, event.tab)
    if (event.type === 'removed') { wc.send(IPC.EventTabRemoved, event.id); debouncedSave() }
    if (event.type === 'activeChanged') { wc.send(IPC.EventActiveTabChanged, event.id) }
    if (event.type === 'download') wc.send(IPC.EventDownload, event.event)
    // A tab Show()/navigation re-raises the WebView2 to HWND_TOP; keep the IG
    // promo (an overlay child) above it, and re-measure the scrollbar so its
    // right gap stays correct after navigation.
    if ((event.type === 'activeChanged' || event.type === 'updated')
        && (popup?.isIGPromoVisible() || popup?.isAchievementVisible())) {
      void tabManager.measureActiveScrollbarWidth().then((w) => {
        popup?.raiseIGPromo(w)
        popup?.raiseAchievement(w)
      })
    }
  })

  // ── Profile events ─────────────────────────────────────────────────────────

  let pendingSessionRestore: { profileId: string } | null = null
  /**
   * True when the overlay was automatically hidden by game detection
   * (i.e. the user did not explicitly hide it). Used to restore the overlay
   * when the game closes, while respecting an intentional user-hide.
   */
  let wasAutoHiddenByGame = false

  profiles.onChange((profile) => {
    if (!overlay) return
    overlay.setOpacity(profile.opacity)
    /**
     * Restore window bounds one tick after the profile switch so any hide() that
     * runs in onAutoDetected fires first (overlay invisible before repositioning).
     * When a game closes there is no profile switch, so this only applies on
     * explicit profile changes (manual or game detection).
     */
    setTimeout(() => {
      if (!overlay || overlay.win.isDestroyed()) return
      overlay.win.setBounds(profile.windowBounds)
    }, 0)
    overlay.win.webContents.send(IPC.EventProfileChanged, profile)
    // Restore the tab session immediately when the overlay is visible.
    // If hidden (user deliberately hid the overlay), defer until the overlay is
    // opened — avoids background network activity the user never requested
    // (e.g. YouTube autoplay while working without the overlay).
    const { protectedDomains } = store.get('settings')
    const protected_ = protectedDomains ?? DEFAULT_PROTECTED_DOMAINS
    if (overlay.getState() !== 'HIDDEN') {
      sessionManager?.restore(profile.id, protected_)
    } else {
      pendingSessionRestore = { profileId: profile.id }
    }
  })

  // Reflect data-only changes (e.g. icon auto-fetched) without side-effects.
  profiles.onProfileDataChanged((profile) => {
    if (!overlay) return
    overlay.win.webContents.send(IPC.EventProfileChanged, profile)
  })

  profiles.onAutoDetected((profile, isNew, fromProfileId, screenPoint) => {
    if (!overlay) return
    profiles?.setPollMode('active')
    overlay.win.webContents.send(IPC.EventProfileAutoDetected, { profile, isNew })
    // Auto-hide when transitioning from idle (default) to a game session.
    // If the user was already in a game profile, do not disturb them.
    // If the overlay was already hidden (user chose to hide it), respect that.
    if (fromProfileId === DEFAULT_PROFILE_ID && overlay.getState() !== 'HIDDEN') {
      wasAutoHiddenByGame = true
      overlay.hide()
    }
    popup?.openGameNotification(profile, isNew, screenPoint)
  })

  profiles.onAutoGameClosed(() => {
    if (!overlay) return
    if (wasAutoHiddenByGame) {
      wasAutoHiddenByGame = false
      // Only reveal the overlay if it is still hidden — if the user opened it
      // manually mid-game, leave it as-is to avoid stealing focus unexpectedly.
      if (overlay.getState() === 'HIDDEN') {
        overlay.show()
      }
    }
    // Profile has NOT changed — the user stays on the game profile.
    // If the overlay was already hidden before the game started, leave it hidden.
    // If it was visible during the game (user opened it mid-session), keep it visible.
  })

  profiles.onGameUndetected((candidates) => {
    popup?.openGameUndetectedNotification(candidates)
  })

  profiles.onBeforeSwitch((fromId) => {
    if (saveDebounce) { clearTimeout(saveDebounce); saveDebounce = null }
    sessionManager?.save(fromId)
  })

  // ── Overlay state changes ──────────────────────────────────────────────────

  overlay.onStateChange((state) => {
    if (!overlay) return
    overlay.win.webContents.send(IPC.EventOverlayStateChanged, state)
    if (state === 'HIDDEN') {
      // Dismiss any floating achievement notification so it never appears above the game.
      popup?.dismissAchievements()
      // Pause media before suspending/unloading so pages receive the pause event
      // while they still have their content (unloadAll navigates to about:blank).
      tabs?.pauseAllMedia()
      const { performanceMode, protectedDomains: pd } = store.get('settings')
      if (performanceMode) tabs?.unloadAll(pd ?? DEFAULT_PROTECTED_DOMAINS)
      else tabs?.suspendAll()
      // Reduce poll frequency only when no game is active.
      if (profiles && profiles.getActive().id === DEFAULT_PROFILE_ID) {
        profiles.setPollMode('idle')
      }
    } else {
      // Return to fast-poll so auto-detection toasts appear without delay.
      profiles?.setPollMode('active')
      // Apply deferred session restore before resumeAll so closeAll() clears
      // the previous profile's tabs before reloading the new ones.
      if (pendingSessionRestore) {
        const p = pendingSessionRestore
        pendingSessionRestore = null
        sessionManager?.restore(p.profileId, store.get('settings').protectedDomains ?? DEFAULT_PROTECTED_DOMAINS)
      }
      tabs?.resumeAll()
      tabs?.resumePausedMedia()
      // Overlay is visible again → bring back the IG promo if it was only
      // retracted by the hide (not dismissed by the user). Deferred a tick so it
      // re-reveals after the overlay's show() window churn has settled.
      setImmediate(() => popup?.restoreIGPromo())
    }
  })

  // ── Window bounds persistence ──────────────────────────────────────────────

  let saveTimer: NodeJS.Timeout | null = null
  const persistBounds = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!overlay || !profiles) return
      profiles.update(profiles.getActive().id, { windowBounds: overlay.getBounds() })
    }, 500)
  }
  overlay.win.on('move', persistBounds)
  overlay.win.on('resize', persistBounds)

  // ── Startup ────────────────────────────────────────────────────────────────

  profiles.startPolling()

  /**
   * Lazy session restore: load tabs only when the overlay is first shown.
   * Keeps the process idle (zero web traffic) while hidden at startup or during
   * a game session where the user hasn't opened the overlay yet.
   */
  // Retract the IG promo before the overlay's Alt+B hide churn — but keep it
  // "wanted" so it re-appears when the overlay is shown again (restored in the
  // overlay state-change handler below).
  overlay.onBeforeHide(() => popup?.retractIGPromo())

  overlay.onFirstShow(() => {
    const current = profiles!.getActive()
    sessionManager!.restoreOrCreate(current.id)
  })

  if (!process.argv.includes('--hidden')) overlay.show()

  // On first run after fresh install, open the settings window immediately so
  // the user sees a visible window rather than hunting for a tray icon.
  // On subsequent launches (not firstrun), fall back to a tray balloon — Windows
  // may suppress it, but it's best-effort.
  if (app.isPackaged && !store.get('settings').hasCompletedOnboarding) {
    tray.showBalloon(
      'Overframe is ready',
      'Your overlay is open. Use the shortcut anytime to show or hide it.',
    )
  }

  sessionManager.startAutoSave(() => profiles!.getActive().id)

  memorySnapshotInterval = setInterval(() => {
    if (!tabs || !overlay || overlay.win.isDestroyed()) return
    const snapshot = tabs.getMemorySnapshot()
    overlay.win.webContents.send(IPC.TabsMemoryUpdated, snapshot)
    popup?.getWebContents()?.send(IPC.TabsMemoryUpdated, snapshot)
  }, 1_000)
}).catch((err) => {
  console.error('[overframe] fatal during app.whenReady():', err)
  app.exit(1)
})

app.on('window-all-closed', () => {
})

app.on('will-quit', () => {
  if (profiles && sessionManager) {
    sessionManager.save(profiles.getActive().id)
    store.set('sessionDirty', false)
  }
  if (memorySnapshotInterval) {
    clearInterval(memorySnapshotInterval)
    memorySnapshotInterval = null
  }
  sessionManager?.stopAutoSave()
  shortcuts?.dispose()
  stopGlobalHooks()
  profiles?.stopPolling()
  tabs?.closeAll()
  tray?.dispose()
})

// macOS hook — kept for future cross-platform port. MVP is Windows-only.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && overlay) overlay.show()
})
