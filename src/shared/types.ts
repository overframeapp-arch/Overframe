// Shared types between main, preload, and renderer.
// Must not import any Node or Electron runtime APIs.

export type OverlayState = 'HIDDEN' | 'FOCUSED' | 'CLICK_THROUGH'

// ── Shortcuts ─────────────────────────────────────────────────────────────────

export const SHORTCUT_IDS = [
  'toggleOverlay',
  'clickThrough',
  'toggleFocusMode',
  'newTab',
  'closeTab',
  'nextTab',
  'prevTab',
  'reloadTab',
  'navBack',
  'navForward',
  'opacityUp',
  'opacityDown',
] as const

export type ShortcutId = (typeof SHORTCUT_IDS)[number]
/** `null` means the shortcut is disabled. */
export type Shortcuts = Record<ShortcutId, string | null>

export const DEFAULT_SHORTCUTS: Shortcuts = {
  toggleOverlay:   'Alt+B',
  clickThrough:    'Alt+C',
  toggleFocusMode: 'Ctrl+Shift+F',
  newTab:          'Ctrl+T',
  closeTab:        'Ctrl+W',
  nextTab:         'Ctrl+PageUp',
  prevTab:         'Ctrl+PageDown',
  reloadTab:       'Ctrl+R',
  navBack:         'Alt+Left',
  navForward:      'Alt+Right',
  opacityUp:       'Ctrl+Shift+Up',
  opacityDown:     'Ctrl+Shift+Down',
}

export const SHORTCUT_LABELS: Record<ShortcutId, string> = {
  toggleOverlay:   'Show / Hide overlay',
  clickThrough:    'Toggle click-through',
  toggleFocusMode: 'Toggle focus mode (hide header)',
  newTab:          'New tab',
  closeTab:        'Close active tab',
  nextTab:         'Next tab',
  prevTab:         'Previous tab',
  reloadTab:       'Reload page',
  navBack:         'Go back',
  navForward:      'Go forward',
  opacityUp:       'Increase opacity',
  opacityDown:     'Decrease opacity',
}

export const SHORTCUT_GROUPS: { label: string; ids: ShortcutId[] }[] = [
  { label: 'Overlay',    ids: ['toggleOverlay', 'clickThrough', 'toggleFocusMode', 'opacityUp', 'opacityDown'] },
  { label: 'Tabs',       ids: ['newTab', 'closeTab', 'nextTab', 'prevTab', 'reloadTab'] },
  { label: 'Navigation', ids: ['navBack', 'navForward'] },
]

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Settings {
  shortcuts: Shortcuts
  startWithWindows: boolean
  activeProfileId: string
  hasCompletedOnboarding: boolean
  showMemoryUsage: boolean
  /** When true, tabs are fully unloaded (navigated to about:blank) on hide instead of just suspended. */
  performanceMode?: boolean

  // ── Game detection (advanced) ──────────────────────────────────────
  /** Process names (lowercase, no .exe) treated as non-games — user owns the full list. */
  blockedProcesses?: string[]
  /** Path fragments that should never count as game directories — user owns the full list. */
  nonGameDirs?: string[]
  /** Path fragments used to identify game installs — user owns the full list (mirrors GAME_PATH_HINTS). */
  gamePathHints?: string[]
  /** Process names matching the launcher heuristic but that the user wants detected anyway. */
  launcherExceptions?: string[]

  // ── Browser ──────────────────────────────────────────────────────────
  /** Default search engine used when a non-URL query is typed in the address bar. */
  searchEngine?: SearchEngineId

  // ── Profile automation ───────────────────────────────────────────────
  /** When false, Overframe will never auto-create a profile for an unrecognised game. */
  autoCreateProfiles?: boolean
  /** When false, Overframe will never auto-switch to a matching profile when a game is detected. */
  autoSwitchProfile?: boolean

}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Profile {
  id: string
  name: string
  processNames: string[]
  priority: number
  homepageUrl: string
  opacity: number
  windowBounds: WindowBounds
  iconUrl?: string
  /** Exe paths seen when this profile was auto-created. Used to distinguish same-name games (e.g. PoE1 vs PoE2). */
  exePaths?: string[]
  /** PE-version friendly name (FileDescription / ProductName) captured at creation time.
   *  More stable than exePath for same-exe disambiguation: survives reinstalls/path changes. */
  gameDisplayName?: string
}

export type CollectionSource = 'user' | 'publisher' | 'community'

export interface Link {
  id: string
  title: string
  url: string
  note?: string
  favicon?: string
  pinned: boolean
  order: number
}

export interface Collection {
  id: string
  name: string
  profileId: string | 'shared'
  source: CollectionSource
  links: Link[]
  iconUrl?: string
  createdAt: number
  updatedAt: number
}

