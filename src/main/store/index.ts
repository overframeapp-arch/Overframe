import Store from 'electron-store'
import { app } from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  Settings,
  Shortcuts,
  Profile,
  Collection,
  ProfileSession,
  CustomLink,
  DEFAULT_SHORTCUTS,
  DEFAULT_HOMEPAGE,
  DEFAULT_OPACITY,
  DEFAULT_PROFILE_ID
} from '@shared/types'
import { DEFAULT_NON_GAME_DIRS, DEFAULT_GAME_PATH_HINTS, DEFAULT_BLOCKED_PROCESSES } from '@shared/gameDefaults'

interface AetherStoreSchema {
  settings: Settings
  profiles: Profile[]
  collections: Collection[]
  sessions: Record<string, ProfileSession>
  sessionDirty: boolean
  /** Process names (lowercase, no .exe) that the user has explicitly excluded from auto-detection. */
  excludedProcessNames: string[]
  /** User-defined extra game installation directories — added to isLikelyGamePath matching. */
  customGamePaths: string[]
  /** Full profile snapshots saved at delete-time so they can be fully restored later. */
  deletedProfileSnapshots: Profile[]
  /**
   * Generation counter for the uBlock default filter-list selection (see
   * download-ublock.mjs). uBlock only computes its default list selection on the
   * extension's first run — bumping this past the stored value makes main/index.ts
   * uninstall + reinstall the extension once so it re-picks the current defaults.
   */
  adBlockListGeneration: number
  /**
   * True once the built-in YouTube/Twitch/Reddit quick-access tiles have been
   * seeded into settings.quickLinks as regular, fully user-managed entries
   * (rename/describe/reorder/delete). The homepage tile is intentionally NOT
   * included — it stays a fixed, always-first, immutable tile derived live
   * from settings.homepageUrl, so it can never be lost to an accidental
   * reorder or delete.
   */
  quickLinksSeeded: boolean
  /**
   * True once a homepage-duplicate entry (accidentally seeded into quickLinks
   * by an earlier, now-corrected version of this migration) has been cleaned
   * up. One-time only — a user is free to add a manual link that happens to
   * match their homepage URL afterwards without it being stripped again.
   */
  quickLinksHomepageDeduped: boolean
}

const defaultProfile: Profile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Default',
  processNames: [],
  priority: 0,
  opacity: DEFAULT_OPACITY,
  windowBounds: { x: 100, y: 100, width: 900, height: 600 }
}

const defaults: AetherStoreSchema = {
  sessions: {},
  sessionDirty: false,
  excludedProcessNames: [],
  customGamePaths: [],
  deletedProfileSnapshots: [],
  adBlockListGeneration: 0,
  quickLinksSeeded: false,
  quickLinksHomepageDeduped: false,
  settings: {
    shortcuts: DEFAULT_SHORTCUTS,
    startWithWindows: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    hasCompletedOnboarding: false,
    showMemoryUsage: false,
    performanceMode: false,
    applyDarkMode: true,
    homepageUrl: DEFAULT_HOMEPAGE,
    blockedProcesses: [...DEFAULT_BLOCKED_PROCESSES],
    nonGameDirs: [...DEFAULT_NON_GAME_DIRS],
    gamePathHints: [...DEFAULT_GAME_PATH_HINTS],
    launcherExceptions: [],
  },
  profiles: [defaultProfile],
  collections: []
}

export const store = new Store<AetherStoreSchema>({
  name: 'aether-store',
  defaults,
  cwd: app.getPath('userData'),
  clearInvalidConfig: true
})

/**
 * Migrate legacy settings format (pre-shortcuts) to current schema.
 * Runs once on startup; is a no-op for already-migrated stores.
 */
