import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import _updateElectronAppImport from 'update-electron-app'
// update-electron-app is ESM; Rollup may wrap it as { default: fn } in CJS bundles.
const updateElectronApp: (...args: Parameters<typeof _updateElectronAppImport>) => void =
  ((_updateElectronAppImport as unknown as { default: typeof _updateElectronAppImport }).default
    ?? _updateElectronAppImport) as never

/**
 * Squirrel.Windows event guard — must run before app.whenReady() so no window
 * is created during install / update / uninstall phases. When this returns
 * true the process is on its way to exit; skip all further initialisation.
 */
import { handleSquirrelEvents, isFirstRun } from './lifecycle/squirrel'
const isSquirrelEvent = handleSquirrelEvents()

import { OverlayWindow } from './windows/OverlayWindow'
import { PopupWindow } from './windows/PopupWindow'
import { TrayManager } from './windows/TrayManager'
import { ShortcutManager } from './managers/ShortcutManager'
import { TabManager } from './managers/TabManager'
import { ProfileManager } from './managers/ProfileManager'
import { CollectionsManager } from './managers/CollectionsManager'
import { SessionManager } from './managers/SessionManager'
import { startGlobalHooks, stopGlobalHooks } from './managers/uiohook'
import { store, migrateStore } from './store'
import { registerIpcHandlers } from './ipc/handlers'
import { installChromeCsp } from './lifecycle/csp'
import { buildShortcutActions } from './lifecycle/shortcutActions'
import { IPC } from '@shared/ipc'
import { DEFAULT_SHORTCUTS, DEFAULT_PROFILE_ID, type Shortcuts } from '@shared/types'

/** Single-instance lock — a second launch focuses the existing instance. */
const gotLock = isSquirrelEvent ? true : app.requestSingleInstanceLock()
if (!gotLock) app.quit()

/** Last-resort safety net so an unhandled rejection doesn't silently kill the main process. */
process.on('unhandledRejection', (reason) => {
  console.error('[overframe] unhandledRejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[overframe] uncaughtException:', err)
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
}

// Force dark mode for all browser tab content.
// WebContentsForceDark uses Chromium's auto-dark algorithm (already-dark pages are skipped).
// nativeTheme ensures prefers-color-scheme: dark for sites with native dark mode support.
app.commandLine.appendSwitch('enable-features', 'WebContentsForceDark')

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
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

  // ── Tab events ─────────────────────────────────────────────────────────────

  let saveDebounce: NodeJS.Timeout | null = null
  const debouncedSave = (): void => {
    if (saveDebounce) clearTimeout(saveDebounce)
    saveDebounce = setTimeout(() => {
      if (profiles && sessionManager) sessionManager.save(profiles.getActive().id)
    }, 2_000)
  }

  tabs.on((event) => {
    if (!overlay) return
    const wc = overlay.win.webContents
    if (event.type === 'updated') wc.send(IPC.EventTabUpdated, event.tab)
    if (event.type === 'removed') { wc.send(IPC.EventTabRemoved, event.id); debouncedSave() }
    if (event.type === 'activeChanged') { wc.send(IPC.EventActiveTabChanged, event.id); debouncedSave() }
    if (event.type === 'download') wc.send(IPC.EventDownload, event.event)
  })

  // ── Profile events ─────────────────────────────────────────────────────────

  let pendingSessionRestore: { profileId: string; fallbackUrl: string } | null = null

  profiles.onChange((profile) => {
    if (!overlay) return
    overlay.setOpacity(profile.opacity)
    /**
     * Restore window bounds one tick after the profile switch so any hide() that
     * runs in onAutoDetected / onAutoReturnedToDefault fires first. The reposition
     * then happens while the window is already invisible.
     */
    setTimeout(() => {
      if (!overlay || overlay.win.isDestroyed()) return
      overlay.win.setBounds(profile.windowBounds)
    }, 0)
    overlay.win.webContents.send(IPC.EventProfileChanged, profile)
    // Only restore the tab session if the overlay is currently visible.
    // If hidden (game just closed, returned to default), defer until the user
    // explicitly opens the overlay — avoids background network activity the
    // user never asked for (e.g. YouTube autoplay).
    if (overlay.getState() !== 'HIDDEN') {
      sessionManager?.restore(profile.id, profile.homepageUrl)
    } else {
      pendingSessionRestore = { profileId: profile.id, fallbackUrl: profile.homepageUrl }
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
    if (fromProfileId === DEFAULT_PROFILE_ID && overlay.getState() !== 'HIDDEN') {
      overlay.hide()
    }
    popup?.openGameNotification(profile, isNew, screenPoint)
  })

  profiles.onAutoReturnedToDefault(() => {
    if (overlay && overlay.getState() !== 'HIDDEN') overlay.hide()
  })

  profiles.onGameUndetected((candidates) => {
    popup?.openGameUndetectedNotification(candidates)
  })

  profiles.onBeforeSwitch((fromId) => {
    sessionManager?.save(fromId)
  })

  // ── Overlay state changes ──────────────────────────────────────────────────

  overlay.onStateChange((state) => {
    if (!overlay) return
    overlay.win.webContents.send(IPC.EventOverlayStateChanged, state)
    if (state === 'HIDDEN') {
      const perfMode = store.get('settings').performanceMode ?? false
      if (perfMode) tabs?.unloadAll()
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
        sessionManager?.restore(p.profileId, p.fallbackUrl)
      }
      tabs?.resumeAll()
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
  overlay.win.on('resize', () => {
    persistBounds()
    tabs?.relayoutActive()
  })

  // ── Startup ────────────────────────────────────────────────────────────────

  profiles.startPolling()

  /**
   * Lazy session restore: load tabs only when the overlay is first shown.
   * Keeps the process idle (zero web traffic) while hidden at startup or during
   * a game session where the user hasn't opened the overlay yet.
   */
  overlay.onFirstShow(() => {
    const current = profiles!.getActive()
    sessionManager!.restoreOrCreate(current.id, current.homepageUrl)
  })

  if (!process.argv.includes('--hidden')) overlay.show()

  // On first run after fresh install, open the settings window immediately so
  // the user sees a visible window rather than hunting for a tray icon.
  // On subsequent launches (not firstrun), fall back to a tray balloon — Windows
  // may suppress it, but it's best-effort.
  if (app.isPackaged) {
    if (isFirstRun()) {
      popup!.openCentered()
    } else if (!store.get('settings').hasCompletedOnboarding) {
      tray.showBalloon(
        'Overframe is ready',
        'Your overlay is open. Use the shortcut anytime to show or hide it.',
      )
    }
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
