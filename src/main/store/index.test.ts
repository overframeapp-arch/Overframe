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
import { DEFAULT_SHORTCUTS, DEFAULT_PROFILE_ID, DEFAULT_HOMEPAGE, type Settings } from '@shared/types'

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
  // Default every test to "already seeded/deduped" so unrelated migrations don't
  // also trigger the one-time quickLinks steps — tests for those reset explicitly.
  store.set('quickLinksSeeded', true)
  store.set('quickLinksHomepageDeduped', true)
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

describe('migrateStore — quickLinks id backfill', () => {
  it('backfills a missing id on legacy quick links (pre-dates rename/reorder support)', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ name: 'PoE Trade', url: 'https://poe.trade' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks
    expect(links).toHaveLength(1)
    expect(typeof links?.[0].id).toBe('string')
    expect(links?.[0].id.length).toBeGreaterThan(0)
    expect(links?.[0].name).toBe('PoE Trade')
    expect(links?.[0].url).toBe('https://poe.trade')
  })

  it('preserves an existing id and description instead of generating a new one', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ id: 'kept-id', name: 'Wiki', url: 'https://wiki.tld', description: 'Game wiki' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks
    expect(links?.[0]).toEqual({ id: 'kept-id', name: 'Wiki', url: 'https://wiki.tld', description: 'Game wiki' })
  })

  it('assigns distinct ids to multiple legacy entries', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ name: 'A', url: 'https://a.tld' }, { name: 'B', url: 'https://b.tld' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links[0].id).not.toBe(links[1].id)
  })

  it('is a no-op when quickLinks is absent', () => {
    expect(() => migrateStore()).not.toThrow()
    expect((store.get('settings') as Settings).quickLinks).toBeUndefined()
  })

  it('survives a literally null entry in a corrupted store (regression: the map used to crash)', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [null, { id: 'ok', name: 'A', url: 'https://a.tld' }],
    } as unknown as Settings)

    expect(() => migrateStore()).not.toThrow()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links).toHaveLength(2)
    expect(typeof links[0].id).toBe('string')
    expect(links[0].name).toBe('')
    expect(links[0].url).toBe('')
    expect(links[1]).toEqual({ id: 'ok', name: 'A', url: 'https://a.tld' })
  })

  it('coerces malformed legacy entries while keeping valid ids and descriptions', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [
        { name: 'A', url: 'https://a.tld' },                          // missing id → triggers the backfill
        { id: 'kept-id', name: 42, url: null, description: 'kept' },  // non-string name/url coerced to ''
      ],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(typeof links[0].id).toBe('string')
    expect(links[0]).toMatchObject({ name: 'A', url: 'https://a.tld' })
    expect(links[1]).toEqual({ id: 'kept-id', name: '', url: '', description: 'kept' })
  })

  it('does not re-migrate (and does not change ids) once already migrated', () => {
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ id: 'stable-id', name: 'A', url: 'https://a.tld' }],
    } as unknown as Settings)

    migrateStore()
    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks
    expect(links?.[0].id).toBe('stable-id')
  })
})

describe('migrateStore — quickLinks seeding (YouTube/Twitch/Reddit → user-managed)', () => {
  it('seeds YouTube/Twitch/Reddit as regular quickLinks entries on first run — homepage excluded', () => {
    store.set('quickLinksSeeded', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      homepageUrl: 'https://www.google.com',
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.map((l) => l.name)).toEqual(['YouTube', 'Twitch', 'Reddit'])
    expect(links.map((l) => l.url)).toEqual([
      'https://www.youtube.com',
      'https://www.twitch.tv',
      'https://www.reddit.com',
    ])
    expect(new Set(links.map((l) => l.id)).size).toBe(3)
    expect(store.get('quickLinksSeeded')).toBe(true)
  })

  it('keeps existing custom links before the seeded defaults', () => {
    store.set('quickLinksSeeded', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ id: 'my-link', name: 'My Site', url: 'https://mysite.tld' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links).toHaveLength(4)
    expect(links[3]).toEqual({ id: 'my-link', name: 'My Site', url: 'https://mysite.tld' })
  })

  it('does not duplicate a built-in already present by URL', () => {
    store.set('quickLinksSeeded', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      quickLinks: [{ id: 'already-there', name: 'YT', url: 'https://www.youtube.com' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.filter((l) => l.url === 'https://www.youtube.com')).toHaveLength(1)
    expect(links.map((l) => l.name)).toEqual(['Twitch', 'Reddit', 'YT'])
  })

  it('does not re-seed once already seeded', () => {
    store.set('quickLinksSeeded', true)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
    } as unknown as Settings)

    migrateStore()

    expect((store.get('settings') as Settings).quickLinks).toBeUndefined()
  })
})

describe('migrateStore — quickLinks homepage dedup', () => {
  it('strips a legacy homepage-duplicate entry from quickLinks', () => {
    store.set('quickLinksHomepageDeduped', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      homepageUrl: 'https://www.google.com',
      quickLinks: [
        { id: 'stale-homepage', name: 'Google', url: 'https://www.google.com' },
        { id: 'yt', name: 'YouTube', url: 'https://www.youtube.com' },
      ],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.map((l) => l.id)).toEqual(['yt'])
    expect(store.get('quickLinksHomepageDeduped')).toBe(true)
  })

  it('is a no-op when no entry matches the homepage URL', () => {
    store.set('quickLinksHomepageDeduped', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      homepageUrl: 'https://www.google.com',
      quickLinks: [{ id: 'yt', name: 'YouTube', url: 'https://www.youtube.com' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.map((l) => l.id)).toEqual(['yt'])
  })

  it('falls back to the default homepage URL when settings has no homepageUrl', () => {
    store.set('quickLinksHomepageDeduped', false)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      // homepageUrl intentionally absent → DEFAULT_HOMEPAGE fallback
      quickLinks: [
        { id: 'stale-default-home', name: 'Google', url: DEFAULT_HOMEPAGE },
        { id: 'yt', name: 'YouTube', url: 'https://www.youtube.com' },
      ],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.map((l) => l.id)).toEqual(['yt'])
    expect(store.get('quickLinksHomepageDeduped')).toBe(true)
  })

  it('does not re-run once already deduped', () => {
    store.set('quickLinksHomepageDeduped', true)
    store.set('quickLinksSeeded', true)
    store.set('settings', {
      shortcuts: { ...DEFAULT_SHORTCUTS },
      startWithWindows: true,
      activeProfileId: DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: false,
      showMemoryUsage: false,
      homepageUrl: 'https://www.google.com',
      quickLinks: [{ id: 'stale-homepage', name: 'Google', url: 'https://www.google.com' }],
    } as unknown as Settings)

    migrateStore()

    const links = (store.get('settings') as Settings).quickLinks ?? []
    expect(links.map((l) => l.id)).toEqual(['stale-homepage'])
  })
})
