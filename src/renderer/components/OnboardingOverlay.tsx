import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { DEFAULT_SHORTCUTS } from '@shared/types'

const KBD = 'inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 font-mono text-[11px] font-semibold bg-muted border border-border/80 rounded-md text-foreground/80 shadow-[0_2px_0_rgba(0,0,0,0.35)] leading-none'
const PLUS = <span className="text-[10px] text-muted-foreground/40">+</span>

function splitKeys(shortcut: string): string[] {
  return shortcut.split('+').map((k) => {
    if (k === 'Up') return '↑'
    if (k === 'Down') return '↓'
    return k
  })
}

function Keys({ shortcut }: { shortcut: string }): JSX.Element {
  const parts = splitKeys(shortcut)
  return (
    <span className="flex items-center gap-1 shrink-0">
      {parts.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          <kbd className={KBD}>{k}</kbd>
          {i < parts.length - 1 && PLUS}
        </span>
      ))}
    </span>
  )
}

/** Shows shared modifier prefix once: [Ctrl]+[Shift]+[↑]/[↓] */
function KeysDuo({ a, b }: { a: string; b: string }): JSX.Element {
  const pa = splitKeys(a)
  const pb = splitKeys(b)
  let pfx = 0
  while (pfx < pa.length - 1 && pfx < pb.length - 1 && pa[pfx] === pb[pfx]) pfx++
  const prefix = pa.slice(0, pfx)
  return (
    <span className="flex items-center gap-1 shrink-0">
      {prefix.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          <kbd className={KBD}>{k}</kbd>
          {PLUS}
        </span>
      ))}
      <kbd className={KBD}>{pa[pfx]}</kbd>
      <span className="text-[10px] text-muted-foreground/40">/</span>
      <kbd className={KBD}>{pb[pfx]}</kbd>
    </span>
  )
}

export function OnboardingOverlay(): JSX.Element | null {
  const { settings, setSettings } = useAppStore()
  const [step, setStep] = useState(0)

  if (!settings || settings.hasCompletedOnboarding) return null

  const finish = async (): Promise<void> => {
    const next = await window.aether.settings.set('hasCompletedOnboarding', true)
    if (next) setSettings(next)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="flex flex-col items-center gap-5 p-7 w-[360px] text-center bg-background border border-border/60 rounded-2xl shadow-2xl">

        {step === 0 ? (
          <>
            {/* ── Step 1: THE shortcut ─────────────────────────── */}
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary/50">
              Welcome to Overframe
            </p>

            {/* Giant key combo */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center gap-2">
                {splitKeys(DEFAULT_SHORTCUTS.toggleOverlay!).map((k, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <kbd className="inline-flex items-center justify-center min-w-[52px] h-[52px] px-4 font-mono text-[22px] font-bold bg-muted border-2 border-border/80 rounded-xl text-foreground shadow-[0_4px_0_rgba(0,0,0,0.5)] leading-none">
                      {k}
                    </kbd>
                    {i < arr.length - 1 && (
                      <span className="text-[18px] font-light text-muted-foreground/40">+</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/50 tracking-wide">
                show / hide · works from any game
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-[16px] font-semibold leading-snug tracking-tight">
                This is the only shortcut that matters.
              </h2>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Press it over your game to open Overframe. Press it again to make it vanish.
                Your game never loses focus.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full h-9 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Got it →
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                className="text-[10px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
              >
                Skip intro
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Step 2: Utility shortcuts ────────────────────── */}
            <h2 className="text-[16px] font-semibold leading-snug tracking-tight">
              You're all set.
            </h2>
            <p className="text-[12px] text-muted-foreground leading-relaxed -mt-2">
              Three more shortcuts — you'll use them every session.
            </p>

            <div className="flex flex-col gap-1.5 w-full text-left">

              {/* Click-through */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                <div>
                  <p className="text-[12px] font-medium text-foreground/90">Click-through</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Clicks go straight to the game</p>
                </div>
                <Keys shortcut={DEFAULT_SHORTCUTS.clickThrough!} />
              </div>

              {/* Focus mode */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                <div>
                  <p className="text-[12px] font-medium text-foreground/90">Focus mode</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Hides the toolbar, nothing else</p>
                </div>
                <Keys shortcut={DEFAULT_SHORTCUTS.toggleFocusMode!} />
              </div>

              {/* Opacity — compact prefix */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/40">
                <div>
                  <p className="text-[12px] font-medium text-foreground/90">Opacity</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tune transparency on the fly</p>
                </div>
                <KeysDuo a={DEFAULT_SHORTCUTS.opacityUp!} b={DEFAULT_SHORTCUTS.opacityDown!} />
              </div>

            </div>

            <div className="flex flex-col items-center gap-1.5 w-full">
              <button
                type="button"
                onClick={() => void finish()}
                className="w-full h-9 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Start browsing →
              </button>
              <p className="text-[10px] text-muted-foreground/30">
                All shortcuts can be changed in Settings
              </p>
            </div>
          </>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 -mt-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  )
}

