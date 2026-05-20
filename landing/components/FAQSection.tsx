'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useInView } from '@/lib/useInView'

/**
 * Each answer starts with a one-sentence direct response so generative
 * search engines (ChatGPT, Perplexity, Gemini, Google AI Overviews) can
 * extract a clean, authoritative quote without paraphrasing.
 */
const FAQ_ITEMS = [
  {
    q: 'Will Overframe get me banned by anti-cheat?',
    a: "Safe with most anti-cheats. It works like the Discord overlay — a window on top, no game interaction. Vanguard (Valorant) is the main exception: hide it before queuing ranked.",
  },
  {
    q: 'Does it work in fullscreen?',
    a: "Yes, in borderless and windowed mode. Exclusive fullscreen is the only exception — switch to borderless in game settings, zero performance impact.",
  },
  {    q: 'Is Overframe really free? What’s the catch?',
    a: "Yes. No premium tier, no ads, no tracking. Full source on GitHub. Ko-fi inside the app if you want to support it.",
  },
  {
    q: 'Which games does it work with?',
    a: "All major launchers: Steam, Epic, GOG, Ubisoft, Xbox, EA and Riot. Each game gets a profile on first launch.",
  },
  {
    q: 'Does Overframe collect any data?',
    a: "No. Nothing leaves your machine. Profiles and history stay in a local file. Browsing is plain Chromium.",
  },
] as const

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0)
  const [sectionRef, inView] = useInView<HTMLElement>()

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="scroll-mt-20 px-6 py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-container">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
        {/* Left: sticky heading */}
        <div className={cn('reveal lg:sticky lg:top-24 lg:self-start', inView && 'in-view')}>
          <h2
            id="faq-heading"
            className="text-3xl font-bold tracking-tight md:text-4xl"
          >
            Questions.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Five quick ones.
          </p>
        </div>

        {/* Right: accordion */}
        <div className={cn('reveal', inView && 'in-view reveal-delay-2')}>
        <ul className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i
            return (
              <li
                key={item.q}
                className={cn(
                  'overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors duration-300',
                  isOpen && 'border-primary/40 bg-muted/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={cn(
                      'shrink-0 text-muted-foreground transition-transform duration-300',
                      isOpen && 'rotate-180 text-primary',
                    )}
                  />
                </button>
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        </div>
      </div>

      {/* Inject FAQPage schema for Google rich results & generative engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      </div>
    </section>
  )
}
