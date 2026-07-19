import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ProfileSession, TabState } from '@shared/types'
import type { TabManager } from './TabManager'

const h = vi.hoisted(() => ({ sessions: {} as Record<string, ProfileSession> }))
vi.mock('../store', () => ({
  store: {
    get: (key: string) => (key === 'sessions' ? h.sessions : undefined),
    set: (key: string, val: unknown) => {
      if (key === 'sessions') h.sessions = val as Record<string, ProfileSession>
    },
  },
}))

import { SessionManager } from './SessionManager'

/**
 * Build a TabManager test double.
 *  - `initial` is what getAll() returns (for restore() this represents the tabs
 *    that survived closeUnprotected(), i.e. still-open protected tabs).
 *  - createLazy() records each URL and hands back a stable `new-N` id.
 *  - closeUnprotected() is a no-op spy — the mock's getAll() already models the
 *    post-close state.
 */
function makeTabs(initial: Array<Partial<TabState>> = []) {
  const tabs = initial as TabState[]
  let activeId: string | null = initial[0]?.id ?? null
  let counter = 0
  const createdLazy: string[] = []
  const api = {
    getAll: vi.fn(() => tabs),
    getActiveId: vi.fn(() => activeId),
    setActive: vi.fn((id: string) => { activeId = id }),
    createLazy: vi.fn((url: string) => {
      const id = `new-${counter++}`
      createdLazy.push(url)
      return { id, url } as TabState
    }),
    closeUnprotected: vi.fn(() => {}),
  }
  return {
    mgr: api as unknown as TabManager,
    api,
    createdLazy,
    setActiveId: (id: string | null) => { activeId = id },
  }
}

beforeEach(() => { h.sessions = {} })

describe('SessionManager.save', () => {
  it('saves only http(s) tabs with the active index', () => {
    const t = makeTabs([
      { id: 'a', url: 'https://a', title: 'A', favicon: 'fa' },
      { id: 'b', url: 'about:blank', title: 'blank' },
      { id: 'c', url: 'http://c', title: 'C' },
    ])
    t.setActiveId('c')
    new SessionManager(t.mgr).save('p1')
    expect(h.sessions.p1.tabs).toEqual([
      { url: 'https://a', title: 'A', favicon: 'fa' },
      { url: 'http://c', title: 'C' },
    ])
    expect(h.sessions.p1.activeTabIndex).toBe(1)
    expect(typeof h.sessions.p1.savedAt).toBe('number')
  })

  it('falls back to index 0 when the active tab is not an http tab', () => {
    const t = makeTabs([{ id: 'a', url: 'https://a', title: 'A' }])
    t.setActiveId('ghost')
    new SessionManager(t.mgr).save('p1')
    expect(h.sessions.p1.activeTabIndex).toBe(0)
  })

  it('stores an empty session when there are no http(s) tabs', () => {
    const t = makeTabs([{ id: 'a', url: 'about:blank', title: 'blank' }])
    new SessionManager(t.mgr).save('p1')
    expect(h.sessions.p1.tabs).toEqual([])
    expect(h.sessions.p1.activeTabIndex).toBe(0)
  })
})

