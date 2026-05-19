import psList from 'ps-list'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { store } from '../store'
import type { Profile, NewProfile } from '@shared/types'
import {
  DEFAULT_HOMEPAGE,
  DEFAULT_OPACITY,
  DEFAULT_PROFILE_ID,
  PROCESS_POLL_IDLE_INTERVAL_MS,
  PROCESS_POLL_INTERVAL_MS,
} from '@shared/types'
import { DEFAULT_NON_GAME_DIRS, DEFAULT_GAME_PATH_HINTS, DEFAULT_BLOCKED_PROCESSES } from '@shared/gameDefaults'
import { getExeIcon } from '../utils/getExeIcon'
import { getVisibleGames } from '../utils/getVisibleGames'
import {
  isLikelySystemDisplayName,
  isLikelyGamePath,
  isLikelyLauncher,
  normalizeProcessName,
  PLATFORM_SUFFIX_RE,
} from './profiles/heuristics'
import {
  AUTO_CREATED_KEYS_CAP,
  AUTO_DETECT_THROTTLE_MS,
  ICON_FETCH_TIMEOUT_MS,
  VISIBLE_GAMES_CACHE_GRACE_MS,
  type GameUndetectedListener,
  type ProfileAutoDetectedListener,
  type ProfileAutoGameClosedListener,
  type ProfileBeforeSwitchListener,
  type ProfileChangeListener,
  type ProfileDataChangeListener,
} from './profiles/types'

export type {
  GameUndetectedListener,
  ProfileAutoDetectedListener,
  ProfileAutoGameClosedListener,
  ProfileBeforeSwitchListener,
  ProfileChangeListener,
  ProfileDataChangeListener,
} from './profiles/types'

/** These two are always blocked regardless of user config — self-protection. */
const ALWAYS_BLOCKED = new Set(['electron', 'overframe'])

interface VisibleGameCacheEntry {
  exePath: string
  displayName: string
  cx: number
  cy: number
}

export class ProfileManager {
  private pollHandle: NodeJS.Timeout | null = null
  private listeners = new Set<ProfileChangeListener>()
  private beforeSwitchListeners = new Set<ProfileBeforeSwitchListener>()
  private dataChangeListeners = new Set<ProfileDataChangeListener>()
  private autoDetectedListeners = new Set<ProfileAutoDetectedListener>()
  private autoGameClosedListeners = new Set<ProfileAutoGameClosedListener>()
  private gameUndetectedListeners = new Set<GameUndetectedListener>()
  private polling = false
  private currentPollIntervalMs = PROCESS_POLL_INTERVAL_MS
  private manualOverride = false
  /**
   * The profile ID that was last auto-switched to for the current game session.
   * If the user manually changes away while the game is still running, we skip
   * forcing them back — their choice is respected until the game closes.
   */
  private activeGameSessionId: string | null = null
  /** Keys `processname|exepath` already auto-created this session. */
  private autoCreatedKeys = new Set<string>()
  private lastAutoDetectAt = 0
  private visibleGamesCache = new Map<string, VisibleGameCacheEntry[]>()
  private visibleGamesCacheAt = 0
  private shownUndetectedKeys = new Set<string>()

  // ───────────────────────── CRUD ─────────────────────────

  getAll(): Profile[] {
    return store.get('profiles')
  }

  getById(id: string): Profile | undefined {
    return this.getAll().find((p) => p.id === id)
  }

  getActive(): Profile {
    const id = store.get('settings').activeProfileId
    return this.getById(id) ?? this.getDefault()
  }

  getDefault(): Profile {
    const def = this.getById(DEFAULT_PROFILE_ID)
    if (def) return def
    const created: Profile = {
      id: DEFAULT_PROFILE_ID,
      name: 'Default',
      processNames: [],
      priority: 0,
      homepageUrl: DEFAULT_HOMEPAGE,
      opacity: DEFAULT_OPACITY,
      windowBounds: { x: 100, y: 100, width: 900, height: 600 },
    }
    store.set('profiles', [...this.getAll(), created])
    return created
  }

