import { BrowserWindow, app, screen } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import type { AchievementPayload, BookmarkPopupPayload, MemoryPopupPayload, ProfilesPopupPayload, CollectionPickerPayload, CollectionsPopupPayload, LinkOverflowPayload, SettingsPopupPayload, ManageProfilesPayload, GameNotificationPayload, GameUndetectedPayload, Profile } from '@shared/types'
import { store } from '../store'

const isDev = !app.isPackaged

function resolveIcon(): string {
  return isDev
    ? path.join(process.cwd(), 'public', 'icons', 'icon.ico')
    : path.join(process.resourcesPath, 'icons', 'icon.ico')
}

type PopupPayload =
  | { type: 'bookmark'; data: BookmarkPopupPayload }
  | { type: 'memory'; data: MemoryPopupPayload }
  | { type: 'profiles'; data: ProfilesPopupPayload }
  | { type: 'collectionPicker'; data: CollectionPickerPayload }
  | { type: 'collections'; data: CollectionsPopupPayload }
  | { type: 'settings'; data: SettingsPopupPayload }
  | { type: 'manage-profiles'; data: ManageProfilesPayload }
  | { type: 'linkOverflow'; data: LinkOverflowPayload }

const POPUP_SIZES = {
  bookmark: { width: 272, height: 310 },
  memory: { width: 300, height: 400 },
  profiles: { width: 240, height: 320 },
  collectionPicker: { width: 220, height: 280 },
  collections: { width: 340, height: 520 },
  settings: { width: 600, height: 620 },
  'manage-profiles': { width: 340, height: 520 },
  linkOverflow: { width: 220, height: 300 },
} as const

const MOVABLE_POPUPS = new Set(['collections', 'settings', 'manage-profiles'])

export class PopupWindow {
  private win: BrowserWindow | null = null
  private overlayWin: BrowserWindow
  /** Standalone game-detection notification (separate from main popup). */
  private notifWin: BrowserWindow | null = null
  private notifTimer: NodeJS.Timeout | null = null
  /** Pending undetected-candidates payload deferred while another notification is visible. */
  private pendingUndetected: GameUndetectedPayload['candidates'] | null = null
  /** Achievement notification window. */
  private achievementWin: BrowserWindow | null = null
  private achievementTimer: NodeJS.Timeout | null = null
  /** Queue of achievement titles waiting to be shown. */
  private achievementQueue: string[] = []

  constructor(overlayWin: BrowserWindow) {
    this.overlayWin = overlayWin
  }

  open(payload: PopupPayload): void {
    // If already open, just focus it
    if (this.win && !this.win.isDestroyed()) {
      this.win.focus()
      return
    }

    const { type, data } = payload
    const { width, height } = POPUP_SIZES[type]
    const overlayBounds = this.overlayWin.getBounds()
    const display = screen.getDisplayNearestPoint({
      x: Math.round(overlayBounds.x + data.anchorX),
      y: Math.round(overlayBounds.y + data.anchorY),
    })
    const wa = display.workArea
    const x = Math.max(wa.x, Math.min(Math.round(overlayBounds.x + data.anchorX - width), wa.x + wa.width - width))
    const y = Math.max(wa.y, Math.min(Math.round(overlayBounds.y + data.anchorY + 4), wa.y + wa.height - height))

    this.win = new BrowserWindow({
      x,
      y,
      width,
      height,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: MOVABLE_POPUPS.has(type),
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: false,
      },
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void this.win.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    // Send data once DOM is ready, then show
    this.win.webContents.once('dom-ready', () => {
      if (!this.win || this.win.isDestroyed()) return
      this.win.webContents.send(IPC.PopupInit, { type, data })
      this.win.show()
    })

    // Close when focus leaves the popup
    this.win.on('blur', () => {
      this.close()
    })

    this.win.on('closed', () => {
      this.win = null
    })
  }

  /**
   * Open the settings popup centered on the primary display.
   * Unlike `open()`, it does not auto-close on blur — intended for first-run
   * onboarding where the user needs to acknowledge the window themselves.
   */
  openCentered(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.focus()
      return
    }

    const W = POPUP_SIZES.settings.width
    const H = POPUP_SIZES.settings.height
    const wa = screen.getPrimaryDisplay().workArea
    const x = Math.round(wa.x + (wa.width - W) / 2)
    const y = Math.round(wa.y + (wa.height - H) / 2)

    // Anchor coords relative to the overlay window origin, so PopupInit renders correctly.
    const overlayBounds = this.overlayWin.getBounds()
    const anchorX = x - overlayBounds.x + W
    const anchorY = y - overlayBounds.y - 4

    this.win = new BrowserWindow({
      x,
      y,
      width: W,
      height: H,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: false,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: false,
      },
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void this.win.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    this.win.webContents.once('dom-ready', () => {
      if (!this.win || this.win.isDestroyed()) return
      this.win.webContents.send(IPC.PopupInit, {
        type: 'settings',
        data: { anchorX, anchorY } satisfies SettingsPopupPayload,
      })
      this.win.show()
      this.win.focus()
    })

    this.win.on('closed', () => {
      this.win = null
    })
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
    }
    this.win = null
    // Notify overlay renderer to refresh collections
    if (!this.overlayWin.isDestroyed()) {
      this.overlayWin.webContents.send(IPC.PopupDone)
    }
  }

