import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '../../lib/cn'
import { Info, Globe, Check } from 'lucide-react'

// ── Copied-to-clipboard toast ─────────────────────────────────────────────────
// Floating confirmation anchored at the click that triggered a share/export.
// Shared by CollectionsPanel and ManagePanel via useShareCollection().

export function CopiedTooltip({ pos }: { pos: { x: number; y: number } | null }): JSX.Element | null {
  if (!pos) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ left: pos.x, top: pos.y - 36 }}
      className="fixed z-[9999] pointer-events-none -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border shadow-lg text-[11px] text-foreground whitespace-nowrap"
    >
      <Check size={11} className="text-green-500 shrink-0" aria-hidden="true" />
      Copied to clipboard
    </div>
  )
}

// ── Favicon ───────────────────────────────────────────────────────────────────
// Waterfall: stored URL → /favicon.ico → Google service → globe placeholder

type FavState = 'primary' | 'ico' | 'google' | 'dead'

export function Favicon({ url, favicon, className }: { url: string; favicon?: string | null; className?: string }): JSX.Element {
  const origin = useMemo(() => { try { return new URL(url).origin } catch { return '' } }, [url])
  const hostname = useMemo(() => { try { return new URL(url).hostname } catch { return '' } }, [url])

  const [state, setState] = useState<FavState>(() => (favicon ? 'primary' : 'ico'))

  // Reset waterfall when the source link changes
  useEffect(() => {
    setState(favicon ? 'primary' : 'ico')
  }, [url, favicon])

  const src = useMemo((): string | null => {
    if (state === 'primary') return favicon ?? null
    if (state === 'ico') return origin ? `${origin}/favicon.ico` : null
    if (state === 'google') return hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : null
    return null
  }, [state, favicon, origin, hostname])

  const onError = useCallback(() => {
    setState((s) => {
      if (s === 'primary') return 'ico'
      if (s === 'ico') return 'google'
      return 'dead'
    })
  }, [])

  if (!src || state === 'dead') {
    return (
      <span className={cn('inline-flex items-center justify-center shrink-0 rounded-sm bg-muted/40 text-muted-foreground/30', className)}>
        <Globe size={10} />
      </span>
    )
  }

  return <img src={src} alt="" className={cn('shrink-0 rounded-sm', className)} onError={onError} />
}

// ── InfoTip ───────────────────────────────────────────────────────────────────

export function InfoTip({ text }: { text: string }): JSX.Element {
  return (
    <span className="group relative inline-flex items-center ml-1">
      <Info size={10} className="text-muted-foreground hover:text-foreground cursor-help" aria-hidden="true" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-48 rounded bg-muted border border-border px-2 py-1.5 text-[11px] text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {text}
      </span>
    </span>
  )
}