  create(input: NewProfile): Profile {
    const dedupedNames = Array.from(
      new Set((input.processNames ?? []).map(normalizeProcessName).filter(Boolean)),
    )
    const dedupedPaths =
      input.exePaths && input.exePaths.length > 0
        ? Array.from(new Set(input.exePaths.map((p) => String(p))))
        : undefined
    const profile: Profile = {
      id: randomUUID(),
      name: input.name.trim() || 'Untitled',
      processNames: dedupedNames,
      priority: input.priority ?? 0,
      homepageUrl: input.homepageUrl ?? DEFAULT_HOMEPAGE,
      opacity: DEFAULT_OPACITY,
      windowBounds: { x: 100, y: 100, width: 900, height: 600 },
      ...(dedupedPaths ? { exePaths: dedupedPaths } : {}),
      ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
      ...(input.gameDisplayName ? { gameDisplayName: input.gameDisplayName } : {}),
    }
    store.set('profiles', [...this.getAll(), profile])
    return profile
  }

  update(id: string, patch: Partial<Profile>): Profile | null {
    const profiles = this.getAll()
    const idx = profiles.findIndex((p) => p.id === id)
    if (idx === -1) return null
    const normalizedPatch: Partial<Profile> = { ...patch }
    if (Array.isArray(patch.processNames)) {
      normalizedPatch.processNames = Array.from(
        new Set(patch.processNames.map(normalizeProcessName).filter(Boolean)),
      )
    }
    if (Array.isArray(patch.exePaths)) {
      normalizedPatch.exePaths = Array.from(new Set(patch.exePaths.map((p) => String(p))))
    }
    if (typeof patch.name === 'string') {
      normalizedPatch.name = patch.name.trim() || profiles[idx].name
    }
    const updated = { ...profiles[idx], ...normalizedPatch, id: profiles[idx].id }
    profiles[idx] = updated
    store.set('profiles', profiles)
    if (id === store.get('settings').activeProfileId) {
      for (const cb of this.dataChangeListeners) cb(updated)
    }
    return updated
  }

  remove(id: string, mode: 'delete' | 'exclude' = 'exclude'): void {
    if (id === DEFAULT_PROFILE_ID) return
    const profile = this.getById(id)
    if (mode === 'exclude' && profile && profile.processNames.length > 0) {
      const snapshots = store.get('deletedProfileSnapshots') ?? []
      const alreadySaved = snapshots.some((s) => s.id === profile.id)
      if (!alreadySaved) {
        store.set('deletedProfileSnapshots', [...snapshots, { ...profile }])
      }
      const current = store.get('excludedProcessNames') ?? []
      const toAdd = profile.processNames.map(normalizeProcessName).filter((n) => !current.includes(n))
      if (toAdd.length > 0) {
        store.set('excludedProcessNames', [...current, ...toAdd])
      }
      this.purgeAutoCreatedKeysFor(profile.processNames)
    } else if (mode === 'delete' && profile) {
      this.purgeAutoCreatedKeysFor(profile.processNames)
    }
    const profiles = this.getAll().filter((p) => p.id !== id)
    store.set('profiles', profiles)
    const active = store.get('settings').activeProfileId
    if (active === id) {
      this.setActive(DEFAULT_PROFILE_ID)
    }
  }

  getExcluded(): string[] {
    return store.get('excludedProcessNames') ?? []
  }

  unexclude(name: string): void {
    const key = normalizeProcessName(name)
    const snapshots = store.get('deletedProfileSnapshots') ?? []
    const snapshotIdx = snapshots.findIndex((s) =>
      s.processNames.some((n) => normalizeProcessName(n) === key),
    )
    if (snapshotIdx !== -1) {
      const snapshot = snapshots[snapshotIdx]
      const existing = this.getAll()
      if (!existing.find((p) => p.id === snapshot.id)) {
        store.set('profiles', [...existing, snapshot])
      }
      const allKeys = snapshot.processNames.map(normalizeProcessName)
      const excluded = store.get('excludedProcessNames') ?? []
      store.set('excludedProcessNames', excluded.filter((n) => !allKeys.includes(n)))
      store.set(
        'deletedProfileSnapshots',
        snapshots.filter((_, i) => i !== snapshotIdx),
      )
      this.purgeAutoCreatedKeysFor(snapshot.processNames)
    } else {
      const current = store.get('excludedProcessNames') ?? []
      store.set('excludedProcessNames', current.filter((n) => n !== key))
    }
  }

