'use client'

import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'
import { SITE_CONFIG } from '@/lib/config'
import { DiscordIcon } from './DiscordIcon'
import { MessageSquare, Tv2 } from 'lucide-react'

export function CommunitySection() {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <section
      id="community"
      ref={ref}
      className="scroll-mt-20 px-6 py-24"
      style={{ background: 'linear-gradient(180deg, #0d0d16 0%, #0c0c14 100%)' }}
      aria-labelledby="community-heading"
    >
      <div className="mx-auto max-w-container">

        {/* Heading */}
        <div className={cn('mb-10 text-center reveal', inView && 'in-view')}>
          <span className="mb-3 block font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">
            Community
          </span>
          <h2
            id="community-heading"
            className="text-balance text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--text-head)]"
          >
            Shaped by everyone using it.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[0.9rem] leading-relaxed text-muted-foreground">
            What you share in Discord goes straight to the person writing the code.
            Every version is better because someone said something.
          </p>
        </div>

        {/* Two panels */}
        <div className={cn('mb-8 grid gap-4 sm:grid-cols-2 reveal reveal-delay-1', inView && 'in-view')}>
          <div className="flex flex-col gap-3 rounded-xl border border-border/30 bg-[#0b0b10] px-6 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-primary/70">
              <MessageSquare size={16} aria-hidden />
            </div>
            <p className="text-[0.93rem] font-semibold text-[var(--text-head)]">Players</p>
            <p className="text-[0.84rem] leading-relaxed text-[var(--text)]">
              Bug, idea, or daily frustration &mdash; drop it in Discord.
              It goes straight into what gets built next.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-6 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary/70">
              <Tv2 size={16} aria-hidden />
            </div>
            <p className="text-[0.93rem] font-semibold text-[var(--text-head)]">Creators</p>
            <p className="text-[0.84rem] leading-relaxed text-[var(--text)]">
              Stream with Overframe? Share your setup or workflow in Discord.
              Creator tools get built from real use cases, not guesses.
            </p>
          </div>
        </div>

        {/* Discord CTA */}
        <div className={cn('flex justify-center reveal reveal-delay-2', inView && 'in-view')}>
          <a
            href={SITE_CONFIG.links.discord}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary"
          >
            <DiscordIcon size={16} aria-hidden />
            Join the Discord
          </a>
        </div>

      </div>
    </section>
  )
}
