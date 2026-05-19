import { WebContentsView, app, session, Menu, MenuItem, clipboard } from 'electron'
import { randomUUID } from 'node:crypto'
import type { TabState, MemoryEntry, MemorySnapshot, DownloadEvent, DownloadEventState, SearchEngineId } from '@shared/types'
import { DEFAULT_HOMEPAGE, SEARCH_ENGINES } from '@shared/types'
import { store } from '../store'
import type { OverlayWindow } from '../windows/OverlayWindow'
import { SCROLLBAR_CSS, SCROLLBAR_JS } from './tabs/scrollbar'
import {
  POPUP_DEDUP_EVICT_THRESHOLD,
  POPUP_DEDUP_MAX_AGE_MS,
  POPUP_DEDUP_WINDOW_MS,
  type ManagedTab,
  type TabEvent,
} from './tabs/types'

export type { TabEvent } from './tabs/types'

export class TabManager {
  private tabs = new Map<string, ManagedTab>()
  private displayOrder: string[] = []
  private activeTabId: string | null = null
  private listeners = new Set<(e: TabEvent) => void>()
  private recentPopups = new Map<string, number>()
  private stoppedDuringHide = new Set<string>()
  private unloadedUrls = new Map<string, string>()
  private tabSession: Electron.Session
  /** True while in CLICK_THROUGH state — used to suppress hover in tab webpages. */
  private isClickThrough = false

