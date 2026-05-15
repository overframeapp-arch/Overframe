'use client'

import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'
import { SITE_CONFIG } from '@/lib/config'

export function GameList() {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <section ref={ref} className="overflow-hidden py-16">
      <div className="mx-auto max-w-container px-6">
        <header className={cn('mx-auto max-w-xl text-center reveal', inView && 'in-view')}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
            Auto-detection
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold tracking-tight md:text-3xl">
            Works with every launcher you already use
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Overframe identifies your games automatically — no configuration required.
          </p>
        </header>
      </div>

      {/* Marquee */}
      <div
        className={cn('mt-10 reveal', inView && 'in-view reveal-delay-2')}
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)' }}
      >
        <div
          className="flex w-max gap-3"
          style={{ animation: 'marquee 28s linear infinite' }}
          aria-label="Supported platforms"
        >
          {[...SITE_CONFIG.supportedPlatforms, ...SITE_CONFIG.supportedPlatforms].map((p, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-full border border-border/60 bg-muted/20 px-5 py-2 text-sm text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              aria-hidden={i >= SITE_CONFIG.supportedPlatforms.length}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
