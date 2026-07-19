import { useEffect, useRef } from 'react'
import { useAppStore } from './store/appStore'
import { TabBar } from './components/TabBar'
import { AddressBar } from './components/AddressBar'
import { CollectionBar } from './components/CollectionBar'
import { PinnedBar } from './components/PinnedBar'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { WelcomePage } from './components/WelcomePage'
import { MissionsTracker } from './components/MissionsTracker'
import { MissionsPanel } from './components/MissionsPanel'
import { IGNudge } from './components/IGNudge'
import { ResizeHandles } from './components/ResizeHandles'
import { getCatalogForProfile, localizeIGUrl } from '@shared/ig-affiliate'
import { DEFAULT_PROFILE_ID } from '@shared/types'
import { notify } from './lib/notify'
import { igPromoState } from './lib/igPromoState'

export function App(): JSX.Element {
  const {
    setSettings,
    setProfiles,
    setActiveProfile,
    setCollections,
    setTabs,
    upsertTab,
    removeTab,
    setActiveTab,
    activeProfile,
    overlayState,
    setOverlayState,
    isFocusMode,
    setFocusMode,
    isMaximized,
    setIsMaximized,
    missionsPanelOpen,
    setHomeTab,
  } = useAppStore()


  // Initial load
  useEffect(() => {
    void (async () => {
      const [settings, profiles, current, collections, tabsState, state] = await Promise.all([
        window.aether.settings.get(),
        window.aether.profiles.getAll(),
        window.aether.profiles.getCurrent(),
        window.aether.collections.getAll(),
        window.aether.tabs.getAll(),
        window.aether.overlay.getState()
      ])
      setSettings(settings)
      setProfiles(profiles)
      setActiveProfile(current)
      setCollections(collections)
      setTabs(tabsState.tabs, tabsState.activeId)
      setOverlayState(state)
    })()
  }, [
    setSettings,
    setProfiles,
    setActiveProfile,
    setCollections,
    setTabs,
    setOverlayState
  ])

  // Navigate to a Home tab when triggered from a popup (popup → main → here)
  useEffect(() => {
    return window.aether.on.navigateHome((tab) => {
      setHomeTab(tab as Parameters<typeof setHomeTab>[0])
      if (useAppStore.getState().activeTabId !== null) void window.aether.tabs.deactivate()
    })
  }, [setHomeTab])

  // Subscribe to events
  useEffect(() => {
    const offTab = window.aether.on.tabUpdated(upsertTab)
    const offRemove = window.aether.on.tabRemoved(removeTab)
    const offActive = window.aether.on.activeTabChanged(setActiveTab)
    const offProfile = window.aether.on.profileChanged((p) => {
      setActiveProfile(p)
      void window.aether.profiles.getAll().then(setProfiles).catch(console.error)
      void window.aether.collections.getAll().then(setCollections).catch(console.error)
    })
    const offState = window.aether.on.overlayStateChanged(setOverlayState)
    // Refresh collections after bookmark popup closes (save/remove/blur)
    const offPopup = window.aether.on.popupDone(() => {
      void window.aether.collections.getAll().then(setCollections).catch(console.error)
    })
    const offDownload = window.aether.on.downloadUpdate((ev) => {
      if (ev.state === 'completed') notify.success(`Downloaded: ${ev.filename}`)
      else if (ev.state === 'interrupted') notify.error(`Download failed: ${ev.filename}`)
    })
    const offSettings = window.aether.on.settingsChanged(setSettings)
    const offMaximized = window.aether.on.maximizedChanged(setIsMaximized)

    return () => {
      offTab()
      offRemove()
      offActive()
      offProfile()
      offState()
      offPopup()
      offDownload()
      offSettings()
      offMaximized()
    }
  }, [
    upsertTab,
    removeTab,
    setActiveTab,
    setActiveProfile,
    setProfiles,
    setCollections,
    setOverlayState,
    setSettings,
    setIsMaximized,
  ])

  // IG promo: show once per game-profile change, restore when user returns to a web tab.
  const prevPromoIdRef = useRef<string | null>(null)
  useEffect(() => {
    const id = activeProfile?.id ?? null
    if (id === prevPromoIdRef.current) return
    prevPromoIdRef.current = id

    window.aether.igPromo.close()
    igPromoState.reset()

    const entry = activeProfile && id !== DEFAULT_PROFILE_ID
      ? getCatalogForProfile(activeProfile.processNames, activeProfile.id, DEFAULT_PROFILE_ID, activeProfile.name)
      : null

    if (entry && useAppStore.getState().settings?.showIGPromo !== false) {
      const payload = { purchaseHint: entry.purchaseHint, browseUrl: localizeIGUrl(entry.browseUrl) }
      const t = setTimeout(() => {
        igPromoState.payload = payload
        if (useAppStore.getState().overlayState !== 'HIDDEN' && useAppStore.getState().activeTabId !== null) {
          void window.aether.igPromo.show(payload)
        }
        // If on Home, payload is stored — will show when user opens a web tab.
      }, 1500)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id])

  // Hide promo on Home, restore it only when coming back FROM Home (not on every tab switch).
  const activeTabId = useAppStore((s) => s.activeTabId)
  const prevActiveTabIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevActiveTabIdRef.current
    prevActiveTabIdRef.current = activeTabId
    if (activeTabId === null) {
      window.aether.igPromo.close()
    } else if (prev === null && igPromoState.payload && !igPromoState.dismissed
        && useAppStore.getState().settings?.showIGPromo !== false) {
      void window.aether.igPromo.show(igPromoState.payload)
    }
  }, [activeTabId])

  // Sync dismissed state from the popup renderer (separate V8 context) to this one.
  useEffect(() => window.aether.on.igPromoDismissed(() => igPromoState.dismiss()), [])

  // (Hiding the overlay no longer dismisses the promo here — the main process
  // retracts it on hide and restores it on show, so it survives an Alt+B cycle.)

  // Send the keyboard layout map to the main process so ShortcutManager can
  // resolve logical letters (e.g. 'Z') to physical keycodes correctly on
  // AZERTY and other non-QWERTY layouts.
  useEffect(() => {
    void (async () => {
      const map: Record<string, string> = {}
      const nav = navigator as Navigator & { keyboard?: { getLayoutMap: () => Promise<Map<string, string>> } }
      if (typeof nav.keyboard?.getLayoutMap === 'function') {
        const raw = await nav.keyboard.getLayoutMap()
        raw.forEach((value: string, key: string) => { map[key] = value })
      }
      window.aether.system.reportLayoutMap(map)
    })()
  }, [])

  // Keyboard shortcuts (renderer-only, require the overlay to have DOM focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey
      // Ctrl+T / Ctrl+W / Ctrl+Shift+F are handled by uiohook in main (WH_KEYBOARD_LL)
      // so they work in-game. Only Ctrl+L needs DOM focus and stays here.
      if (ctrlOrMeta && e.key === 'l') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('[data-address-input]')
        input?.focus()
        input?.select()
      }
      if (e.key === 'F12') {
        e.preventDefault()
        void window.aether.system.toggleDevTools()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Sync panel width whenever missions panel is toggled
  useEffect(() => {
    window.aether.overlay.setPanelWidth(missionsPanelOpen ? 320 : 0)
  }, [missionsPanelOpen])

  // Keep WebView2 bounds in sync with the CSS-computed bounds of its host div.
  // ResizeObserver fires after layout but before paint. Reading getBoundingClientRect()
  // here gives the exact pixel bounds Chromium has already committed for the next
  // frame, so WebView2 and the HTML panel update in the same vsync.
  const webViewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = webViewRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      window.aether.overlay.setWebViewBounds(
        Math.round(r.left), Math.round(r.top),
        Math.round(r.width), Math.round(r.height),
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Global shortcut Ctrl+Shift+F is registered in main process (works even when a game has focus).
  // Main sends EventToggleFocusMode → renderer toggles focus mode state.
  useEffect(() => {
    return window.aether.on.toggleFocusMode(() => {
      setFocusMode(!useAppStore.getState().isFocusMode)
    })
  // setFocusMode is stable (zustand)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the user presses an opacity shortcut, main emits EventOpacityChanged.
  // Update the active profile in Zustand directly so the settings slider reflects
  // the new value without waiting for the profile event chain.
  useEffect(() => {
    return window.aether.on.opacityChanged((opacity) => {
      const profile = useAppStore.getState().activeProfile
      if (profile) useAppStore.getState().setActiveProfile({ ...profile, opacity })
    })
  }, [])

  // ResizeObserver: auto-sync chrome height whenever the chrome DOM changes.
  // Skipped when focus mode is active (main process height is controlled by the effect above).
  const chromeRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = chromeRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (!useAppStore.getState().isFocusMode) {
        window.aether.overlay.setChromeHeight(Math.round(entry.contentRect.height))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // When focus mode toggles, immediately update the chrome height sent to main.
  useEffect(() => {
    if (isFocusMode) {
      window.aether.overlay.setChromeHeight(0)
    } else {
      const el = chromeRef.current
      if (el) window.aether.overlay.setChromeHeight(el.scrollHeight)
    }
  }, [isFocusMode])

  return (
    <div className="relative w-screen h-screen">
      {/* Outer shell: fills the full window but has no background.
          The 6px gap between this shell and the inner content div is transparent
          (shows the game/desktop behind the overlay) and acts as the invisible
          resize zone — no visual inset on the content itself. */}
      {/* Visible content: inset 6px from the window edge on all sides */}
      <div className={`absolute flex flex-col bg-background/90 backdrop-blur-md overflow-hidden ${isMaximized ? 'inset-0' : 'inset-[6px] rounded-md border border-border'}`}>
        {/* pointer-events-none in click-through: suppresses all hover/tooltip artefacts.
            Interactive elements (exit badge, hide button) override with pointer-events-auto
            and call setMouseInteractive so OS-level clicks reach them too. */}
        <div
          ref={chromeRef}
          className={[
            overlayState === 'CLICK_THROUGH' && 'pointer-events-none',
            isFocusMode && 'h-0 overflow-hidden',
          ].filter(Boolean).join(' ') || undefined}
        >
          <TabBar />
          <AddressBar />
          <CollectionBar />
          <PinnedBar />
          <IGNudge />
        </div>

        {/* Achievement notifications — rendered here so they appear above the WebContentsView */}
        <MissionsTracker />

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div ref={webViewRef} className="flex-1 relative min-w-0">
            <OnboardingOverlay />
            <WelcomePage />
          </div>
          {missionsPanelOpen && (
            <div className="w-[320px] flex-shrink-0 border-l border-border bg-background overflow-y-auto">
              <MissionsPanel />
            </div>
          )}
        </div>
      </div>

      {/* Resize handles sit in the outer shell, not the inner content */}
      <ResizeHandles />
    </div>
  )
}
