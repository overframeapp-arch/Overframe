import { Star, Users, Heart } from 'lucide-react'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

const STATS = [
  { icon: Star, label: 'GitHub stars', value: 'Open source' },
  { icon: Users, label: 'Discord members', value: 'Growing' },
  { icon: Heart, label: 'Built for gamers', value: 'By gamers' },
]

export function SocialProof() {
  return (
    <section className="mx-auto max-w-container px-6 pt-12">
      <div className="grid gap-3 sm:grid-cols-3">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <a
          href={SITE_CONFIG.links.github}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <GithubIcon size={14} />
          Star us on GitHub
        </a>
      </div>
    </section>
  )
}
