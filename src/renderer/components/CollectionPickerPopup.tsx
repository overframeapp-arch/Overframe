import { useId, useMemo, useState, useEffect } from 'react'
import { Check, X, BookOpen, Globe } from 'lucide-react'
import type { Collection, CollectionPickerPayload } from '@shared/types'
import { cn } from '../lib/cn'

function collectionStorageKey(profileId: string): string {
  return `bookmarkBar:collectionId:${profileId}`
}

interface Props {
  payload: CollectionPickerPayload
}

export function CollectionPickerPopup({ payload }: Props): JSX.Element {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(payload.selectedId)
  const titleId = useId()

  useEffect(() => {
    void window.aether.collections.getAll().then((all) => {
      setCollections(
        all.filter(
          (c) => c.profileId === payload.profileId || c.profileId === 'shared'
        )
      )
    })
  }, [payload.profileId])

  const select = (c: Collection): void => {
    localStorage.setItem(collectionStorageKey(payload.profileId), c.id)
    setSelectedId(c.id)
    window.aether.popup.close()
  }

  const sortedCollections = useMemo(() => {
    if (!selectedId) return collections
    const selected = collections.find((c) => c.id === selectedId)
    if (!selected) return collections
    return [selected, ...collections.filter((c) => c.id !== selectedId)]
  }, [collections, selectedId])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="h-full bg-background border border-border rounded-lg flex flex-col overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
        <h2 id={titleId} className="text-[11px] font-semibold flex-1 truncate">Collections</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => window.aether.popup.close()}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </div>

      {/* List */}
      <ul role="list" className="flex-1 overflow-y-auto">
        {sortedCollections.map((c) => {
          const isSelected = c.id === selectedId
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Active collection: ' : 'Switch to '}${c.name}`}
                onClick={() => select(c)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-3 py-2',
                  'hover:bg-muted/40 border-b border-border/30 transition-colors',
                  isSelected && 'bg-muted/20'
                )}
              >
                <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                  {isSelected
                    ? <Check size={12} className="text-primary" aria-hidden="true" />
                    : c.iconUrl
                      ? <img src={c.iconUrl} alt="" aria-hidden="true" className="h-4 w-4 rounded-sm object-contain" />
                      : <Globe size={11} className="text-muted-foreground/30" aria-hidden="true" />
                  }
                </div>
                <span className={cn('text-[12px] flex-1 truncate', isSelected && 'text-primary font-medium')}>
                  {c.name}
                </span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0" aria-label={`${c.links.length} links`}>
                  {c.links.length}
                </span>
              </button>
            </li>
          )
        })}
        {collections.length === 0 && (
          <li className="px-3 py-6 text-center text-[11px] text-muted-foreground/50">
            No collections
          </li>
        )}
      </ul>

      {/* Footer */}
      <div className="border-t border-border shrink-0 px-2 py-1.5">
        <button
          type="button"
          aria-label="Manage links in this collection"
          onClick={() => void window.aether.popup.openPanel('links', selectedId ?? undefined)}
          className="w-full flex items-center gap-2 h-6 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <BookOpen size={12} aria-hidden="true" />
          Manage links
        </button>
      </div>
    </div>
  )
}
