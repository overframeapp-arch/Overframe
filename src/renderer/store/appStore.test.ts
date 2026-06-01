import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import type { Profile, Settings, TabState } from '@shared/types'

function tab(id: string, over: Partial<TabState> = {}): TabState {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    favicon: null,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    zoomFactor: 1,
    isAudioPlaying: false,
    isMuted: false,
    ...over,
  }
}

function profile(id: string): Profile {
  return {
    id,
    name: id,
    processNames: [],
    priority: 0,
    homepageUrl: 'https://example.com',
    opacity: 1,
    windowBounds: { x: 0, y: 0, width: 800, height: 600 },
  }
}

const pristine = useAppStore.getState()

beforeEach(() => {
  // Reset to initial values (keep the action fns) before each test.
  useAppStore.setState({
    tabs: [],
    activeTabId: null,
    overlayState: 'HIDDEN',
    activeProfile: null,
    profiles: [],
    collections: [],
    settings: null,
    isFocusMode: false,
    missionsPanelOpen: false,
  })
})

describe('appStore — tabs', () => {
  it('setTabs replaces the list and active id', () => {
    pristine.setTabs([tab('a'), tab('b')], 'b')
    expect(useAppStore.getState().tabs.map((t) => t.id)).toEqual(['a', 'b'])
    expect(useAppStore.getState().activeTabId).toBe('b')
  })

  it('upsertTab appends a new tab', () => {
    pristine.upsertTab(tab('a'))
    expect(useAppStore.getState().tabs).toHaveLength(1)
  })

  it('upsertTab updates an existing tab in place', () => {
    pristine.setTabs([tab('a', { title: 'old' })], 'a')
    pristine.upsertTab(tab('a', { title: 'new' }))
    const { tabs } = useAppStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toBe('new')
  })

  it('removeTab drops the tab and clears active id when it was active', () => {
    pristine.setTabs([tab('a'), tab('b')], 'a')
    pristine.removeTab('a')
    expect(useAppStore.getState().tabs.map((t) => t.id)).toEqual(['b'])
    expect(useAppStore.getState().activeTabId).toBeNull()
  })

  it('removeTab keeps active id when a different tab is removed', () => {
    pristine.setTabs([tab('a'), tab('b')], 'a')
    pristine.removeTab('b')
    expect(useAppStore.getState().activeTabId).toBe('a')
  })

  it('setActiveTab sets the active id', () => {
    pristine.setActiveTab('z')
    expect(useAppStore.getState().activeTabId).toBe('z')
  })
})

describe('appStore — overlay / profile / collections / settings', () => {
  it('setOverlayState updates overlay state', () => {
    pristine.setOverlayState('FOCUSED')
    expect(useAppStore.getState().overlayState).toBe('FOCUSED')
  })

  it('setActiveProfile and setProfiles', () => {
    pristine.setProfiles([profile('p1'), profile('p2')])
    pristine.setActiveProfile(profile('p1'))
    expect(useAppStore.getState().profiles).toHaveLength(2)
    expect(useAppStore.getState().activeProfile?.id).toBe('p1')
  })

  it('setCollections replaces collections', () => {
    pristine.setCollections([])
    expect(useAppStore.getState().collections).toEqual([])
  })

  it('setSettings stores settings', () => {
    const s = { shortcuts: {}, startWithWindows: true, activeProfileId: 'default', hasCompletedOnboarding: false, showMemoryUsage: false } as unknown as Settings
    pristine.setSettings(s)
    expect(useAppStore.getState().settings).toBe(s)
  })
})

describe('appStore — UI flags', () => {
  it('setFocusMode toggles focus mode', () => {
    pristine.setFocusMode(true)
    expect(useAppStore.getState().isFocusMode).toBe(true)
  })

  it('toggleMissionsPanel flips the panel flag', () => {
    expect(useAppStore.getState().missionsPanelOpen).toBe(false)
    pristine.toggleMissionsPanel()
    expect(useAppStore.getState().missionsPanelOpen).toBe(true)
    pristine.toggleMissionsPanel()
    expect(useAppStore.getState().missionsPanelOpen).toBe(false)
  })
})
