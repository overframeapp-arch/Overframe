import {
  ArrowLeft,
  ArrowRight,
  Home,
  RotateCw,
  Star,
  Library,
  Heart,
  MemoryStick,
  Settings as SettingsIcon,
} from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PROFILE_ID, SEARCH_ENGINES } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { Input } from './ui/Input'
import { cn } from '../lib/cn'

// ── MemoryWidget ──────────────────────────────────────────────────────────────
function formatMb(kb: number): string {
  const mb = kb / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

function MemoryWidget(): JSX.Element {
  const [totalKb, setTotalKb] = useState(0)
  useEffect(() => {
    void window.aether.tabs.getMemoryUsage().then((s) =>
      setTotalKb(s.tabs.reduce((acc, e) => acc + e.privateKb, 0) + s.appKb)
    )
    return window.aether.on.memoryUpdated((s) =>
      setTotalKb(s.tabs.reduce((acc, e) => acc + e.privateKb, 0) + s.appKb)
    )
  }, [])
  const label = totalKb > 0 ? formatMb(totalKb) : '...'
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        void window.aether.popup.openMemory({ anchorX: Math.round(r.right), anchorY: Math.round(r.bottom) })
      }}
      aria-label="Memory usage"
      aria-haspopup="dialog"
      className="flex items-center gap-1.5 h-7 px-2 rounded text-[11px] tabular-nums shrink-0 text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors"
      title="Memory usage"
    >
      <MemoryStick size={13} />
      <span>{label}</span>
    </button>
  )
}