export function migrateStore(): void {
  const raw = store.get('settings') as unknown as Record<string, unknown>

  // v1 → v2: replace hotkey/clickThroughHotkey with shortcuts object
  if (typeof raw['hotkey'] === 'string' || typeof raw['clickThroughHotkey'] === 'string') {
    const migrated: Shortcuts = {
      ...DEFAULT_SHORTCUTS,
      ...(typeof raw['hotkey'] === 'string'             ? { toggleOverlay: raw['hotkey'] as string }             : {}),
      ...(typeof raw['clickThroughHotkey'] === 'string' ? { clickThrough:  raw['clickThroughHotkey'] as string } : {}),
    }
    const next: Settings = {
      shortcuts:            migrated,
      startWithWindows:     typeof raw['startWithWindows'] === 'boolean' ? raw['startWithWindows'] : true,
      activeProfileId:      typeof raw['activeProfileId'] === 'string'   ? raw['activeProfileId']  : DEFAULT_PROFILE_ID,
      hasCompletedOnboarding: typeof raw['hasCompletedOnboarding'] === 'boolean' ? raw['hasCompletedOnboarding'] : false,
      showMemoryUsage:      typeof raw['showMemoryUsage'] === 'boolean'  ? raw['showMemoryUsage']  : false,
    }
    store.set('settings', next)
  }

  // Normalise all shortcut keys:
  // • Fill keys added in newer versions
  // • Correct any previously-swapped nextTab/prevTab (we’ve toggled this twice)
  const settings = store.get('settings')
  if (settings.shortcuts) {
    const merged: Shortcuts = {
      ...DEFAULT_SHORTCUTS,
      ...settings.shortcuts,
      // Always force these to the canonical defaults regardless of stored value
      nextTab:    'Ctrl+PageUp',
      prevTab:    'Ctrl+PageDown',
      // Restore navBack/navForward if they were previously force-nulled
      navBack:    settings.shortcuts.navBack    ?? 'Alt+Left',
      navForward: settings.shortcuts.navForward ?? 'Alt+Right',
    }
    if (JSON.stringify(merged) !== JSON.stringify(settings.shortcuts)) {
      store.set('settings', { ...settings, shortcuts: merged })
    }
  }

  // Backfill `id` on quickLinks saved before custom links became fully user-managed
  // (rename/describe/reorder). The settings:set IPC handler validates the WHOLE
  // array on every write, so even one legacy entry missing `id` silently rejects
  // every future add/edit/remove/reorder — this must run before any write is attempted.
  const settingsNow = store.get('settings')
  const rawLinks = settingsNow.quickLinks as unknown[] | undefined
  if (Array.isArray(rawLinks) && rawLinks.some((l) => !l || typeof (l as Record<string, unknown>).id !== 'string')) {
    const migratedLinks = rawLinks.map((l) => {
      // `l` can be literally null/undefined in a corrupted store — the some() above
      // treats that as needing migration, so the map must survive it too.
      const link = (l ?? {}) as Record<string, unknown>
      return {
        id: typeof link.id === 'string' ? link.id : randomUUID(),
        name: typeof link.name === 'string' ? link.name : '',
        url: typeof link.url === 'string' ? link.url : '',
        ...(typeof link.description === 'string' ? { description: link.description } : {}),
      }
    })
    store.set('settings', { ...settingsNow, quickLinks: migratedLinks })
  }

  // One-time: strip a homepage-duplicate entry left behind by an earlier version
  // of the seeding migration below (it used to also seed the homepage tile into
  // quickLinks — corrected so the homepage tile stays fixed/separate instead).
  if (!store.get('quickLinksHomepageDeduped')) {
    const settingsForDedupe = store.get('settings')
    const homepageUrl = settingsForDedupe.homepageUrl ?? DEFAULT_HOMEPAGE
    if (Array.isArray(settingsForDedupe.quickLinks) && settingsForDedupe.quickLinks.some((l) => l.url === homepageUrl)) {
      store.set('settings', {
        ...settingsForDedupe,
        quickLinks: settingsForDedupe.quickLinks.filter((l) => l.url !== homepageUrl),
      })
    }
    store.set('quickLinksHomepageDeduped', true)
  }

  // One-time: promote the built-in YouTube/Twitch/Reddit quick-access tiles into
  // regular quickLinks entries so the user can rename, describe, reorder or
  // delete them like any link they add themselves. The homepage tile is
  // intentionally excluded — see the schema comment on quickLinksSeeded.
  if (!store.get('quickLinksSeeded')) {
    const settingsForSeed = store.get('settings')
    const existing = settingsForSeed.quickLinks ?? []
    const builtins: Array<{ name: string; url: string }> = [
      { name: 'YouTube', url: 'https://www.youtube.com' },
      { name: 'Twitch', url: 'https://www.twitch.tv' },
      { name: 'Reddit', url: 'https://www.reddit.com' },
    ]
    const toAdd = builtins.filter((b) => !existing.some((l) => l.url === b.url))
    const seeded: CustomLink[] = [
      ...toAdd.map((b) => ({ id: randomUUID(), name: b.name, url: b.url })),
      ...existing,
    ]
    store.set('settings', { ...settingsForSeed, quickLinks: seeded })
    store.set('quickLinksSeeded', true)
  }
}

export function getStorePath(): string {
  return path.join(app.getPath('userData'), 'aether-store.json')
}
