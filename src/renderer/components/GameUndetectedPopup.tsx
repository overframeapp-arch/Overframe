import { useEffect, useRef, useState } from 'react'
import type { GameUndetectedPayload } from '@shared/types'
import { Ban, Plus } from 'lucide-react'
import { ProfileIcon } from './ProfileIcon'

/** Must match the auto-dismiss timer in PopupWindow.ts (cosmetic — bar is independent). */
const DURATION_MS = 6_000
const SLIDE_OUT_MS = 300

interface Props {
  data: GameUndetectedPayload
}

export function GameUndetectedPopup({ data }: Props): JSX.Element {
  const { candidates } = data
  const primary = candidates[0]

  // Best display name: first candidate with a real (non-exe) display name, else the process name.
  const name =
    candidates.find((c) => c.displayName && c.displayName !== c.processName)?.displayName ??
    primary?.displayName ??
    primary?.processName ??
    'Unknown game'
  const extra = candidates.length > 1 ? ` +${candidates.length - 1}` : ''

  const [entered, setEntered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Slide-in on first frame (matches the game-detected notification).
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Progress bar: CSS transition scaleX(1→0).
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transformOrigin = 'left'
    el.style.transform = 'scaleX(1)'
    void el.getBoundingClientRect()
    el.style.transition = `transform ${DURATION_MS}ms linear`
    el.style.transform = 'scaleX(0)'
  }, [])

  const dismiss = (): void => {
    if (leaveTimer.current !== null) return
    const el = containerRef.current
    if (el) {
      el.style.transition = `transform ${SLIDE_OUT_MS}ms ease-in, opacity ${SLIDE_OUT_MS - 60}ms ease`
      el.style.transform = 'translateY(-115%)'
      el.style.opacity = '0'
    }
    leaveTimer.current = setTimeout(() => window.aether.popup.closeNotification(), SLIDE_OUT_MS + 80)
  }

  const handleCreate = (): void => {
    if (!primary) return
    // Create straight away — name + icon derived automatically, like an auto-created
    // game. The "profile created" notification fired by the detector replaces this one.
    void window.aether.profiles.createFromCandidate({
      processName: primary.processName,
      exePath: primary.exePath,
      displayName: primary.displayName,
    })
  }

  const handleBlock = (): void => {
    if (primary?.processName) void window.aether.profiles.exclude(primary.processName)
    dismiss()
  }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Unrecognized game: ${name}${extra}`}
      className="h-full flex flex-col rounded-lg overflow-hidden select-none bg-background/95 border border-border/60 shadow-xl"
      style={{
        transform: entered ? 'translateY(0)' : 'translateY(-115%)',
        opacity: entered ? 1 : 0,
        transition: 'transform 300ms cubic-bezier(0.34, 1.26, 0.64, 1), opacity 220ms ease',
      }}
    >
      <div className="flex items-center gap-2.5 px-3 flex-1">
        {/* Real game icon (from its window) + amber "unrecognized" badge */}
        <div className="relative shrink-0">
          <ProfileIcon iconUrl={primary?.iconDataUrl} name={name} size={30} />
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-background" />
          </span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] text-amber-400 leading-none mb-1">Unrecognized game</span>
          <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {name}{extra}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreate}
            aria-label={`Create a profile for ${name}`}
            className="flex items-center gap-1 h-7 pl-2 pr-2.5 rounded-md text-[11px] font-semibold bg-primary/15 text-primary hover:bg-primary/25 active:brightness-95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus size={12} aria-hidden="true" />
            Create profile
          </button>
          <button
            type="button"
            onClick={handleBlock}
            aria-label={`Never suggest ${primary?.processName ?? name} again`}
            title="Don't suggest this game again"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <Ban size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="h-[3px] bg-border/20 shrink-0">
        <div ref={barRef} className="h-full bg-amber-500/50" />
      </div>
    </div>
  )
}
