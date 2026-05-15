import { store } from '../store'
import type { ProfileSession } from '@shared/types'
import type { TabManager } from './TabManager'

const AUTO_SAVE_INTERVAL_MS = 15_000

export class SessionManager {
  private autoSaveHandle: NodeJS.Timeout | null = null

  constructor(
    private tabs: TabManager,
  ) {}

  save(profileId: string): void {
    // getAll() now returns tabs in visual display order
    const allTabs = this.tabs.getAll()
    const activeId = this.tabs.getActiveId()

    const httpTabs = allTabs.filter(
      (t) => t.url.startsWith('http://') || t.url.startsWith('https://')
    )
    if (httpTabs.length === 0) return

    const activeIndex = Math.max(0, httpTabs.findIndex((t) => t.id === activeId))

    const session: ProfileSession = {
      tabs: httpTabs.map((t) => ({ url: t.url, title: t.title })),
      activeTabIndex: Math.max(0, activeIndex),
      savedAt: Date.now(),
    }

    const sessions = store.get('sessions')
    store.set('sessions', { ...sessions, [profileId]: session })
  }

  /** On startup: restore saved session or open the homepage if none exists. */
  restoreOrCreate(profileId: string, fallbackUrl: string): void {
    const session = store.get('sessions')[profileId]
    // No session at all → first launch, leave tabs empty (onboarding state).
    if (!session) return
    if (session.tabs.length === 0) {
      this.tabs.create(fallbackUrl)
      return
    }
    const createdIds: string[] = []
    for (const t of session.tabs) {
      const tab = this.tabs.create(t.url)
      createdIds.push(tab.id)
    }
    const targetIndex = Math.min(session.activeTabIndex, createdIds.length - 1)
    this.tabs.setActive(createdIds[targetIndex])
  }

  restore(profileId: string, fallbackUrl: string): void {
    const session = store.get('sessions')[profileId]

    // Always close the current profile's tabs first — keeping them would show
    // the wrong profile's content and corrupt the next save.
    this.tabs.closeAll()

    if (!session || session.tabs.length === 0) {
      // No saved session — open the profile's homepage
      this.tabs.create(fallbackUrl)
      return
    }

    const createdIds: string[] = []
    for (const t of session.tabs) {
      const tab = this.tabs.create(t.url)
      createdIds.push(tab.id)
    }

    const targetIndex = Math.min(session.activeTabIndex, createdIds.length - 1)
    this.tabs.setActive(createdIds[targetIndex])
  }

  startAutoSave(getProfileId: () => string): void {
    if (this.autoSaveHandle) return
    this.autoSaveHandle = setInterval(() => {
      this.save(getProfileId())
    }, AUTO_SAVE_INTERVAL_MS)
  }

  stopAutoSave(): void {
    if (this.autoSaveHandle) {
      clearInterval(this.autoSaveHandle)
      this.autoSaveHandle = null
    }
  }
}
