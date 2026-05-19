import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react'
import type { Collection } from '@shared/types'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Favicon } from './atoms'
import type { PinnedEntry } from './types'

interface CollectionActionsMenuProps {
  collection: Collection
  onRename: () => void
  onSetIcon: () => void
  onExport: () => void
  onDelete: () => void
}

export function CollectionActionsMenu({ collection, onRename, onSetIcon, onExport, onDelete }: CollectionActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Actions for ${collection.name}`} className="h-6 w-6 shrink-0">
          <MoreHorizontal size={11} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          className="z-50 min-w-[148px] rounded-md border border-border bg-background shadow-md py-0.5 text-xs">
          {collection.source === 'user' && (
            <DropdownMenu.Item onSelect={onRename}
              className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
              <Pencil size={10} aria-hidden="true" /> Rename
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item onSelect={onSetIcon}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <ImageIcon size={10} aria-hidden="true" /> Icon
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onExport}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <Download size={10} aria-hidden="true" /> Export
          </DropdownMenu.Item>
          {collection.source === 'user' && (
            <>
              <DropdownMenu.Separator className="my-0.5 border-t border-border/60" />
              <DropdownMenu.Item onSelect={onDelete}
                className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none text-destructive hover:bg-muted data-[highlighted]:bg-muted transition-colors">
                <Trash2 size={10} aria-hidden="true" /> Delete
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface LinkActionsMenuProps {
  title: string
  pinned: boolean
  onRename: () => void
  onMove: () => void
  onTogglePin: () => void
  onRemove: () => void
}

export function LinkActionsMenu({ title, pinned, onRename, onMove, onTogglePin, onRemove }: LinkActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Actions for ${title}`}
          className={cn('h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity', pinned && 'opacity-100 text-primary')}>
          <Pin size={9} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          className="z-50 min-w-[148px] rounded-md border border-border bg-background shadow-md py-0.5 text-xs">
          <DropdownMenu.Item onSelect={onTogglePin}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <Pin size={10} fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
            {pinned ? 'Unpin' : 'Pin (quick access)'}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onRename}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <Pencil size={10} aria-hidden="true" /> Rename
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onMove}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <ChevronRight size={10} aria-hidden="true" /> Move to…
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-0.5 border-t border-border/60" />
          <DropdownMenu.Item onSelect={onRemove}
            className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none text-destructive hover:bg-muted data-[highlighted]:bg-muted transition-colors">
            <Trash2 size={10} aria-hidden="true" /> Remove
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface AddLinkMenuProps {
  currentTab: { title: string; url: string; favicon?: string | null } | null
  pinnedLinks: PinnedEntry[]
  onAdd: (link: { title: string; url: string; favicon?: string }) => void
}

export function AddLinkMenu({ currentTab, pinnedLinks, onAdd }: AddLinkMenuProps): JSX.Element {
  const [manualUrl, setManualUrl] = useState('')
  const [open, setOpen] = useState(false)

  const addManual = (): void => {
    const url = manualUrl.trim()
    if (!url) return
    let finalUrl = url
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`
    try { new URL(finalUrl) } catch { return }
    onAdd({ title: finalUrl, url: finalUrl })
    setManualUrl('')
    setOpen(false)
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label="Add link" className="h-6 w-6 shrink-0">
          <Plus size={11} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          className="z-50 w-60 rounded-md border border-border bg-background shadow-md py-0.5 text-xs">
          <div className="px-2 py-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <LinkIcon size={10} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <input autoFocus value={manualUrl} onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addManual(); e.stopPropagation() }}
              placeholder="Paste or type a URL…"
              aria-label="URL to add"
              className="flex-1 h-6 px-1.5 rounded text-[11px] bg-input border border-border focus:outline-none focus:border-primary/60" />
            <Button size="icon" variant="ghost" aria-label="Add URL" className="h-6 w-6 shrink-0" onClick={addManual} disabled={!manualUrl.trim()}>
              <Check size={10} aria-hidden="true" />
            </Button>
          </div>
          {(currentTab || pinnedLinks.length > 0) && <DropdownMenu.Separator className="my-0.5 border-t border-border/60" />}
          {currentTab && (
            <DropdownMenu.Item onSelect={() => onAdd({ title: currentTab.title, url: currentTab.url, favicon: currentTab.favicon ?? undefined })}
              className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
              <Favicon url={currentTab.url} favicon={currentTab.favicon ?? undefined} />
              <span className="truncate flex-1">{currentTab.title || currentTab.url}</span>
            </DropdownMenu.Item>
          )}
          {pinnedLinks.length > 0 && (
            <>
              <p className="px-3 py-0.5 text-[10px] text-muted-foreground">Pinned links</p>
              {pinnedLinks.map((l) => (
                <DropdownMenu.Item key={`${l.collectionId}-${l.id}`}
                  onSelect={() => onAdd({ title: l.title, url: l.url, favicon: l.favicon })}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-default select-none outline-none hover:bg-muted data-[highlighted]:bg-muted transition-colors">
                  <Favicon url={l.url} favicon={l.favicon} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{l.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{l.collectionName}</div>
                  </div>
                </DropdownMenu.Item>
              ))}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
