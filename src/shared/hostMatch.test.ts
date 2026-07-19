import { describe, it, expect } from 'vitest'
import { hostMatchesDomain } from './hostMatch'

describe('hostMatchesDomain', () => {
  it('matches the exact domain', () => {
    expect(hostMatchesDomain('instant-gaming.com', 'instant-gaming.com')).toBe(true)
  })

  it('matches any subdomain', () => {
    expect(hostMatchesDomain('www.instant-gaming.com', 'instant-gaming.com')).toBe(true)
    expect(hostMatchesDomain('a.b.twitch.tv', 'twitch.tv')).toBe(true)
  })

  it('is case-insensitive on both sides', () => {
    expect(hostMatchesDomain('WWW.Twitch.TV', 'twitch.tv')).toBe(true)
    expect(hostMatchesDomain('www.twitch.tv', 'Twitch.TV')).toBe(true)
  })

  it('rejects a spoofed suffix (domain embedded in an attacker host)', () => {
    expect(hostMatchesDomain('instant-gaming.com.evil.io', 'instant-gaming.com')).toBe(false)
  })

  it('rejects a prefixed lookalike', () => {
    expect(hostMatchesDomain('notinstant-gaming.com', 'instant-gaming.com')).toBe(false)
  })

  it('rejects an unrelated host', () => {
    expect(hostMatchesDomain('example.com', 'instant-gaming.com')).toBe(false)
  })
})