  constructor(private overlay: OverlayWindow) {
    // Dedicated persistent session for browser tabs.
    // Isolated from defaultSession (used by the overlay BrowserWindow + CSP hook)
    // so tab traffic never touches our chrome-layer webRequest interceptors.
    // "persist:" prefix means cookies / localStorage / cache survive restarts.
    this.tabSession = session.fromPartition('persist:browser')

    // Strip "Electron/x.x.x" from the UA — sites detect it and behave differently
    // (Discord shows a compatibility banner, some CDNs return different assets).
    const chromeVer = process.versions.chrome
    this.tabSession.setUserAgent(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
    )

    // Permission prompts cannot appear in a frameless overlay — without handlers
    // the requests hang forever and block page initialisation (Discord, Ko-fi…).
    // setPermissionRequestHandler  → async prompt (e.g. Notification.requestPermission())
    // setPermissionCheckHandler    → sync query (navigator.permissions.query()) — equally critical.
    const GRANTED_PERMISSIONS = new Set([
      'notifications', 'fullscreen', 'pointerLock',
      'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write',
      'mediaKeySystem', 'background-sync', 'persistent-storage',
    ])
    this.tabSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(GRANTED_PERMISSIONS.has(permission))
    })
    this.tabSession.setPermissionCheckHandler((_wc, permission) => {
      return GRANTED_PERMISSIONS.has(permission)
    })

    // Suppress :hover / pointer effects in tab pages while in CT mode so
    // the user doesn't see hover UI (YouTube controls, etc.) bleed through.
    this.overlay.onStateChange((state) => {
      const entering = state === 'CLICK_THROUGH'
      if (entering === this.isClickThrough) return
      this.isClickThrough = entering
      for (const tab of this.tabs.values()) {
        this.applyClickThroughCSS(tab.view.webContents, entering)
      }
    })

    // Wire download tracking at session level (covers all tabs)
    this.tabSession.on('will-download', (_event, item) => {
      const id = randomUUID()
      const filename = item.getFilename()
      const url = item.getURL()
      this.emit({
        type: 'download',
        event: { id, filename, url, receivedBytes: 0, totalBytes: item.getTotalBytes(), state: 'started' },
      })
      item.on('updated', (_e, state) => {
        this.emit({
          type: 'download',
          event: {
            id, filename, url,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes(),
            state: state as DownloadEventState,
          },
        })
      })
      item.on('done', (_e, state) => {
        this.emit({
          type: 'download',
          event: {
            id, filename, url,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes(),
            state: state as DownloadEventState,
          },
        })
      })
    })
  }

  on(cb: (e: TabEvent) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private emit(e: TabEvent): void {
    for (const cb of this.listeners) cb(e)
  }

  /** Inject or remove a <style> that blocks pointer events in a tab page during CT mode. */
  private applyClickThroughCSS(wc: Electron.WebContents, enable: boolean): void {
    if (wc.isDestroyed()) return
    const js = enable
      ? `if(!document.getElementById('__of_ct')){const s=document.createElement('style');s.id='__of_ct';s.textContent='html,html *{pointer-events:none!important}';(document.head??document.documentElement).appendChild(s)}`
      : `document.getElementById('__of_ct')?.remove()`
    void wc.executeJavaScript(js).catch(() => {})
  }

  getAll(): TabState[] {
    return this.getOrderedIds().map((id) => this.tabs.get(id)!.state)
  }

  getOrderedIds(): string[] {
    if (this.displayOrder.length > 0) {
      return this.displayOrder.filter((id) => this.tabs.has(id))
    }
    return Array.from(this.tabs.keys())
  }

  reorder(ids: string[]): void {
    this.displayOrder = ids.filter((id) => this.tabs.has(id))
  }

  getMemoryUsage(): MemoryEntry[] {
    return this.getMemorySnapshot().tabs
  }

  getMemorySnapshot(): MemorySnapshot {
    const metrics = app.getAppMetrics()
    const tabPids = new Set<number>()
    const tabs = Array.from(this.tabs.entries()).map(([id, tab]) => {
      const pid = tab.view.webContents.getOSProcessId()
      tabPids.add(pid)
      const metric = metrics.find((m) => m.pid === pid)
      const privateKb = metric?.memory.privateBytes ?? metric?.memory.workingSetSize ?? 0
      return { tabId: id, privateKb }
    })
    const appKb = metrics
      .filter((m) => !tabPids.has(m.pid))
      .reduce((sum, m) => sum + (m.memory.privateBytes ?? m.memory.workingSetSize ?? 0), 0)
    return { tabs, appKb }
  }

  getActiveId(): string | null {
    return this.activeTabId
  }

  create(url: string): TabState {
    const id = randomUUID()
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false,
        session: this.tabSession,
      },
    })
    // Prevent flash of white before the page paints its first frame.
    view.setBackgroundColor('#141414')

    const isHomepage = url === DEFAULT_HOMEPAGE || url === DEFAULT_HOMEPAGE + '/'
    const initialState: TabState = {
      id,
      url,
      title: isHomepage ? 'New tab' : '',
      favicon: null,
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      zoomFactor: 1,
      isAudioPlaying: false,
      isMuted: false,
    }
    const tab: ManagedTab = { id, view, state: initialState }
    this.tabs.set(id, tab)
    this.displayOrder.push(id)

    this.wireWebContents(tab)

    void view.webContents.loadURL(url).catch(() => {
      /* surfaced via did-fail-load */
    })
    this.setActive(id)

    return initialState
  }

  close(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    this.overlay.detachView(tab.view)
    try {
      tab.view.webContents.close()
    } catch {
      /* may already be destroyed */
    }

    let successor: string | null = null
    if (this.activeTabId === id) {
      const order = this.displayOrder
      const idx = order.indexOf(id)
      successor = order[idx + 1] ?? order[idx - 1] ?? null
    }

    this.tabs.delete(id)
    this.displayOrder = this.displayOrder.filter((x) => x !== id)
    this.emit({ type: 'removed', id })

    if (this.activeTabId === id) {
      if (successor && this.tabs.has(successor)) {
        this.setActive(successor)
      } else {
        this.activeTabId = null
        this.emit({ type: 'activeChanged', id: null })
      }
    }
  }

  closeAll(): void {
    const ids = Array.from(this.tabs.keys())
    for (const id of ids) {
      const tab = this.tabs.get(id)
      if (!tab) continue
      this.overlay.detachView(tab.view)
      try {
        tab.view.webContents.close()
      } catch {
        /* already destroyed */
      }
      this.tabs.delete(id)
      this.emit({ type: 'removed', id })
    }
    this.displayOrder = []
    this.activeTabId = null
    this.emit({ type: 'activeChanged', id: null })
    this.stoppedDuringHide.clear()
    this.unloadedUrls.clear()
  }

  setActive(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    for (const other of this.tabs.values()) {
      if (other.id !== id) this.overlay.detachView(other.view)
    }
    this.overlay.attachView(tab.view)
    this.overlay.layoutView(tab.view)

    this.activeTabId = id
    this.emit({ type: 'activeChanged', id })
    setImmediate(() => {
      if (this.activeTabId === id && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.focus()
      }
    })
  }

  deactivate(): void {
    if (this.activeTabId === null) return
    const tab = this.tabs.get(this.activeTabId)
    if (tab) this.overlay.detachView(tab.view)
    this.activeTabId = null
    this.emit({ type: 'activeChanged', id: null })
  }

  navigate(id: string, url: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    void tab.view.webContents.loadURL(url).catch(() => {
      /* surfaced via did-fail-load */
    })
  }

  goBack(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    if (tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  goForward(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    if (tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  reload(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    tab.view.webContents.reload()
  }

  relayoutActive(): void {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null
    if (tab) this.overlay.layoutView(tab.view)
  }

  /**
   * Mute audio + stop any in-flight loads when the overlay is hidden so the
   * underlying game is not disturbed.
   */
  suspendAll(): void {
    this.stoppedDuringHide.clear()
    for (const tab of this.tabs.values()) {
      try {
        const wc = tab.view.webContents
        if (wc.isDestroyed()) continue
        wc.setAudioMuted(true)
        if (wc.isLoading()) {
          wc.stop()
          this.stoppedDuringHide.add(tab.id)
        }
      } catch {
        /* destroyed mid-iteration */
      }
    }
  }

  /**
   * Performance mode: navigate every tab to about:blank so the renderer
   * processes can be reaped. resumeAll() reloads from saved URLs.
   */
  unloadAll(): void {
    this.stoppedDuringHide.clear()
    this.unloadedUrls.clear()
    for (const tab of this.tabs.values()) {
      try {
        const wc = tab.view.webContents
        if (wc.isDestroyed()) continue
        wc.setAudioMuted(true)
        const url = tab.state.url
        if (url && url !== 'about:blank') {
          this.unloadedUrls.set(tab.id, url)
          void wc.loadURL('about:blank').catch(() => {
            /* unload best-effort */
          })
        }
      } catch {
        /* destroyed mid-iteration */
      }
    }
  }

  resumeAll(): void {
    for (const tab of this.tabs.values()) {
      try {
        const wc = tab.view.webContents
        if (wc.isDestroyed()) continue
        wc.setAudioMuted(tab.state.isMuted ?? false)
        const unloadedUrl = this.unloadedUrls.get(tab.id)
        if (unloadedUrl) {
          tab.state = { ...tab.state, url: unloadedUrl }
          this.emit({ type: 'updated', tab: tab.state })
          void wc.loadURL(unloadedUrl).catch(() => {
            /* surfaced via did-fail-load */
          })
          this.unloadedUrls.delete(tab.id)
        } else if (this.stoppedDuringHide.has(tab.id)) {
          wc.reload()
        }
      } catch {
        /* destroyed mid-iteration */
      }
    }
    this.stoppedDuringHide.clear()
  }

  private wireWebContents(tab: ManagedTab): void {
    const wc = tab.view.webContents
    const update = (patch: Partial<TabState>): void => {
      if (!this.tabs.has(tab.id)) return
      tab.state = { ...tab.state, ...patch }
      this.emit({ type: 'updated', tab: tab.state })
    }

    /**
     * Use Electron's before-input-event for Ctrl+W (layout-aware logical key)
     * and to swallow Alt+Left/Right so uiohook stays the sole nav handler.
     */
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      // Ctrl+W — close tab
      if (input.control && !input.shift && !input.alt && input.key.toLowerCase() === 'w') {
        event.preventDefault()
        if (this.tabs.has(tab.id)) this.close(tab.id)
        return
      }
      // Ctrl+= / Ctrl++ — zoom in
      if (input.control && !input.shift && !input.alt && (input.key === '=' || input.key === '+')) {
        event.preventDefault()
        const next = Math.min(5, Math.round((wc.getZoomFactor() + 0.1) * 10) / 10)
        wc.setZoomFactor(next)
        update({ zoomFactor: next })
        return
      }
      // Ctrl+- — zoom out
      if (input.control && !input.shift && !input.alt && input.key === '-') {
        event.preventDefault()
        const next = Math.max(0.25, Math.round((wc.getZoomFactor() - 0.1) * 10) / 10)
        wc.setZoomFactor(next)
        update({ zoomFactor: next })
        return
      }
      // Ctrl+0 — reset zoom
      if (input.control && !input.shift && !input.alt && input.key === '0') {
        event.preventDefault()
        wc.setZoomFactor(1)
        update({ zoomFactor: 1 })
        return
      }
      if (input.alt && !input.control && !input.shift) {
        if (input.code === 'ArrowLeft' || input.code === 'ArrowRight') {
          event.preventDefault()
        }
      }
    })

    wc.on('did-start-loading', () => update({ isLoading: true }))
    wc.on('did-fail-load', (_e, errorCode, _desc, validatedURL, isMainFrame) => {
      // ERR_ABORTED (-3) = intentional stop (e.g. suspendAll); not a real failure.
      if (!isMainFrame || errorCode === -3) return
      update({ isLoading: false, url: validatedURL || tab.state.url })
    })
    wc.on('dom-ready', () => {
      void wc.insertCSS(SCROLLBAR_CSS).catch(() => {
        /* page may be navigating away */
      })
      void wc.executeJavaScript(SCROLLBAR_JS).catch(() => {
        /* page may be navigating away */
      })
      // Re-apply CT suppression after navigation (the injected <style> is lost on nav).
      if (this.isClickThrough) this.applyClickThroughCSS(wc, true)
    })
    wc.on('did-stop-loading', () =>
      update({
        isLoading: false,
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward(),
      }),
    )
    wc.on('did-navigate', (_e, url) => update({ url }))
    wc.on('did-navigate-in-page', (_e, url) => update({ url }))
    wc.on('page-title-updated', (_e, title) => {
      const currentUrl = tab.state.url
      const isHomepage = currentUrl === DEFAULT_HOMEPAGE || currentUrl === DEFAULT_HOMEPAGE + '/'
      update({ title: isHomepage ? 'New tab' : title })
    })
    wc.on('page-favicon-updated', (_e, favicons) => {
      update({ favicon: favicons[0] ?? null })
    })

    // Audio state tracking
    wc.on('media-started-playing', () => update({ isAudioPlaying: true }))
    wc.on('media-paused', () => update({ isAudioPlaying: false }))

    // Zoom via pinch / Ctrl+scroll gesture
    wc.on('zoom-changed', (_e, direction) => {
      const step = 0.1
      const next = direction === 'in'
        ? Math.min(5, Math.round((wc.getZoomFactor() + step) * 10) / 10)
        : Math.max(0.25, Math.round((wc.getZoomFactor() - step) * 10) / 10)
      wc.setZoomFactor(next)
      update({ zoomFactor: next })
    })

    wc.on('will-navigate', (event, url) => {
      try {
        const proto = new URL(url).protocol
        if (proto !== 'http:' && proto !== 'https:') event.preventDefault()
      } catch {
        event.preventDefault()
      }
    })

    wc.setWindowOpenHandler(({ url }) => {
      if (wc.isDestroyed() || !this.tabs.has(tab.id)) return { action: 'deny' }
      try {
        const proto = new URL(url).protocol
        if (proto === 'http:' || proto === 'https:') {
          this.handlePopup(url)
        }
      } catch {
        /* malformed URL */
      }
      return { action: 'deny' }
    })

    wc.on('context-menu', (_e, params) => {
      const menu = new Menu()
      const addSep = (): void => {
        const items = menu.items
        if (items.length > 0 && items[items.length - 1].type !== 'separator') {
          menu.append(new MenuItem({ type: 'separator' }))
        }
      }

      // Edit operations for editable fields
      if (params.isEditable) {
        if (params.editFlags.canUndo) menu.append(new MenuItem({ role: 'undo' }))
        if (params.editFlags.canRedo) menu.append(new MenuItem({ role: 'redo' }))
        if (params.editFlags.canCut || params.editFlags.canCopy || params.editFlags.canPaste) {
          addSep()
          if (params.editFlags.canCut) menu.append(new MenuItem({ role: 'cut' }))
          if (params.editFlags.canCopy) menu.append(new MenuItem({ role: 'copy' }))
          if (params.editFlags.canPaste) menu.append(new MenuItem({ role: 'paste' }))
        }
        if (params.editFlags.canSelectAll) {
          addSep()
          menu.append(new MenuItem({ role: 'selectAll' }))
        }
      } else if (params.selectionText) {
        menu.append(new MenuItem({ role: 'copy' }))
      }

      // Search selected text
      if (params.selectionText.trim()) {
        addSep()
        const text = params.selectionText
        const preview = text.length > 20 ? text.slice(0, 20) + '\u2026' : text
        const engineId = (store.get('settings')?.searchEngine ?? 'google') as SearchEngineId
        const baseUrl = SEARCH_ENGINES[engineId]?.url ?? SEARCH_ENGINES.google.url
        menu.append(new MenuItem({
          label: `Search "${preview}"`,
          click: () => { this.create(baseUrl + encodeURIComponent(text)) },
        }))
      }

      // Link actions
      if (params.linkURL) {
        try {
          const proto = new URL(params.linkURL).protocol
          if (proto === 'http:' || proto === 'https:') {
            addSep()
            menu.append(new MenuItem({ label: 'Open in new tab', click: () => { this.create(params.linkURL) } }))
            menu.append(new MenuItem({ label: 'Copy link address', click: () => { clipboard.writeText(params.linkURL) } }))
          }
        } catch { /* malformed URL */ }
      }

      // Navigation (always visible)
      addSep()
      if (wc.navigationHistory.canGoBack()) menu.append(new MenuItem({ label: 'Back', click: () => wc.navigationHistory.goBack() }))
      if (wc.navigationHistory.canGoForward()) menu.append(new MenuItem({ label: 'Forward', click: () => wc.navigationHistory.goForward() }))
      menu.append(new MenuItem({ label: 'Reload', click: () => wc.reload() }))

      menu.popup({ window: this.overlay.win })
    })
  }

  private handlePopup(url: string): void {
    const now = Date.now()
    const last = this.recentPopups.get(url) ?? 0
    if (now - last <= POPUP_DEDUP_WINDOW_MS) return
    this.recentPopups.set(url, now)
    if (this.recentPopups.size > POPUP_DEDUP_EVICT_THRESHOLD) {
      const cutoff = now - POPUP_DEDUP_MAX_AGE_MS
      for (const [u, t] of this.recentPopups) {
        if (t < cutoff) this.recentPopups.delete(u)
      }
    }
    this.create(url)
  }

  setZoom(id: string, factor: number): void {
    const tab = this.tabs.get(id)
    if (!tab || tab.view.webContents.isDestroyed()) return
    const clamped = Math.max(0.25, Math.min(5, factor))
    tab.view.webContents.setZoomFactor(clamped)
    tab.state = { ...tab.state, zoomFactor: clamped }
    this.emit({ type: 'updated', tab: tab.state })
  }

  setMuted(id: string, muted: boolean): void {
    const tab = this.tabs.get(id)
    if (!tab || tab.view.webContents.isDestroyed()) return
    tab.view.webContents.setAudioMuted(muted)
    tab.state = { ...tab.state, isMuted: muted }
    this.emit({ type: 'updated', tab: tab.state })
  }

}
