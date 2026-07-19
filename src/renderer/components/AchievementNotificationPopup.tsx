import { useEffect, useRef } from 'react'
import { Trophy } from 'lucide-react'
import type { AchievementPayload } from '@shared/types'

/** Matches the auto-dismiss timer set in PopupWindow (see _showNextAchievement). */
const DURATION_MS = 3_500

interface Props {
  data: AchievementPayload
}

/**
 * "Mission complete" toast. Rendered inside an opaque BrowserWindow embedded as a
 * WS_CHILD of the overlay (bottom-right, above the WebView2 content) — same model
 * as the IG promo. The card fills the window flat (no rounded corners / shadow /
 * slide, which need transparency an embedded child can't have); the window
 * appears/disappears instantly and the progress bar shows the countdown.
 */
export function AchievementNotificationPopup({ data }: Props): JSX.Element {
  const { title } = data
  const barRef = useRef<HTMLDivElement>(null)

  // Progress bar countdown (visual timer). Keyed on `title` so each queued toast
  // (the window is reused) restarts the countdown instead of staying at 0.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transformOrigin = 'left'
    el.style.transform = 'scaleX(1)'
    void el.getBoundingClientRect()
    el.style.transition = `transform ${DURATION_MS}ms linear`
    el.style.transform = 'scaleX(0)'
  }, [title])

  // Clicking takes the user straight to the Missions tab.
  const handleClick = (): void => { void window.aether.popup.navigateHome('missions') }

  return (
    <div
      onClick={handleClick}
      className="relative w-full h-full flex items-center gap-2.5 px-3 bg-background border border-border overflow-hidden cursor-pointer select-none"
    >
      {/* Yellow accent rail */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-yellow-400/80" aria-hidden="true" />

      <div className="shrink-0 ml-1 flex items-center justify-center w-7 h-7 rounded bg-yellow-500/15 border border-yellow-500/25">
        <Trophy size={14} className="text-yellow-400" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-yellow-400/70 leading-none mb-0.5">
          Mission complete
        </div>
        <div className="text-[11px] font-semibold text-foreground truncate leading-tight">
          {title}
        </div>
      </div>

      {/* Countdown progress bar */}
      <div ref={barRef} className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400/40" />
    </div>
  )
}
