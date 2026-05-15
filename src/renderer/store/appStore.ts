import { create } from 'zustand'
import type {
  Collection,
  OverlayState,
  Profile,
  Settings,
  TabState
} from '@shared/types'

export type PanelId = 'collections' | 'settings' | 'memory' | 'profiles' | null

interface AppState {
  // Tabs
  tabs: TabState[]
  activeTabId: string | null
  setTabs: (tabs: TabState[], activeId: string | null) => void
  upsertTab: (tab: TabState) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string | null) => void

  // Overlay state
  overlayState: OverlayState
  setOverlayState: (s: OverlayState) => void

  // Profile
  activeProfile: Profile | null
  profiles: Profile[]
  setActiveProfile: (p: Profile) => void
  setProfiles: (ps: Profile[]) => void

  // Collections
  collections: Collection[]
  setCollections: (cs: Collection[]) => void

  // Settings
  settings: Settings | null
  setSettings: (s: Settings) => void

  // UI
  /** When true, the browser chrome (tab/address/collection bars) is hidden and
   *  only revealed on hover over the top sentinel zone. */
  isFocusMode: boolean
  setFocusMode: (v: boolean) => void

  missionsPanelOpen: boolean
  toggleMissionsPanel: () => void
}

export const useAppStore = create<AppState>((set) => ({
  tabs: [],
  activeTabId: null,
  setTabs: (tabs, activeId) => set({ tabs, activeTabId: activeId }),
  upsertTab: (tab) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === tab.id)
      if (idx === -1) return { tabs: [...state.tabs, tab] }
      const next = state.tabs.slice()
      next[idx] = tab
      return { tabs: next }
    }),
  removeTab: (id) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id !== id),
      activeTabId: state.activeTabId === id ? null : state.activeTabId
    })),
  setActiveTab: (id) => set({ activeTabId: id }),

  overlayState: 'HIDDEN',
  setOverlayState: (s) => set({ overlayState: s }),

  activeProfile: null,
  profiles: [],
  setActiveProfile: (p) => set({ activeProfile: p }),
  setProfiles: (ps) => set({ profiles: ps }),

  collections: [],
  setCollections: (cs) => set({ collections: cs }),

  settings: null,
  setSettings: (s) => set({ settings: s }),

  isFocusMode: false,
  setFocusMode: (v) => set({ isFocusMode: v }),

  missionsPanelOpen: false,
  toggleMissionsPanel: () => set((s) => ({ missionsPanelOpen: !s.missionsPanelOpen })),
}))
