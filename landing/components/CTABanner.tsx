import { Download } from 'lucide-react'
import Link from 'next/link'
import { GithubIcon } from '@/components/GithubIcon'
import { SITE_CONFIG } from '@/lib/config'

export function CTABanner() {
  return (
    <section className="px-6 py-24 text-center">
      <div className="mx-auto max-w-[560px]">
        <h2 className="mb-3 text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--text-head)]">
          Try it. It&apos;s free.
        </h2>

        <p className="mb-8 text-[0.95rem] leading-relaxed text-[var(--text)]">
          Free forever. 30-second install. No account.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/download"
            className="btn-primary"
          >
            <Download size={16} aria-hidden />
            Download free for Windows
          </Link>
          <a
            href={SITE_CONFIG.links.github}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost"
          >
            <GithubIcon size={16} aria-hidden />
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
