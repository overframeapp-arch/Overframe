import { useEffect, useRef, useState } from 'react'
import { useAppStore } from './store/appStore'
import { TabBar } from './components/TabBar'
import { AddressBar } from './components/AddressBar'
import { CollectionBar } from './components/CollectionBar'
import { PinnedBar } from './components/PinnedBar'
import { Toast } from './components/Toast'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { WelcomePage } from './components/WelcomePage'
import { MissionsTracker } from './components/MissionsTracker'
import { MissionsPanel } from './components/MissionsPanel'
import { notify } from './lib/notify'
import type { ToastPayload } from './components/Toast'

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
    setOverlayState,
    isFocusMode,
    setFocusMode,
    missionsPanelOpen,
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
    const offAutoDetect = window.aether.on.profileAutoDetected(({ profile, isNew }) => {
      toastKeyRef.current += 1
      setToastPayload({ profile, isNew, key: toastKeyRef.current })
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

    return () => {
      offTab()
      offRemove()
      offActive()
      offProfile()
      offAutoDetect()
      offState()
      offPopup()
      offDownload()
      offSettings()
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
  ])

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
  // Skipped when focus mode is active (main process already received 0).
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

  // Toast for auto-detected profile switches
  const [toastPayload, setToastPayload] = useState<ToastPayload | null>(null)
  const toastKeyRef = useRef(0)

  return (
    <div className="flex flex-col h-screen w-screen bg-background/90 backdrop-blur-md rounded-md overflow-hidden border border-border">
      <div ref={chromeRef}>
        <TabBar />
        <AddressBar />
        <CollectionBar />
        <PinnedBar />
      </div>

      {/* Auto-detection toast */}
      <Toast payload={toastPayload} />

      {/* Achievement notifications — rendered here so they appear above the WebContentsView */}
      <MissionsTracker />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 relative min-w-0">
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
  )
}
