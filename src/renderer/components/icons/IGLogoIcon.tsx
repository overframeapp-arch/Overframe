import { useId } from 'react'

/**
 * Instant Gaming compact logo icon.
 * Uses React 18 useId() for unique SVG gradient IDs — safe when multiple
 * instances coexist in the DOM (AddressBar, IGNudge, WelcomePage, IGGamePromo).
 */
export function IGLogoIcon({
  size = 20,
  className,
  mono = false,
}: {
  size?: number | string
  className?: string
  /** Render in a single `currentColor` tone (for neutral toolbar icons) instead of the orange gradient. */
  mono?: boolean
}): JSX.Element {
  const uid = useId()
  const gradA = `${uid}-a`
  const gradB = `${uid}-b`
  const fillA = mono ? 'currentColor' : `url(#${gradA})`
  const fillB = mono ? 'currentColor' : `url(#${gradB})`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 323 348"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {!mono && (
        <defs>
          <linearGradient id={gradA} x1="-0.5" y1="348" x2="319" y2="167" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff8a15" />
            <stop offset="100%" stopColor="#ff3131" />
          </linearGradient>
          <linearGradient id={gradB} x1="11" y1="219" x2="97" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff771b" />
            <stop offset="100%" stopColor="#ff452b" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <g transform="matrix(1.014 0 0 1.014 0 -4.9)">
        <path
          d="M50.1 4.8a16.7 16.7 0 0 0-7.9 2.2L8.4 26.5C.4 31.1-2.4 41.4 2.2 49.4c3.1 5.4 8.7 8.4 14.5 8.4a16.7 16.7 0 0 0 8.4-2.2L58.8 36.2c8-4.6 10.8-14.9 6.1-22.9-3.2-5.5-9-8.5-15-8.4zm84.2 48.3c-2.9 0-5.8.7-8.4 2.2L8.4 123.1c-8 4.6-10.8 14.9-6.1 22.9 3.1 5.4 8.7 8.4 14.5 8.4a16.7 16.7 0 0 0 8.4-2.2l109-62.9 134.2 77.4L33.6 302.2v-58.1l1.9-1.1-24.5-24.6-2.5 1.5c-5.2 3-8.4 8.5-8.4 14.5v96.8c0 6 3.2 11.5 8.4 14.5 2.6 1.5 5.5 2.2 8.4 2.2a16.8 16.8 0 0 0 8.4-2.2L310.4 181.2a16.8 16.8 0 0 0 8.4-14.5c0-6-3.2-11.5-8.4-14.5l-83.6-48.2a14.6 14.6 0 0 0-.5-.3L142.6 55.3a16.8 16.8 0 0 0-8.4-2.2z"
          fill={fillA}
        />
        <path
          d="M184.5 118.3L15.6 215.7l-6.1 3.6 24 24.9 184.5-106.5z"
          fill={fillB}
        />
      </g>
    </svg>
  )
}
