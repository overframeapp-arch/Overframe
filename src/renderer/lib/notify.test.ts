import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { notify, type Notification } from './notify'

describe('notify bus', () => {
  beforeEach(() => {
    notify.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers pushed notifications to subscribers (with an initial emit)', () => {
    const seen: Notification[][] = []
    const unsub = notify.subscribe((n) => seen.push([...n]))
    expect(seen[0]).toEqual([]) // initial state pushed on subscribe
    notify.info('hello', 0)
    const last = seen[seen.length - 1]
    expect(last).toHaveLength(1)
    expect(last[0]).toMatchObject({ level: 'info', message: 'hello' })
    expect(typeof last[0].id).toBe('number')
    expect(typeof last[0].createdAt).toBe('number')
    unsub()
  })

  it('emits the three levels', () => {
    let current: readonly Notification[] = []
    const unsub = notify.subscribe((n) => { current = n })
    notify.info('i', 0)
    notify.error('e', 0)
    notify.success('s', 0)
    expect(current.map((n) => n.level)).toEqual(['info', 'error', 'success'])
    unsub()
  })

  it('auto-dismisses after the ttl', () => {
    let current: readonly Notification[] = []
    const unsub = notify.subscribe((n) => { current = n })
    notify.error('boom', 1000)
    expect(current).toHaveLength(1)
    vi.advanceTimersByTime(999)
    expect(current).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(current).toHaveLength(0)
    unsub()
  })

  it('does not schedule auto-dismiss when ttl is 0', () => {
    let current: readonly Notification[] = []
    const unsub = notify.subscribe((n) => { current = n })
    notify.success('persist', 0)
    vi.advanceTimersByTime(1_000_000)
    expect(current).toHaveLength(1)
    unsub()
  })

  it('dismiss removes a specific notification', () => {
    let current: readonly Notification[] = []
    const unsub = notify.subscribe((n) => { current = n })
    const id = notify.info('x', 0)
    notify.info('y', 0)
    notify.dismiss(id)
    expect(current.map((n) => n.message)).toEqual(['y'])
    unsub()
  })

  it('dismiss is a no-op for unknown ids (no extra emit)', () => {
    let emits = 0
    const unsub = notify.subscribe(() => { emits++ })
    notify.info('x', 0)
    const before = emits
    notify.dismiss(987654)
    expect(emits).toBe(before)
    unsub()
  })

  it('clear empties the bus and is a no-op when already empty', () => {
    let current: readonly Notification[] = []
    let emits = 0
    const unsub = notify.subscribe((n) => { current = n; emits++ })
    notify.info('a', 0)
    notify.info('b', 0)
    expect(current).toHaveLength(2)
    notify.clear()
    expect(current).toHaveLength(0)
    const before = emits
    notify.clear() // already empty → no further emit
    expect(emits).toBe(before)
    unsub()
  })

  it('unsubscribe stops further delivery', () => {
    let count = 0
    const unsub = notify.subscribe(() => { count++ })
    const before = count
    unsub()
    notify.info('x', 0)
    expect(count).toBe(before)
  })
})
