import type { Profile } from '@shared/types'

export type ProfileChangeListener = (profile: Profile) => void
export type ProfileBeforeSwitchListener = (fromId: string, toId: string) => void
export type ProfileDataChangeListener = (profile: Profile) => void
export type ProfileAutoDetectedListener = (
  profile: Profile,
  isNew: boolean,
  fromProfileId: string,
  screenPoint?: { x: number; y: number },
) => void
/**
 * Fires when the active game profile's process is no longer detected.
 * The profile is NOT automatically switched — the user stays on the game profile.
 * `fromProfileId` is the game profile that was active when the game closed.
 */
export type ProfileAutoGameClosedListener = (fromProfileId: string) => void
export type GameUndetectedListener = (
  candidates: Array<{ processName: string; displayName: string; exePath: string }>,
) => void

export const AUTO_DETECT_THROTTLE_MS = 30_000
export const VISIBLE_GAMES_CACHE_GRACE_MS = 5_000
export const AUTO_CREATED_KEYS_CAP = 200
export const ICON_FETCH_TIMEOUT_MS = 3_000
