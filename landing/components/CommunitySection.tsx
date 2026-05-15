'use client'

import { MessageCircle, Github } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/config'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

export function CommunitySection() {
  const [sectionRef, inView] = useInView<HTMLElement>()

  return (
    <section
      id="community"
      ref={sectionRef}
      className="relative scroll-mt-20 overflow-hidden border-y border-border/30 py-24"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto max-w-container px-6">
        <div
          className={cn(
            'reveal flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between',
            inView && 'in-view',
          )}
        >
          <div className="max-w-xl">
            <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
              Built in the open.
              <br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Shaped on Discord.
              </span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
              Discord is where Overframe lives between releases — bug triage, feature votes and
              curated link collections. Direct line to the maintainers, no support tickets.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={SITE_CONFIG.links.discord}
              target="_blank"
              rel="noreferrer noopener"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-[0_0_40px_-10px_rgba(99,102,241,0.7)] transition-all duration-300 hover:scale-[1.02] hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <span
                aria-hidden
                className="absolute inset-0 -skew-x-12 translate-x-[-120%] bg-white/15 transition-transform duration-700 group-hover:translate-x-[200%]"
              />
              <MessageCircle size={18} aria-hidden />
              Join the Discord
            </a>
            <a
              href={SITE_CONFIG.links.github}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-7 py-3.5 text-base font-semibold transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Github size={18} aria-hidden />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
