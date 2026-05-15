import type { KeyboardEvent } from 'react'

// Activates Enter/Space on a div acting as a button — pair with role="button" tabIndex={0}.
export function activateOnKey<T extends Element>(
  handler: (e: KeyboardEvent<T>) => void
): (e: KeyboardEvent<T>) => void {
  return (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    // Don't intercept keystrokes the user meant for a focused inner control
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    handler(e)
  }
}
