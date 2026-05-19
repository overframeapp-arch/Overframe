import { useMemo, useState } from 'react'
import { LayoutList, Link as LinkIcon, Plus, X as XIcon } from 'lucide-react'
import type { Collection } from '@shared/types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Favicon } from './atoms'
import { LinkRow } from './LinkRow'

type Tab = { id: string; title: string; url: string; favicon: string | null }
type FooterMode = 'default' | 'newLink' | 'tabPicker'

interface LinksViewProps {
  collection: Collection
  tabs: Tab[]
  onOpen: (url: string) => void
  onAddLink: (link: { title: string; url: string; favicon?: string }) => void
  onEditLink: (lid: string, title: string, url: string) => void
  onRemoveLink: (lid: string) => void
  onReorderLinks: (ids: string[]) => void
}

export function LinksView({
  collection, tabs,
  onOpen, onAddLink, onEditLink, onRemoveLink, onReorderLinks,
}: LinksViewProps): JSX.Element {
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null)
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null)
  const [footerMode, setFooterMode] = useState<FooterMode>('default')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set())

  const addNewLink = (): void => {
    let url = newLinkUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try { new URL(url) } catch { return }
    onAddLink({ title: newLinkTitle.trim() || url, url })
    setNewLinkUrl('')
    setNewLinkTitle('')
    setFooterMode('default')
  }

  const toggleTabSelection = (id: string): void => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addSelectedTabs = (): void => {
    tabs.filter((t) => selectedTabIds.has(t.id)).forEach((t) => {
      onAddLink({ title: t.title || t.url, url: t.url, favicon: t.favicon ?? undefined })
    })
    setSelectedTabIds(new Set())
    setFooterMode('default')
  }

  const addAllTabs = (): void => {
    tabs.forEach((t) => {
      onAddLink({ title: t.title || t.url, url: t.url, favicon: t.favicon ?? undefined })
    })
    setFooterMode('default')
  }

  const closeTabPicker = (): void => {
    setSelectedTabIds(new Set())
    setFooterMode('default')
  }

  const sorted = useMemo(() => [...collection.links].sort((a, b) => a.order - b.order), [collection.links])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
            <LinkIcon size={20} aria-hidden="true" />
            <p className="text-[11px]">No links yet — click + to add one.</p>
          </div>
        )}
        {sorted.length > 0 && (
          <ul role="list" aria-label={`Links in ${collection.name}`}>
            {sorted.map((l) => {
              const isDragOver = dragOverLinkId === l.id && draggedLinkId !== l.id
              return (
                <li key={l.id}
                  draggable
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
                  <LinkRow link={l}
                    isDragging={draggedLinkId === l.id}
                    onOpen={onOpen}
                    onEdit={onEditLink}
                    onRemove={onRemoveLink} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer — new link */}
      {footerMode === 'newLink' && (
        <div className="flex flex-col gap-1.5 px-3 py-2 border-t border-border/40 shrink-0" role="form" aria-label="Add new link">
          <Input autoFocus aria-label="URL" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
            placeholder="URL…" className="h-7 text-xs"
            onKeyDown={(e) => { if (e.key === 'Enter') addNewLink(); if (e.key === 'Escape') { setFooterMode('default'); setNewLinkUrl(''); setNewLinkTitle('') } }} />
          <Input aria-label="Title (optional)" value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)}
            placeholder="Title (optional)" className="h-6 text-[11px]"
            onKeyDown={(e) => { if (e.key === 'Enter') addNewLink(); if (e.key === 'Escape') { setFooterMode('default'); setNewLinkUrl(''); setNewLinkTitle('') } }} />
          <div className="flex gap-2">
            <button type="button" onClick={addNewLink}
              className="flex-1 h-7 rounded text-[12px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
            <button type="button" onClick={() => { setFooterMode('default'); setNewLinkUrl(''); setNewLinkTitle('') }}
              className="flex-1 h-7 rounded text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Footer — tab picker */}
      {footerMode === 'tabPicker' && (
        <div className="flex flex-col border-t border-border/40 shrink-0 max-h-52" role="region" aria-label="Open tabs">
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border/30 shrink-0">
            <span className="text-[11px] font-medium flex-1">Open tabs</span>
            <button type="button" disabled={selectedTabIds.size === 0} onClick={addSelectedTabs}
              className="text-[11px] px-2 h-6 rounded bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Add {selectedTabIds.size > 0 ? `(${selectedTabIds.size})` : 'selected'}
            </button>
            <button type="button" onClick={addAllTabs}
              className="text-[11px] px-2 h-6 rounded text-muted-foreground hover:bg-muted/50 transition-colors">All</button>
            <button type="button" onClick={closeTabPicker}
              className="h-6 w-6 rounded text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center">
              <XIcon size={11} />
            </button>
          </div>
          <div className="overflow-y-auto">
            {tabs.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">No open tabs</p>
            )}
            {tabs.map((tab) => (
              <div key={tab.id}
                role="option" aria-selected={selectedTabIds.has(tab.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer border-b border-border/20 hover:bg-muted/40 ${selectedTabIds.has(tab.id) ? 'bg-primary/5' : ''}`}
                onClick={() => toggleTabSelection(tab.id)}>
                <input type="checkbox" readOnly checked={selectedTabIds.has(tab.id)} className="h-3 w-3 shrink-0 accent-primary pointer-events-none" />
                <Favicon url={tab.url} favicon={tab.favicon} className="w-3.5 h-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate">{tab.title || tab.url}</div>
                  <div className="text-[10px] text-muted-foreground/60 truncate">{tab.url}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer — default buttons */}
      {footerMode === 'default' && (
        <div className="flex items-center gap-0.5 px-2 py-2 border-t border-border/30 shrink-0">
          <Button size="sm" variant="ghost" aria-label="Add a new link" onClick={() => setFooterMode('newLink')}
            className="text-[11px] text-muted-foreground gap-1.5">
            <Plus size={11} aria-hidden="true" /> New link
          </Button>
          {tabs.length > 0 && (
            <Button size="sm" variant="ghost" aria-label="Add links from open tabs" onClick={() => setFooterMode('tabPicker')}
              className="text-[11px] text-muted-foreground gap-1.5">
              <LayoutList size={11} aria-hidden="true" /> From tabs
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
