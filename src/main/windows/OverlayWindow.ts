import {
  BrowserWindow,
  screen,
  app,
  WebContentsView
} from 'electron'
import path from 'node:path'
import {
  OverlayState,
  WindowBounds,
  DRAG_ZONE_HEIGHT,
  CHROME_HEIGHT,
} from '@shared/types'

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
      minHeight: 120,
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
    if (!this.everShown) {
      this.everShown = true
      // Fire one-shot "first show" callbacks and release them
      for (const cb of this.firstShowListeners) cb()
      this.firstShowListeners.clear()
    }
    // Re-assert always-on-top in case the OS demoted us while hidden,
    // then bring the window to foreground and steal keyboard focus.
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.win.show()
    this.win.moveTop()
    if (restoreClickThrough) {
      // Restore click-through without stealing keyboard focus from the game.
      this.applyClickThrough(true)
      this.setState('CLICK_THROUGH')
    } else {
      app.focus({ steal: true })
      if (this.state !== 'FOCUSED') {
        this.setState('FOCUSED')
      }
    }
  }

  hide(): void {
    if (this.state === 'HIDDEN') return
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
      this.win.setBounds(this.savedBounds)
      this.savedBounds = null
    } else {
      this.savedBounds = this.getBounds()
      const display = screen.getDisplayMatching(this.win.getBounds())
      const wa = display.workArea
      this.win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height })
    }
  }

  isMaximized(): boolean {
    return this.savedBounds !== null
  }

  /** Restore from custom-maximized state and return the restored bounds (or null if not maximized). */
  unmaximize(): WindowBounds | null {
    if (!this.savedBounds) return null
    const bounds = { ...this.savedBounds }
    this.win.setBounds(this.savedBounds)
    this.savedBounds = null
    return bounds
  }

  /** Move the window top-left corner to (x, y) in screen coordinates. */
  setPositionXY(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    this.win.setPosition(Math.round(x), Math.round(y))
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
    const width = Math.min(Math.max(bounds.width, 400), wa.width)
    const height = Math.min(Math.max(bounds.height, 300), wa.height)
    const x = Math.min(Math.max(bounds.x, wa.x), wa.x + wa.width - width)
    const y = Math.min(Math.max(bounds.y, wa.y), wa.y + wa.height - height)
    return { x, y, width, height }
  }

  // ─────────────────────────────────────────────────────────────────────
  //  WebContentsView management (tabs)
  // ─────────────────────────────────────────────────────────────────────

  attachView(view: WebContentsView): void {
    this.win.contentView.addChildView(view)
    this.layoutView(view)
  }

  detachView(view: WebContentsView): void {
    try {
      this.win.contentView.removeChildView(view)
    } catch {
      // already removed
    }
  }

  layoutView(view: WebContentsView): void {
    const { width, height } = this.win.getContentBounds()
    const SIDE   = 1
    const TOP    = 1
    const BOTTOM = 1
    view.setBounds({
      x: SIDE,
      y: this.chromeHeight + TOP,
      width: Math.max(0, width - this.panelWidth - SIDE * 2),
      height: Math.max(0, height - this.chromeHeight - TOP - BOTTOM)
    })
  }

  setChromeHeight(h: number): void {
    this.chromeHeight = Math.max(0, h)
    const views = this.win.contentView.children as WebContentsView[]
    for (const v of views) this.layoutView(v)
  }

  setPanelWidth(w: number): void {
    this.panelWidth = Math.max(0, w)
    // Re-layout all active views
    const views = this.win.contentView.children as WebContentsView[]
    for (const v of views) this.layoutView(v)
  }

  layoutAllViews(views: WebContentsView[]): void {
    for (const view of views) this.layoutView(view)
  }
}

export { DRAG_ZONE_HEIGHT, CHROME_HEIGHT }
