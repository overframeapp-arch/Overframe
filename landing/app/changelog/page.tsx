import type { Metadata } from 'next'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes and version history for Overframe.',
  alternates: { canonical: '/changelog' },
}

interface GHRelease {
  tag_name: string
  published_at: string
  body: string
  html_url: string
}

async function getReleases(): Promise<GHRelease[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/overframeApp-arch/Overframe/releases',
      { cache: 'force-cache' },
    )
    if (!res.ok) return []
    return res.json() as Promise<GHRelease[]>
  } catch {
    return []
  }
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1]) {
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<code key={match.index} className="rounded bg-muted px-1 font-mono text-xs">{match[4]}</code>)
    } else if (match[5]) {
      parts.push(<a key={match.index} href={match[7]} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">{match[6]}</a>)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function renderBody(body: string) {
  const lines = body.trim().split('\n')
  const elements: React.ReactNode[] = []
  let bullets: React.ReactNode[][] = []

  function flushBullets() {
    if (!bullets.length) return
    const captured = bullets.slice()
    elements.push(
      <ul key={`ul-${elements.length}`} className="mt-3 space-y-1.5">
        {captured.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-primary/50" />
            <span>{b}</span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) { flushBullets(); continue }
    if (t.startsWith('## ')) {
      flushBullets()
      elements.push(
        <h2 key={`h2-${elements.length}`} className="mt-6 text-base font-semibold text-foreground">
          {t.slice(3)}
        </h2>,
      )
    } else if (t.startsWith('### ')) {
      flushBullets()
      elements.push(
        <h3 key={`h3-${elements.length}`} className="mt-4 text-sm font-semibold text-foreground">
          {t.slice(4)}
        </h3>,
      )
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      bullets.push(parseInline(t.slice(2)))
    } else {
      flushBullets()
      elements.push(
        <p key={`p-${elements.length}`} className="mt-3 text-sm text-muted-foreground">
          {parseInline(t)}
        </p>,
      )
    }
  }
  flushBullets()
  return elements
}

export default async function ChangelogPage() {
  const releases = await getReleases()

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-primary/80">Changelog</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          What&rsquo;s new.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Pulled live from GitHub Releases — updates automatically with each release.
        </p>
        <a
          href={SITE_CONFIG.links.github + '/releases'}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <GithubIcon size={15} />
          View on GitHub
        </a>
      </header>

      {releases.length === 0 ? (
        <p className="mt-14 text-center text-muted-foreground">No releases yet.</p>
      ) : (
        <ol className="mt-14 space-y-6">
          {releases.map((r) => (
            <li key={r.tag_name} className="rounded-2xl border border-border bg-muted/30 p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">{r.tag_name}</h2>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.published_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="mt-1">
                {r.body?.trim() ? renderBody(r.body) : (
                  <p className="mt-3 text-sm text-muted-foreground">See full notes on GitHub.</p>
                )}
              </div>
              <a
                href={r.html_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
              >
                <GithubIcon size={12} />
                Full release ↗
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
