import { useMemo, useRef, useState } from 'react'
import { Check, GripVertical, Link as LinkIcon, X as XIcon } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Collection } from '@shared/types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { LinkRow } from './LinkRow'
import { AddLinkMenu, CollectionActionsMenu } from './Menus'
import type { PinnedEntry } from './types'

interface LinksViewProps {
  collection: Collection
  currentTab: { title: string; url: string; favicon?: string | null } | null
  pinnedLinks: PinnedEntry[]
  onOpen: (url: string) => void
  onAddLink: (link: { title: string; url: string; favicon?: string }) => void
  onRenameLink: (lid: string, title: string) => void
  onTogglePin: (lid: string) => void
  onRemoveLink: (lid: string) => void
  onMoveLink: (lid: string) => void
  onReorderLinks: (ids: string[]) => void
  onRenameCollection: (name: string) => void
  onSetIconUrl: (url: string) => void
  onExport: () => void
  onDelete: () => void
  deleteConfirming: boolean
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

export function LinksView({
  collection, currentTab, pinnedLinks,
  onOpen, onAddLink, onRenameLink, onTogglePin, onRemoveLink, onMoveLink, onReorderLinks,
  onRenameCollection, onSetIconUrl, onExport, onDelete,
  deleteConfirming, onDeleteConfirm, onDeleteCancel,
}: LinksViewProps): JSX.Element {
  const [renamingColl, setRenamingColl] = useState(false)
  const [collNameDraft, setCollNameDraft] = useState(collection.name)
  const [editingIcon, setEditingIcon] = useState(false)
  const [iconDraft, setIconDraft] = useState(collection.iconUrl ?? '')
  const parentRef = useRef<HTMLDivElement>(null)
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null)
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null)

  const sorted = useMemo(() => [...collection.links].sort((a, b) => a.order - b.order), [collection.links])

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 10,
  })

  const commitCollName = (): void => {
    const t = collNameDraft.trim()
    if (t && t !== collection.name) onRenameCollection(t)
    else setCollNameDraft(collection.name)
    setRenamingColl(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/10 shrink-0">
        {collection.iconUrl && (
          <img src={collection.iconUrl} alt="" className="h-4 w-4 rounded-sm object-contain shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
        )}
        {renamingColl ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input autoFocus aria-label="Rename collection" value={collNameDraft}
              onChange={(e) => setCollNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCollName(); if (e.key === 'Escape') { setCollNameDraft(collection.name); setRenamingColl(false) } }}
              className="h-5 text-xs py-0 px-1 flex-1" />
            <Button size="icon" variant="ghost" className="h-5 w-5" aria-label="Save name" onClick={commitCollName}><Check size={10} /></Button>
            <Button size="icon" variant="ghost" className="h-5 w-5" aria-label="Cancel" onClick={() => { setCollNameDraft(collection.name); setRenamingColl(false) }}><XIcon size={10} /></Button>
          </div>
        ) : (
          <span className="text-[11px] font-medium flex-1 truncate">{collection.name}</span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0" aria-label={`${sorted.length} links`}>{sorted.length}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <AddLinkMenu currentTab={currentTab} pinnedLinks={pinnedLinks} onAdd={onAddLink} />
          <CollectionActionsMenu
            collection={collection}
            onRename={() => { setCollNameDraft(collection.name); setRenamingColl(true) }}
            onSetIcon={() => { setIconDraft(collection.iconUrl ?? ''); setEditingIcon(true) }}
            onExport={onExport}
            onDelete={onDelete}
          />
        </div>
      </div>

      {editingIcon && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/20 border-b border-border/40 shrink-0" role="form" aria-label="Set collection icon">
          <Input autoFocus aria-label="Icon URL" value={iconDraft} onChange={(e) => setIconDraft(e.target.value)}
            placeholder="Icon URL (https://…)" className="h-7 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') { onSetIconUrl(iconDraft); setEditingIcon(false) }; if (e.key === 'Escape') setEditingIcon(false) }} />
          <Button size="icon" variant="ghost" aria-label="Apply" className="h-7 w-7" onClick={() => { onSetIconUrl(iconDraft); setEditingIcon(false) }}><Check size={11} /></Button>
          <Button size="icon" variant="ghost" aria-label="Cancel" className="h-7 w-7" onClick={() => setEditingIcon(false)}><XIcon size={11} /></Button>
        </div>
      )}

      {deleteConfirming && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20 shrink-0" role="alert">
          <span className="text-[11px] flex-1">Delete &laquo;{collection.name}&raquo; and all its links?</span>
          <button type="button" onClick={onDeleteConfirm}
            className="h-6 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">Delete</button>
          <button type="button" onClick={onDeleteCancel}
            className="h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      )}

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
            <LinkIcon size={20} aria-hidden="true" />
            <p className="text-[11px]">No links yet — click + to add one.</p>
          </div>
        )}
        {sorted.length > 0 && (
          <ul
            role="list"
            aria-label={`Links in ${collection.name}`}
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const l = sorted[row.index]
              const isDragOver = dragOverLinkId === l.id && draggedLinkId !== l.id
              return (
                <li key={l.id}
                  draggable
                  style={{ position: 'absolute', top: `${row.start}px`, left: 0, right: 0, height: `${row.size}px` }}
                  className={isDragOver ? 'border-t-2 border-primary' : undefined}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedLinkId(l.id) }}
                  onDragOver={(e) => { e.preventDefault(); if (draggedLinkId && draggedLinkId !== l.id) setDragOverLinkId(l.id) }}
                  onDragLeave={() => setDragOverLinkId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (draggedLinkId && draggedLinkId !== l.id) {
                      const ids = sorted.map((s) => s.id)
                      const fromIdx = ids.indexOf(draggedLinkId)
                      const toIdx = ids.indexOf(l.id)
                      if (fromIdx !== -1 && toIdx !== -1) {
                        const reordered = [...ids]
                        reordered.splice(fromIdx, 1)
                        reordered.splice(toIdx, 0, draggedLinkId)
                        onReorderLinks(reordered)
                      }
                    }
                    setDraggedLinkId(null)
                    setDragOverLinkId(null)
                  }}
                  onDragEnd={() => { setDraggedLinkId(null); setDragOverLinkId(null) }}
                >
                  <div className={draggedLinkId === l.id ? 'opacity-40' : undefined} style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <GripVertical size={12} className="shrink-0 text-muted-foreground/30 cursor-grab ml-1 mr-0.5" aria-hidden="true" />
                    <LinkRow link={l}
                      onOpen={onOpen}
                      onRename={onRenameLink}
                      onTogglePin={onTogglePin}
                      onRemove={onRemoveLink}
                      onMove={onMoveLink} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
