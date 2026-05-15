import type { Metadata } from 'next'
import Link from 'next/link'
import { Github } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes and version history for Overframe.',
  alternates: { canonical: '/changelog' },
}

interface Release {
  version: string
  date: string
  highlights: string[]
}

/**
 * Maintained manually for now — when we wire the GitHub Releases API, this
 * array becomes a fetch + revalidate (next: { revalidate: 3600 }).
 */
const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: 'Initial release',
    highlights: [
      'Transparent always-on-top browser overlay (Windows 10 / 11)',
      '3 modes: Active, Click-through, Hidden',
      'Multi-tab management with drag reorder and Performance mode',
      'Collections & bookmarks with pinned bar',
      'Game profiles with auto-detection across major launchers',
      'Fully customisable global keyboard shortcuts',
      'Built-in ad and tracker blocker',
      'Real-time RAM monitor per tab',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-primary/80">Changelog</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          What&rsquo;s new in Overframe
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Every release is published on GitHub with binaries, source and checksums.
        </p>
        <a
          href={SITE_CONFIG.links.github + '/releases'}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <Github size={15} />
          Full release history
        </a>
      </header>

      <ol className="mt-14 space-y-6">
        {RELEASES.map((r) => (
          <li
            key={r.version}
            className="rounded-2xl border border-border bg-muted/30 p-6"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight">v{r.version}</h2>
              <span className="text-xs text-muted-foreground">{r.date}</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {r.highlights.map((h) => (
                <li key={h} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Want to suggest a feature?{' '}
        <Link href="/contact" className="text-foreground underline hover:text-primary">
          Get in touch
        </Link>
        .
      </p>
    </div>
  )
}