  setActive(id: string, manual = false): Profile {
    const profile = this.getById(id) ?? this.getDefault()
    if (manual) {
      this.manualOverride = profile.id !== DEFAULT_PROFILE_ID
    }
    const settings = store.get('settings')
    if (settings.activeProfileId !== profile.id) {
      for (const cb of this.beforeSwitchListeners) cb(settings.activeProfileId, profile.id)
      store.set('settings', { ...settings, activeProfileId: profile.id })
      for (const cb of this.listeners) cb(profile)
    }
    return profile
  }

  // ─────────────────────── Listeners ───────────────────────

  onChange(cb: ProfileChangeListener): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  onBeforeSwitch(cb: ProfileBeforeSwitchListener): () => void {
    this.beforeSwitchListeners.add(cb)
    return () => {
      this.beforeSwitchListeners.delete(cb)
    }
  }

  onProfileDataChanged(cb: ProfileDataChangeListener): () => void {
    this.dataChangeListeners.add(cb)
    return () => {
      this.dataChangeListeners.delete(cb)
    }
  }

  onAutoDetected(cb: ProfileAutoDetectedListener): () => void {
    this.autoDetectedListeners.add(cb)
    return () => {
      this.autoDetectedListeners.delete(cb)
    }
  }

  onAutoGameClosed(cb: ProfileAutoGameClosedListener): () => void {
    this.autoGameClosedListeners.add(cb)
    return () => {
      this.autoGameClosedListeners.delete(cb)
    }
  }

  onGameUndetected(cb: GameUndetectedListener): () => void {
    this.gameUndetectedListeners.add(cb)
    return () => {
      this.gameUndetectedListeners.delete(cb)
    }
  }

  // ─────────────────────── Polling ─────────────────────────

  forceDetect(): void {
    this.lastAutoDetectAt = 0
    void this.autoDetectGames()
  }

