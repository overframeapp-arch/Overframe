// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMissionsStore, STORAGE_KEY } from './missionsStore'

beforeEach(() => {
  localStorage.clear()
  useMissionsStore.setState({ completed: [], pendingUnlocked: [] })
})

describe('missionsStore', () => {
  it('completes a mission, persists it, and queues it as pending', () => {
    useMissionsStore.getState().complete('open-tab')
    const s = useMissionsStore.getState()
    expect(s.completed).toEqual(['open-tab'])
    expect(s.pendingUnlocked).toEqual(['open-tab'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(['open-tab'])
  })

  it('ignores a duplicate completion', () => {
    const { complete } = useMissionsStore.getState()
    complete('m')
    complete('m')
    expect(useMissionsStore.getState().completed).toEqual(['m'])
    expect(useMissionsStore.getState().pendingUnlocked).toEqual(['m'])
  })

  it('shifts the pending-unlocked queue one at a time', () => {
    const { complete } = useMissionsStore.getState()
    complete('a')
    complete('b')
    useMissionsStore.getState().shiftPendingUnlocked()
    expect(useMissionsStore.getState().pendingUnlocked).toEqual(['b'])
  })

  it('reset clears state and storage', () => {
    useMissionsStore.getState().complete('a')
    useMissionsStore.getState().reset()
    expect(useMissionsStore.getState().completed).toEqual([])
    expect(useMissionsStore.getState().pendingUnlocked).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('missionsStore — load from storage on init', () => {
  it('hydrates completed missions from valid storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['x', 'y']))
    vi.resetModules()
    const mod = await import('./missionsStore')
    expect(mod.useMissionsStore.getState().completed).toEqual(['x', 'y'])
  })

  it('recovers to an empty list when storage is corrupt', async () => {
    localStorage.setItem(STORAGE_KEY, '{ not valid json')
    vi.resetModules()
    const mod = await import('./missionsStore')
    expect(mod.useMissionsStore.getState().completed).toEqual([])
  })
})
