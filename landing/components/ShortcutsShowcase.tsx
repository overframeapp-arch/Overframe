'use client'

import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

/**
 * Mirrors the 12 default global hotkeys defined in
 * `src/shared/types.ts` of the desktop app. All are remappable
 * from Settings and the keyboard hook is layout-aware
 * (QWERTY / AZERTY / DVORAK).
 */
const GROUPS: Array<{ label: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    label: 'Overlay',
    items: [
      { keys: ['Alt', 'B'], label: 'Show or hide the overlay' },
      { keys: ['Alt', 'C'], label: 'Toggle click-through to the game' },
      { keys: ['Ctrl', 'Shift', 'F'], label: 'Toggle focus mode (hide chrome)' },
      { keys: ['Ctrl', 'Shift', '↑'], label: 'Increase opacity' },
      { keys: ['Ctrl', 'Shift', '↓'], label: 'Decrease opacity' },
    ],
  },
  {
    label: 'Tabs',
    items: [
      { keys: ['Ctrl', 'T'], label: 'New tab' },
      { keys: ['Ctrl', 'W'], label: 'Close active tab' },
      { keys: ['Ctrl', 'PageUp'], label: 'Previous tab' },
      { keys: ['Ctrl', 'PageDown'], label: 'Next tab' },
      { keys: ['Ctrl', 'R'], label: 'Reload page' },
    ],
  },
  {
    label: 'Navigation',
    items: [
      { keys: ['Alt', '←'], label: 'Go back' },
      { keys: ['Alt', '→'], label: 'Go forward' },
    ],
  },
]

export function ShortcutsShowcase() {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <section
      id="shortcuts"
      ref={ref}
      className="mx-auto max-w-container scroll-mt-20 px-6 py-24"
      aria-labelledby="shortcuts-heading"
    >
      <header className={cn('mx-auto max-w-2xl text-center reveal', inView && 'in-view')}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
          Shortcuts
        </p>
        <h2
          id="shortcuts-heading"
          className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-[2.8rem]"
        >
          Hands stay on the keyboard.
          <br />
          <span className="text-muted-foreground">Eyes stay on the game.</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          12 shortcuts, all remappable from Settings. Works on QWERTY, AZERTY and DVORAK.
        </p>
      </header>

      <div
        className={cn(
          'reveal mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-border/60',
          inView && 'in-view reveal-delay-2',
        )}
        style={{ background: '#0e0e18' }}
      >
        {/* Terminal-style title bar */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" aria-hidden />
          <span className="ml-3 font-mono text-[11px] text-muted-foreground/50">
            overframe — default global hotkeys
          </span>
        </div>

        <div className="divide-y divide-border/30">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="bg-white/[0.015] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
                {group.label}
              </div>
              <ul className="divide-y divide-border/20">
                {group.items.map((s) => (
                  <li
                    key={s.label}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-white/[0.02]"
                  >
                    <span className="text-sm text-foreground/80">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {s.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1.5">
                          <kbd className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-border/80 bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground/80 shadow-[0_3px_0_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-150 hover:translate-y-[2px] hover:shadow-[0_1px_0_rgba(0,0,0,0.45)]">
                            {k}
                          </kbd>
                          {ki < s.keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground/40">+</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/50">
        Don’t like a binding? Remap it in Settings → Shortcuts in seconds.
      </p>
    </section>
  )
}
