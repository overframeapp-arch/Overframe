import { ArrowLeft, ArrowRight, RotateCw, Star, X, Plus, Bookmark } from 'lucide-react'

export function OverlayMockup() {
  return (
    <div className="relative mx-auto max-w-5xl select-none">
      {/* Multi-layer glow behind the mockup */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-3xl opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.28) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-[10%] -bottom-6 h-20 -z-10"
        style={{
          background: 'rgba(124,58,237,0.15)',
          filter: 'blur(30px)',
          borderRadius: '50%',
        }}
      />

      {/* Mockup window */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/5">

        {/* Scan line animation */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
          <div
            className="absolute inset-x-0 h-[1.5px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.7) 30%, rgba(167,139,250,0.9) 50%, rgba(124,58,237,0.7) 70%, transparent)',
              animation: 'scan 6s ease-in-out infinite 1.5s',
              top: 0,
            }}
          />
        </div>

        {/* Title bar dots */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#0e0e18] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
          <span className="ml-4 text-[11px] font-medium text-white/30">Overframe — Path of Exile</span>
          <span className="ml-auto text-[10px] text-white/20">Alt+B to hide</span>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[#0e0e18]/80 px-3 py-2">
          <Tab title="Path of Exile Wiki" active />
          <Tab title="poe.ninja — builds" />
          <Tab title="YouTube — boss guide" />
          <button
            aria-label="New tab"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-white/30 hover:bg-white/5 hover:text-white/60"
          >
            <Plus size={13} />
          </button>
          {/* Opacity badge */}
          <span className="ml-auto mr-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/40">
            85%
          </span>
        </div>

        {/* Address bar */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#0e0e18]/60 px-3 py-2">
          <button className="text-white/30 hover:text-white/60" aria-label="Back">
            <ArrowLeft size={14} />
          </button>
          <button className="text-white/30 hover:text-white/60" aria-label="Forward">
            <ArrowRight size={14} />
          </button>
          <button className="text-white/30 hover:text-white/60" aria-label="Reload">
            <RotateCw size={13} />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/40">
            <span className="truncate">https://www.poewiki.net/wiki/Atlas_passive_skill_tree</span>
            <Star size={12} className="ml-auto shrink-0 text-amber-400/70" />
          </div>
          <button className="text-white/30 hover:text-white/60" aria-label="Bookmarks">
            <Bookmark size={14} />
          </button>
        </div>

        {/* Pinned bar */}
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#0d0d17]/80 px-3 py-2">
          <Pin label="Atlas tree" active />
          <Pin label="Currency" />
          <Pin label="Map mods" />
          <Pin label="Boss guide" />
          <span className="ml-auto text-[9px] font-semibold uppercase tracking-widest text-primary/50">
            PROFILE: Path of Exile
          </span>
        </div>

        {/* Faux web content */}
        <div className="p-6">
          {/* Heading skeleton */}
          <div className="h-4 w-2/5 rounded-md bg-white/10" />
          <div className="mt-3 h-2.5 w-3/4 rounded bg-white/[0.06]" />
          <div className="mt-2 h-2.5 w-1/2 rounded bg-white/[0.05]" />
          {/* Card grid skeleton */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              'rgba(124,58,237,0.08)',
              'rgba(255,255,255,0.04)',
              'rgba(255,255,255,0.03)',
            ].map((bg, i) => (
              <div
                key={i}
                className="h-20 rounded-lg ring-1 ring-white/[0.06]"
                style={{ background: bg }}
              />
            ))}
          </div>
          <div className="mt-5 h-2.5 w-4/5 rounded bg-white/[0.06]" />
          <div className="mt-2 h-2.5 w-3/5 rounded bg-white/[0.05]" />
          <div className="mt-2 h-2.5 w-2/3 rounded bg-white/[0.04]" />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#0e0e18]/80 px-4 py-2 text-[10px] text-white/25">
          <span>Press <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">Alt+B</kbd> to hide · <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">Alt+C</kbd> click-through</span>
          <span className="tabular-nums">138 MB</span>
        </div>
      </div>
    </div>
  )
}

function Tab({ title, active = false }: { title: string; active?: boolean }) {
  return (
    <div
      className={
        'flex h-7 max-w-[168px] items-center gap-1.5 rounded-md px-2.5 text-[11px] ' +
        (active
          ? 'bg-white/[0.08] text-white/80 ring-1 ring-white/10'
          : 'text-white/30 hover:bg-white/[0.04] hover:text-white/50')
      }
    >
      {active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      )}
      <span className="truncate">{title}</span>
      <X size={10} className="ml-auto shrink-0 opacity-50" />
    </div>
  )
}

function Pin({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={
        'rounded-md border px-2 py-0.5 text-[10px] transition ' +
        (active
          ? 'border-primary/30 bg-primary/10 text-primary/80'
          : 'border-white/[0.08] bg-white/[0.03] text-white/30')
      }
    >
      {label}
    </span>
  )
}
