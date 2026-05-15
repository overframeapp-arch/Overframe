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
    q: 'What is Overframe in one sentence?',
    a: "Overframe is a free, open-source overlay browser for Windows that lets you read wikis, build guides and any web page on top of your game without alt-tabbing.",
  },
  {
    q: 'Will Overframe get me banned by anti-cheat?',
    a: "It is designed to be safe with mainstream anti-cheats. Overframe never injects code, never opens a handle on the game process and never reads its memory — it runs as a transparent always-on-top window using the same Windows compositor APIs as the Discord overlay. Some kernel-level systems (like Vanguard) are intentionally strict, so when in doubt, hide Overframe before queueing in ranked.",
  },
  {
    q: 'Does it work in fullscreen?',
    a: "Yes — in borderless and windowed modes, which is what virtually every modern game uses by default. True exclusive fullscreen is the only edge case; if your game still uses it, switch to borderless in the in-game settings (zero performance loss on Windows 10 and 11).",
  },
  {
    q: 'Is Overframe really free? What’s the catch?',
    a: "Yes, Overframe is 100% free with no premium tier, no ads, no telemetry and no account. The full source is on GitHub under the MIT licence. If you want to support development, there’s a Ko-fi link inside the app — entirely optional.",
  },
  {
    q: 'How do I share my collections with friends?',
    a: "Open the collection, click Export and Overframe encodes it as a single short string. Paste that into Discord, Steam chat or anywhere text goes. Your friends paste it back into Overframe and import the whole pack — wikis, calculators, build sites — in one click.",
  },
  {
    q: 'Which games and launchers are auto-detected?',
    a: "Overframe ships with profiles for 100+ games across Steam, Epic Games, GOG Galaxy, Battle.net, EA App, Riot Games, Ubisoft Connect, Xbox / Game Pass, Microsoft Store, Amazon Games, Rockstar Games and itch.io. Anything we don’t know yet can be added manually as a custom profile in two clicks.",
  },
  {
    q: 'Does Overframe collect data, telemetry or analytics?',
    a: "No. Zero telemetry, zero accounts, zero cloud sync. Profiles, collections and history live in a local SQLite file on your machine. Browsing is plain Chromium — the same privacy guarantees as a regular browser, with the built-in ad and tracker blocker on by default.",
  },
  {
    q: 'How much RAM and CPU does Overframe use?',
    a: "When hidden with Performance Mode on, Overframe fully unloads tabs and idles at near-zero CPU and minimal RAM. When visible, each open tab uses about as much memory as the same tab in Chrome — you can see live per-tab usage in the built-in memory profiler and close runaway tabs in one click.",
  },
  {
    q: 'Where do I report a bug or request a feature?',
    a: "Discord is the main hub. Join discord.gg/A2KPZn8WNd and post in #bug-reports or #feature-requests — every message is read, and the most-requested ideas ship. You can also open issues directly on the GitHub repository.",
  },
  {
    q: 'Does it work with AZERTY or DVORAK keyboard layouts?',
    a: "Yes. The global keyboard hook is layout-aware: hotkeys are mapped to physical key positions, not characters, so Alt+B works the same on QWERTY, AZERTY, DVORAK or any custom layout your OS reports.",
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
      className="mx-auto max-w-container scroll-mt-20 px-6 py-24"
      aria-labelledby="faq-heading"
    >
      <div className="grid gap-16 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
        {/* Left: sticky heading */}
        <div className={cn('reveal lg:sticky lg:top-24 lg:self-start', inView && 'in-view')}>
          <h2
            id="faq-heading"
            className="text-3xl font-bold tracking-tight md:text-4xl"
          >
            Common
            <br />
            questions.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Honest answers, no marketing fluff.
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
    </section>
  )
}
