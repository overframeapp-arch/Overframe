import { useState } from 'react'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import type { Collection } from '@shared/types'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Tooltip } from '../ui/Tooltip'
import { Favicon } from './atoms'

interface LinkRowProps {
  link: Collection['links'][number]
  isDragging?: boolean
  onOpen: (url: string) => void
  onEdit: (lid: string, title: string, url: string) => void
  onRemove: (lid: string) => void
}

export function LinkRow({ link, isDragging, onOpen, onEdit, onRemove }: LinkRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(link.title)
  const [urlDraft, setUrlDraft] = useState(link.url)

  const openEdit = (): void => { setTitleDraft(link.title); setUrlDraft(link.url); setEditing(true) }

  const commit = (): void => {
    const t = titleDraft.trim()
    const u = urlDraft.trim()
    if (u) onEdit(link.id, t || link.title, u)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex-1 px-3 py-2.5 flex flex-col gap-2 border-b border-border/40">
        <Input autoFocus aria-label="Title" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
          placeholder="Title…" className="h-7 text-xs"
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
        <Input aria-label="URL" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="URL…" className="h-6 text-[11px]"
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
        <div className="flex gap-2">
          <button type="button" onClick={commit}
            className="flex-1 h-7 rounded text-[12px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
          <button type="button" onClick={() => setEditing(false)}
            className="flex-1 h-7 rounded text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 border-b border-border/40 flex-1 min-w-0${isDragging ? ' opacity-40' : ''}`}>
      <GripVertical size={12} className="shrink-0 text-muted-foreground/30 cursor-grab -ml-1" aria-hidden="true" />
      <button type="button" onClick={() => onOpen(link.url)} className="flex-1 min-w-0 text-left" aria-label={`Open ${link.title}`} title={link.url}>
        <div className="flex items-center gap-2">
          <Favicon url={link.url} favicon={link.favicon} className="w-4 h-4" />
          <div className="min-w-0">
            <div className="text-[12px] truncate">{link.title}</div>
            <div className="text-[10px] text-muted-foreground/60 truncate">{link.url}</div>
          </div>
        </div>
      </button>
      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Tooltip label="Edit">
          <Button size="icon" variant="ghost" aria-label={`Edit ${link.title}`} className="h-6 w-6" onClick={openEdit}>
            <Pencil size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Remove">
          <Button size="icon" variant="ghost" aria-label={`Remove ${link.title}`}
            className="h-6 w-6 hover:text-destructive"
            onClick={() => onRemove(link.id)}>
            <Trash2 size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
