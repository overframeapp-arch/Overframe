import { useEffect, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { AchievementPayload } from '@shared/types'

/** Matches the 3.5 s auto-dismiss timer set in PopupWindow._showNextAchievement */
const DURATION_MS = 3_500
const SLIDE_OUT_MS = 280

interface Props {
  data: AchievementPayload
}

export function AchievementNotificationPopup({ data }: Props): JSX.Element {
  const { title } = data
  const [entered, setEntered] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Slide-in on first frame
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Progress bar animation
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transformOrigin = 'left'
    el.style.transform = 'scaleX(1)'
    void el.getBoundingClientRect()
    el.style.transition = `transform ${DURATION_MS}ms linear`
    el.style.transform = 'scaleX(0)'
  }, [])

  const startLeaveRef = useRef<() => void>(() => { /* filled below */ })
  startLeaveRef.current = (): void => {
    if (leaveTimer.current !== null) return
    const el = containerRef.current
    if (el) {
      el.style.transition = `transform ${SLIDE_OUT_MS}ms ease-in, opacity ${SLIDE_OUT_MS - 40}ms ease`
      el.style.transform = 'translateY(115%)'
      el.style.opacity = '0'
    }
    leaveTimer.current = setTimeout(() => {
      window.aether.popup.closeNotification()
    }, SLIDE_OUT_MS + 60)
  }

  // Listen to main process dismiss signal
  useEffect(() => {
    const unsub = window.aether.on.notifDismiss(() => startLeaveRef.current())
    return () => {
      unsub()
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current)
    }
  }, [])

  // Clicking navigates to the home/missions screen
  const handleClick = (): void => {
    void window.aether.tabs.deactivate()
    window.aether.popup.closeNotification()
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        onClick={handleClick}
        style={{
          transform: entered ? 'translateY(0)' : 'translateY(115%)',
          transition: entered ? `transform 320ms cubic-bezier(0.22,1,0.36,1)` : 'none',
          opacity: entered ? 1 : 0,
        }}
        className="w-full h-full cursor-pointer select-none"
      >
        <div className="relative w-full h-full bg-background/95 border border-border/80 rounded-lg shadow-2xl overflow-hidden flex items-center gap-2.5 px-3">
          {/* Trophy icon */}
          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded bg-yellow-500/15 border border-yellow-500/25">
            <Trophy size={14} className="text-yellow-400" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-yellow-400/70 leading-none mb-0.5">
              Mission
            </div>
            <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
              {title}
            </div>
          </div>

          {/* Progress bar */}
          <div
            ref={barRef}
            className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400/40 rounded-b-lg"
          />
        </div>
      </div>
    </div>
  )
}
