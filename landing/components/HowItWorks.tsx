'use client'

import { Download, Play, Share2, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

type Step = {
  n: string
  icon: LucideIcon
  title: string
  description: string
  kbd?: readonly string[]
}

const STEPS: Step[] = [
  {
    n: '1',
    icon: Download,
    title: 'Install in 30 seconds',
    description: 'Run the installer. No admin required, no background services.',
  },
  {
    n: '2',
    icon: Play,
    title: 'Remembers each game',
    description: 'Reopen the overlay and your tabs are right where you left them.',
    kbd: ['Alt', 'B'],
  },
  {
    n: '3',
    icon: Share2,
    title: 'Save it. Share it.',
    description: 'Export your setup as a short code. One paste and anyone gets your exact layout.',
  },
]

export function HowItWorks() {
  const [sectionRef, inView] = useInView<HTMLElement>()

  return (
    <section
      id="how"
      ref={sectionRef}
      className="scroll-mt-20 py-24"
      style={{ background: 'linear-gradient(180deg, #0d0d15 0%, #0b0b10 100%)' }}
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-container px-6">
        <h2
          id="how-heading"
          className={cn(
            'reveal max-w-xl text-balance text-3xl font-bold tracking-tight md:text-4xl',
            inView && 'in-view',
          )}
        >
          Up and running in 30 seconds.
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-border/30 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={cn(
                'reveal flex flex-col gap-5 bg-[#0b0b10] p-8 lg:p-10',
                inView && 'in-view',
                i === 1 && 'reveal-delay-2',
                i === 2 && 'reveal-delay-4',
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className="select-none font-mono text-[5rem] font-bold leading-none text-muted-foreground/[0.07]"
                  aria-hidden
                >
                  {s.n}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <s.icon size={22} aria-hidden />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </div>
              {s.kbd && (
                <div className="flex items-center gap-1.5">
                  {s.kbd.map((k, ki) => (
                    <span key={ki} className="flex items-center gap-1.5">
                      <kbd className="inline-flex min-w-[28px] items-center justify-center rounded border border-border/80 bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground/70 shadow-[0_2px_0_rgba(0,0,0,0.4)]">
                        {k}
                      </kbd>
                      {ki < s.kbd!.length - 1 && (
                        <span className="text-[10px] text-muted-foreground/40">+</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

            </div>
          ))}
        </div>

        <div className={cn('mt-10 text-center reveal reveal-delay-4', inView && 'in-view')}>
          <Link href="/download" className="btn-primary">
            <Download size={16} aria-hidden />
            Download free for Windows
          </Link>
        </div>
      </div>
    </section>
  )
}
