import { useState, useEffect } from 'react'
import { ChevronDown, X as XIcon } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { cn } from '../lib/cn'
import { notify } from '../lib/notify'
import { STRINGS } from '../lib/strings'
import type { Collection, BookmarkPopupPayload } from '@shared/types'
import { DEFAULT_PROFILE_ID } from '@shared/types'

function BkFavicon({ url, favicon }: { url: string; favicon?: string | null }): JSX.Element {
  const [failed, setFailed] = useState(false)
  let src = favicon ?? ''
  if (!src || failed) {
    try { src = `${new URL(url).origin}/favicon.ico` } catch { src = '' }
  }
  if (!src) return <span className="inline-block w-4 h-4 shrink-0 rounded-sm bg-muted" />
  return (
    <img src={src} alt="" width={16} height={16} className="shrink-0 rounded-sm"
      onError={() => setFailed(true)} />
  )
}

export function BookmarkPopup({ initialData }: { initialData: BookmarkPopupPayload }): JSX.Element {
  const [data] = useState<BookmarkPopupPayload>(initialData)
  const [collections, setCollections] = useState<Collection[]>([])
  const [title, setTitle] = useState(initialData.existingBookmark?.title ?? initialData.title)
  const [collectionId, setCollectionId] = useState('')
  const [colOpen, setColOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.aether.collections.getAll().then((cs) => {
      setCollections(cs)
      const relevant = cs.filter(
        (c) => c.profileId === (initialData.activeProfileId ?? DEFAULT_PROFILE_ID) || c.profileId === 'shared'
      )
      setCollectionId(initialData.existingBookmark?.cid ?? relevant[0]?.id ?? '')
    }).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape closes the popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const relevant = collections.filter(
    (c) => c.profileId === (data.activeProfileId ?? DEFAULT_PROFILE_ID) || c.profileId === 'shared'
  )
  const selectedCollection = relevant.find((c) => c.id === collectionId)

  const close = (): void => {
    window.aether.popup.close()
  }

  const save = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      let targetId = collectionId
      if (!targetId) {
        const newColl = await window.aether.collections.create({
          name: `${data.activeProfileId ?? 'Default'} links`,
          profileId: data.activeProfileId ?? DEFAULT_PROFILE_ID,
          source: 'user',
        })
        targetId = newColl.id
      }
      if (data.existingBookmark) {
        if (data.existingBookmark.cid !== targetId) {
          await window.aether.collections.removeLink(data.existingBookmark.cid, data.existingBookmark.lid)
          await window.aether.collections.addLink(targetId, {
            title: title || data.url, url: data.url, favicon: data.favicon ?? undefined,
          })
        } else {
          await window.aether.collections.updateLink(
            data.existingBookmark.cid, data.existingBookmark.lid, { title: title || data.url }
          )
        }
      } else {
        await window.aether.collections.addLink(targetId, {
          title: title || data.url, url: data.url, favicon: data.favicon ?? undefined,
        })
      }
      close()
    } catch (err) {
      console.error('[bookmark] save failed:', err)
      notify.error(STRINGS.errors.bookmarkSaveFailed)
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!data.existingBookmark || busy) return
    setBusy(true)
    try {
      await window.aether.collections.removeLink(data.existingBookmark.cid, data.existingBookmark.lid)
      close()
    } catch (err) {
      console.error('[bookmark] remove failed:', err)
      notify.error(STRINGS.errors.bookmarkRemoveFailed)
      setBusy(false)
    }
  }

  return (
    <div className="h-full bg-background border border-border rounded-md shadow-2xl p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold tracking-tight">
          {data.existingBookmark ? 'Edit bookmark' : 'Save bookmark'}
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <XIcon size={11} />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <BkFavicon url={data.url} favicon={data.favicon} />
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
          className="h-7 text-[11px] flex-1"
          placeholder="Page name"
        />
      </div>

      {relevant.length > 0 ? (
        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => setColOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-1 h-7 px-2.5 text-[11px] rounded border border-border bg-input hover:border-border/80 transition-colors"
          >
            <span className="truncate">{selectedCollection?.name ?? 'Select collection'}</span>
            <ChevronDown size={10} className="shrink-0 text-muted-foreground" />
          </button>
          {colOpen && (
            <div className="absolute left-0 top-full mt-0.5 z-10 bg-background border border-border rounded-md shadow-xl py-0.5 w-full max-h-36 overflow-y-auto">
              {relevant.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCollectionId(c.id); setColOpen(false) }}
                  className={cn(
                    'w-full text-left text-[11px] px-3 py-1.5 hover:bg-muted transition-colors',
                    collectionId === c.id && 'text-primary font-medium'
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {c.profileId === 'shared' && (
                    <span className="text-[9px] text-muted-foreground ml-1">(global)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mb-3 italic">
          A default collection will be created.
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        {data.existingBookmark ? (
          <button type="button" onClick={() => void remove()} disabled={busy}
            className="text-[11px] text-destructive hover:underline disabled:opacity-40 disabled:no-underline">
            Remove
          </button>
        ) : <span />}
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : (data.existingBookmark ? 'Update' : 'Save')}
        </Button>
      </div>
    </div>
  )
}
