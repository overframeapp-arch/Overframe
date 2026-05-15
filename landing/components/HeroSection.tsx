import { Download, MessageCircle } from 'lucide-react'
import { SITE_CONFIG } from '@/lib/config'

function OverframeCube() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ovtg" cx="38%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#ddd6fe" />
          <stop offset="40%"  stopColor="#7c3aed" />
          <stop offset="85%"  stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#2e1065" />
        </radialGradient>
        <radialGradient id="ovhi" cx="45%" cy="32%" r="58%">
          <stop offset="0%"   stopColor="#fff" stopOpacity=".45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0"   />
        </radialGradient>
        <filter id="ovglow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Top face */}
      <polygon
        points="60,10 106,34 60,58 14,34"
        fill="url(#ovtg)"
        filter="url(#ovglow)"
      />
      {/* Right face */}
      <polygon points="106,34 106,82 60,106 60,58" fill="#4c1d95" />
      {/* Left face */}
      <polygon points="14,34 60,58 60,106 14,82" fill="#3b0764" />
      {/* Highlight */}
      <polygon points="60,10 106,34 60,58 14,34" fill="url(#ovhi)" />

      {/* Edges */}
      <polyline
        points="60,10 106,34 60,58 14,34 60,10"
        fill="none"
        stroke="rgba(196,181,253,0.55)"
        strokeWidth="0.8"
      />
      <line x1="60"  y1="58"  x2="60"  y2="106" stroke="rgba(196,181,253,0.32)" strokeWidth="0.8" />
      <line x1="14"  y1="34"  x2="14"  y2="82"  stroke="rgba(196,181,253,0.22)" strokeWidth="0.8" />
      <line x1="106" y1="34"  x2="106" y2="82"  stroke="rgba(196,181,253,0.32)" strokeWidth="0.8" />
      <line x1="14"  y1="82"  x2="60"  y2="106" stroke="rgba(196,181,253,0.22)" strokeWidth="0.8" />
      <line x1="106" y1="82"  x2="60"  y2="106" stroke="rgba(196,181,253,0.32)" strokeWidth="0.8" />
    </svg>
  )
}

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-28 text-center">
      {/* Atmospheric rings */}
      <div className="ov-ring-outer" aria-hidden />
      <div className="ov-ring-inner" aria-hidden />

      {/* Cube */}
      <div className="ov-cube relative z-10 mb-8 h-[108px] w-[108px] max-sm:h-[82px] max-sm:w-[82px]">
        <OverframeCube />
      </div>

      {/* Content */}
      <div
        className="relative z-10 mx-auto w-full max-w-[680px]"
        style={{ animation: 'fade-up 0.65s 0.12s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Eyebrow */}
        <span className="mb-5 block font-sans text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-primary/70">
          In-game browser overlay
        </span>

        {/* Product name */}
        <h1 className="text-[clamp(3rem,8vw,5.5rem)] font-bold leading-[1.06] tracking-[0.02em] text-gradient-animated">
          Overframe
        </h1>

        {/* Tagline */}
        <p className="mt-4 text-[clamp(1.1rem,2.5vw,1.45rem)] font-medium tracking-wide text-[var(--text-head)]">
          Browse the web. Stay in the game.
        </p>

        {/* Divider */}
        <div className="ov-divider my-8">
          <span className="ov-divider-line" />
          <span className="ov-divider-icon" aria-hidden>&#x25C6;</span>
          <span className="ov-divider-line" />
        </div>

        {/* Description */}
        <p className="mx-auto max-w-[520px] text-[clamp(0.98rem,2.2vw,1.13rem)] leading-[1.82] text-[var(--text)]">
          Press{' '}
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground/80">
            Alt
          </kbd>
          {' '}+{' '}
          <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground/80">
            B
          </kbd>
          {' '}in any game and your browser appears on top —
          no alt-tab, no lost focus. Safe with all anti-cheat systems.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
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
            href={SITE_CONFIG.links.discord}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost"
          >
            <MessageCircle size={16} aria-hidden />
            Join Discord
          </a>
        </div>

        {/* Hint */}
        <p className="mt-5 font-sans text-[0.75rem] uppercase tracking-[0.08em] text-[var(--text-dim)]">
          Windows 10 &amp; 11 · Free &amp; open source · No account needed
        </p>
      </div>
    </section>
  )
}
