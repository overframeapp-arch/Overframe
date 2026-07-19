import { useId } from 'react'

type Variant = 'purple' | 'orange'

const VARIANTS = {
  purple: { back: '#2e1065', backStroke: '#c4b5fd', gradStart: '#c4b5fd', gradEnd: '#6d28d9' },
  orange: { back: '#2a1400', backStroke: '#ff6400', gradStart: '#ff9d00', gradEnd: '#ff6400' },
} as const satisfies Record<Variant, { back: string; backStroke: string; gradStart: string; gradEnd: string }>

export function OverframeIcon({
  size = 20,
  variant = 'purple',
  className,
}: {
  size?: number | string
  variant?: Variant
  className?: string
}): JSX.Element {
  const uid = useId()
  const gradId = `${uid}-ov`
  const { back, backStroke, gradStart, gradEnd } = VARIANTS[variant]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="160" y1="160" x2="448" y2="448" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={gradStart} />
          <stop offset="100%" stopColor={gradEnd} />
        </linearGradient>
      </defs>
      <rect x="64"  y="64"  width="288" height="288" rx="56" fill={back} stroke={backStroke} strokeWidth="22" />
      <rect x="160" y="160" width="288" height="288" rx="56" fill={`url(#${gradId})`} />
    </svg>
  )
}
