import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { MemorySnapshot, TabState } from '@shared/types'

function formatMb(kb: number): string {
  const mb = kb / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

function MemBar({ kb, maxKb }: { kb: number; maxKb: number }): JSX.Element {
  const pct = maxKb > 0 ? Math.min(100, Math.round((kb / maxKb) * 100)) : 0
  return (
    <div className="h-1 w-10 rounded-full bg-muted overflow-hidden shrink-0" aria-hidden="true">
      <div
        className="h-full rounded-full bg-primary/50 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function MemoryPopup(): JSX.Element {
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null)
  const [tabs, setTabs] = useState<TabState[]>([])

  useEffect(() => {
    void window.aether.tabs.getAll().then((s) => setTabs(s.tabs)).catch(console.error)
    void window.aether.tabs.getMemoryUsage().then(setSnapshot).catch(console.error)
  }, [])

  useEffect(() => {
    const off = window.aether.on.memoryUpdated((s) => {
      setSnapshot(s)
      void window.aether.tabs.getAll().then((r) => setTabs(r.tabs)).catch(console.error)
    })
    return off
  }, [])

  const close = (): void => window.aether.popup.close()

  if (!snapshot) {
    return (
      <div
        className="h-full bg-background border border-border rounded-lg flex items-center justify-center"
        role="status"
      >
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    )
  }

  const tabsWithMem = tabs
    .map((t) => ({ ...t, privateKb: snapshot.tabs.find((e) => e.tabId === t.id)?.privateKb ?? 0 }))
    .sort((a, b) => b.privateKb - a.privateKb)

  const tabsTotal = snapshot.tabs.reduce((s, e) => s + e.privateKb, 0)
  const grandTotal = tabsTotal + snapshot.appKb
  const maxKb = Math.max(snapshot.appKb, ...tabsWithMem.map((t) => t.privateKb), 1)

  const closeAll = (): void => { tabsWithMem.forEach((t) => void window.aether.tabs.close(t.id)) }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Memory usage"
      className="h-full bg-background border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
        <h2 className="text-[11px] font-semibold flex-1">Memory usage</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </div>

      {/* Process list */}
      <ul role="list" className="flex-1 overflow-y-auto">
        {/* App row */}
        <li className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
          <img src="/icons/icon-amber.svg" alt="" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="text-[11px] flex-1 text-foreground/60 truncate">Overframe (app)</span>
          <MemBar kb={snapshot.appKb} maxKb={maxKb} />
          <span className="text-[11px] tabular-nums text-muted-foreground w-14 text-right shrink-0">
            {formatMb(snapshot.appKb)}
          </span>
          {/* Spacer to align with tab close buttons */}
          <div className="w-5 shrink-0" aria-hidden="true" />
        </li>

        {tabsWithMem.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/40 border-b border-border/20 transition-colors"
          >
            {t.favicon ? (
              <img src={t.favicon} alt="" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 shrink-0 rounded-sm bg-muted-foreground/20" aria-hidden="true" />
            )}
            <span className="truncate text-[11px] flex-1 min-w-0">{t.title || t.url}</span>
            <MemBar kb={t.privateKb} maxKb={maxKb} />
            <span className="text-[11px] tabular-nums text-muted-foreground w-14 text-right shrink-0">
              {formatMb(t.privateKb)}
            </span>
            <button
              type="button"
              aria-label={`Close tab: ${t.title || t.url}`}
              onClick={() => void window.aether.tabs.close(t.id)}
              className="h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </li>
        ))}

        {tabsWithMem.length === 0 && (
          <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            No open tabs
          </li>
        )}
      </ul>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border shrink-0">
        <p className="text-[11px]">
          <span className="text-muted-foreground">Total </span>
          <span className="tabular-nums font-semibold">{formatMb(grandTotal)}</span>
        </p>
        <button
          type="button"
          aria-label="Close all tabs"
          onClick={closeAll}
          disabled={tabsWithMem.length === 0}
          className="flex items-center gap-1 h-6 px-2 rounded border border-border/60 text-[10px] text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <X size={10} aria-hidden="true" />
          Close all
        </button>
      </div>
    </div>
  )
}
