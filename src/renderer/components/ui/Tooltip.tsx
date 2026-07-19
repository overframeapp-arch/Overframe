import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { cn } from '../../lib/cn'

interface TooltipProps {
  label: string
  children: React.ReactNode
  side?: 'top' | 'bottom'
  wrap?: boolean
}

export function Tooltip({ label, children, side = 'bottom', wrap = false }: TooltipProps): JSX.Element {
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)

  const show = (): void => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      x: rect.left + rect.width / 2,
      y: side === 'bottom' ? rect.bottom + 6 : rect.top - 6,
    })
  }

  return (
    <span ref={triggerRef} className="inline-flex" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
      {children}
      {pos !== null &&
        ReactDOM.createPortal(
          <span
            className={cn(
              'pointer-events-none fixed z-[9999] rounded',
              'bg-background px-2 py-1 text-[11px] text-foreground border border-border shadow',
              wrap ? 'max-w-[220px] whitespace-pre-wrap' : 'whitespace-nowrap',
            )}
            style={{
              left: pos.x,
              top: pos.y,
              transform: side === 'bottom' ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)',
            }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  )
}
