import {
  BrowserWindow,
  screen,
  app,
} from 'electron'
import path from 'node:path'
import {
  OverlayState,
  WindowBounds,
  DRAG_ZONE_HEIGHT,
  CHROME_HEIGHT,
  RESIZE_BORDER,
} from '@shared/types'
import { IPC } from '@shared/ipc'

const isDev = !app.isPackaged

function resolveIcon(): string {
  return isDev
    ? path.join(process.cwd(), 'public', 'icons', 'icon.ico')
    : path.join(process.resourcesPath, 'icons', 'icon.ico')
}

export class OverlayWindow {
  public win: BrowserWindow
  private state: OverlayState = 'HIDDEN'
  private listeners = new Set<(state: OverlayState) => void>()
  private firstShowListeners = new Set<() => void>()
  /** Fired synchronously at the very start of hide(), before any window op. */
  private beforeHideListeners = new Set<() => void>()
  private currentOpacity = 1.0
  private panelWidth = 0
  private chromeHeight = CHROME_HEIGHT
  /** True once the window has been shown at least once (OS-level). */
  private everShown = false
  /** True while visually hidden via opacity=0. */
  private visuallyHidden = false
  /** State saved before hiding, so CT mode survives a hide/show cycle. */
  private stateBeforeHide: OverlayState | null = null

  constructor(initialBounds: WindowBounds) {
    const safeBounds = this.clampToDisplay(initialBounds)
    this.win = new BrowserWindow({
      ...safeBounds,
      minWidth: 500,
      minHeight: CHROME_HEIGHT + RESIZE_BORDER * 2 + 1,
      icon: resolveIcon(),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: true,
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
        backgroundThrottling: false
      }
    })

    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      void this.win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void this.win.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    // setMinimumSize() is required in addition to the constructor option —
    // frameless transparent windows on Windows can ignore minWidth/minHeight
    // from the constructor when the OS native resize handles are used.
    this.win.setMinimumSize(500, CHROME_HEIGHT + RESIZE_BORDER * 2 + 1)