describe('SessionManager.restoreOrCreate', () => {
  it('does nothing when there is no saved session', () => {
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1')
    expect(t.api.createLazy).not.toHaveBeenCalled()
    expect(t.api.setActive).not.toHaveBeenCalled()
  })

  it('does nothing when the saved session has no tabs', () => {
    h.sessions = { p1: { tabs: [], activeTabIndex: 0, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1')
    expect(t.api.createLazy).not.toHaveBeenCalled()
  })

  it('restores saved tabs lazily and activates the saved index', () => {
    h.sessions = {
      p1: {
        tabs: [{ url: 'https://a', title: 'A', favicon: 'fa' }, { url: 'https://b', title: 'B' }],
        activeTabIndex: 1,
        savedAt: 1,
      },
    }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1')
    expect(t.createdLazy).toEqual(['https://a', 'https://b'])
    expect(t.api.createLazy).toHaveBeenCalledWith('https://a', 'A', 'fa')
    expect(t.api.createLazy).toHaveBeenCalledWith('https://b', 'B', null)
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-1')
  })

  it('clamps an out-of-range active index to the last tab', () => {
    h.sessions = { p1: { tabs: [{ url: 'https://a', title: 'A' }], activeTabIndex: 9, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1')
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })
})

describe('SessionManager.restore', () => {
  it('closes unprotected tabs and restores nothing when there is no saved session', () => {
    const t = makeTabs([{ id: 'old', url: 'https://old', title: 'old' }])
    new SessionManager(t.mgr).restore('p1')
    expect(t.api.closeUnprotected).toHaveBeenCalledWith([])
    expect(t.createdLazy).toEqual([])
    expect(t.api.setActive).not.toHaveBeenCalled()
  })

  it('restores nothing when the saved session is empty', () => {
    h.sessions = { p1: { tabs: [], activeTabIndex: 0, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restore('p1')
    expect(t.api.closeUnprotected).toHaveBeenCalledOnce()
    expect(t.createdLazy).toEqual([])
  })

  it('restores saved tabs lazily and activates the saved index (no protected domains)', () => {
    h.sessions = {
      p1: {
        tabs: [{ url: 'https://a', title: 'A' }, { url: 'https://b', title: 'B' }],
        activeTabIndex: 0,
        savedAt: 1,
      },
    }
    const t = makeTabs()
    new SessionManager(t.mgr).restore('p1')
    expect(t.createdLazy).toEqual(['https://a', 'https://b'])
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })

  it('skips a saved tab whose protected domain is already open, keeping the rest', () => {
    const t = makeTabs([{ id: 'd', url: 'https://discord.com/app', title: 'Discord' }])
    h.sessions = {
      p1: {
        tabs: [
          { url: 'https://discord.com/channels/1', title: 'Discord' },
          { url: 'https://a', title: 'A' },
        ],
        activeTabIndex: 0,
        savedAt: 1,
      },
    }
    new SessionManager(t.mgr).restore('p1', ['discord.com'])
    // The Discord tab is already covered → only https://a is reopened.
    expect(t.createdLazy).toEqual(['https://a'])
    // Saved-active was the filtered Discord tab → fall back to the first restored tab.
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })

  it('restores nothing when every saved tab is an already-open protected domain', () => {
    const t = makeTabs([{ id: 'd', url: 'https://discord.com/app', title: 'Discord' }])
    h.sessions = {
      p1: { tabs: [{ url: 'https://discord.com/channels/1', title: 'Discord' }], activeTabIndex: 0, savedAt: 1 },
    }
    new SessionManager(t.mgr).restore('p1', ['discord.com'])
    expect(t.createdLazy).toEqual([])
    expect(t.api.setActive).not.toHaveBeenCalled()
  })

  it('matches protected subdomains and skips tabs with unparseable URLs', () => {
    const t = makeTabs([
      { id: 'd', url: 'https://ptb.discord.com/app', title: 'Discord PTB' }, // subdomain → endsWith match
      { id: 'x', url: '', title: 'destroyed' },                              // unparseable → ignored
    ])
    h.sessions = {
      p1: {
        tabs: [
          { url: '', title: 'broken' },                          // unparseable → kept (not covered)
          { url: 'https://discord.com/home', title: 'Discord' }, // covered → filtered out
          { url: 'https://b', title: 'B' },                      // kept
        ],
        activeTabIndex: 1,
        savedAt: 1,
      },
    }
    new SessionManager(t.mgr).restore('p1', ['discord.com', 'slack.com'])
    expect(t.createdLazy).toEqual(['', 'https://b'])
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })

  it('activates the first restored tab when the saved active index is out of range', () => {
    h.sessions = { p1: { tabs: [{ url: 'https://a', title: 'A' }], activeTabIndex: 5, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restore('p1')
    expect(t.createdLazy).toEqual(['https://a'])
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })
})

describe('SessionManager auto-save', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves on the interval and is idempotent', () => {
    const t = makeTabs([{ id: 'a', url: 'https://a', title: 'A' }])
    const sm = new SessionManager(t.mgr)
    sm.startAutoSave(() => 'p1')
    sm.startAutoSave(() => 'p1') // second call is a no-op (already running)
    vi.advanceTimersByTime(15_000)
    expect(h.sessions.p1).toBeDefined()
    expect(t.api.getAll).toHaveBeenCalled()
    sm.stopAutoSave()
  })

  it('stopAutoSave halts the interval and is safe to call when not running', () => {
    const t = makeTabs([{ id: 'a', url: 'https://a', title: 'A' }])
    const sm = new SessionManager(t.mgr)
    sm.stopAutoSave() // not running yet → no-op
    sm.startAutoSave(() => 'p1')
    sm.stopAutoSave()
    const calls = t.api.getAll.mock.calls.length
    vi.advanceTimersByTime(60_000)
    expect(t.api.getAll.mock.calls.length).toBe(calls) // no more saves
  })
})
