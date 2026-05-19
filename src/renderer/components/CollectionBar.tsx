import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { Collection, Link } from '@shared/types'
import { Favicon } from './collections/atoms'

function collectionStorageKey(profileId: string): string {
  return `bookmarkBar:collectionId:${profileId}`
}

// A single link button — reused in both the sizer (invisible) and the visible bar
function BarLinkButton({ link, onClick }: { link: Link; onClick?: () => void }): JSX.Element {
  return (
    <button
      type="button"
      aria-label={link.title || link.url}
      onClick={onClick}
      title={link.url}
      className="flex items-center gap-1.5 h-6 px-2.5 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors shrink-0 max-w-[160px]"
    >
      {link.favicon ? (
        <img src={link.favicon} alt="" className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Favicon url={link.url} favicon={link.favicon} />
      )}
      <span className="truncate">{link.title || link.url}</span>
    </button>
  )
}

function OverflowButton({ links }: { links: Link[] }): JSX.Element {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    void window.aether.popup.openLinkOverflow({
      anchorX: Math.round(rect.right),
      anchorY: Math.round(rect.bottom),
      links: links.map((l) => ({ id: l.id, title: l.title, url: l.url, favicon: l.favicon })),
    })
  }
  return (
    <button
      type="button"
      aria-label={`${links.length} more links`}
      onClick={handleClick}
      className="flex items-center justify-center h-6 px-2 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors shrink-0"
    >
      +{links.length}
    </button>
  )
}

export function CollectionBar(): JSX.Element | null {
  const { collections, activeProfile } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Available collections for this profile
  const available = collections.filter(
    (c) => activeProfile && (c.profileId === activeProfile.id || c.profileId === 'shared')
  )

  // Restore persisted selection when profile or collections change
  useEffect(() => {
    if (!activeProfile) return
    const stored = localStorage.getItem(collectionStorageKey(activeProfile.id))
    const valid = available.find((c) => c.id === stored)
    setSelectedId(valid ? valid.id : (available[0]?.id ?? null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, collections.length])

  // Listen for selection changes written by CollectionPickerPopup
  useEffect(() => {
    if (!activeProfile) return
    const key = collectionStorageKey(activeProfile.id)
    const handler = (e: StorageEvent): void => {
      if (e.key !== key) return
      const valid = available.find((c) => c.id === e.newValue)
      if (valid) setSelectedId(valid.id)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id, available])

  if (!activeProfile || available.length === 0) return null

  const selected: Collection | undefined = available.find((c) => c.id === selectedId) ?? available[0]

  const openPicker = (e: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    void window.aether.popup.openCollectionPicker({
      anchorX: Math.round(rect.left) + 220,
      anchorY: Math.round(rect.bottom),
      profileId: activeProfile.id,
      selectedId: selected?.id ?? null,
    })
  }

  const sortedLinks = [...(selected?.links ?? [])].sort((a, b) => a.order - b.order)

  return (
    <div className="no-drag flex items-center gap-1.5 h-10 px-1.5 bg-muted border-b border-border overflow-hidden">
      {/* Collection picker button */}
      <button
        type="button"
        aria-label="Select collection"
        onClick={openPicker}
        className="flex items-center gap-1.5 h-8 px-2 rounded text-[12px] shrink-0 text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
        title="Select collection"
      >
        {selected?.iconUrl && (
          <img src={selected.iconUrl} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 rounded-sm object-contain" />
        )}
        <span className="max-w-[130px] truncate">{selected?.name ?? '—'}</span>
      </button>

      {/* Separator */}
      <div className="h-4 w-px bg-border shrink-0" />

      {/* Links with overflow measurement */}
      <LinksArea links={sortedLinks} selected={selected} />
    </div>
  )
}

const OVERFLOW_BTN_WIDTH = 42 // px reserved for the "+N" button
const ITEM_GAP = 2            // gap-0.5 = 2px

function LinksArea({ links, selected: _selected }: { links: Link[]; selected: Collection | undefined }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const sizerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(links.length)

  useLayoutEffect(() => {
    const container = containerRef.current
    const sizer = sizerRef.current
    if (!container || !sizer) return

    const calculate = (): void => {
      const available = container.offsetWidth
      const items = Array.from(sizer.children) as HTMLElement[]
      if (items.length === 0) { setVisibleCount(0); return }

      let total = 0
      let count = 0
      for (let i = 0; i < items.length; i++) {
        const w = items[i].offsetWidth + (i > 0 ? ITEM_GAP : 0)
        const moreAfter = i < items.length - 1
        const reserved = moreAfter ? OVERFLOW_BTN_WIDTH + ITEM_GAP : 0
        if (total + w + reserved > available) break
        total += w
        count++
      }
      setVisibleCount(count)
    }

    calculate()
    const ro = new ResizeObserver(calculate)
    ro.observe(container)
    return () => ro.disconnect()
  }, [links])

  const visibleLinks = links.slice(0, visibleCount)
  const overflowLinks = links.slice(visibleCount)

  if (links.length === 0) {
    return (
      <span className="text-[11px] text-muted-foreground/50 px-2">No links in this collection</span>
    )
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden">
      {/* Invisible sizer — renders all links to measure their widths */}
      <div
        ref={sizerRef}
        aria-hidden="true"
        className="absolute top-0 left-0 flex items-center gap-0.5 pointer-events-none"
        style={{ visibility: 'hidden', whiteSpace: 'nowrap' }}
      >
        {links.map((link) => (
          <BarLinkButton key={link.id} link={link} />
        ))}
      </div>

      {/* Visible links */}
      <div className="flex items-center gap-0.5 h-full">
        {visibleLinks.map((link) => (
          <BarLinkButton
            key={link.id}
            link={link}
            onClick={() => void window.aether.tabs.create(link.url)}
          />
        ))}
        {overflowLinks.length > 0 && <OverflowButton links={overflowLinks} />}
      </div>
    </div>
  )
}
