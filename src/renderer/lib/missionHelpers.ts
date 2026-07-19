import type { Mission } from './missions'
import type { Shortcuts } from '@shared/types'

/**
 * Resolves a mission's description, substituting the "{shortcut}" token (if the
 * mission has one) with the user's CURRENT accelerator for that action — never
 * the hardcoded default baked into the mission's `desc` string, so a rebound
 * shortcut is reflected immediately instead of showing a stale key combo.
 */
export function resolveMissionDesc(mission: Mission, shortcuts: Shortcuts | undefined): string {
  if (!mission.shortcutId) return mission.desc
  const accel = shortcuts?.[mission.shortcutId]
  if (!accel) return mission.desc.replace('{shortcut}', 'a shortcut (set one in Settings → Shortcuts)')
  return mission.desc.replace('{shortcut}', accel)
}

/** Hostnames of preset search-engine homepages — blocked from completing the
 *  "navigate to a website" mission since they open automatically as the new-tab page. */
const PRESET_HOMEPAGE_HOSTNAMES = new Set([
  'google.com',
  'bing.com',
  'www.bing.com',
  'search.brave.com',
])

/** Returns true for real websites — excludes blank pages, preset search-engine
 *  homepages (Google / Bing / Brave) and the user's configured custom homepage. */
export function isRealWebsite(url: string, customHomepageUrl?: string | null): boolean {
  if (!url || url === 'about:blank') return false
  try {
    const { hostname } = new URL(url)
    const bare = hostname.replace(/^www\./, '')
    // Block all google.com domains (google.com, maps.google.com, etc.)
    if (bare === 'google.com' || bare.endsWith('.google.com')) return false
    // Block other preset homepage hostnames
    if (PRESET_HOMEPAGE_HOSTNAMES.has(hostname)) return false
    // Block the user's configured custom homepage hostname
    if (customHomepageUrl) {
      try {
        if (hostname === new URL(customHomepageUrl).hostname) return false
      } catch { /* ignore malformed custom URL */ }
    }
    return true
  } catch {
    return false
  }
}
