'use client'

import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

export function CreatorNote() {
  const [ref, inView] = useInView<HTMLElement>()

  return (
    <section
      ref={ref}
      className="scroll-mt-20 border-b border-border/20 px-6 py-16"
      aria-label="From the developer"
    >
      <div
        className={cn(
          'mx-auto max-w-2xl text-center reveal',
          inView && 'in-view',
        )}
      >
        {/* Opening quote mark */}
        <span
          className="mb-2 block select-none font-serif text-[3rem] leading-none text-primary/20"
          aria-hidden
        >
          &ldquo;
        </span>

        <p className="text-[1rem] leading-[1.85] text-[var(--text)]">
          Every PC gamer has been there: mid-session, something to check, forced to alt-tab out.{' '}
          <span className="font-medium text-[var(--text-head)]">So I built something that stays.</span>
          {' '}Free, because the problem is real.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <p className="text-[0.82rem] text-muted-foreground">
            Solo developer &amp; PC gamer
          </p>
        </div>
      </div>
    </section>
  )
}
