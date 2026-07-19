/**
 * Instant Gaming affiliate catalog.
 * Tag: igr=overframe — appended to any instant-gaming.com URL.
 *
 * HOW TO ADD A GAME
 * ─────────────────
 * Add an entry to IG_CATALOG (before the catch-all) with:
 *
 *   exes         — known process names (lowercase, .exe optional).
 *                  Add every launcher variant you know of.
 *   keywords     — words that appear in the Overframe profile name (case-insensitive).
 *                  Fallback when no exe matches — useful when you don't know the exe.
 *   purchaseHint — label shown in the promo bar, e.g. "Valorant Points"
 *   browseUrl    — /en/search/?query=... URL (sub-paths like /fr/search/ return 404)
 *
 * Matching order: exact exe first, then keywords on profile name, then catch-all (*).
 */

import { hostMatchesDomain } from './hostMatch'

export const IG_AFFILIATE_TAG = 'overframe'
export const IG_BASE_URL      = 'https://www.instant-gaming.com'
export const IG_HOME          = `${IG_BASE_URL}/en/?igr=${IG_AFFILIATE_TAG}`

const PREPAID = `&product_types%5B%5D=prepaid&igr=${IG_AFFILIATE_TAG}`
const AFFILIATE = `&igr=${IG_AFFILIATE_TAG}`

// ── URL helpers ───────────────────────────────────────────────────────────────

export function isIGUrl(url: string): boolean {
  try { return hostMatchesDomain(new URL(url).hostname, 'instant-gaming.com') } catch { return false }
}
export function hasIGAffiliate(url: string): boolean {
  try { return new URL(url).searchParams.get('igr') === IG_AFFILIATE_TAG } catch { return false }
}
export function addIGAffiliate(url: string): string {
  try {
    const u = new URL(url)
    if (!hostMatchesDomain(u.hostname, 'instant-gaming.com')) return url
    u.searchParams.set('igr', IG_AFFILIATE_TAG)
    return u.toString()
  } catch { return url }
}

/**
 * Swaps /en/ to the user's browser locale — ONLY on the IG homepage path.
 * Sub-paths (/en/search/, etc.) do NOT have /fr/ equivalents and return 404.
 */
export function localizeIGUrl(url: string): string {
  try {
    const u = new URL(url)
    if (!/^\/en\/?$/.test(u.pathname)) return url
    const lang = navigator.language.split('-')[0].toLowerCase()
    const supported = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl']
    const locale = supported.includes(lang) ? lang : 'en'
    if (locale === 'en') return url
    u.pathname = `/${locale}/`
    return u.toString()
  } catch { return url }
}

// ── Catalog types ─────────────────────────────────────────────────────────────

