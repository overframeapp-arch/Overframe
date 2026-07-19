import { BrowserWindow, app, screen } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import type { AchievementPayload, BookmarkPopupPayload, MemoryPopupPayload, ProfilesPopupPayload, CollectionPickerPayload, CollectionsPopupPayload, LinkOverflowPayload, SettingsPopupPayload, ManageProfilesPayload, GameNotificationPayload, GameUndetectedPayload, Profile, IGPromoPayload } from '@shared/types'
import { WebView2View } from '../managers/tabs/WebView2View'
import { store } from '../store'

// IG promo card geometry (logical px). IG_PROMO_GAP is the visual gap we want
// to be EQUAL on the right and bottom; on the right we additionally shift left by
// the active tab's vertical scrollbar width (measured at show time) so the gap to
// the *visible* content edge matches the bottom — whether a scrollbar is present
// or not.
const IG_PROMO_W = 258
const IG_PROMO_H = 82
const IG_PROMO_GAP = 12

// "Mission complete" toast geometry (logical px). Shares IG_PROMO_GAP + the
// scrollbar-aware right gap, and stacks above the IG promo when both are shown.
const ACH_W = 300
const ACH_H = 52

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
  /**
   * IG promo popup — bottom-right, focusable:false. Created and shown ONCE, then
   * revealed/dismissed purely via opacity (never Show/Hide/Destroy mid-session).
   * See the IG promo section below for why visibility transitions are unsafe.
   */
  private igPromoWin: BrowserWindow | null = null
  /** True once the promo window has loaded and been embedded as an overlay child. */
  private igPromoReady = false
  /** True once the promo HWND has been re-parented as a WS_CHILD of the overlay. */
  private igPromoAttached = false
  /** Logical visibility (revealed vs dismissed). */
  private igPromoVisible = false
  /**
   * Whether the promo should be visible for the current game context. Set true by
   * openIGPromo, cleared only by an explicit dismiss (X / Shop / profile change).
   * Hiding the overlay merely *retracts* the promo (keeps this true) so it
   * re-appears when the overlay is shown again.
   */
  private igPromoWanted = false
  /** The current promo content, kept so the promo can be restored after a retract. */
  private igPromoPayload: IGPromoPayload | null = null
  /** Active-tab vertical scrollbar width (px) measured at the last show. */
  private igPromoScrollbar = 0
  /**
   * True while the renderer reports a resize-handle drag in progress (mousedown
   * held). Extends the resize settle delay so the promo never pops back
   * mid-drag, even if the user holds the handle still.
   */
  private igPromoResizeHold = false
  /** Debounce timer that restores the promo once the overlay size has settled. */
  private igPromoSettleTimer: NodeJS.Timeout | null = null
  /**
   * "Mission complete" toast — same embedded-WS_CHILD model as the IG promo
   * (created/shown once, toggled via SetChildWindowBounds, never destroyed
   * mid-session). Auto-dismisses after a timer; queues multiple completions.
   */
  private achievementWin: BrowserWindow | null = null
  private achievementTimer: NodeJS.Timeout | null = null
  private achievementReady = false
  private achievementAttached = false
  private achievementVisible = false
  private achievementScrollbar = 0
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

  /**
   * True if `wc` belongs to one of this popup's own windows — the main panel,
   * the standalone game-detection notification, or the achievement toast. Used
   * to authorise popup-originated IPC (e.g. the game-detection notification's
   * "Create profile" lives in `notifWin`, the mission-complete toast in
   * `achievementWin`, neither is `win`).
   */
  ownsWebContents(wc: Electron.WebContents | null): boolean {
    if (!wc) return false
    return (
      (this.win != null && !this.win.isDestroyed() && this.win.webContents === wc) ||
      (this.notifWin != null && !this.notifWin.isDestroyed() && this.notifWin.webContents === wc) ||
      (this.achievementWin != null && !this.achievementWin.isDestroyed() && this.achievementWin.webContents === wc)
    )
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

    const NOTIF_W = 340
    const NOTIF_H = 82
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

  // ─── IG promo popup ──────────────────────────────────────────────────────
  //
  // ROOT CAUSE of the `FATAL:hwnd_util.cc(65)] 1400` crash (exit 0x80000003)
  // ───────────────────────────────────────────────────────────────────────
  // The promo must float OVER the WebView2 web content (an in-overlay React
  // element would be painted *behind* the WebView2 child HWND). Earlier it was a
  // separate TOP-LEVEL always-on-top window. Two paths then made Chromium's
  // HWNDMessageHandler call gfx::GetClassName() on a momentarily invalid HWND →
  // ui/gfx/win/hwnd_util.cc PLOG(FATAL) 1400, aborting the process:
  //   1. win.destroy() on close raced with the WebView2 put_IsVisible() cascade.
  //   2. As its own top-level window it shared the OS focus/Z-order band with the
  //      overlay; every Alt+B hide/show (setAlwaysOnTop + moveTop +
  //      app.focus({steal:true})) reshuffled that band across BOTH windows — so
  //      "promo open, hide the overlay, bring it back" crashed. Owning the window
  //      to the overlay reduced but did NOT remove this.
  //
  // THE FIX — embed it as a WS_CHILD of the overlay
  // ────────────────────────────────────────────────
  // The promo HWND is re-parented (native AttachChildWindow) as a WS_CHILD of the
  // overlay's top-level HWND — the same parent the WebView2 hosts already use. As
  // a child it is just pixels clipped to the overlay client area; it has NO
  // top-level activation and moves/Z-orders as part of the overlay. The Alt+B
  // hide/show now acts on a SINGLE top-level window, so there is no cross-window
  // focus cascade to race — the crash is removed structurally. Reveal/dismiss go
  // through SetChildWindowBounds (a child SetWindowPos show/hide, which posts no
  // WM_ACTIVATE), never a top-level Show/Hide/Destroy. (Destroyed once, with the
  // overlay, at quit.)

  /** Bottom-right rect in the overlay's CLIENT coordinates (where children live). */
  private igPromoRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.overlayWin.isDestroyed()) return null
    const [cw, ch] = this.overlayWin.getContentSize()
    return {
      // Right gap = GAP + scrollbar (sit just left of the scrollbar); bottom gap =
      // GAP. Equal visual gap to the visible content edge on both sides.
      x: Math.max(0, cw - IG_PROMO_W - IG_PROMO_GAP - this.igPromoScrollbar),
      y: Math.max(0, ch - IG_PROMO_H - IG_PROMO_GAP),
      w: IG_PROMO_W, h: IG_PROMO_H,
    }
  }

  /** Lazily create the reusable promo window. Returns null if the overlay is gone. */
  private ensureIGPromoWin(): BrowserWindow | null {
    if (this.igPromoWin && !this.igPromoWin.isDestroyed()) return this.igPromoWin
    if (this.overlayWin.isDestroyed()) return null

    const win = new BrowserWindow({
      width: IG_PROMO_W, height: IG_PROMO_H,
      x: -32000, y: -32000,   // off-screen until embedded + revealed (avoids any flash)
      icon: resolveIcon(),
      // OPAQUE on purpose: once re-parented as a WS_CHILD a `transparent: true`
      // window loses its DWM/DirectComposition alpha and paints solid black. An
      // opaque window with the card's own background (#141414 = --background)
      // renders correctly as a child. The promo card fills the whole window.
      frame: false, backgroundColor: '#141414',
      hasShadow: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, focusable: false, show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: false,
        // Keep painting even though this window never holds focus / is a child —
        // otherwise Chromium throttles the renderer and the card stays blank.
        backgroundThrottling: false,
      },
    })
    this.igPromoWin = win
    this.igPromoReady = false
    this.igPromoAttached = false
    this.igPromoVisible = false

    // Show it once at the Electron level (off-screen) so Chromium actually paints
    // the renderer — a window that Electron thinks is hidden never paints, which
    // is why a purely native-shown child stayed blank. Then embed it as a
    // WS_CHILD of the overlay; from here visibility is driven natively.
    win.showInactive()
    this.igPromoAttached = WebView2View.attachChildWindow(
      win.getNativeWindowHandle(),
      this.overlayWin.getNativeWindowHandle(),
    )

    // As a WS_CHILD the promo follows the overlay's moves automatically; only a
    // resize changes the bottom-right anchor. A live resize fires 'resize' many
    // times per second and nudging the child on every tick reads as a flicker —
    // so retract on the first tick and restore once the size has settled. This
    // is the authoritative path: it also covers resizes that never go through
    // the renderer handles (OS-native edges, unmaximize, profile bounds).
    const trackOverlay = (): void => {
      if (win.isDestroyed()) return
      if (this.igPromoVisible) this.hideIGPromoWindow()
      // While a renderer drag is held, wait long enough that the promo never
      // pops back mid-drag (mouseup restores it instantly; the long delay is
      // only the failsafe for a lost mouseup). Otherwise settle quickly.
      this.armIGPromoSettle(this.igPromoResizeHold ? 2_000 : 300)
    }
    this.overlayWin.on('resize', trackOverlay)

    const onOverlayClosed = (): void => { if (!win.isDestroyed()) win.destroy() }
    this.overlayWin.once('closed', onOverlayClosed)

    win.on('closed', () => {
      this.overlayWin.removeListener('resize', trackOverlay)
      this.overlayWin.removeListener('closed', onOverlayClosed)
      if (this.igPromoSettleTimer) { clearTimeout(this.igPromoSettleTimer); this.igPromoSettleTimer = null }
      this.igPromoWin = null
      this.igPromoReady = false
      this.igPromoAttached = false
      this.igPromoVisible = false
    })

    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return
      this.igPromoReady = true
      // If a reveal was requested during load, do it now.
      if (this.igPromoWanted && this.igPromoPayload) this.revealIGPromo(this.igPromoPayload)
    })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void win.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }

    return win
  }

  /** Reveal the promo as a child window raised above the WebView2 content. */
  private revealIGPromo(payload: IGPromoPayload): void {
    const win = this.igPromoWin
    if (!win || win.isDestroyed()) return
    win.webContents.send(IPC.PopupInit, { type: 'igPromo', data: payload })
    win.setIgnoreMouseEvents(false)  // allow clicks on the Shop / dismiss buttons
    const r = this.igPromoRect()
    if (this.igPromoAttached && r) {
      WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, true)
      try { win.webContents.invalidate() } catch { /* force a repaint into the child surface */ }
    } else {
      // Degraded fallback if native embedding was unavailable: a plain top-level
      // window anchored to the overlay's bottom-right (not crash-hardened, but
      // the addon is always present on the supported Windows build).
      const b = this.overlayWin.getBounds()
      win.setBounds({ x: b.x + b.width - IG_PROMO_W - IG_PROMO_GAP - this.igPromoScrollbar, y: b.y + b.height - IG_PROMO_H - IG_PROMO_GAP, width: IG_PROMO_W, height: IG_PROMO_H })
      win.showInactive()
    }
    this.igPromoVisible = true
  }

  /**
   * Re-raise the promo above the WebView2 siblings. A tab Show()/navigation does
   * SetWindowPos(webview, HWND_TOP), which would otherwise cover the promo — so
   * we re-assert HWND_TOP after such operations to keep it visible until closed.
   */
  raiseIGPromo(scrollbarWidth?: number): void {
    const win = this.igPromoWin
    if (!win || win.isDestroyed() || !this.igPromoVisible || !this.igPromoAttached) return
    if (scrollbarWidth !== undefined) this.igPromoScrollbar = Math.max(0, Math.round(scrollbarWidth))
    const r = this.igPromoRect()
    if (r) WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, true)
  }

  /** Whether the promo is currently revealed. */
  isIGPromoVisible(): boolean { return this.igPromoVisible }

  /** Whether the achievement toast is currently revealed. */
  isAchievementVisible(): boolean { return this.achievementVisible }

  /** Physically hide the promo window (child SetWindowPos hide / top-level hide). */
  private hideIGPromoWindow(): void {
    const win = this.igPromoWin
    if (!win || win.isDestroyed()) { this.igPromoVisible = false; return }
    // Do NOT call setIgnoreMouseEvents(true) here. The window was embedded as a
    // WS_CHILD with WS_EX_LAYERED (kept from Electron's focusable:false setup).
    // Cycling setIgnoreMouseEvents(true → false) on a WS_CHILD leaves WS_EX_TRANSPARENT
    // in a partially-restored state: Chromium's TrackMouseEvent still delivers
    // WM_MOUSEMOVE (→ CSS hover works) but WM_NCHITTEST returns HTTRANSPARENT so
    // WM_LBUTTONDOWN routes to the game instead — clicks silently miss the buttons.
    // SW_HIDE (from setChildWindowBounds visible=false) is sufficient: a hidden
    // HWND receives no mouse messages regardless of its WS_EX_TRANSPARENT flag.
    if (this.igPromoAttached) {
      const r = this.igPromoRect()
      if (r) WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, false)
    } else if (win.isVisible()) {
      win.hide()
    }
    this.igPromoVisible = false
  }

  /** Show the promo for the current game context. Stays "wanted" until dismissed. */
  openIGPromo(payload: IGPromoPayload, scrollbarWidth = 0): void {
    this.igPromoWanted = true
    this.igPromoPayload = payload
    this.igPromoScrollbar = Math.max(0, Math.round(scrollbarWidth))
    const win = this.ensureIGPromoWin()
    if (!win) return
    // Not loaded yet → did-finish-load will reveal it (wanted + payload are set).
    if (this.igPromoReady) this.revealIGPromo(payload)
  }

  /**
   * Dismiss the IG promo for good (X / Shop / profile change) — clears "wanted",
   * so it will NOT come back when the overlay is shown again.
   */
  closeIGPromo(): void {
    this.igPromoWanted = false
    this.igPromoPayload = null
    this.hideIGPromoWindow()
  }

  /**
   * Temporarily retract the promo (overlay hidden / DevTools opening) WITHOUT
   * clearing "wanted", so restoreIGPromo() brings it back when the overlay
   * returns. As an embedded child this is a SetWindowPos hide (no WM_ACTIVATE),
   * so it never interleaves with the overlay's focus cascade.
   */
  retractIGPromo(): void {
    this.hideIGPromoWindow()
  }

  /** Re-reveal the promo after a retract, if it is still wanted. */
  restoreIGPromo(): void {
    if (!this.igPromoWanted || !this.igPromoPayload) return
    const win = this.ensureIGPromoWin()
    if (!win || !this.igPromoReady) return  // did-finish-load will reveal it
    this.revealIGPromo(this.igPromoPayload)
  }

  /**
   * (Re)arm the debounce that restores the promo once resize activity stops.
   * Also clears the drag-hold flag so a lost mouseup can never strand the
   * promo hidden.
   */
  private armIGPromoSettle(delayMs: number): void {
    if (this.igPromoSettleTimer) clearTimeout(this.igPromoSettleTimer)
    this.igPromoSettleTimer = setTimeout(() => {
      this.igPromoSettleTimer = null
      this.igPromoResizeHold = false
      // If the overlay was hidden meanwhile, its show handler restores instead.
      if (!this.overlayWin.isDestroyed() && this.overlayWin.isVisible()) this.restoreIGPromo()
    }, delayMs)
  }

  /**
   * Renderer resize-handle drag started (mousedown held). Retracts the promo
   * immediately — before the first bounds change — and keeps it retracted for
   * the whole drag via the extended settle delay in the 'resize' tracker.
   */
  beginResizeHold(): void {
    this.igPromoResizeHold = true
    this.retractIGPromo()
    // Arm the failsafe now in case no 'resize' tick ever fires (mousedown
    // without movement) AND the mouseup is lost.
    this.armIGPromoSettle(2_000)
  }

  /**
   * Renderer resize-handle drag ended (mouseup). Restores the promo right away
   * instead of waiting for the settle timer. If this event is ever lost (the
   * mouseup can land in the WebView2 child HWND), the settle timer in the
   * 'resize' tracker restores the promo on its own.
   */
  endResizeHold(): void {
    this.igPromoResizeHold = false
    if (this.igPromoSettleTimer) { clearTimeout(this.igPromoSettleTimer); this.igPromoSettleTimer = null }
    if (!this.overlayWin.isDestroyed() && this.overlayWin.isVisible()) this.restoreIGPromo()
  }

  // ─── Achievement notification (bottom-right, stacked queue) ──────────────

  /** Bottom-right rect (overlay CLIENT coords), stacked above the IG promo if it is shown. */
  private achievementRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.overlayWin.isDestroyed()) return null
    const [cw, ch] = this.overlayWin.getContentSize()
    const promoBump = this.igPromoVisible ? IG_PROMO_H + IG_PROMO_GAP : 0
    return {
      x: Math.max(0, cw - ACH_W - IG_PROMO_GAP - this.achievementScrollbar),
      y: Math.max(0, ch - ACH_H - IG_PROMO_GAP - promoBump),
      w: ACH_W, h: ACH_H,
    }
  }

  /** Lazily create the reusable achievement window, embedded as a WS_CHILD. */
  private ensureAchievementWin(): BrowserWindow | null {
    if (this.achievementWin && !this.achievementWin.isDestroyed()) return this.achievementWin
    if (this.overlayWin.isDestroyed()) return null

    const win = new BrowserWindow({
      width: ACH_W, height: ACH_H,
      x: -32000, y: -32000,
      icon: resolveIcon(),
      frame: false, backgroundColor: '#141414',
      hasShadow: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, focusable: false, show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: false,
        backgroundThrottling: false,
      },
    })
    this.achievementWin = win
    this.achievementReady = false
    this.achievementAttached = false
    this.achievementVisible = false

    // Show once (off-screen) so Chromium paints, then embed as a WS_CHILD of the
    // overlay — identical to the IG promo (see that note for the rationale).
    win.showInactive()
    this.achievementAttached = WebView2View.attachChildWindow(
      win.getNativeWindowHandle(),
      this.overlayWin.getNativeWindowHandle(),
    )

    const onOverlayClosed = (): void => { if (!win.isDestroyed()) win.destroy() }
    this.overlayWin.once('closed', onOverlayClosed)
    win.on('closed', () => {
      this.overlayWin.removeListener('closed', onOverlayClosed)
      this.achievementWin = null
      this.achievementReady = false
      this.achievementAttached = false
      this.achievementVisible = false
    })

    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return
      this.achievementReady = true
      if (this.achievementQueue.length > 0 && !this.achievementVisible) this._showNextAchievement()
    })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popup.html`)
    } else {
      void win.loadFile(path.join(__dirname, '../renderer/popup.html'))
    }
    return win
  }

  /**
   * Queues a "mission complete" toast. Shows one at a time at the overlay's
   * bottom-right (above the IG promo if present), auto-dismissing after 3.5 s.
   */
  openAchievementNotification(payload: AchievementPayload, scrollbarWidth = 0): void {
    this.achievementScrollbar = Math.max(0, Math.round(scrollbarWidth))
    this.achievementQueue.push(payload.title)
    if (!this.achievementVisible) this._showNextAchievement()
  }

  private _showNextAchievement(): void {
    if (this.achievementQueue.length === 0) return
    const win = this.ensureAchievementWin()
    if (!win || !this.achievementReady) return  // did-finish-load will retry
    const r = this.achievementRect()
    if (!r) return
    const title = this.achievementQueue[0]
    win.webContents.send(IPC.PopupInit, { type: 'achievementNotification', data: { title } })
    win.setIgnoreMouseEvents(false)  // allow click-to-open-missions
    WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, true)
    try { win.webContents.invalidate() } catch { /* repaint into the child surface */ }
    this.achievementVisible = true
    if (this.achievementTimer) clearTimeout(this.achievementTimer)
    this.achievementTimer = setTimeout(() => this._closeCurrentAchievement(), 3_500)
  }

  /** Re-raise the achievement above the WebView2 after a tab Show()/navigation. */
  raiseAchievement(scrollbarWidth?: number): void {
    const win = this.achievementWin
    if (!win || win.isDestroyed() || !this.achievementVisible || !this.achievementAttached) return
    if (scrollbarWidth !== undefined) this.achievementScrollbar = Math.max(0, Math.round(scrollbarWidth))
    const r = this.achievementRect()
    if (r) WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, true)
  }

  private hideAchievementWindow(): void {
    const win = this.achievementWin
    this.achievementVisible = false
    if (!win || win.isDestroyed()) return
    // Same reasoning as hideIGPromoWindow: setIgnoreMouseEvents(true) on a WS_CHILD
    // with WS_EX_LAYERED can leave WS_EX_TRANSPARENT partially restored, causing
    // hover to work but clicks to silently miss. SW_HIDE is sufficient.
    if (this.achievementAttached) {
      const r = this.achievementRect()
      if (r) WebView2View.setChildWindowBounds(win.getNativeWindowHandle(), r.x, r.y, r.w, r.h, false)
    } else if (win.isVisible()) {
      win.hide()
    }
  }

  private _closeCurrentAchievement(): void {
    if (this.achievementTimer) { clearTimeout(this.achievementTimer); this.achievementTimer = null }
    this.hideAchievementWindow()
    this.achievementQueue.shift()
    // Leave a short visible gap before the next toast so a burst of completions
    // reads as distinct notifications instead of one continuous one.
    if (this.achievementQueue.length > 0) {
      this.achievementTimer = setTimeout(() => this._showNextAchievement(), 380)
    }
  }

  /**
   * Immediately dismisses any active achievement notification and empties the
   * queue. Called when the overlay becomes hidden so toasts never float above the
   * game. Hides (never destroys) — the window is reused.
   */
  dismissAchievements(): void {
    if (this.achievementTimer) { clearTimeout(this.achievementTimer); this.achievementTimer = null }
    this.achievementQueue = []
    this.hideAchievementWindow()
  }

  /** Native HWNDs of the embedded child windows (promo + achievement) for claimFocus exclusion. */
  getEmbeddedHwnds(): Buffer[] {
    const out: Buffer[] = []
    if (this.igPromoWin && !this.igPromoWin.isDestroyed() && this.igPromoAttached) out.push(this.igPromoWin.getNativeWindowHandle())
    if (this.achievementWin && !this.achievementWin.isDestroyed() && this.achievementAttached) out.push(this.achievementWin.getNativeWindowHandle())
    return out
  }
}