  getWebContents(): Electron.WebContents | null {
    return this.win && !this.win.isDestroyed() ? this.win.webContents : null
  }

  // ─── Game detection notification ─────────────────────────────────────────

  /**
   * Opens a small always-on-top notification window styled like Discord/Steam's
   * game-detection popup. Positioned at the top-centre of the display where the
   * overlay lives. Auto-dismisses after 4 s; clicking it opens the main overlay.
   * Does NOT close on blur (games steal focus constantly).
   */
  openGameNotification(profile: Profile, isNew: boolean, screenPoint?: { x: number; y: number }): void {
    this.closeNotification()

    // Prefer the game's window center so the notification appears on the game's display.
    // Fall back to cursor position when no window coords are available.
    const point = (screenPoint && (screenPoint.x !== 0 || screenPoint.y !== 0))
      ? screenPoint
      : screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(point)
    const wa = display.workArea

    const NOTIF_W = 340
    const NOTIF_H = 82
    const MARGIN = 12

    // Top-centre of the display (Discord = top-left, Steam = bottom-right)
    const x = Math.round(wa.x + (wa.width - NOTIF_W) / 2)
    const y = wa.y + MARGIN

    this.notifWin = new BrowserWindow({
      x, y,
      width: NOTIF_W,
      height: NOTIF_H,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: false,
      },
    })

    this.notifWin.setAlwaysOnTop(true, 'screen-saver')
    this.notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.notifWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void this.notifWin.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    const shortcut = store.get('settings').shortcuts?.toggleOverlay ?? null
    const payload: GameNotificationPayload = { profile, isNew, shortcut }
    const sendInit = (): void => {
      if (!this.notifWin || this.notifWin.isDestroyed()) return
      this.notifWin.webContents.send(IPC.PopupInit, { type: 'gameNotification', data: payload })
    }

    // dom-ready fires after DOMContentLoaded (module scripts evaluated).
    // React's useEffect (which registers the onInit listener) is scheduled
    // for AFTER the first paint — so send the message twice:
    //   1. at dom-ready (fast path, works when React is quick)
    //   2. at did-finish-load (guaranteed fallback after all assets + useEffect)
    this.notifWin.webContents.once('dom-ready', () => {
      if (!this.notifWin || this.notifWin.isDestroyed()) return
      this.notifWin.show()
      sendInit()
      // Reassert always-on-top after fullscreen game initialisation which can
      // temporarily demote screen-saver level windows on some GPU drivers.
      setTimeout(() => {
        if (!this.notifWin || this.notifWin.isDestroyed()) return
        this.notifWin.setAlwaysOnTop(true, 'screen-saver')
        this.notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.notifWin.moveTop()
      }, 150)
    })

    this.notifWin.webContents.once('did-finish-load', () => {
      sendInit()
      if (this.notifTimer) clearTimeout(this.notifTimer)
      // After 6 s, tell the renderer to slide out. Then hard-destroy 1.2 s later
      // as a fallback in case the renderer doesn't call closeNotification() in time.
      this.notifTimer = setTimeout(() => {
        if (!this.notifWin || this.notifWin.isDestroyed()) return
        this.notifWin.webContents.send(IPC.PopupNotifDismiss)
        this.notifTimer = setTimeout(() => this.closeNotification(), 1_200)
      }, 6_000)
    })