export function AddressBar(): JSX.Element {
  const { tabs, activeTabId, activeProfile, collections, settings } = useAppStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const [value, setValue] = useState('')
  const urlSelectedRef = useRef(false)

  // Mirror CollectionBar visibility condition to add border-b when it's hidden
  const collectionBarVisible = activeProfile != null && collections.some(
    (c) => c.profileId === activeProfile.id || c.profileId === 'shared'
  )

  useEffect(() => {
    setValue(activeTab?.url ?? '')
  }, [activeTab?.url, activeTab?.id])

  const relevantCollections = useMemo(
    () => collections.filter(
      (c) => c.profileId === (activeProfile?.id ?? DEFAULT_PROFILE_ID) || c.profileId === 'shared'
    ),
    [collections, activeProfile?.id]
  )

  const existingBookmark = useMemo(() => {
    if (!activeTab) return null
    for (const c of relevantCollections) {
      const link = c.links.find((l) => l.url === activeTab.url)
      if (link) return { cid: c.id, lid: link.id, title: link.title }
    }
    return null
  }, [activeTab, relevantCollections])
  const isBookmarked = existingBookmark !== null

  const handleStarClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (!activeTab) return
    const rect = e.currentTarget.getBoundingClientRect()
    void window.aether.popup.open('bookmark', {
      anchorX: Math.round(rect.right),
      anchorY: Math.round(rect.bottom),
      url: activeTab.url,
      title: activeTab.title ?? activeTab.url,
      favicon: activeTab.favicon,
      existingBookmark,
      activeProfileId: activeProfile?.id ?? DEFAULT_PROFILE_ID,
    })
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!activeTab) { void window.aether.tabs.create(buildUrl(value, settings?.searchEngine)); return }
    void window.aether.tabs.navigate(activeTab.id, buildUrl(value, settings?.searchEngine))
  }

  return (
    <div className={cn('no-drag flex items-center gap-1 px-2 h-10 bg-muted', !collectionBarVisible && 'border-b border-border')}>
      {/* Navigation */}
      <button
        type="button"
        aria-label="Go to homepage"
        disabled={!activeTab}
        onClick={() => {
          void window.aether.tabs.deactivate()
        }}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Home"
      >
        <Home size={14} />
      </button>
      <button
        type="button"
        aria-label="Go back"
        disabled={!activeTab?.canGoBack}
        onClick={() => activeTab && void window.aether.tabs.goBack(activeTab.id)}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Back"
      >
        <ArrowLeft size={15} />
      </button>
      <button
        type="button"
        aria-label="Go forward"
        disabled={!activeTab?.canGoForward}
        onClick={() => activeTab && void window.aether.tabs.goForward(activeTab.id)}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Forward"
      >
        <ArrowRight size={15} />
      </button>
      <button
        type="button"
        aria-label={activeTab?.isLoading ? 'Loading' : 'Reload'}
        disabled={!activeTab}
        onClick={() => activeTab && void window.aether.tabs.reload(activeTab.id)}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title="Reload"
      >
        <RotateCw size={14} className={activeTab?.isLoading ? 'animate-spin' : ''} />
      </button>

      {/* Address input */}
      <form onSubmit={handleSubmit} className="flex-1 min-w-0 relative mx-1" role="search">
        {activeTab?.favicon && (
          <img
            src={activeTab.favicon}
            alt=""
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 pointer-events-none"
          />
        )}
        <Input
          aria-label="Address bar"
          data-address-input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onMouseDown={(e) => {
            if (!urlSelectedRef.current) {
              e.preventDefault()
              e.currentTarget.focus()
              e.currentTarget.select()
              urlSelectedRef.current = true
            } else {
              urlSelectedRef.current = false
            }
          }}
          onBlur={(e) => {
            urlSelectedRef.current = false
            const el = e.currentTarget
            el.setSelectionRange(el.value.length, el.value.length)
          }}
          placeholder="Search or enter URL"
          className={cn('h-8 w-full text-[12px] pr-8 bg-background border-border/60', activeTab?.favicon ? 'pl-8' : 'pl-3')}
        />
        <button
          type="button"
          aria-label={isBookmarked ? 'Edit bookmark' : 'Bookmark page'}
          aria-pressed={isBookmarked}
          disabled={!activeTab}
          onClick={handleStarClick}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors',
            'hover:text-foreground disabled:opacity-30 disabled:pointer-events-none',
            isBookmarked ? 'text-primary' : 'text-muted-foreground/60'
          )}
          title={isBookmarked ? 'Edit bookmark' : 'Bookmark page'}
        >
          <Star size={13} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
      </form>

      {/* Right toolbar */}
      <button
        type="button"
        aria-label="Manage collections"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          void window.aether.popup.openCollections({ anchorX: Math.round(r.right), anchorY: Math.round(r.bottom), initialLevel: 'collections' })
        }}
        className="flex items-center justify-center h-7 w-7 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/70"
        title="Manage collections"
      >
        <Library size={15} />
      </button>

      {/* Memory */}
      {settings?.showMemoryUsage !== false && <MemoryWidget />}

      {/* Zoom badge — only shown when zoom differs from 100% */}
      {activeTab && activeTab.zoomFactor !== undefined && activeTab.zoomFactor !== 1 && (
        <button
          type="button"
          aria-label={`Zoom ${Math.round(activeTab.zoomFactor * 100)}%. Click to reset.`}
          onClick={() => void window.aether.tabs.setZoom(activeTab.id, 1)}
          className="flex items-center h-7 px-1.5 rounded text-[11px] tabular-nums text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors"
          title="Reset zoom to 100%"
        >
          {Math.round(activeTab.zoomFactor * 100)}%
        </button>
      )}
      <button
        type="button"
        aria-label="Join the Discord community"
        onClick={() => void window.aether.tabs.create('https://discord.com/channels/1501993110291349584/1501996196103979251')}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-background/70 transition-colors"
        title="Discord community"
      >
        <DiscordIcon size={15} />
      </button>
      <button
        type="button"
        aria-label="Support the developer on Ko-fi"
        onClick={() => void window.aether.tabs.create('https://ko-fi.com/overframe')}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground/60 hover:text-pink-400 hover:bg-background/70 transition-colors"
        title="Support development"
      >
        <Heart size={15} />
      </button>
      <button
        type="button"
        aria-label="Open settings"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          void window.aether.popup.openSettings({ anchorX: Math.round(r.right), anchorY: Math.round(r.bottom) })
        }}
        className="flex items-center justify-center h-7 w-7 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/70"
        title="Settings"
      >
        <SettingsIcon size={15} />
      </button>
    </div>
  )
}

function buildUrl(input: string, searchEngine?: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'about:blank'
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`
  const engine = SEARCH_ENGINES[searchEngine as keyof typeof SEARCH_ENGINES] ?? SEARCH_ENGINES.google
  return engine.url + encodeURIComponent(trimmed)
}
