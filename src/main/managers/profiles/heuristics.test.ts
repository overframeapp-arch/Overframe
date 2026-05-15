import { describe, it, expect } from 'vitest'
import {
  isLikelyGamePath,
  isLikelyLauncher,
  isLikelySystemDisplayName,
  hasGameLikePeMetadata,
  normalizeProcessName,
  NON_GAME_BLOCKLIST,
  PLATFORM_SUFFIX_RE,
} from './heuristics'

describe('normalizeProcessName', () => {
  it('lowercases and strips .exe', () => {
    expect(normalizeProcessName('PathOfExile.exe')).toBe('pathofexile')
  })
  it('handles already-normalised input', () => {
    expect(normalizeProcessName('steam')).toBe('steam')
  })
  it('trims whitespace', () => {
    expect(normalizeProcessName('  Game.exe  ')).toBe('game')
  })
})

describe('NON_GAME_BLOCKLIST', () => {
  it('contains known non-game processes', () => {
    expect(NON_GAME_BLOCKLIST.has('steam')).toBe(true)
    expect(NON_GAME_BLOCKLIST.has('discord')).toBe(true)
    expect(NON_GAME_BLOCKLIST.has('chrome')).toBe(true)
  })
  it('does not contain a game exe', () => {
    expect(NON_GAME_BLOCKLIST.has('pathofexile')).toBe(false)
  })
})

describe('isLikelyGamePath', () => {
  it('matches Steam game paths', () => {
    expect(isLikelyGamePath('C:\\Program Files (x86)\\Steam\\steamapps\\common\\PathOfExile2\\PathOfExile.exe')).toBe(true)
  })
  it('matches Epic Games paths', () => {
    expect(isLikelyGamePath('D:\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe')).toBe(true)
  })
  it('rejects system paths', () => {
    expect(isLikelyGamePath('C:\\Program Files\\SomeApp\\app.exe')).toBe(false)
  })
  it('accepts custom game path', () => {
    expect(isLikelyGamePath('D:\\MyGames\\SomeGame\\game.exe', ['D:\\MyGames'])).toBe(true)
  })
  it('custom path match is case-insensitive', () => {
    expect(isLikelyGamePath('D:\\MYGAMES\\SomeGame\\game.exe', ['d:\\mygames'])).toBe(true)
  })
  it('rejects AppData paths as non-game', () => {
    expect(isLikelyGamePath('C:\\Users\\User\\AppData\\Local\\SomeApp\\app.exe')).toBe(false)
  })
})

describe('isLikelyLauncher', () => {
  it('detects launcher suffix', () => {
    expect(isLikelyLauncher('GameLauncher.exe')).toBe(true)
  })
  it('detects updater suffix', () => {
    expect(isLikelyLauncher('gameupdater')).toBe(true)
  })
  it('does not flag a plain game name', () => {
    expect(isLikelyLauncher('pathofexile')).toBe(false)
  })
  it('detects crash handler', () => {
    expect(isLikelyLauncher('CrashHandler.exe')).toBe(true)
  })
})

describe('isLikelySystemDisplayName', () => {
  it('flags Microsoft vendor strings', () => {
    expect(isLikelySystemDisplayName('Microsoft Visual C++ Redistributable')).toBe(true)
  })
  it('flags NVIDIA driver', () => {
    expect(isLikelySystemDisplayName('NVIDIA Graphics Driver')).toBe(true)
  })
  it('passes a game title', () => {
    expect(isLikelySystemDisplayName('Path of Exile 2')).toBe(false)
  })
  // ── Peripheral / audio management software ────────────────────────────
  it('flags Sound Blaster Command', () => {
    expect(isLikelySystemDisplayName('Sound Blaster Command')).toBe(true)
  })
  it('flags ASUS Armoury Crate', () => {
    expect(isLikelySystemDisplayName('ASUS Armoury Crate')).toBe(true)
  })
  it('flags Nahimic audio', () => {
    expect(isLikelySystemDisplayName('Nahimic 3')).toBe(true)
  })
  it('flags Dolby software', () => {
    expect(isLikelySystemDisplayName('Dolby Access')).toBe(true)
  })
  it('flags HyperX NGenuity', () => {
    expect(isLikelySystemDisplayName('HyperX NGenuity')).toBe(true)
  })
  it('does not flag an unrelated indie game', () => {
    expect(isLikelySystemDisplayName('Hollow Knight')).toBe(false)
  })
})

describe('hasGameLikePeMetadata', () => {
  it('returns true for a plausible game name', () => {
    expect(hasGameLikePeMetadata('Path of Exile 2')).toBe(true)
  })
  it('returns false for empty string', () => {
    expect(hasGameLikePeMetadata('')).toBe(false)
  })
  it('returns false for system vendor display name', () => {
    expect(hasGameLikePeMetadata('Microsoft DirectX Runtime')).toBe(false)
  })
})

describe('PLATFORM_SUFFIX_RE', () => {
  it('strips Steam suffix', () => {
    expect('Path of Exile Steam'.replace(PLATFORM_SUFFIX_RE, '').trim()).toBe('Path of Exile')
  })
  it('strips Epic Games suffix', () => {
    expect('Fortnite Epic Games'.replace(PLATFORM_SUFFIX_RE, '').trim()).toBe('Fortnite')
  })
  it('leaves plain names untouched', () => {
    expect('Path of Exile'.replace(PLATFORM_SUFFIX_RE, '').trim()).toBe('Path of Exile')
  })
})
