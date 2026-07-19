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

/** A user-added quick access link on the home page — fully user-managed (name, description, order). */
export interface CustomLink {
  id: string
  name: string
  url: string
  /** Optional short description shown under the name. */
  description?: string
}

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
  /** Name keywords that mark a process as a launcher/utility (skipped by detection) — user owns the full list. */
  launcherPatterns?: string[]
  /** Process names matching the launcher heuristic but that the user wants detected anyway. */
  launcherExceptions?: string[]

  // ── Browser ──────────────────────────────────────────────────────────
  /** Default search engine used when a non-URL query is typed in the address bar. */
  searchEngine?: SearchEngineId
  /** When true, Edge WebView2 reports prefers-color-scheme:dark to sites that have a dark mode. Default: true. */
  applyDarkMode?: boolean
  /** When false, the Instant Gaming deal card is never shown. Default: true. */
  showIGPromo?: boolean
  /** Global homepage URL — the page that opens when creating a new tab. */
  homepageUrl?: string
  /** Domains whose tabs survive profile switches and performance-mode unloads. */
  protectedDomains?: string[]
  /** User-defined quick access links shown on the home page. */
  quickLinks?: CustomLink[]
  // ── Profile automation ───────────────────────────────────────────────
  /** When false, Overframe will never auto-create a profile for an unrecognised game. */
  autoCreateProfiles?: boolean
  /** When false, Overframe will never auto-switch to a matching profile when a game is detected. */
  autoSwitchProfile?: boolean

  // ── Privacy ──────────────────────────────────────────────────────────────────
  /**
   * When true, loads uBlock Origin (MV2) as a browser extension into the Edge profile.
   * Blocks ads and cookie banners at the network level.
   * Off by default to stay compatible with ad-supported partner sites.
   */
  adBlockEnabled?: boolean

  // ── Instant Gaming affiliate ─────────────────────────────────────────
  /** When true, automatically adds the affiliate tag when navigating to Instant Gaming. */
  igAutoAffiliate?: boolean

  // ── Creator identity (collection signatures) ─────────────────────────
  /** Local creator handle stamped on collections you author and share. No account, no PII. */
  creatorHandle?: string
  /** Optional accent colour (#rrggbb) for the creator signature. */
  creatorColor?: string
  /** Creator social/support links that travel with shared collections. */
  creatorLinks?: CreatorLink[]
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
  homepageUrl?: string
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

/** Single source of truth for creator platforms — validation allowlists derive from it. */
export const CREATOR_PLATFORMS = ['twitch', 'youtube', 'kick', 'discord', 'kofi', 'patreon', 'twitter', 'tiktok', 'website'] as const
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number]

/** Maximum creator links carried by a signature — enforced at the IPC boundary and on import. */
export const MAX_CREATOR_LINKS = 10

/** Maximum named sections per collection — enforced at the IPC boundary and on import. */
export const MAX_COLLECTION_SECTIONS = 50

export interface CreatorLink {
  platform: CreatorPlatform
  url: string
}

/** Local creator identity — no account, no PII. Travels with a shared collection. */
export interface CollectionAuthor {
  /** Creator's chosen display handle. */
  handle: string
  /** Optional accent colour as a #rrggbb hex string. */
  color?: string
  /** Social/support links — shown to importers as a creator discovery card. */
  links?: CreatorLink[]
}

export interface Link {
  id: string
  title: string
  url: string
  note?: string
  favicon?: string
  pinned: boolean
  order: number
  /** Named group within a creator collection. Undefined = unsectioned. */
  section?: string
}

/** Reposition/zoom applied to `bannerUrl` at render time — a few numbers, never a re-encoded image. */
export interface BannerFocus {
  /** Focal point as a percentage of the image, matching CSS object-position semantics. */
  x: number
  y: number
  /** Zoom multiplier on top of the cover-fit scale. 1 = no zoom. */
  zoom: number
}

export interface Collection {
  id: string
  name: string
  /** Optional short description shown on the collection card and shared preview. */
  description?: string
  profileId: string | 'shared'
  source: CollectionSource
  /** Creator signature — travels with the collection when it is shared. */
  author?: CollectionAuthor
  links: Link[]
  iconUrl?: string
  bannerUrl?: string
  /** Pan/zoom applied to bannerUrl. Undefined = centered, no zoom. */
  bannerFocus?: BannerFocus
  /** Pan/zoom applied to iconUrl. Undefined = centered, no zoom. */
  iconFocus?: BannerFocus
  createdAt: number
  updatedAt: number
  /** Ordered list of section names for creator collections. Undefined = sections not activated. */
  sections?: string[]
}

export interface CollectionExport {
  version: 1
  name: string
  description?: string
  source: CollectionSource
  author?: CollectionAuthor
  iconUrl?: string
  /** Pan/zoom applied to iconUrl — travels with the share so the page looks identical on import. */
  iconFocus?: BannerFocus
  bannerUrl?: string
  /** Pan/zoom applied to bannerUrl — travels with the share so the page looks identical on import. */
  bannerFocus?: BannerFocus
  sections?: string[]
  links: Array<Pick<Link, 'title' | 'url' | 'note' | 'pinned' | 'favicon' | 'section'>>
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
  section?: string
}

export interface NewCollection {
  name: string
  description?: string
  profileId: string | 'shared'
  source?: CollectionSource
  author?: CollectionAuthor
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

export interface IGPromoPayload {
  purchaseHint: string
  browseUrl: string
}

/** Fired when a visible game was seen but could not be auto-profiled. */
export interface GameUndetectedPayload {
  /** Candidates that passed blocklist/excluded checks but failed the game-path filter. */
  candidates: Array<{ processName: string; displayName: string; exePath: string; iconDataUrl: string }>
}

export interface LinkOverflowPayload {
  anchorX: number
  anchorY: number
  links: Array<{ id: string; title: string; url: string; favicon?: string }>
}

export interface TabSession {
  url: string
  title: string
  favicon?: string | null
}

export interface ProfileSession {
  tabs: TabSession[]
  activeTabIndex: number
  savedAt: number
}

// ── Homepage presets ──────────────────────────────────────────────────────────

export const HOMEPAGE_PRESETS = [
  { id: 'chrome',  label: 'Google',  url: 'https://www.google.com'  },
  { id: 'edge',    label: 'Bing',    url: 'https://www.bing.com'    },
  { id: 'brave',   label: 'Brave',   url: 'https://search.brave.com' },
] as const

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
export const DEFAULT_PROTECTED_DOMAINS: string[] = ['discord.com']
export const DEFAULT_OPACITY = 1.0
export const MIN_OPACITY = 0.2
export const MAX_OPACITY = 1.0
export const MAX_PINNED_LINKS = 8
export const DRAG_ZONE_HEIGHT = 10 // px, top strip always intercepts mouse
export const RESIZE_BORDER = 6   // px, inset reserved for window resize handles (sides + bottom)
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