    this.win.on('closed', () => {
      this.listeners.clear()
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  //  State machine
  // ─────────────────────────────────────────────────────────────────────

  toggle(): void {
    if (this.state === 'HIDDEN') {
      this.show()
    } else {
      this.hide()
    }
  }

  show(): void {
    const restoreClickThrough = this.state === 'HIDDEN' && this.stateBeforeHide === 'CLICK_THROUGH'
    this.stateBeforeHide = null

    if (this.state === 'HIDDEN') {
      this.visuallyHidden = false
      this.win.setOpacity(this.currentOpacity)
      this.win.setIgnoreMouseEvents(false)
    }
    const isFirstShow = !this.everShown
    if (isFirstShow) this.everShown = true
    // Re-assert always-on-top in case the OS demoted us while hidden,
    // then bring the window to foreground and steal keyboard focus.
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.win.show()
    this.win.moveTop()
    // Fire one-shot "first show" callbacks only AFTER the window is actually
    // visible on screen. Session restore (the sole listener) navigates the active
    // tab here; doing it before win.show() means the active tab begins loading
    // while its WebView2 host window is still hidden. Visibility-gated media pages
    // (e.g. a YouTube watch page) then stall indefinitely — they wait for
    // document.visibilityState to become 'visible' before initialising the player.
    // A background tab opened later by a user click never hits this because the
    // window is already visible by then.
    if (isFirstShow) {
      for (const cb of this.firstShowListeners) cb()
      this.firstShowListeners.clear()
    }
    if (restoreClickThrough) {
      // Restore click-through without stealing keyboard focus from the game.
      this.applyClickThrough(true)
      this.setState('CLICK_THROUGH')
    } else {
      // Ensure mouse events reach the window regardless of the previous state
      // (e.g. show() called via a global shortcut while in CLICK_THROUGH mode).
      this.win.setIgnoreMouseEvents(false)
      app.focus({ steal: true })
      if (this.state !== 'FOCUSED') {
        this.setState('FOCUSED')
      }
    }
  }

  hide(): void {
    if (this.state === 'HIDDEN') return
    // Let companion windows (e.g. the IG promo) retract themselves BEFORE we
    // start reshuffling always-on-top / focus below.
    for (const cb of this.beforeHideListeners) cb()
    // Save current state so show() can restore it (e.g. CT mode survives a hide/show).
    this.stateBeforeHide = this.state
    // Drop alwaysOnTop while invisible — this removes the window from the DWM
    // "screen-saver" layer so game windows can't interact with a transparent ghost.
    // show() will re-assert screen-saver level before the window becomes opaque.
    this.win.setAlwaysOnTop(false)
    this.visuallyHidden = true
    this.win.setOpacity(0)
    // No { forward: true } here — when fully hidden the renderer must NOT receive
    // WM_MOUSEMOVE events, which would trigger :hover states and tooltip artefacts
    // while the user is playing. Mouse input reaches the game naturally because
    // the OS skips windows that ignore mouse events.
    this.win.setIgnoreMouseEvents(true)
    this.win.blur()
    // Undo any CT ignoring so the hidden window is fully non-interactive.
    if (this.state === 'CLICK_THROUGH') this.applyClickThrough(false)
    this.setState('HIDDEN')
  }

  enterClickThrough(): void {
    if (this.state !== 'FOCUSED') return
    this.applyClickThrough(true)
    this.setState('CLICK_THROUGH')
  }

  leaveClickThrough(): void {
    if (this.state !== 'CLICK_THROUGH') return
    this.applyClickThrough(false)
    this.win.focus()
    this.setState('FOCUSED')
  }

  getState(): OverlayState {
    return this.state
  }

  private setState(next: OverlayState): void {
    if (next === this.state) return
    this.state = next
    for (const cb of this.listeners) cb(next)
  }

  onStateChange(cb: (state: OverlayState) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Registers a callback fired synchronously at the start of every hide(),
   *  before any window operation. Use it to retract companion windows. */
  onBeforeHide(cb: () => void): () => void {
    this.beforeHideListeners.add(cb)
    return () => this.beforeHideListeners.delete(cb)
  }

  /** Registers a one-shot callback fired the first time the overlay becomes visible.
   *  If the overlay was already shown, the callback fires immediately. */
  onFirstShow(cb: () => void): () => void {
    if (this.everShown) {
      cb()
      return () => { /* no-op */ }
    }
    this.firstShowListeners.add(cb)
    return () => this.firstShowListeners.delete(cb)
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Click-through with permanent drag zone
  // ─────────────────────────────────────────────────────────────────────

  /**
   * When click-through is enabled, the OS forwards mouse events to the window
   * underneath EXCEPT when the cursor hovers a non-ignored region.
   * The renderer dynamically calls setMouseRegion via IPC to keep the top
   * drag strip and any visible UI panels interactive.
   */
  private applyClickThrough(enabled: boolean): void {
    if (enabled) {
      this.win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      this.win.setIgnoreMouseEvents(false)
    }
  }

  /**
   * Called from renderer when the mouse moves while in CLICK_THROUGH state.
   * The renderer detects whether the cursor is over an interactive element
   * (drag zone, tab, button) and toggles ignoring accordingly.
   */
  setMouseInteractive(interactive: boolean): void {
    if (this.state !== 'CLICK_THROUGH') return
    if (interactive) {
      this.win.setIgnoreMouseEvents(false)
    } else {
      this.win.setIgnoreMouseEvents(true, { forward: true })
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Opacity / bounds
  // ─────────────────────────────────────────────────────────────────────

  setOpacity(value: number): void {
    if (!Number.isFinite(value)) return
    const clamped = Math.max(0.2, Math.min(1, value))
    this.currentOpacity = clamped
    if (!this.visuallyHidden) {
      this.win.setOpacity(clamped)
    }
  }

  getOpacity(): number {
    return this.currentOpacity
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Maximize / restore
  // ─────────────────────────────────────────────────────────────────────

  private savedBounds: WindowBounds | null = null

  toggleMaximize(): void {
    if (this.savedBounds) {
      this.win.setResizable(true)
      this.win.setBounds(this.clampToDisplay(this.savedBounds))
      this.savedBounds = null
      this.win.webContents.send(IPC.EventMaximizedChanged, false)
    } else {
      this.savedBounds = this.getBounds()
      const display = screen.getDisplayMatching(this.win.getBounds())
      this.win.setBounds(display.bounds)
      this.win.setResizable(false)
      this.win.webContents.send(IPC.EventMaximizedChanged, true)
    }
  }

  isMaximized(): boolean {
    return this.savedBounds !== null
  }

  /** Restore from custom-maximized state and return the restored bounds (or null if not maximized). */
  unmaximize(): WindowBounds | null {
    if (!this.savedBounds) return null
    const bounds = { ...this.savedBounds }
    this.win.setResizable(true)
    this.win.setBounds(this.clampToDisplay(this.savedBounds))
    this.savedBounds = null
    this.win.webContents.send(IPC.EventMaximizedChanged, false)
    return bounds
  }

  /** Move the window top-left corner to (x, y) in screen coordinates. */
  setPositionXY(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    this.win.setPosition(Math.round(x), Math.round(y))
  }

  /** Translate the window by (dx, dy) logical pixels relative to its current position. */
  moveByDelta(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    const [x, y] = this.win.getPosition()
    this.win.setPosition(Math.round(x + dx), Math.round(y + dy))
  }

  setBounds(bounds: WindowBounds): void {
    const safe = this.clampToDisplay(bounds)
    this.win.setBounds(safe)
  }

  getBounds(): WindowBounds {
    const b = this.win.getBounds()
    return { x: b.x, y: b.y, width: b.width, height: b.height }
  }

  private clampToDisplay(bounds: WindowBounds): WindowBounds {
    const display = screen.getDisplayMatching(bounds) ?? screen.getPrimaryDisplay()
    const wa = display.workArea
    const minH = CHROME_HEIGHT + RESIZE_BORDER * 2 + 1
    const width = Math.min(Math.max(bounds.width, 500), wa.width)
    const height = Math.min(Math.max(bounds.height, minH), wa.height)
    const x = Math.min(Math.max(bounds.x, wa.x), wa.x + wa.width - width)
    const y = Math.min(Math.max(bounds.y, wa.y), wa.y + wa.height - height)
    return { x, y, width, height }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  WebContentsView management (tabs)
  // ─────────────────────────────────────────────────────────────────────

  /** Returns the tab content area bounds (relative to the overlay's client area). */
  getTabContentBounds(): { x: number; y: number; width: number; height: number } {
    const { width, height } = this.win.getContentBounds()
    // In maximized mode the inner div is inset-0 (no transparent resize ring, no 1px border).
    // In normal mode it is inset-[6px] + a 1px border = 7px offset on every side.
    const inset = this.savedBounds !== null ? 0 : RESIZE_BORDER + 1
    return {
      x: inset,
      y: this.chromeHeight + inset,
      width: Math.max(0, width - this.panelWidth - inset * 2),
      height: Math.max(0, height - this.chromeHeight - inset * 2),
    }
  }

  setChromeHeight(h: number): void {
    this.chromeHeight = Math.max(0, h)
    this.onLayoutChange?.()
  }

  setPanelWidth(w: number): void {
    this.panelWidth = Math.max(0, w)
    this.onLayoutChange?.()
  }

  /** Called by TabManager whenever chrome/panel dimensions change. */
  onLayoutChange: (() => void) | null = null
}

export { DRAG_ZONE_HEIGHT, CHROME_HEIGHT }
