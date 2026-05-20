import { Download, ShieldCheck, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { SITE_CONFIG } from '@/lib/config'
import { DiscordIcon } from './DiscordIcon'

export function HeroSection() {  return (
    <section className="relative flex flex-col items-center justify-start overflow-hidden px-6 pb-28 pt-[clamp(5.5rem,11vh,7.5rem)] text-center">
      {/* Atmospheric rings */}
      <div className="ov-ring-outer" aria-hidden />
      <div className="ov-ring-inner" aria-hidden />

      {/* Content */}
      <div
        className="relative z-10 mx-auto w-full max-w-[680px]"
        style={{ animation: 'fade-up 0.65s 0.12s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Eyebrow */}
        <span className="mb-5 block font-sans text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-primary/70">
          For PC gamers
        </span>

        {/* Product name */}
        <h1 className="text-[clamp(3rem,8vw,5.5rem)] font-bold leading-[1.06] tracking-tight text-white">
          Overframe
        </h1>

        {/* Tagline */}
        <p className="mt-5 text-[clamp(1.1rem,2.5vw,1.45rem)] font-medium tracking-wide text-[var(--text-head)]">
          Never alt-tab again.
        </p>

        {/* Description */}
        <p className="mt-6 mx-auto max-w-[480px] text-[clamp(0.95rem,2vw,1.08rem)] leading-[1.75] text-[var(--text)]">
          Press{' '}
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground/80">
            Alt
          </kbd>
          {' '}+{' '}
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground/80">
            B
          </kbd>
          {' '}and a browser opens over your game — builds, wikis, guides.
          Each game keeps its own.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/download"
            className="btn-primary"
          >
            <Download size={16} aria-hidden />
            Download free for Windows
          </Link>
          <a
            href={SITE_CONFIG.links.discord}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost"
          >
            <DiscordIcon size={16} />
            Join Discord
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[0.72rem] text-muted-foreground">
            Windows 10 &amp; 11
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[0.72rem] text-muted-foreground">
            Free forever · No account
          </span>
          <a
            href="https://www.virustotal.com/gui/file/fb5e1ad4fed0f002553b92c2bac201c4d3f100c44fe8371bdd75ff9a5c5c7165/detection"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[0.72rem] text-muted-foreground transition hover:border-emerald-500/30 hover:text-foreground"
          >
            <ShieldCheck size={10} className="text-emerald-400/80" aria-hidden />
            Scanned clean · VirusTotal ↗
          </a>
        </div>

      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground/30"
        aria-hidden
      >
        <ChevronDown size={22} />
      </div>

    </section>
  )
}
