import { useMemo, useState } from 'react'
import { Search, X as XIcon } from 'lucide-react'
import type { Collection } from '@shared/types'

interface MoveLinkPickerProps {
  collections: Collection[]
  onMove: (toCid: string) => void
  onCancel: () => void
}

export function MoveLinkPicker({ collections, onMove, onCancel }: MoveLinkPickerProps): JSX.Element {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => collections.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [collections, query]
  )
  return (
    <div className="absolute inset-0 bg-background z-20 flex flex-col">
      <div className="flex items-center gap-1 px-2 h-8 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold flex-1">Move to a collection</span>
        <button type="button" aria-label="Cancel move" onClick={onCancel}
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <XIcon size={11} />
        </button>
      </div>
      {collections.length > 6 && (
        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" aria-label="Filter collections"
              className="w-full h-6 pl-6 pr-2 rounded text-[11px] bg-input border border-border focus:outline-none focus:border-primary/60" />
          </div>
        </div>
      )}
      <ul className="flex-1 overflow-y-auto" role="list" aria-label="Target collections">
        {filtered.length === 0 && <li className="px-3 py-4 text-center text-[11px] text-muted-foreground">No collections.</li>}
        {filtered.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onMove(c.id)}
              className="w-full text-left text-[11px] px-3 py-2 hover:bg-muted/60 transition-colors flex items-center justify-between border-b border-border/30">
              <span className="truncate">{c.name}</span>
              {c.profileId === 'shared' && (
                <span className="text-[9px] text-primary bg-primary/15 px-1 rounded shrink-0 ml-2">global</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
