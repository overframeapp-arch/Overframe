import Store from 'electron-store'
import { app } from 'electron'
import path from 'node:path'
import {
  Settings,
  Shortcuts,
  Profile,
  Collection,
  ProfileSession,
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
}

const defaultProfile: Profile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Default',
  processNames: [],
  priority: 0,
  homepageUrl: DEFAULT_HOMEPAGE,
  opacity: DEFAULT_OPACITY,
  windowBounds: { x: 100, y: 100, width: 900, height: 600 }
}

const defaults: AetherStoreSchema = {
  sessions: {},
  sessionDirty: false,
  excludedProcessNames: [],
  customGamePaths: [],
  deletedProfileSnapshots: [],
  settings: {
    shortcuts: DEFAULT_SHORTCUTS,
    startWithWindows: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    hasCompletedOnboarding: false,
    showMemoryUsage: false,
    performanceMode: false,
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
}

export function getStorePath(): string {
  return path.join(app.getPath('userData'), 'aether-store.json')
}
