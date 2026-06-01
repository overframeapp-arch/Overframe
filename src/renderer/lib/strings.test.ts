import { describe, it, expect } from 'vitest'
import { STRINGS } from './strings'

describe('STRINGS', () => {
  it('exposes toast copy', () => {
    expect(STRINGS.toast.profileCreated).toMatch(/Profile created/)
    expect(STRINGS.toast.profileActivated).toMatch(/Profile activated/)
  })

  it('exposes error copy', () => {
    expect(STRINGS.errors.bookmarkSaveFailed).toBe('Failed to save bookmark.')
    expect(STRINGS.errors.bookmarkRemoveFailed).toBe('Failed to remove bookmark.')
    expect(STRINGS.errors.rendererCrashed).toContain('crashed')
  })
})