export interface IGGameEntry {
  /**
   * Known process names (lowercase, .exe optional — the matcher normalises them).
   * Use ['*'] for the catch-all.
   */
  exes: string[]
  /**
   * Profile-name keywords (case-insensitive).
   * Fallback when no exe matches — so you can target a game without knowing its exe.
   */
  keywords?: string[]
  /** UI label, e.g. "Valorant Points". */
  purchaseHint: string
  /** /en/search/ URL — confirmed 200 on IG. */
  browseUrl: string
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// Order matters: more specific entries go first (WoW before generic Blizzard).

export const IG_CATALOG: IGGameEntry[] = [

  // ── Riot Games ───────────────────────────────────────────────────────────────
  {
    exes: ['valorant.exe', 'valorant-win64-shipping.exe'],
    keywords: ['valorant'],
    purchaseHint: 'Valorant Points',
    browseUrl: `${IG_BASE_URL}/en/search/?query=valorant+points${PREPAID}`,
  },
  {
    exes: ['leagueclientux.exe', 'leagueclient.exe', 'league of legends.exe'],
    keywords: ['league of legends'],
    purchaseHint: 'Riot Points',
    browseUrl: `${IG_BASE_URL}/en/search/?query=riot+points${PREPAID}`,
  },

  // ── Roblox ───────────────────────────────────────────────────────────────────
  {
    exes: ['robloxplayerbeta.exe', 'robloxplayer.exe'],
    keywords: ['roblox'],
    purchaseHint: 'Roblox Gift Card',
    browseUrl: `${IG_BASE_URL}/en/search/?query=roblox+gift+card${PREPAID}`,
  },

  // ── Guild Wars 2 ─────────────────────────────────────────────────────────────
  {
    exes: ['gw2-64.exe', 'gw2.exe'],
    keywords: ['guild wars'],
    purchaseHint: 'Guild Wars 2 Gems',
    browseUrl: `${IG_BASE_URL}/en/search/?query=guild+wars+2+gems${PREPAID}`,
  },

  // ── Blizzard — WoW first (more specific), then generic Battle.net ─────────────
  {
    exes: ['wow.exe', 'wow-64.exe', 'wowclassic.exe', 'wow_classic.exe'],
    keywords: ['world of warcraft', 'wow classic'],
    purchaseHint: 'WoW Game Time',
    browseUrl: `${IG_BASE_URL}/en/search/?query=world+of+warcraft+game+time${AFFILIATE}`,
  },
  {
    exes: ['battle.net.exe', 'battlenet.exe', 'battlenetlauncher.exe',
           'overwatch.exe', 'diablo iv.exe', 'hearthstone.exe', 'sc2_x64.exe'],
    keywords: ['blizzard', 'overwatch', 'diablo', 'hearthstone', 'starcraft'],
    purchaseHint: 'Battle.net Gift Card',
    browseUrl: `${IG_BASE_URL}/en/search/?query=battle.net+gift+card${PREPAID}`,
  },

  // ── EA / EA Sports ───────────────────────────────────────────────────────────
  {
    exes: ['fc26.exe', 'easportsfc26.exe', 'fc25.exe'],
    keywords: ['ea sports fc', 'fc 26', 'fc26', 'fifa'],
    purchaseHint: 'FC Points',
    browseUrl: `${IG_BASE_URL}/en/search/?query=ea+fc+points${PREPAID}`,
  },
  {
    exes: ['eadesktop.exe', 'easteam.exe', 'origin.exe', 'eaapp.exe'],
    keywords: ['ea play', 'electronic arts'],
    purchaseHint: 'EA Play',
    browseUrl: `${IG_BASE_URL}/en/search/?query=ea+play${AFFILIATE}`,
  },

  // ── Xbox ─────────────────────────────────────────────────────────────────────
  {
    exes: ['xboxapp.exe', 'xgamingoverlay.exe'],
    keywords: ['xbox game pass', 'game pass'],
    purchaseHint: 'Xbox Game Pass',
    browseUrl: `${IG_BASE_URL}/en/search/?query=xbox+game+pass${AFFILIATE}`,
  },
  {
    exes: [],
    keywords: ['xbox'],
    purchaseHint: 'Xbox Gift Card',
    browseUrl: `${IG_BASE_URL}/en/search/?query=xbox+gift+card${PREPAID}`,
  },

  // ── RuneScape ────────────────────────────────────────────────────────────────
  {
    exes: ['rs2client.exe', 'jagexlauncher.exe', 'runelite.exe', 'osclient.exe'],
    keywords: ['runescape', 'oldschool runescape', 'osrs'],
    purchaseHint: 'RuneScape Membership',
    browseUrl: `${IG_BASE_URL}/en/search/?query=runescape+membership${AFFILIATE}`,
  },

  // ── Steam games (gift card route) ────────────────────────────────────────────
  {
    exes: ['pathofexile.exe', 'pathofexile_x64.exe', 'pathofexilesteam.exe'],
    keywords: ['path of exile'],
    purchaseHint: 'Steam Gift Cards',
    browseUrl: `${IG_BASE_URL}/en/search/?query=steam+gift+card${PREPAID}`,
  },
  {
    exes: ['pathofexile2.exe', 'pathofexile2steam.exe'],
    keywords: ['path of exile 2'],
    purchaseHint: 'Steam Gift Cards',
    browseUrl: `${IG_BASE_URL}/en/search/?query=steam+gift+card${PREPAID}`,
  },
  {
    exes: ['warframe.exe', 'warframe.x64.exe'],
    keywords: ['warframe'],
    purchaseHint: 'Steam Gift Cards',
    browseUrl: `${IG_BASE_URL}/en/search/?query=steam+gift+card${PREPAID}`,
  },
  {
    exes: ['cs2.exe'],
    keywords: ['counter-strike', 'cs2'],
    purchaseHint: 'Steam Gift Cards',
    browseUrl: `${IG_BASE_URL}/en/search/?query=steam+gift+card${PREPAID}`,
  },
  {
    exes: ['rocketleague.exe'],
    keywords: ['rocket league'],
    purchaseHint: 'Rocket League Credits',
    browseUrl: `${IG_BASE_URL}/en/search/?query=rocket+league+credits${PREPAID}`,
  },

  // ── Catch-all — any unrecognised game ────────────────────────────────────
  {
    exes: ['*'],
    purchaseHint: 'PC game keys',
    browseUrl: IG_HOME,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeExe(name: string): string {
  const lower = name.toLowerCase()
  return lower.endsWith('.exe') ? lower : `${lower}.exe`
}

/**
 * Returns the best catalog entry for the active profile.
 * Matching order:
 *   1. Exact exe match against entry.exes
 *   2. Case-insensitive keyword match against profileName
 *   3. Catch-all (exes: ['*'])
 */
export function getCatalogForProfile(
  processNames: string[],
  profileId: string,
  defaultProfileId: string,
  profileName?: string,
): IGGameEntry | null {
  if (profileId === defaultProfileId) return null

  const normalizedExes = processNames.map(normalizeExe)

  // 1. Exact exe match
  for (const entry of IG_CATALOG) {
    if (entry.exes.includes('*')) continue
    if (entry.exes.some((e) => normalizedExes.includes(normalizeExe(e)))) return entry
  }

  // 2. Profile name keyword match
  if (profileName) {
    const lower = profileName.toLowerCase()
    for (const entry of IG_CATALOG) {
      if (entry.exes.includes('*')) continue
      if (entry.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) return entry
    }
  }

  return IG_CATALOG.find((e) => e.exes.includes('*')) ?? null
}
