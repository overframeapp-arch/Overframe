import { create } from 'zustand'

export const STORAGE_KEY = 'overframe:completedMissions'

function loadCompleted(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

interface MissionsState {
  completed: string[]
  pendingUnlocked: string[]
  complete: (id: string) => void
  shiftPendingUnlocked: () => void
  reset: () => void
}

export const useMissionsStore = create<MissionsState>((set, get) => ({
  completed: loadCompleted(),
  pendingUnlocked: [],

  complete: (id) => {
    const { completed, pendingUnlocked } = get()
    if (completed.includes(id)) return
    const next = [...completed, id]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    set({ completed: next, pendingUnlocked: [...pendingUnlocked, id] })
  },

  shiftPendingUnlocked: () => {
    const { pendingUnlocked } = get()
    set({ pendingUnlocked: pendingUnlocked.slice(1) })
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ completed: [], pendingUnlocked: [] })
  },
}))
