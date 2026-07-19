import {
  ArrowLeft,
  ArrowRight,
  Home,
  RotateCw,
  X,
  Star,
  Library,
  MemoryStick,
  Settings as SettingsIcon,
  Globe,
} from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'
import { KoFiIcon } from './icons/PlatformIcons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PROFILE_ID, DEFAULT_HOMEPAGE, SEARCH_ENGINES } from '@shared/types'
import { IGLogoIcon } from './icons/IGLogoIcon'
import { localizeIGUrl, IG_HOME } from '@shared/ig-affiliate'
import { useAppStore } from '../store/appStore'
import type { HomeTab } from '../store/appStore'
import { useDiscordUrl } from '../hooks/useDiscordUrl'
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
  const { tabs, activeTabId, activeProfile, collections, settings, setHomeTab } = useAppStore()

  const goHome = (tab: HomeTab): void => {
    setHomeTab(tab)
    if (activeTabId) void window.aether.tabs.deactivate()
  }
  const discordUrl = useDiscordUrl()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const [value, setValue] = useState('')
  // Timestamp of the last mousedown on the address bar. Used to suppress the
  // webviewFocused blur if the user clicked the address bar right after the webview
  // (race condition: the GotFocus IPC can arrive after claimFocus restored focus).
  const lastBarClickMsRef = useRef(0)
  // Tracks whether the input is genuinely in edit mode (onFocus fired).
  // Used instead of document.activeElement which Chrome can update before
  // mousedown is dispatched to JS, causing first-click to wrongly skip select-all.
  const inputFocusedRef = useRef(false)
  // Set by onFocus, consumed by onMouseDown: detects the Windows "activation click"
  // where focus fires before mousedown (Electron window wasn't the foreground window).
  const focusPrecededMousedownRef = useRef(false)
  // Set of tab IDs seen so far — used to detect brand-new tabs (not tab switches).
  const knownTabIdsRef = useRef(new Set<string>())

  // Mirror CollectionBar visibility condition to add border-b when it's hidden
  const collectionBarVisible = activeProfile != null && collections.some(
    (c) => c.profileId === activeProfile.id || c.profileId === 'shared'
  )

  const homepageUrl = activeProfile?.homepageUrl ?? DEFAULT_HOMEPAGE

  useEffect(() => {
    // Empty address bar when the tab is at the homepage so the user can type directly.
    const isAtHomepage = !!activeTab && (activeTab.url === homepageUrl || activeTab.url === homepageUrl + '/')
    setValue(isAtHomepage ? '' : (activeTab?.url ?? ''))
  // activeTab?.url and activeTab?.id cover all properties we actually read
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.url, activeTab?.id, homepageUrl])

  // Auto-focus the address bar when a brand-new empty tab is opened (like browsers do).
  // Fires only when the active tab is one that wasn't previously known (not a tab switch)
  // and has the 'New tab' title (set exclusively by create() for homepage tabs).
  useEffect(() => {
    const known = knownTabIdsRef.current
    const currentIds = new Set(tabs.map((t) => t.id))
    const isNewTab = !!activeTabId && !known.has(activeTabId) && currentIds.has(activeTabId)
    knownTabIdsRef.current = currentIds
    if (!isNewTab) return
    const isAtHomepage = !!activeTab && (activeTab.url === homepageUrl || activeTab.url === homepageUrl + '/')
    if (!isAtHomepage) return
    const t = setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('[data-address-input]')
      if (!input) return
      inputFocusedRef.current = true
      input.focus()
      input.select()
    }, 0)
    return () => clearTimeout(t)
  // activeTab?.url covers the property we read from activeTab
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabId, activeTab?.url, homepageUrl])

  // Blur + deselect the address bar when the user clicks in the WebView2.
  // Skip if the address bar was clicked within the last 200 ms — that means the
  // user clicked the webview and then quickly clicked the address bar; claimFocus()
  // already handled the OS focus restoration and we must not steal it back.
  useEffect(() => window.aether.on.webviewFocused(() => {
    const input = document.querySelector<HTMLInputElement>('[data-address-input]')
    if (!input) return
    if (Date.now() - lastBarClickMsRef.current < 200) return
    inputFocusedRef.current = false
    input.blur()
  }), [])


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
        aria-label={activeTab?.isLoading ? 'Stop loading' : 'Reload page'}
        disabled={!activeTab}
        onClick={() => {
          if (!activeTab) return
          if (activeTab.isLoading) void window.aether.tabs.stop(activeTab.id)
          else void window.aether.tabs.reload(activeTab.id)
        }}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-background/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        title={activeTab?.isLoading ? 'Stop loading' : 'Reload'}
      >
        {activeTab?.isLoading ? <X size={14} /> : <RotateCw size={14} />}
      </button>

      {/* Address input */}
      <form onSubmit={handleSubmit} className="flex-1 min-w-0 relative mx-1" role="search">
        {/* Favicon */}
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center pointer-events-none">
          {activeTab?.favicon ? (
            <img src={activeTab.favicon} alt="" className="h-4 w-4 favicon-pop" />
          ) : activeTab ? (
            <Globe size={12} className="text-muted-foreground" aria-hidden="true" />
          ) : null}
        </span>
        <Input
          aria-label="Address bar"
          data-address-input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => {
            inputFocusedRef.current = true
            focusPrecededMousedownRef.current = true
            e.currentTarget.select()
            // Clear the flag after the current click gesture ends so it doesn't
            // persist into subsequent clicks (e.g. double-click's second mousedown).
            setTimeout(() => { focusPrecededMousedownRef.current = false }, 0)
          }}
          onMouseDown={(e) => {
            // shouldSelectAll is true when:
            // 1. Normal first click: input wasn't focused (inputFocusedRef=false)
            // 2. Activation click: Windows fires focus before mousedown when the Electron
            //    window wasn't the foreground window — focus already set inputFocusedRef=true,
            //    but focusPrecededMousedownRef tells us this is still the "first click".
            const shouldSelectAll = !inputFocusedRef.current || focusPrecededMousedownRef.current
            if (shouldSelectAll) {
              // preventDefault stops Chromium from repositioning the cursor at the click
              // location on mouseup — without it, select() can race against mouseup and lose.
              e.preventDefault()
              focusPrecededMousedownRef.current = false
              lastBarClickMsRef.current = Date.now()
            }
            window.focus()
            window.aether.overlay.claimFocus()
            if (shouldSelectAll) {
              // Manually give focus (skipped by browser since we called preventDefault).
              e.currentTarget.focus()
              e.currentTarget.select()
            }
          }}
          onBlur={(e) => { inputFocusedRef.current = false; e.currentTarget.setSelectionRange(0, 0) }}
          placeholder="Search or enter URL"
          className={cn('h-8 w-full text-[12px] pr-8 bg-background border-border/60', activeTab ? 'pl-8' : 'pl-3')}
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
            isBookmarked ? 'text-primary' : 'text-muted-foreground'
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
        onClick={() => goHome('manage')}
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
        aria-label="Shop on Instant Gaming"
        onClick={() => void window.aether.tabs.create(localizeIGUrl(IG_HOME))}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-ig-orange hover:bg-background/70 transition-colors"
        title="Instant Gaming: save on games & top-ups"
      >
        <IGLogoIcon size={15} mono />
      </button>
      <button
        type="button"
        aria-label="Join the Discord community"
        onClick={() => void window.aether.tabs.create(discordUrl)}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-indigo-400 hover:bg-background/70 transition-colors"
        title="Discord community"
      >
        <DiscordIcon size={15} />
      </button>
      <button
        type="button"
        aria-label="Support the developer on Ko-fi"
        onClick={() => void window.aether.tabs.create('https://ko-fi.com/overframe')}
        className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-ko-fi-red hover:bg-background/70 transition-colors"
        title="Support development"
      >
        <KoFiIcon size={15} />
      </button>
      <button
        type="button"
        aria-label="Open settings"
        onClick={() => goHome('settings')}
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
