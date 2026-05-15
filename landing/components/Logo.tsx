/**
 * Logo — the single source of truth for the Overframe brand mark on the web.
 *
 * Two layered rounded squares: a darker back "frame" (the game canvas) and a
 * brighter front "frame" (the floating overlay) sliding in from the bottom-
 * right. Amber gradient = primary brand colour, identical to the SVGs in
 * /public/icons/ used by the desktop app — keep them in sync.
 *
 * Each instance gets a unique gradient id (random suffix) so multiple
 * `<Logo />`s on the same page don't collide.
 */

import { useId } from 'react'

interface LogoProps {
  className?: string
  /** Render only the mark, no wordmark. Default: true. */
  markOnly?: boolean
  /** Wordmark text colour (CSS). Default: 'currentColor'. */
  wordmarkColor?: string
}

export function Logo({
  className = 'h-8 w-8',
  markOnly = true,
  wordmarkColor = 'currentColor',
}: LogoProps) {
  const uid = useId().replace(/:/g, '')
  const gFill = `of-fill-${uid}`
  const gDeep = `of-deep-${uid}`

  if (markOnly) {
    return (
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gFill} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={gDeep} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C2D12" />
            <stop offset="100%" stopColor="#1F0A02" />
          </linearGradient>
        </defs>
        <rect
          x="4"
          y="4"
          width="18"
          height="18"
          rx="3.5"
          fill={`url(#${gDeep})`}
          stroke={`url(#${gFill})`}
          strokeWidth="1.6"
        />
        <rect x="10" y="10" width="18" height="18" rx="3.5" fill={`url(#${gFill})`} />
      </svg>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo markOnly className="h-7 w-7" />
      <span className="text-lg font-bold tracking-tight" style={{ color: wordmarkColor }}>
        Overframe
      </span>
    </span>
  )
}
