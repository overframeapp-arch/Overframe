import { describe, it, expect } from 'vitest'
import { MISSIONS } from './missions'

describe('MISSIONS', () => {
  it('has at least the seven onboarding missions', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(7)
  })

  it('has unique ids', () => {
    const ids = MISSIONS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every mission has an icon, title and description', () => {
    for (const m of MISSIONS) {
      expect(m.icon).toBeTruthy()
      expect(m.title.length).toBeGreaterThan(0)
      expect(m.desc.length).toBeGreaterThan(0)
    }
  })

  it('the discord mission exposes a clickable https hint link', () => {
    const discord = MISSIONS.find((m) => m.id === 'join-discord')
    expect(discord).toBeDefined()
    expect(discord?.hint).toBeTruthy()
    expect(discord?.hintUrl).toMatch(/^https:\/\//)
  })
})
