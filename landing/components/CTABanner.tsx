import { Download, Github } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/config'

export function CTABanner() {
  return (
    <section className="px-6 pb-28 pt-6 text-center">
      <div className="mx-auto max-w-[560px]">
        <div className="ov-divider mb-10">
          <span className="ov-divider-line" />
          <span className="ov-divider-icon" aria-hidden>&#x25C6;</span>
          <span className="ov-divider-line" />
        </div>

        <h2 className="mb-3 text-[clamp(1.5rem,3.5vw,2.4rem)] font-bold tracking-tight text-[var(--text-head)]">
          Your browser. On top.
        </h2>

        <p className="mb-8 text-[0.95rem] leading-relaxed text-[var(--text)]">
          Free forever. Open source. Ready in 30 seconds.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={SITE_CONFIG.downloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary"
          >
            <Download size={16} aria-hidden />
            Download free for Windows
          </a>
          <a
            href={SITE_CONFIG.links.github}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost"
          >
            <Github size={16} aria-hidden />
            View on GitHub
          </a>
        </div>

        <p className="mt-5 font-sans text-[0.75rem] uppercase tracking-[0.08em] text-[var(--text-dim)]">
          Windows 10 &amp; 11 · MIT licensed
        </p>
      </div>
    </section>
  )
}
