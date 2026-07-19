/**
 * Heuristics for distinguishing games from system processes/launchers.
 *
 * All matchers operate on lowercase strings without `.exe`. Splitting them
 * out lets us unit-test them independently of the polling loop.
 */

import { DEFAULT_BLOCKED_PROCESSES, DEFAULT_GAME_PATH_HINTS, DEFAULT_NON_GAME_DIRS, LAUNCHER_NAME_PATTERNS } from '@shared/gameDefaults'

/**
 * Combined set of self-protection names + user-editable defaults.
 * Exported so unit tests can assert membership; at runtime ProfileManager
 * uses `ALWAYS_BLOCKED` + the user-owned `blockedProcesses` setting instead.
 */
export const NON_GAME_BLOCKLIST = new Set([
  'electron', 'overframe',
  ...DEFAULT_BLOCKED_PROCESSES,
])

const SYSTEM_VENDORS = [
  'microsoft', 'windows', 'nvidia', 'amd', 'intel', 'realtek', 'qualcomm',
  'broadcom', 'logitech', 'corsair', 'razer', 'steelseries', 'alienware',
  'adobe', 'google', 'mozilla', 'opera', 'chrome', 'firefox', 'edge',
  'visual studio', 'visual c++', '.net framework', 'directx', 'vcredist',
  'redistributable', 'runtime', 'sdk', 'driver', 'graphics',
  // ── Audio / peripheral OEM tools — these companies don't ship games;
  //    their management apps should be silently ignored during game detection.
  'sound blaster', 'soundblaster',              // Creative audio products (SB Command, SB X3…)
  'creative technology', 'creative labs',        // Creative Technology company strings
  'asus',                                        // ASUS Armoury Crate, ROG software
  'armory crate', 'armoury crate',              // ASUS ROG suite (in case display name omits "asus")
  'msi center', 'dragon center',                 // MSI peripheral suites
  'gigabyte',                                    // Gigabyte App Center / RGB Fusion
  'hyperx', 'hyperx ngenuity',                  // Kingston / HyperX peripherals
  'turtle beach',                                // Turtle Beach headsets
  'astro gaming',                                // ASTRO Command Center
  'sennheiser',                                  // Sennheiser HeadSetup / Smart Control
  'beyerdynamic',                                // beyerdynamic software
  'nahimic',                                     // Nahimic audio by MSI / ASUS
  'dolby',                                       // Dolby Access / Dolby Atmos
  'thx spatial',                                 // THX Spatial Audio
  'dts sound', 'dts:x',                         // DTS:X Ultra, DTS Sound Unbound
  'elgato', 'focusrite', 'behringer',           // Audio interfaces / capture cards
  // ── Security tools ────────────────────────────────────────────────────
  'kaspersky', 'bitdefender', 'malwarebytes',
  'avast', 'avg', 'mcafee', 'norton', 'webroot', 'symantec', 'eset', 'sophos',
  // ── Remote / admin tools ──────────────────────────────────────────────
  'teamviewer', 'anydesk',
]

export const PLATFORM_SUFFIX_RE =
  /[\s_-]+(steam|epic(\s*games)?|gog|origin|uplay|ubisoft\s*connect|xbox|gamepass|game\s*pass|microsoft\s*store|ea\s*app|battle\.?net|launcher)$/i

/**
 * Strips build/version/architecture noise commonly appended to game window
 * titles — e.g. "Subnautica 2 - Build 115506" → "Subnautica 2".
 *
 * Conservative by design: only removes *recognised* trailing noise tokens
 * (storefront suffix, "Build NNNN", dotted version, arch/renderer tags). It
 * never strips a trailing bare number or word that may belong to the real
 * title — "Half-Life 2", "Cyberpunk 2077", "F1 24", "DOOM (2016)" are kept.
 * Applied iteratively so combined noise ("Game - Build 12 (64-bit)") is cleared.
 */
export function cleanGameName(raw: string): string {
  if (!raw) return ''
  let s = raw.trim()
  let prev = ''
  while (s !== prev && s.length > 0) {
    prev = s
    s = s
      // Storefront suffix (Steam, Epic, GOG…)
      .replace(PLATFORM_SUFFIX_RE, '')
      // "Build 115506", "- Build 115506", "rev 42"
      .replace(/[\s|–—_-]*\b(?:build|rev(?:ision)?)\s*[#:]?\s*\d[\w.]*$/i, '')
      // Dotted version: "v1.2.3", "- 1.2", "(1.0.0)" — requires a dot so a bare
      // sequel number ("Portal 2") is never matched.
      .replace(/[\s|–—_-]*\(?\bv?\d+\.\d+(?:\.\d+){0,2}\)?$/i, '')
      // Architecture / renderer tags: "(64-bit)", "[DX12]", "x64", "Vulkan"
      .replace(
        /[\s|–—_-]*[([{]?\s*(?:64[\s-]?bit|32[\s-]?bit|x64|x86|dx1[12]|directx\s*1[12]|d3d1[12]|vulkan|opengl)\s*[)\]}]?$/i,
        '',
      )
      // Dangling separators / now-empty brackets left behind
      .replace(/[\s|–—_-]+$/, '')
      .replace(/[([{]\s*[)\]}]$/, '')
      .trim()
  }
  return s || raw.trim()
}

/**
 * True when the exe path lies under a known game install dir, a user-defined
 * custom dir, or any directory outside the standard system folders.
 *
 * @param nonGameDirs  Full list of path fragments to treat as non-game dirs.
 *   Defaults to the hardcoded NON_GAME_DIRS so unit tests that omit the arg
 *   continue to pass unchanged.
 * @param gamePathHints     Path hint strings used to positively identify game installs.
 *   Defaults to the built-in GAME_PATH_HINTS list.
 */
export function isLikelyGamePath(
  exePath: string,
  customGamePaths: readonly string[] = [],
  nonGameDirs: readonly string[] = DEFAULT_NON_GAME_DIRS,
  gamePathHints: readonly string[] = DEFAULT_GAME_PATH_HINTS,
): boolean {
  const lp = exePath.toLowerCase().replace(/\//g, '\\')
  if (gamePathHints.some((h) => lp.includes(h))) return true
  if (
    customGamePaths.some((cp) => {
      const norm = cp.toLowerCase().replace(/\//g, '\\').replace(/\\+$/, '') + '\\'
      return lp.startsWith(norm)
    })
  ) {
    return true
  }
  const dirs = nonGameDirs.map((d) => d.toLowerCase().replace(/\//g, '\\'))
  return !dirs.some((d) => lp.includes(d))
}

export function isLikelySystemDisplayName(displayName: string): boolean {
  const d = displayName.toLowerCase()
  return SYSTEM_VENDORS.some((v) => d.includes(v))
}

export function hasGameLikePeMetadata(displayName: string): boolean {
  if (!displayName || displayName.trim().length < 2) return false
  return !isLikelySystemDisplayName(displayName)
}

export function isLikelyLauncher(
  processName: string,
  exceptions: readonly string[] = [],
  patterns: readonly string[] = LAUNCHER_NAME_PATTERNS,
): boolean {
  const n = processName.toLowerCase().replace(/\.exe$/i, '')
  if (exceptions.some((e) => e.toLowerCase().replace(/\.exe$/i, '') === n)) return false
  return patterns.some((p) => n.includes(p.toLowerCase()))
}

export function normalizeProcessName(name: string): string {
  return name.trim().toLowerCase().replace(/\.exe$/i, '').trim()
}