export interface CollectionExport {
  version: 1
  name: string
  source: CollectionSource
  iconUrl?: string
  links: Array<Pick<Link, 'title' | 'url' | 'note' | 'pinned'>>
}

export interface TabState {
  id: string
  url: string
  title: string
  favicon: string | null
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  zoomFactor: number
  isAudioPlaying: boolean
  isMuted: boolean
}

export interface MemoryEntry {
  tabId: string
  privateKb: number
}

export interface MemorySnapshot {
  tabs: MemoryEntry[]
  appKb: number  // overlay renderer + main process combined
}

export interface NewLink {
  title: string
  url: string
  note?: string
  favicon?: string
  pinned?: boolean
}

export interface NewCollection {
  name: string
  profileId: string | 'shared'
  source?: CollectionSource
  iconUrl?: string
}

export interface NewProfile {
  name: string
  processNames: string[]
  homepageUrl?: string
  priority?: number
  exePaths?: string[]
  iconUrl?: string
  /** PE-version friendly name to store for future disambiguation. */
  gameDisplayName?: string
}

export interface BookmarkPopupPayload {
  anchorX: number         // right edge of star button, overlay-window-relative px
  anchorY: number         // bottom edge of star button, overlay-window-relative px
  url: string
  title: string
  favicon?: string | null
  existingBookmark: { cid: string; lid: string; title: string } | null
  activeProfileId: string
}

export interface MemoryPopupPayload {
  anchorX: number
  anchorY: number
}

export interface ProfilesPopupPayload {
  anchorX: number
  anchorY: number
}

export interface CollectionPickerPayload {
  anchorX: number
  anchorY: number
  profileId: string
  selectedId: string | null
}

export interface CollectionsPopupPayload {
  anchorX: number
  anchorY: number
  initialLevel?: 'profiles' | 'collections' | 'links'
  initialCollectionId?: string
  /** When set, the ProfileCreateForm opens pre-filled with this data. */
  prefillNewProfile?: { name: string; processName: string }
}

export interface SettingsPopupPayload {
  anchorX: number
  anchorY: number
}

export interface ManageProfilesPayload {
  anchorX: number
  anchorY: number
}

export interface GameNotificationPayload {
  profile: Profile
  isNew: boolean
  /** The toggleOverlay shortcut key (e.g. "Alt+B"), null if disabled. */
  shortcut: string | null
}

export interface AchievementPayload {
  title: string
}

/** Fired when a visible game was seen but could not be auto-profiled. */
export interface GameUndetectedPayload {
  /** Candidates that passed blocklist/excluded checks but failed the game-path filter. */
  candidates: Array<{ processName: string; displayName: string; exePath: string }>
}

export interface LinkOverflowPayload {
  anchorX: number
  anchorY: number
  links: Array<{ id: string; title: string; url: string; favicon?: string }>
}

export interface TabSession {
  url: string
  title: string
}

export interface ProfileSession {
  tabs: TabSession[]
  activeTabIndex: number
  savedAt: number
}

// ── Search engines ───────────────────────────────────────────────────────────

export const SEARCH_ENGINES = {
  google:     { label: 'Google',       url: 'https://www.google.com/search?q=' },
  duckduckgo: { label: 'DuckDuckGo',   url: 'https://duckduckgo.com/?q=' },
  bing:       { label: 'Bing',         url: 'https://www.bing.com/search?q=' },
  brave:      { label: 'Brave Search', url: 'https://search.brave.com/search?q=' },
} as const
export type SearchEngineId = keyof typeof SEARCH_ENGINES


// ── Downloads ─────────────────────────────────────────────────────────────────

export type DownloadEventState = 'started' | 'progressing' | 'completed' | 'cancelled' | 'interrupted'
export interface DownloadEvent {
  id: string
  filename: string
  url: string
  receivedBytes: number
  totalBytes: number
  state: DownloadEventState
}

export const DEFAULT_HOMEPAGE = 'https://www.google.com'
export const DEFAULT_OPACITY = 1.0
export const MIN_OPACITY = 0.2
export const MAX_OPACITY = 1.0
export const MAX_PINNED_LINKS = 8
export const DRAG_ZONE_HEIGHT = 10 // px, top strip always intercepts mouse
export const CHROME_HEIGHT = 120 // tabbar(40) + addressbar(40) + collectionbar(40) — default without PinnedBar
export const PANEL_WIDTH = 340 // side panel width when open
export const DEFAULT_PROFILE_ID = 'default'
export const PROCESS_POLL_INTERVAL_MS = 5000
/**
 * Slower poll interval used when the overlay is hidden AND the active profile
 * is the default one (no game running). Reduces background CPU/disk usage
 * when the user is just idle.
 */
export const PROCESS_POLL_IDLE_INTERVAL_MS = 15000
