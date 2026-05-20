import type { Metadata } from 'next'
import { Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Overframe — support, bugs, feature requests and security.',
  alternates: { canonical: '/contact' },
}

const CHANNELS = [
  {
    icon: MessageCircle,
    title: 'Discord',
    description: 'Bugs, features, questions — fastest way to reach me.',
    cta: 'Join Discord',
    href: SITE_CONFIG.links.discord,
    primary: true,
  },
  {
    icon: Mail,
    title: 'Email',
    description: 'Legal, partnerships, or anything you prefer to keep private.',
    cta: 'contact@overframe.app',
    href: `mailto:${SITE_CONFIG.links.email}`,
    primary: false,
  },
  {
    icon: ShieldAlert,
    title: 'Security',
    description: 'Found a vulnerability? Report it privately so I can patch it first.',
    cta: 'security@overframe.app',
    href: 'mailto:security@overframe.app',
    primary: false,
  },
  {
    icon: GithubIcon,
    title: 'GitHub',
    description: 'Source code, issues and pull requests.',
    cta: 'Browse the repo',
    href: SITE_CONFIG.links.github,
    primary: false,
  },
]

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="text-center">
        <p className="text-sm uppercase tracking-widest text-primary/80">Contact</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Get in touch
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Discord for everything. Email for anything private.
        </p>
      </header>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((c) => (
          <li
            key={c.title}
            className={`flex flex-col rounded-2xl border p-6 ${
              c.primary
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-muted/30'
            }`}
          >
            <div
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
                c.primary ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
              }`}
            >
              <c.icon size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
            <a
              href={c.href}
              target="_blank"
              rel="noreferrer noopener"
              className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline ${
                c.primary ? 'text-primary' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              {c.cta} →
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
