import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useMissionsStore, STORAGE_KEY } from '../store/missionsStore'
import { MISSIONS } from '../lib/missions'
import { isRealWebsite } from '../lib/missionHelpers'
import { isIGUrl } from '@shared/ig-affiliate'
import { DEFAULT_PROFILE_ID } from '@shared/types'

/** The specific channel the user must land on to validate the "join Discord" mission.
 *  A `discord.com/channels/<guild>/<channel>` URL can only be reached as a *member*
 *  of that guild — non-members are bounced to an invite or login page. */
const OVERFRAME_DISCORD_MISSION_URL = 'https://discord.com/channels/1501993110291349584/1501993222908674109'

/** True only when the user is on the exact Overframe landing channel. */
function isOverframeDiscordUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    const { hostname: mh, pathname: mp } = new URL(OVERFRAME_DISCORD_MISSION_URL)
    return hostname === mh && pathname === mp
  } catch { return false }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MissionsTracker(): null {
  const { tabs, collections, overlayState, activeProfile, settings } = useAppStore()
  const { complete, pendingUnlocked, shiftPendingUnlocked } = useMissionsStore()

  // ── Auto-completion watchers ───────────────────────────────────────────────

  useEffect(() => {
    if (tabs.some((t) => isRealWebsite(t.url, settings?.homepageUrl))) complete('open-tab')
  }, [tabs, complete, settings?.homepageUrl])

  // Only fires when the user explicitly toggles the overlay via keyboard shortcut,
  // not when it is auto-hidden by game detection.
  useEffect(() => {
    return window.aether.on.overlayUserToggled(() => complete('overlay-toggled'))
  }, [complete])

  useEffect(() => {
    if (overlayState === 'CLICK_THROUGH') complete('use-clickthrough')
  }, [overlayState, complete])

  useEffect(() => {
    if (activeProfile && activeProfile.id !== DEFAULT_PROFILE_ID) complete('game-profile')
  }, [activeProfile, complete])

  useEffect(() => {
    if (collections.some((c) => c.links.length > 0)) complete('add-bookmark')
  }, [collections, complete])

  useEffect(() => {
    if (collections.length > 0) complete('create-collection')
  }, [collections, complete])

  useEffect(() => {
    if (tabs.some((t) => isOverframeDiscordUrl(t.url))) complete('join-discord')
  }, [tabs, complete])

  useEffect(() => {
    if (tabs.some((t) => isIGUrl(t.url))) complete('visit-ig')
  }, [tabs, complete])

  // ── Sync missions completed by other windows (e.g. the popup) via localStorage ─
  useEffect(() => {
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const newIds = JSON.parse(e.newValue) as string[]
        const { completed, pendingUnlocked } = useMissionsStore.getState()
        const newlyCompleted = newIds.filter((id) => !completed.includes(id))
        if (newlyCompleted.length > 0) {
          useMissionsStore.setState({
            completed: newIds,
            pendingUnlocked: [...pendingUnlocked, ...newlyCompleted]
          })
        }
      } catch { /* ignore malformed data */ }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // ── Drain notification queue — only while overlay is visible ────────────
  useEffect(() => {
    if (overlayState === 'HIDDEN') return
    if (pendingUnlocked.length === 0) return
    const id = pendingUnlocked[0]
    const mission = MISSIONS.find((m) => m.id === id)
    shiftPendingUnlocked()
    if (mission) void window.aether.achievement.notify(mission.title)
  }, [overlayState, pendingUnlocked, shiftPendingUnlocked])

  return null
}