  startPolling(): void {
    if (this.pollHandle) return
    this.pollHandle = setInterval(() => {
      void this.pollOnce()
    }, this.currentPollIntervalMs)
    void this.pollOnce()
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle)
      this.pollHandle = null
    }
  }

  setPollMode(mode: 'active' | 'idle'): void {
    const next = mode === 'idle' ? PROCESS_POLL_IDLE_INTERVAL_MS : PROCESS_POLL_INTERVAL_MS
    if (next === this.currentPollIntervalMs) return
    this.currentPollIntervalMs = next
    if (this.pollHandle) {
      clearInterval(this.pollHandle)
      this.pollHandle = setInterval(() => {
        void this.pollOnce()
      }, next)
    }
  }

  private async pollOnce(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const procs = await psList()
      const names = new Set(procs.map((p) => normalizeProcessName(p.name)))
      const profiles = this.getAll()
      let cacheIsFresh =
        Date.now() - this.visibleGamesCacheAt < AUTO_DETECT_THROTTLE_MS + VISIBLE_GAMES_CACHE_GRACE_MS

      // Build candidate matches. Closure so it can be re-evaluated after a cache refresh.
      const buildMatches = (): Profile[] =>
        profiles.filter((p) => {
          if (p.id === DEFAULT_PROFILE_ID) return false
          return p.processNames.some((pn) => {
            const norm = normalizeProcessName(pn)
            if (!names.has(norm)) return false
            if (!cacheIsFresh) return true
            const entries = this.visibleGamesCache.get(norm)
            if (!entries || entries.length === 0) return true
            // Accept only if at least one visible-window entry is consistent with this profile.
            return entries.some((cached) => {
              if (
                p.gameDisplayName &&
                cached.displayName &&
                p.gameDisplayName.toLowerCase() !== cached.displayName.toLowerCase()
              ) {
                return false
              }
              if (p.exePaths && p.exePaths.length > 0 && cached.exePath) {
                return p.exePaths.some((ep) => ep.toLowerCase() === cached.exePath)
              }
              return true
            })
          })
        })

      let matches = buildMatches()

      // ── Exe-sharing disambiguation ──────────────────────────────────────────
      // When multiple profiles share the same process name (e.g. PoE1/PoE2 both
      // use PathOfExile.exe), sorting by priority alone picks the wrong one.
      // We need a live getVisibleGames() scan to get the actual exe path from the
      // OS window list, then re-filter so only the correct profile survives.
      //
      // Returns true when ≥2 candidates collide on the same normalised process name.
      const hasAmbiguousSharedName = (candidates: Profile[]): boolean =>
        candidates.length > 1 &&
        candidates.some((m) =>
          m.processNames.some((pn) => {
            const norm = normalizeProcessName(pn)
            return (
              names.has(norm) &&
              candidates.some(
                (other) =>
                  other.id !== m.id &&
                  other.processNames.some((opn) => normalizeProcessName(opn) === norm),
              )
            )
          }),
        )

      if (hasAmbiguousSharedName(matches)) {
        // Always do a fresh scan — the cache may pre-date this launch and lack
        // the exe path needed to distinguish the correct profile.
        try {
          const games = await getVisibleGames()
          this.refreshVisibleGamesCache(games)
          cacheIsFresh = true
          matches = buildMatches()
        } catch {
          // best-effort — fall through
        }

        if (hasAmbiguousSharedName(matches)) {
          // Still ambiguous after a live scan.
          // If at least one candidate declares exePaths, disambiguation CAN work
          // once the game window becomes visible (still loading). Defer this poll
          // cycle and invalidate the cache so the next poll re-scans immediately.
          // If no candidate declares exePaths, we can't disambiguate by exe path
          // at all — fall through and let priority decide (existing behaviour).
          const canDisambiguateByExe = matches.some((m) => (m.exePaths?.length ?? 0) > 0)
          if (canDisambiguateByExe) {
            this.visibleGamesCacheAt = 0 // force fresh scan next poll
            return
          }
        }
      }

      if (matches.length > 0) {
        const current = this.getActive()
        const next = matches.sort((a, b) => b.priority - a.priority)[0]

        // If the user manually changed away from the auto-detected game profile
        // during the current session, respect their choice — don't force them back.
        const userChangedDuringSession =
          this.activeGameSessionId === next.id && current.id !== next.id

        if (!userChangedDuringSession) {
          // New game detected (or first detection this session) — re-enable auto-switching.
          this.manualOverride = false
          this.activeGameSessionId = next.id
          if (next.id !== current.id) {
            const matchedPn = next.processNames.find((pn) => names.has(normalizeProcessName(pn)))
            const matchedEntries = matchedPn ? (this.visibleGamesCache.get(normalizeProcessName(matchedPn)) ?? []) : []
            // Prefer the entry whose exePath matches this profile so the notification
            // appears on the correct screen when two games share a process name.
            const cachedGame =
              (next.exePaths?.length
                ? matchedEntries.find((e) => next.exePaths!.some((ep) => ep.toLowerCase() === e.exePath))
                : undefined) ?? matchedEntries[0]
            const screenPoint =
              cachedGame && (cachedGame.cx !== 0 || cachedGame.cy !== 0)
                ? { x: cachedGame.cx, y: cachedGame.cy }
                : undefined
            if (store.get('settings').autoSwitchProfile !== false) {
              this.setActive(next.id)
              for (const cb of this.autoDetectedListeners) cb(next, false, current.id, screenPoint)
            }
          }
        }

        if (!next.iconUrl && next.processNames.length > 0) {
          const matchedName = next.processNames.find((pn) => names.has(normalizeProcessName(pn)))
          if (matchedName) {
            void getExeIcon(matchedName)
              .then((dataUrl) => {
                if (dataUrl) this.update(next.id, { iconUrl: dataUrl })
              })
              .catch(() => {
                /* icon fetch is best-effort */
              })
          }
        }
      } else {
        // No game detected — clear the session so the next game starts fresh.
        this.activeGameSessionId = null
        if (!this.manualOverride) {
          const current = this.getActive()
          if (current.id !== DEFAULT_PROFILE_ID && store.get('settings').autoSwitchProfile !== false) {
            // Stay on the game profile — don't auto-switch back to default.
            // Set manualOverride so this branch doesn't re-fire every poll cycle
            // while no game is running. It is cleared when a new game starts.
            this.manualOverride = true
            for (const cb of this.autoGameClosedListeners) cb(current.id)
            // Reset the throttle so the next game that starts triggers an immediate
            // autoDetectGames() scan rather than waiting up to 30 s.
            this.lastAutoDetectAt = 0
          }
        }
      }
      void this.autoDetectGames()
    } catch (err) {
      console.warn('[overframe:profiles] poll failed', err)
    } finally {
      this.polling = false
    }
  }

  /**
   * Scan visible windowed apps and auto-create a profile for any unrecognised
   * non-system app. Same-exe-name games are distinguished by exe path so two
   * installations sharing a binary name (e.g. PoE1/PoE2) each get a profile.
   */
  private async autoDetectGames(): Promise<void> {
    const now = Date.now()
    if (now - this.lastAutoDetectAt < AUTO_DETECT_THROTTLE_MS) return
    this.lastAutoDetectAt = now

    let games: Awaited<ReturnType<typeof getVisibleGames>>
    try {
      games = await getVisibleGames()
    } catch (err) {
      console.warn('[overframe:profiles] visible-games scan failed', err)
      return
    }

    this.refreshVisibleGamesCache(games)

    const allProfiles = this.getAll()
    const existingNames = new Set(allProfiles.flatMap((p) => p.processNames).map(normalizeProcessName))
    const excluded = new Set(store.get('excludedProcessNames') ?? [])
    const customGamePaths: string[] = store.get('customGamePaths') ?? []
    const userSettings = store.get('settings')
    const userBlocked = new Set((userSettings.blockedProcesses ?? [...DEFAULT_BLOCKED_PROCESSES]).map((s) => s.toLowerCase().replace(/\.exe$/i, '')))
    const nonGameDirs = userSettings.nonGameDirs ?? [...DEFAULT_NON_GAME_DIRS]
    const gamePathHints = userSettings.gamePathHints ?? [...DEFAULT_GAME_PATH_HINTS]
    const launcherExceptions = userSettings.launcherExceptions ?? []
    const pathFilteredCandidates: Array<{ processName: string; displayName: string; exePath: string }> = []

    for (const game of games) {
      const key = game.processName.toLowerCase()
      const normalizedPath = game.exePath.toLowerCase()
      const sessionKey = `${key}|${normalizedPath}`

      if (
        ALWAYS_BLOCKED.has(key) ||
        userBlocked.has(key) ||
        excluded.has(key) ||
        this.autoCreatedKeys.has(sessionKey)
      ) {
        continue
      }
      if (isLikelyLauncher(key, launcherExceptions)) continue

      if (existingNames.has(key)) {
        const pathAlreadyCovered = allProfiles.some(
          (p) =>
            p.processNames.some((n) => normalizeProcessName(n) === key) &&
            (p.exePaths ?? []).some((ep) => ep.toLowerCase() === normalizedPath),
        )
        if (pathAlreadyCovered) continue
      }

      if (!isLikelyGamePath(game.exePath, customGamePaths, nonGameDirs, gamePathHints)) {
        // Known system / peripheral vendor → silently ignore (not even suggested to the user)
        if (isLikelySystemDisplayName(game.displayName)) continue
        // Windowed app in a non-game directory → suggest to the user but never auto-create
        if (!game.isFullscreen) {
          pathFilteredCandidates.push({
            processName: key,
            displayName: game.displayName || key,
            exePath: game.exePath,
          })
          continue
        }
        // Fullscreen + non-game path → strong game signal, fall through to auto-create
      }

      if (userSettings.autoCreateProfiles === false) continue

      const displayName = this.deriveDisplayName(game, allProfiles, key)
      const iconUrl = await this.fetchExeIcon(game.exePath)

      let profile: Profile
      try {
        profile = this.create({
          name: displayName,
          processNames: [key],
          exePaths: [game.exePath],
          ...(game.displayName ? { gameDisplayName: game.displayName } : {}),
          ...(iconUrl ? { iconUrl } : {}),
        })
      } catch (err) {
        console.error('[overframe:profiles] create() failed for', key, err)
        continue
      }

      this.recordAutoCreatedKey(sessionKey)

      if (userSettings.autoSwitchProfile !== false) {
        const fromProfileId = this.getActive().id
        const screenPoint =
          game.windowCX !== 0 || game.windowCY !== 0
            ? { x: game.windowCX, y: game.windowCY }
            : undefined
        this.manualOverride = false
        this.setActive(profile.id)
        for (const cb of this.autoDetectedListeners) cb(profile, true, fromProfileId, screenPoint)
      }
    }

    const newCandidates = pathFilteredCandidates.filter(
      (c) => !this.shownUndetectedKeys.has(c.processName),
    )
    if (newCandidates.length > 0) {
      for (const c of newCandidates) this.shownUndetectedKeys.add(c.processName)
      for (const cb of this.gameUndetectedListeners) cb(newCandidates)
    }
  }

  // ──────────────────────── Helpers ────────────────────────

  private refreshVisibleGamesCache(games: Awaited<ReturnType<typeof getVisibleGames>>): void {
    this.visibleGamesCacheAt = Date.now()
    this.visibleGamesCache.clear()
    for (const g of games) {
      const k = g.processName.toLowerCase()
      const entry: VisibleGameCacheEntry = {
        exePath: g.exePath.toLowerCase(),
        displayName: g.displayName,
        cx: g.windowCX,
        cy: g.windowCY,
      }
      const existing = this.visibleGamesCache.get(k)
      if (existing) {
        existing.push(entry)
      } else {
        this.visibleGamesCache.set(k, [entry])
      }
    }
  }

  private deriveDisplayName(
    game: Awaited<ReturnType<typeof getVisibleGames>>[number],
    allProfiles: Profile[],
    key: string,
  ): string {
    const rawFriendlyName = game.displayName ? game.displayName.replace(PLATFORM_SUFFIX_RE, '').trim() : ''
    const cleanWindowTitle = game.windowTitle ? game.windowTitle.replace(PLATFORM_SUFFIX_RE, '').trim() : ''
    const baseName =
      rawFriendlyName ||
      cleanWindowTitle ||
      game.processName
        .replace(/\.exe$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim()

    /**
     * Two distinct games can share an identical PE friendly name (PoE1/PoE2 both
     * report "Path of Exile"). Fall back to the parent dir which reflects the
     * game folder and is unique per installation.
     */
    const nameCollides = allProfiles.some(
      (p) =>
        p.processNames.some((n) => normalizeProcessName(n) === key) &&
        p.name.toLowerCase() === baseName.toLowerCase(),
    )
    if (!nameCollides) return baseName
    const exeDir = game.exePath.replace(/[/\\][^/\\]+$/, '')
    const dirName = exeDir.replace(/.*[/\\]/, '').trim()
    return dirName && dirName.toLowerCase() !== key ? dirName : `${baseName} (2)`
  }

  private async fetchExeIcon(exePath: string): Promise<string | null> {
    try {
      const icon = await Promise.race([
        app.getFileIcon(exePath, { size: 'large' }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('icon timeout')), ICON_FETCH_TIMEOUT_MS),
        ),
      ])
      return (icon as Electron.NativeImage).toDataURL()
    } catch {
      return null
    }
  }

  private recordAutoCreatedKey(sessionKey: string): void {
    if (this.autoCreatedKeys.size >= AUTO_CREATED_KEYS_CAP) {
      const oldest = this.autoCreatedKeys.values().next().value
      if (oldest !== undefined) this.autoCreatedKeys.delete(oldest)
    }
    this.autoCreatedKeys.add(sessionKey)
  }

  private purgeAutoCreatedKeysFor(processNames: readonly string[]): void {
    for (const pn of processNames.map(normalizeProcessName)) {
      for (const k of [...this.autoCreatedKeys]) {
        if (k === pn || k.startsWith(`${pn}|`)) this.autoCreatedKeys.delete(k)
      }
    }
  }
}
