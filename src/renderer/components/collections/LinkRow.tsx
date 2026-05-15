import { useState } from 'react'
import { Check, X as XIcon } from 'lucide-react'
import type { Collection } from '@shared/types'
import { Input } from '../ui/Input'
import { Favicon } from './atoms'
import { LinkActionsMenu } from './Menus'

interface LinkRowProps {
  link: Collection['links'][number]
  onOpen: (url: string) => void
  onRename: (lid: string, title: string) => void
  onTogglePin: (lid: string) => void
  onRemove: (lid: string) => void
  onMove: (lid: string) => void
}

export function LinkRow({ link, onOpen, onRename, onTogglePin, onRemove, onMove }: LinkRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(link.title)

  const commit = (): void => {
    const t = draft.trim()
    if (t && t !== link.title) onRename(link.id, t)
    else setDraft(link.title)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2.5 py-1 bg-muted/20">
        <Input autoFocus aria-label="Rename link" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(link.title); setEditing(false) } }}
          className="h-5 text-[11px] py-0 px-1.5 flex-1" />
        <button type="button" aria-label="Save" onClick={commit}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <Check size={10} />
        </button>
        <button type="button" aria-label="Cancel" onClick={() => { setDraft(link.title); setEditing(false) }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <XIcon size={10} />
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1 px-2.5 py-1 hover:bg-muted/30 border-b border-border/20">
      <button type="button" onClick={() => onOpen(link.url)} className="flex-1 min-w-0 text-left" aria-label={`Open ${link.title}`} title={link.url}>
        <div className="text-[11px] truncate flex items-center gap-1.5">
          <Favicon url={link.url} favicon={link.favicon} />
          <span className="truncate">{link.title}</span>
        </div>
      </button>
      <LinkActionsMenu title={link.title} pinned={link.pinned}
        onRename={() => { setDraft(link.title); setEditing(true) }}
        onMove={() => onMove(link.id)}
        onTogglePin={() => onTogglePin(link.id)}
        onRemove={() => onRemove(link.id)} />
    </div>
  )
}