    this.notifWin.on('closed', () => { this.notifWin = null })
  }

  closeNotification(): void {
    if (this.notifTimer) { clearTimeout(this.notifTimer); this.notifTimer = null }
    if (this.notifWin && !this.notifWin.isDestroyed()) {
      this.notifWin.destroy()
    }
    this.notifWin = null
    // Drain any deferred undetected-candidate payload that was queued while a notif was visible
    if (this.pendingUndetected && this.pendingUndetected.length > 0) {
      const next = this.pendingUndetected
      this.pendingUndetected = null
      // Schedule on next tick so the destroyed window has time to be cleaned up
      setImmediate(() => this.openGameUndetectedNotification(next))
    }
  }

  /**
   * Shows the "game not detected" notification — same position/style as openGameNotification
   * but with a different payload type. Auto-dismisses after 6 s; clicking opens the overlay.
   * Does NOT close on blur. If a notification is currently visible, queues for after it closes
   * so candidates aren't silently dropped.
   */
  openGameUndetectedNotification(candidates: GameUndetectedPayload['candidates']): void {
    // Don't stack on top of an active notification — queue and replay when free
    if (this.notifWin && !this.notifWin.isDestroyed()) {
      this.pendingUndetected = candidates
      return
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const wa = display.workArea

    const NOTIF_W = 300
    const NOTIF_H = 68
    const MARGIN = 12

    const x = Math.round(wa.x + (wa.width - NOTIF_W) / 2)
    const y = wa.y + MARGIN

    this.notifWin = new BrowserWindow({
      x, y,
      width: NOTIF_W,
      height: NOTIF_H,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: false,
      },
    })

    this.notifWin.setAlwaysOnTop(true, 'screen-saver')
    this.notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.notifWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void this.notifWin.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    const payload: GameUndetectedPayload = { candidates }
    const sendInit = (): void => {
      if (!this.notifWin || this.notifWin.isDestroyed()) return
      this.notifWin.webContents.send(IPC.PopupInit, { type: 'gameUndetected', data: payload })
    }

    this.notifWin.webContents.once('dom-ready', () => {
      if (!this.notifWin || this.notifWin.isDestroyed()) return
      this.notifWin.show()
      sendInit()
      setTimeout(() => {
        if (!this.notifWin || this.notifWin.isDestroyed()) return
        this.notifWin.setAlwaysOnTop(true, 'screen-saver')
        this.notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        this.notifWin.moveTop()
      }, 150)
    })

    this.notifWin.webContents.once('did-finish-load', () => {
      sendInit()
      if (this.notifTimer) clearTimeout(this.notifTimer)
      this.notifTimer = setTimeout(() => this.closeNotification(), 6_000)
    })

    this.notifWin.on('closed', () => { this.notifWin = null })
  }

  // ─── Achievement notification (bottom-right, stacked queue) ──────────────

  /**
   * Queues an achievement notification. Shows one at a time at the bottom-right
   * of the screen on top of all content. Auto-dismisses after 3.5 s then shows
   * the next queued item.
   */
  openAchievementNotification(payload: AchievementPayload): void {
    this.achievementQueue.push(payload.title)
    if (this.achievementWin && !this.achievementWin.isDestroyed()) return
    this._showNextAchievement()
  }

  private _showNextAchievement(): void {
    if (this.achievementQueue.length === 0) return
    const title = this.achievementQueue[0]

    const b = this.overlayWin.getBounds()
    const display = screen.getDisplayNearestPoint({ x: b.x + b.width, y: b.y + b.height })
    const wa = display.workArea

    const W = 300
    const H = 52
    const MARGIN = 14

    // Anchor to the overlay window's bottom-right corner, clamped to work area
    const x = Math.max(wa.x, Math.min(b.x + b.width - W - MARGIN, wa.x + wa.width - W - MARGIN))
    const y = Math.max(wa.y, Math.min(b.y + b.height - H - MARGIN, wa.y + wa.height - H - MARGIN))

    this.achievementWin = new BrowserWindow({
      x, y, width: W, height: H,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      show: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: false,
      },
    })

    this.achievementWin.setAlwaysOnTop(true, 'screen-saver')
    this.achievementWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.achievementWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void this.achievementWin.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    const data: AchievementPayload = { title }
    const sendInit = (): void => {
      if (!this.achievementWin || this.achievementWin.isDestroyed()) return
      this.achievementWin.webContents.send(IPC.PopupInit, { type: 'achievementNotification', data })
    }

    this.achievementWin.webContents.once('dom-ready', () => {
      if (!this.achievementWin || this.achievementWin.isDestroyed()) return
      this.achievementWin.showInactive()
      sendInit()
      setTimeout(() => {
        if (!this.achievementWin || this.achievementWin.isDestroyed()) return
        this.achievementWin.setAlwaysOnTop(true, 'screen-saver')
        this.achievementWin.moveTop()
      }, 150)
    })

    this.achievementWin.webContents.once('did-finish-load', () => {
      sendInit()
      if (this.achievementTimer) clearTimeout(this.achievementTimer)
      this.achievementTimer = setTimeout(() => {
        if (!this.achievementWin || this.achievementWin.isDestroyed()) return
        this.achievementWin.webContents.send(IPC.PopupNotifDismiss)
        this.achievementTimer = setTimeout(() => this._closeCurrentAchievement(), 400)
      }, 3_500)
    })

    this.achievementWin.on('closed', () => { this.achievementWin = null })
  }

  private _closeCurrentAchievement(): void {
    if (this.achievementTimer) { clearTimeout(this.achievementTimer); this.achievementTimer = null }
    if (this.achievementWin && !this.achievementWin.isDestroyed()) this.achievementWin.destroy()
    this.achievementWin = null
    // Shift queue and show next
    this.achievementQueue.shift()
    if (this.achievementQueue.length > 0) setImmediate(() => this._showNextAchievement())
  }

  /**
   * Immediately dismisses any active achievement notification and empties the
   * queue. Called when the overlay becomes hidden (e.g. game detected) so
   * notifications never float above the game.
   */
  dismissAchievements(): void {
    if (this.achievementTimer) { clearTimeout(this.achievementTimer); this.achievementTimer = null }
    if (this.achievementWin && !this.achievementWin.isDestroyed()) this.achievementWin.destroy()
    this.achievementWin = null
    this.achievementQueue = []
  }
}
