import { useState } from 'react'
import { Info } from 'lucide-react'

export function Favicon({ url, favicon }: { url: string; favicon?: string }): JSX.Element {
  const [failed, setFailed] = useState(false)
  let src = favicon
  if (!src || failed) {
    try { src = `${new URL(url).origin}/favicon.ico` } catch { src = '' }
  }
  if (!src) return <span className="inline-block w-3 h-3 shrink-0 opacity-20 rounded-sm bg-current" />
  return (
    <img src={src} alt="" width={12} height={12} className="shrink-0 rounded-sm" onError={() => setFailed(true)} />
  )
}

export function InfoTip({ text }: { text: string }): JSX.Element {
  return (
    <span className="group relative inline-flex items-center ml-1">
      <Info size={10} className="text-muted-foreground/50 hover:text-muted-foreground cursor-help" aria-hidden="true" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-48 rounded bg-muted border border-border px-2 py-1.5 text-[10px] text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {text}
      </span>
    </span>
  )
}
