import Link from 'next/link'
import { Heart, Mail } from 'lucide-react'
import { GithubIcon } from '@/components/GithubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { SITE_CONFIG } from '@/lib/config'
import { Logo } from './Logo'

const COLS = [
  {
    title: 'Product',
    links: [
      { href: '/download', label: 'Download' },
      { href: '/#how', label: 'How it works' },
      { href: '/#security', label: 'Security' },
      { href: '/#faq', label: 'FAQ' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: SITE_CONFIG.links.discord, label: 'Discord — bugs & features', external: true },
      { href: SITE_CONFIG.links.kofi, label: 'Support on Ko-fi', external: true },
      { href: SITE_CONFIG.links.github, label: 'GitHub (open source)', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/legal', label: 'Legal Notice' },
      { href: '/contact', label: 'Contact' },
    ],
  },
]

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-container px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Logo className="h-6 w-6" />
              <span>Overframe</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Browser overlay for PC gamers. Free &amp; open source.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href={SITE_CONFIG.links.github}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <GithubIcon size={16} />
              </a>
              <a
                href={SITE_CONFIG.links.discord}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Discord"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <DiscordIcon size={16} />
              </a>
              <a
                href={SITE_CONFIG.links.kofi}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Support on Ko-fi"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-pink-400 transition hover:bg-muted"
              >
                <Heart size={16} />
              </a>
              <a
                href={`mailto:${SITE_CONFIG.links.email}`}
                aria-label="Email us"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {col.title}
              </h4>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {'external' in l && l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground transition hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-muted-foreground transition hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {year} {SITE_CONFIG.name}. Released under the MIT License.
          </p>
          <p>
            Not affiliated with any game studio or platform mentioned. All trademarks
            belong to their respective owners.
          </p>
        </div>
      </div>
    </footer>
  )
}
