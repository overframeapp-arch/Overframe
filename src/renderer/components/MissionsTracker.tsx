import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useMissionsStore } from '../store/missionsStore'
import { MISSIONS } from '../lib/missions'
import { DEFAULT_PROFILE_ID } from '@shared/types'

// ── URL helpers ───────────────────────────────────────────────────────────────
/** Returns true for real websites — excludes blank pages, Google homepage and
 *  any google.com domain (search results, images, maps, etc.) */
function isRealWebsite(url: string): boolean {
  if (!url || url === 'about:blank') return false
  try {
    const { hostname } = new URL(url)
    const bare = hostname.replace(/^www\./, '')
    // Block all google.com domains (google.com, maps.google.com, etc.)
    return bare !== 'google.com' && !bare.endsWith('.google.com')
  } catch {
    return false
  }
}

/** Returns true if the URL belongs to a Discord domain */
function isDiscordUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'discord.gg' || hostname === 'discord.com' || hostname.endsWith('.discord.com')
  } catch { return false }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MissionsTracker(): null {
  const { tabs, collections, overlayState, activeProfile } = useAppStore()
  const { complete, pendingUnlocked, shiftPendingUnlocked } = useMissionsStore()

  // ── Auto-completion watchers ───────────────────────────────────────────────

  useEffect(() => {
    if (tabs.some((t) => isRealWebsite(t.url))) complete('open-tab')
  }, [tabs, complete])

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
    if (tabs.some((t) => isDiscordUrl(t.url))) complete('join-discord')
  }, [tabs, complete])

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
