import { describe, it, expect } from 'vitest'
import { isRealWebsite, resolveMissionDesc } from './missionHelpers'
import type { Mission } from './missions'
import { DEFAULT_SHORTCUTS } from '@shared/types'

describe('isRealWebsite', () => {
  // ── Blanks ─────────────────────────────────────────────────────────────────
  it('rejects empty string', () => expect(isRealWebsite('')).toBe(false))
  it('rejects about:blank', () => expect(isRealWebsite('about:blank')).toBe(false))

  // ── Google ─────────────────────────────────────────────────────────────────
  it('rejects google.com homepage', () => expect(isRealWebsite('https://www.google.com')).toBe(false))
  it('rejects google.com search results', () => expect(isRealWebsite('https://www.google.com/search?q=games')).toBe(false))
  it('rejects maps.google.com', () => expect(isRealWebsite('https://maps.google.com')).toBe(false))
  it('rejects images.google.com', () => expect(isRealWebsite('https://images.google.com/search?q=cat')).toBe(false))

  // ── Bing ───────────────────────────────────────────────────────────────────
  it('rejects bing.com homepage', () => expect(isRealWebsite('https://www.bing.com')).toBe(false))
  it('rejects bing.com search results', () => expect(isRealWebsite('https://www.bing.com/search?q=games')).toBe(false))

  // ── Brave Search ───────────────────────────────────────────────────────────
  it('rejects search.brave.com homepage', () => expect(isRealWebsite('https://search.brave.com')).toBe(false))
  it('rejects search.brave.com search results', () => expect(isRealWebsite('https://search.brave.com/search?q=games')).toBe(false))
  it('accepts brave.com (browser site, not search engine)', () => expect(isRealWebsite('https://brave.com')).toBe(true))

  // ── Custom homepage ────────────────────────────────────────────────────────
  it('rejects custom homepage hostname when provided', () =>
    expect(isRealWebsite('https://youtube.com', 'https://youtube.com')).toBe(false))
  it('rejects custom homepage with path', () =>
    expect(isRealWebsite('https://twitch.tv/dashboard', 'https://twitch.tv')).toBe(false))
  it('accepts other sites when custom homepage is set', () =>
    expect(isRealWebsite('https://github.com', 'https://youtube.com')).toBe(true))
  it('ignores malformed custom homepage URL', () =>
    expect(isRealWebsite('https://github.com', 'not-a-url')).toBe(true))
  it('treats missing custom homepage as no extra exclusion', () =>
    expect(isRealWebsite('https://github.com')).toBe(true))
  it('treats null custom homepage as no extra exclusion', () =>
    expect(isRealWebsite('https://github.com', null)).toBe(true))

  // ── Real websites ──────────────────────────────────────────────────────────
  it('accepts github.com', () => expect(isRealWebsite('https://github.com')).toBe(true))
  it('accepts youtube.com with no custom homepage', () => expect(isRealWebsite('https://youtube.com')).toBe(true))
  it('accepts instant-gaming.com', () => expect(isRealWebsite('https://www.instant-gaming.com/fr/')).toBe(true))
  it('accepts twitch.tv', () => expect(isRealWebsite('https://www.twitch.tv')).toBe(true))
})

describe('resolveMissionDesc', () => {
  const baseMission: Mission = {
    id: 'test-mission',
    icon: () => null as unknown as JSX.Element,
    title: 'Test',
    desc: 'Static description with no token.',
  }

  it('returns desc unchanged when the mission has no shortcutId', () => {
    expect(resolveMissionDesc(baseMission, DEFAULT_SHORTCUTS)).toBe('Static description with no token.')
  })

  it('substitutes the current accelerator for the {shortcut} token', () => {
    const mission: Mission = { ...baseMission, desc: 'Press {shortcut} to toggle.', shortcutId: 'toggleOverlay' }
    expect(resolveMissionDesc(mission, DEFAULT_SHORTCUTS)).toBe('Press Alt+B to toggle.')
  })

  it('reflects a rebound shortcut instead of the default', () => {
    const mission: Mission = { ...baseMission, desc: 'Press {shortcut} to toggle.', shortcutId: 'toggleOverlay' }
    const rebound = { ...DEFAULT_SHORTCUTS, toggleOverlay: 'Ctrl+Shift+O' }
    expect(resolveMissionDesc(mission, rebound)).toBe('Press Ctrl+Shift+O to toggle.')
  })

  it('falls back to a prompt when the shortcut is disabled (null)', () => {
    const mission: Mission = { ...baseMission, desc: 'Press {shortcut} to toggle.', shortcutId: 'toggleOverlay' }
    const disabled = { ...DEFAULT_SHORTCUTS, toggleOverlay: null }
    expect(resolveMissionDesc(mission, disabled)).toBe('Press a shortcut (set one in Settings → Shortcuts) to toggle.')
  })

  it('falls back to a prompt when shortcuts is undefined', () => {
    const mission: Mission = { ...baseMission, desc: 'Press {shortcut} to toggle.', shortcutId: 'toggleOverlay' }
    expect(resolveMissionDesc(mission, undefined)).toBe('Press a shortcut (set one in Settings → Shortcuts) to toggle.')
  })
})
