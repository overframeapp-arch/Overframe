import { describe, it, expect, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { activateOnKey } from './a11y'

/** Build a minimal synthetic KeyboardEvent for a div acting as a button. */
function keyEvent(key: string, sameTarget = true): KeyboardEvent<HTMLDivElement> {
  const current = {} as EventTarget
  const inner = {} as EventTarget
  return {
    key,
    currentTarget: current,
    target: sameTarget ? current : inner,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>
}

describe('activateOnKey', () => {
  it('invokes the handler and prevents default on Enter', () => {
    const handler = vi.fn()
    const e = keyEvent('Enter')
    activateOnKey(handler)(e)
    expect(handler).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })

  it('invokes the handler on Space', () => {
    const handler = vi.fn()
    activateOnKey(handler)(keyEvent(' '))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores other keys', () => {
    const handler = vi.fn()
    const e = keyEvent('a')
    activateOnKey(handler)(e)
    expect(handler).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('ignores keystrokes bubbled from a focused inner control', () => {
    const handler = vi.fn()
    const e = keyEvent('Enter', false)
    activateOnKey(handler)(e)
    expect(handler).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
