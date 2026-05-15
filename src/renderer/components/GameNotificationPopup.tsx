import { useEffect, useRef, useState } from 'react'
import type { GameNotificationPayload } from '@shared/types'
import { ProfileIcon } from './ProfileIcon'

/** Must match the 6 s timer in PopupWindow.ts (cosmetic — bar & timer are independent). */
const DURATION_MS = 6_000
const SLIDE_OUT_MS = 300

interface Props {
  data: GameNotificationPayload
}

export function GameNotificationPopup({ data }: Props): JSX.Element {
  const { profile, isNew, shortcut } = data

  const [entered, setEntered] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide-in on first frame
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Progress bar: CSS transition scaleX(1→0), no @keyframes needed
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transformOrigin = 'left'
    el.style.transform = 'scaleX(1)'
    void el.getBoundingClientRect() // force reflow so browser registers start value
    el.style.transition = `transform ${DURATION_MS}ms linear`
    el.style.transform = 'scaleX(0)'
  }, [])

  const startLeaveRef = useRef<() => void>(() => { /* filled below */ })
  startLeaveRef.current = (): void => {
    if (leaveTimer.current !== null) return
    const el = containerRef.current
    if (el) {
      el.style.transition = `transform ${SLIDE_OUT_MS}ms ease-in, opacity ${SLIDE_OUT_MS - 60}ms ease`
      el.style.transform = 'translateY(-115%)'
      el.style.opacity = '0'
    }
    leaveTimer.current = setTimeout(() => {
      window.aether.popup.closeNotification()
    }, SLIDE_OUT_MS + 80)
  }

  useEffect(() => {
    const unsub = window.aether.on.notifDismiss(() => startLeaveRef.current())
    return () => {
      unsub()
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current)
    }
  }, [])

  const handleClick = (): void => {
    window.aether.overlay.show()
    window.aether.popup.closeNotification()
  }

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col rounded-lg overflow-hidden cursor-pointer select-none bg-background/95 border border-border/60 shadow-xl hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() }
        else if (e.key === 'Escape') { e.preventDefault(); window.aether.popup.closeNotification() }
      }}
      aria-label={`${isNew ? 'New profile created' : 'Profile activated'}: ${profile.name}. Click to open the overlay.`}
      style={{
        transform: entered ? 'translateY(0)' : 'translateY(-115%)',
        opacity: entered ? 1 : 0,
        transition: 'transform 300ms cubic-bezier(0.34, 1.26, 0.64, 1), opacity 220ms ease, background-color 100ms ease',
      }}
    >
      {/* Content row */}
      <div className="flex items-center gap-2.5 px-3 flex-1">
        <ProfileIcon iconUrl={profile.iconUrl} name={profile.name} size={30} />

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] text-muted-foreground leading-none mb-0.5">
            {isNew ? 'New profile created' : 'Profile activated'}
          </span>
          <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {profile.name}
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-muted-foreground/60 leading-none">Open overlay</span>
          {shortcut ? (
            <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted/60 border border-border/50 text-muted-foreground leading-none">
              {shortcut}
            </kbd>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">→</span>
          )}
        </div>
      </div>

      {/* Progress bar — CSS transition scaleX(1→0), pauses/resumes via direct DOM ref */}
      <div className="h-[3px] bg-border/20 shrink-0">
        <div ref={barRef} className="h-full bg-primary/50" />
      </div>
    </div>
  )
}

