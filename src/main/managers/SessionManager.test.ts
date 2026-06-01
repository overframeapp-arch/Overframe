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

/** Build a TabManager test double whose getAll returns the given tabs. */
function makeTabs(initial: Array<Partial<TabState>> = []) {
  let tabs = initial
  let activeId: string | null = initial[0]?.id ?? null
  let counter = 0
  const created: string[] = []
  const api = {
    getAll: vi.fn(() => tabs as TabState[]),
    getActiveId: vi.fn(() => activeId),
    setActive: vi.fn((id: string) => { activeId = id }),
    create: vi.fn((url: string) => {
      const id = `new-${counter++}`
      created.push(url)
      return { id, url } as TabState
    }),
    closeAll: vi.fn(() => { tabs = [] }),
  }
  return {
    mgr: api as unknown as TabManager,
    api,
    created,
    setActiveId: (id: string | null) => { activeId = id },
  }
}

beforeEach(() => { h.sessions = {} })

describe('SessionManager.save', () => {
  it('does nothing when there are no http(s) tabs', () => {
    const { mgr } = makeTabs([{ id: 'a', url: 'about:blank', title: 'blank' }])
    new SessionManager(mgr).save('p1')
    expect(h.sessions).toEqual({})
  })

  it('saves only http(s) tabs with the active index', () => {
    const t = makeTabs([
      { id: 'a', url: 'https://a', title: 'A' },
      { id: 'b', url: 'about:blank', title: 'blank' },
      { id: 'c', url: 'http://c', title: 'C' },
    ])
    t.setActiveId('c')
    new SessionManager(t.mgr).save('p1')
    expect(h.sessions.p1.tabs).toEqual([
      { url: 'https://a', title: 'A' },
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
})

describe('SessionManager.restoreOrCreate', () => {
  it('does nothing on first launch (no saved session)', () => {
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1', 'https://home')
    expect(t.api.create).not.toHaveBeenCalled()
  })

  it('opens the homepage when the saved session has no tabs', () => {
    h.sessions = { p1: { tabs: [], activeTabIndex: 0, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1', 'https://home')
    expect(t.created).toEqual(['https://home'])
  })

  it('restores saved tabs and activates the saved index', () => {
    h.sessions = { p1: { tabs: [{ url: 'https://a', title: 'A' }, { url: 'https://b', title: 'B' }], activeTabIndex: 1, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1', 'https://home')
    expect(t.created).toEqual(['https://a', 'https://b'])
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-1')
  })

  it('clamps an out-of-range active index', () => {
    h.sessions = { p1: { tabs: [{ url: 'https://a', title: 'A' }], activeTabIndex: 9, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restoreOrCreate('p1', 'https://home')
    expect(t.api.setActive).toHaveBeenLastCalledWith('new-0')
  })
})

describe('SessionManager.restore', () => {
  it('always closes existing tabs first, then opens the homepage when no session', () => {
    const t = makeTabs([{ id: 'old', url: 'https://old', title: 'old' }])
    new SessionManager(t.mgr).restore('p1', 'https://home')
    expect(t.api.closeAll).toHaveBeenCalledOnce()
    expect(t.created).toEqual(['https://home'])
  })

  it('opens the homepage when the saved session is empty', () => {
    h.sessions = { p1: { tabs: [], activeTabIndex: 0, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restore('p1', 'https://home')
    expect(t.created).toEqual(['https://home'])
  })

  it('restores saved tabs and activates the saved index', () => {
    h.sessions = { p1: { tabs: [{ url: 'https://a', title: 'A' }, { url: 'https://b', title: 'B' }], activeTabIndex: 0, savedAt: 1 } }
    const t = makeTabs()
    new SessionManager(t.mgr).restore('p1', 'https://home')
    expect(t.created).toEqual(['https://a', 'https://b'])
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
