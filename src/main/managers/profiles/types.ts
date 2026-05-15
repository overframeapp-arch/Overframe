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
export type ProfileAutoReturnedToDefaultListener = (fromProfileId: string) => void
export type GameUndetectedListener = (
  candidates: Array<{ processName: string; displayName: string; exePath: string }>,
) => void

export const AUTO_DETECT_THROTTLE_MS = 30_000
export const VISIBLE_GAMES_CACHE_GRACE_MS = 5_000
export const AUTO_CREATED_KEYS_CAP = 200
export const ICON_FETCH_TIMEOUT_MS = 3_000
