import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory electron-store: constructor seeds from `defaults`, get/set are plain.
vi.mock('electron-store', () => {
  class StoreMock {
    private data: Record<string, unknown>
    constructor(opts: { defaults?: Record<string, unknown> }) {
      this.data = { ...(opts.defaults ?? {}) }
    }
    get(key: string): unknown { return this.data[key] }
    set(key: string, val: unknown): void { this.data[key] = val }
  }
  return { default: StoreMock }
})

import { store, migrateStore, getStorePath } from './index'
import { DEFAULT_SHORTCUTS, DEFAULT_PROFILE_ID, type Settings } from '@shared/types'

type Raw = Record<string, unknown>

beforeEach(() => {
  // Restore canonical settings before each migration test.
  store.set('settings', {
    shortcuts: { ...DEFAULT_SHORTCUTS },
    startWithWindows: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    hasCompletedOnboarding: false,
    showMemoryUsage: false,
  } satisfies Settings)
})

describe('store defaults', () => {
  it('seeds the default profile and shortcuts', () => {
    const profiles = store.get('profiles') as Array<{ id: string }>
    expect(profiles[0].id).toBe(DEFAULT_PROFILE_ID)
    expect((store.get('settings') as Settings).shortcuts.toggleOverlay).toBe('Alt+B')
  })

  it('getStorePath ends with aether-store.json', () => {
    expect(getStorePath()).toMatch(/aether-store\.json$/)
  })
})

describe('migrateStore — legacy hotkey → shortcuts', () => {
  it('migrates a full legacy settings object', () => {
    store.set('settings', {
      hotkey: 'Alt+X',
      clickThroughHotkey: 'Alt+Y',
      startWithWindows: false,
      activeProfileId: 'p9',
      hasCompletedOnboarding: true,
      showMemoryUsage: true,
    } as unknown as Settings)

    migrateStore()

    const s = store.get('settings') as Settings
    expect(s.shortcuts.toggleOverlay).toBe('Alt+X')
    expect(s.shortcuts.clickThrough).toBe('Alt+Y')
    expect(s.startWithWindows).toBe(false)
    expect(s.activeProfileId).toBe('p9')
    expect(s.hasCompletedOnboarding).toBe(true)
    expect(s.showMemoryUsage).toBe(true)
  })

  it('migrates when only the legacy click-through hotkey is present', () => {
    store.set('settings', { clickThroughHotkey: 'Alt+Y' } as unknown as Settings)

    migrateStore()

    const s = store.get('settings') as Settings
    expect(s.shortcuts.clickThrough).toBe('Alt+Y')
    expect(s.shortcuts.toggleOverlay).toBe(DEFAULT_SHORTCUTS.toggleOverlay)
  })

  it('applies safe fallbacks for a minimal legacy object', () => {
    store.set('settings', { hotkey: 'Alt+Z' } as unknown as Settings)

    migrateStore()

    const s = store.get('settings') as Settings
    expect(s.shortcuts.toggleOverlay).toBe('Alt+Z')
    expect(s.shortcuts.clickThrough).toBe(DEFAULT_SHORTCUTS.clickThrough)
    expect(s.startWithWindows).toBe(true)
    expect(s.activeProfileId).toBe(DEFAULT_PROFILE_ID)
    expect(s.hasCompletedOnboarding).toBe(false)
    expect(s.showMemoryUsage).toBe(false)
  })
})

describe('migrateStore — shortcut normalisation', () => {
  it('forces canonical nextTab/prevTab and restores nulled nav shortcuts', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS, nextTab: 'Weird', navBack: null, navForward: null },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
    } as unknown as Settings)

    migrateStore()

    const s = store.get('settings') as Settings
    expect(s.shortcuts.nextTab).toBe('Ctrl+PageUp')
    expect(s.shortcuts.prevTab).toBe('Ctrl+PageDown')
    expect(s.shortcuts.navBack).toBe('Alt+Left')
    expect(s.shortcuts.navForward).toBe('Alt+Right')
  })

  it('is a no-op when shortcuts already match the canonical set', () => {
    const before = store.get('settings') as Settings
    migrateStore()
    expect(store.get('settings')).toEqual(before)
  })

  it('skips normalisation entirely when settings has no shortcuts', () => {
    store.set('settings', { startWithWindows: true } as unknown as Settings)
    expect(() => migrateStore()).not.toThrow()
    expect((store.get('settings') as unknown as Raw).shortcuts).toBeUndefined()
  })
})
