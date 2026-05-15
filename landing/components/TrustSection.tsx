'use client'

import { X, Check, FileLock2 } from 'lucide-react'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

/**
 * Honest, technical breakdown of why Overframe is anti-cheat safe.
 * The strongest objection from competitive players — best handled
 * head-on with verifiable claims rather than hand-waving.
 */
const NEVER = [
  'Open a handle on the game process',
  'Read or write the game\u2019s memory',
  'Inject DLLs or hooks into the game',
  'Tamper with input or render pipelines',
  'Run a kernel driver or background service',
] as const

const ALWAYS = [
  'Render in a separate, transparent window',
  'Use the same compositor APIs as the Discord overlay',
  'Capture hotkeys via the documented WH_KEYBOARD_LL hook',
  'Stay fully open-source and auditable on GitHub',
  'Run entirely on your machine \u2014 zero telemetry',
] as const

export function TrustSection() {
  const [sectionRef, inView] = useInView<HTMLElement>()

  return (
    <section
      id="safety"
      ref={sectionRef}
      className="mx-auto max-w-container scroll-mt-20 px-6 py-24"
      aria-labelledby="safety-heading"
    >
      <div className={cn('max-w-2xl reveal', inView && 'in-view')}>
        <h2
          id="safety-heading"
          className="text-4xl font-bold tracking-tight md:text-5xl"
        >
          Anti-cheat safe.
          <br />
          <span className="text-muted-foreground">Here&apos;s exactly why.</span>
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Most overlays earn bans by crossing a line. Overframe was designed to stay on the right
          side of that line — architecturally identical to a transparent browser window.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
        {/* What we never do */}
        <div
          className={cn(
            'reveal rounded-2xl border border-rose-500/20 p-7',
            inView && 'in-view',
          )}
          style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.04), transparent)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
              aria-hidden
            >
              <X size={18} />
            </span>
            <h3 className="text-lg font-semibold">What Overframe never does</h3>
          </div>
          <ul className="mt-4 space-y-2.5">
            {NEVER.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <X
                  size={16}
                  className="mt-0.5 shrink-0 text-rose-400/80"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What we always do */}
        <div
          className={cn(
            'reveal rounded-2xl border border-emerald-500/20 p-7',
            inView && 'in-view reveal-delay-2',
          )}
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.04), transparent)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              aria-hidden
            >
              <Check size={18} />
            </span>
            <h3 className="text-lg font-semibold">What it actually does</h3>
          </div>
          <ul className="mt-4 space-y-2.5">
            {ALWAYS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Check
                  size={16}
                  className="mt-0.5 shrink-0 text-emerald-400/80"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p
        className={cn(
          'reveal mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground/70',
          inView && 'in-view reveal-delay-4',
        )}
      >
        <FileLock2 size={11} className="mr-1 inline-block" aria-hidden />
        Honest disclaimer: no overlay can guarantee compatibility with every anti-cheat
        forever. Some kernel-level systems (e.g.&nbsp;Vanguard) are intentionally strict — when in
        doubt, hide Overframe before queueing into a ranked match. We document our exact technical
        approach on GitHub so you can verify, not trust.
      </p>
    </section>
  )
}
