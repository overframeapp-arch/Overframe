import { useState, useEffect, useRef } from 'react'
import { Home, Newspaper, Trophy, Globe, RefreshCw, Loader2, CheckCircle2, AlertCircle, Mail, Plus, Pencil, Check, ArrowUp, ArrowDown, Trash2, Library, Settings as SettingsIcon, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'

import { useAppStore } from '../store/appStore'
import type { HomeTab } from '../store/appStore'
import type { CustomLink } from '@shared/types'
import { IG_BASE_URL, IG_AFFILIATE_TAG } from '@shared/ig-affiliate'
import { useDiscordUrl } from '../hooks/useDiscordUrl'
import { cn } from '../lib/cn'
import { MissionsPanel } from './MissionsPanel'
import { ManagePanel } from './ManagePanel'
import { SettingsPanel } from './SettingsPanel'

// ── IG partner banner data (extracted from instant-gaming.com/api/banner/partner/loader.js) ──
const IG_PROMO: Record<string, { text: string; cta: string }> = {
  fr: { text: 'Tous vos jeux vidéos, moins cher', cta: 'Découvrir' },
  en: { text: 'All your Video Games, cheaper',    cta: 'Discover' },
  es: { text: 'Todos tus videojuegos más baratos', cta: 'Descúbrelos' },
  it: { text: 'Tutti i tuoi videogiochi, scontati', cta: 'Scoprili' },
  de: { text: 'All deine Games, günstiger',        cta: 'Jetzt entdecken' },
  pt: { text: 'Todos os teus videojogos, mais baratos.', cta: 'Descobrir' },
  nl: { text: 'All your Video Games, cheaper',    cta: 'Discover' },
  pl: { text: 'Wszystkie Twoje gry wideo, taniej', cta: 'Sprawdź oferty!' },
}
const IG_BANNER_IMG_V = '1780387156'

// ── Homepage tile — fixed, always first, never part of the user-managed quickLinks list ──
const HOMEPAGE_LABELS: Record<string, string> = {
  'https://www.google.com':   'Google',
  'https://duckduckgo.com':   'DuckDuckGo',
  'https://www.bing.com':     'Bing',
  'https://search.brave.com': 'Brave',
}
function homepageLinkName(url: string): string {
  return HOMEPAGE_LABELS[url] ?? (() => {
    try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Home' }
  })()
}

// ── Seen-news persistence ────────────────────────────────────────────────────
const SEEN_KEY = 'overframe:seenAnnouncements'
function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

// ── News / patch-notes feed ────────────────────────────────────────────────────
interface GHRelease {
  tag_name: string
  name: string
  published_at: string
  body: string
  html_url: string
  prerelease: boolean
}

const GH_RELEASES_URL = 'https://api.github.com/repos/overframeApp-arch/Overframe/releases'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Release titles are often authored as "Overframe <tag>" — the tag already has its own pill,
// and "Overframe" is implied (this news feed only ever lists Overframe's own releases), so both
// get stripped. What's left is shown only if it actually adds something beyond date + version.
function releaseTitle(name: string, tagName: string): string {
  if (!name) return ''
  return name
    .split(tagName).join(' ')
    .replace(/\boverframe\b/gi, ' ')
    .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
    .trim()
}

// ── Release-note markdown rendering ────────────────────────────────────────
// Release bodies come from the GitHub API (external, untrusted) — parsed into
// React nodes below, never dangerouslySetInnerHTML, so content can't inject markup.
type MdBlock =
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string }

function parseMarkdownBlocks(md: string): MdBlock[] {
  // Em/en dashes read as an AI-changelog tic when repeated across every bullet
  // ("Term — description" x N) — normalize to a colon, which reads the same but
  // doesn't visually repeat as a dash-dash-dash rhythm down the list.
  const lines = md.replace(/\r\n/g, '\n').replace(/\s*[—–]\s*/g, ': ').split('\n')
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1].trim() })
      i++
      continue
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (bullet) {
      const items = [bullet[1].trim()]
      i++
      while (i < lines.length) {
        const next = /^[-*+]\s+(.*)$/.exec(lines[i])
        if (!next) break
        items.push(next[1].trim())
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }

    const para = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s+/.test(lines[i]) && !/^[-*+]\s+/.test(lines[i])) {
      para.push(lines[i].trim())
      i++
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') })
  }
  return blocks
}

// Inline **bold**, `code`, [text](url) — links open in a new Overframe tab, never in-place navigation.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-${i}`} className="rounded border border-border bg-input px-1 py-px text-[11px]">{match[2]}</code>)
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const url = match[4]
      nodes.push(
        <a
          key={`${keyPrefix}-${i}`}
          href={url}
          className="text-primary hover:underline"
          onClick={(e) => { e.preventDefault(); void window.aether.tabs.create(url) }}
        >
          {match[3]}
        </a>,
      )
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function ReleaseBody({ body }: { body: string }): JSX.Element {
  const blocks = parseMarkdownBlocks(body)
  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <p
              key={idx}
              className="mt-3 border-t border-border/60 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground first:mt-0 first:border-t-0 first:pt-0"
            >
              {renderInline(block.text, `h${idx}`)}
            </p>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={idx} className="flex flex-col gap-1">
              {block.items.map((item, j) => (
                <li key={j} className="relative pl-3.5 text-[11px] text-foreground/90 leading-relaxed">
                  <span className="absolute left-0 top-[7px] h-1 w-1 rounded-full bg-muted-foreground" aria-hidden="true" />
                  {renderInline(item, `li${idx}-${j}`)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={idx} className="text-[11px] text-muted-foreground leading-relaxed">
            {renderInline(block.text, `p${idx}`)}
          </p>
        )
      })}
    </div>
  )
}

function useGitHubReleases(): { releases: GHRelease[] | null; error: boolean } {
  const [releases, setReleases] = useState<GHRelease[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch(GH_RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((data: GHRelease[]) => { if (!cancelled) setReleases(data) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])
  return { releases, error }
}

type UpdateStatus =
  | null
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'dev' }

export function WelcomePage(): JSX.Element | null {
  const { activeTabId, settings, homeTab: tab, setHomeTab } = useAppStore()
  const discordUrl = useDiscordUrl()

  // ── Quick access — CRUD for user-managed links (homepage tile is separate & fixed) ──
  const [manageMode, setManageMode] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkName, setNewLinkName] = useState('')
  const [newLinkDesc, setNewLinkDesc] = useState('')
  const [newLinkError, setNewLinkError] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [editLinkName, setEditLinkName] = useState('')
  const [editLinkDesc, setEditLinkDesc] = useState('')
  const [deleteLinkConfirmId, setDeleteLinkConfirmId] = useState<string | null>(null)
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null)
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null)

  const igLang = (() => {
    const l = navigator.language.split('-')[0].toLowerCase()
    return l in IG_PROMO ? l : 'en'
  })()
  // Affiliate URLs composed from the shared module so the tag/host can never
  // drift from the rest of the app (IGNudge, missions, address bar).
  const igHomeUrl = `${IG_BASE_URL}/${igLang}/?igr=${IG_AFFILIATE_TAG}`
  const igBannerUrl = `${igHomeUrl}&utm_source=dynamic_banner&utm_campaign=19535FORZA`
  const [seenIds, setSeenIds] = useState<Set<string>>(loadSeenIds)
  // Snapshot of ids that were still unread the moment the News tab was opened — kept
  // around so the "new" badge/dot stays visible for this viewing session even after
  // switchTab() below persists them as seen.
  const [viewingNewIds, setViewingNewIds] = useState<Set<string>>(new Set())
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(null)
  const [version, setVersion] = useState('')
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { releases, error: releasesError } = useGitHubReleases()

  const [expandedReleaseIds, setExpandedReleaseIds] = useState<Set<string>>(new Set())
  const didInitExpand = useRef(false)
  useEffect(() => {
    if (didInitExpand.current || !releases || releases.length === 0) return
    didInitExpand.current = true
    setExpandedReleaseIds(new Set([releases[0].tag_name]))
  }, [releases])
  const toggleReleaseExpanded = (tagName: string): void => {
    setExpandedReleaseIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagName)) next.delete(tagName)
      else next.add(tagName)
      return next
    })
  }

  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://www.instant-gaming.com/api/banner/partner/style.css'
    document.head.appendChild(link)
    // IG's ::before/::after don't set left/right — on a flex div the static-position
    // can drift. Pin them explicitly so the gradient always spans the full width.
    const fix = document.createElement('style')
    fix.textContent = '.ig-dynamic-banner::before,.ig-dynamic-banner::after{left:0!important;right:0!important}'
    document.head.appendChild(fix)
    return () => {
      try { document.head.removeChild(link) } catch { /* already removed */ }
      try { document.head.removeChild(fix) } catch { /* already removed */ }
    }
  }, [])

  // Replicate IG's own JS: apply ig-size-XXX class based on rendered banner width
  // so their CSS responsive breakpoints (column layout, gradients, etc.) kick in correctly.
  useEffect(() => {
    const el = bannerRef.current
    if (!el) return
    const SIZE_CLASSES = ['ig-size-500','ig-size-650','ig-size-800','ig-size-900','ig-size-1000','ig-size-1100'] as const
    // Thresholds use offsetWidth (border-box) to stay IG-CSS-load-order independent.
    // Small (column/Y): 500, 650, 800. Large (row/X): 900, 1000, 1100.
    const getSizeClass = (w: number): typeof SIZE_CLASSES[number] => {
      if (w >= 1090) return 'ig-size-1100'
      if (w >= 990)  return 'ig-size-1000'
      if (w >= 890)  return 'ig-size-900'
      if (w >= 765)  return 'ig-size-800'
      if (w >= 615)  return 'ig-size-650'
      return 'ig-size-500'  // never ig-size-400 (it hides the CTA button)
    }
    const apply = (w: number) => {
      const cls = getSizeClass(w)
      SIZE_CLASSES.forEach((c) => el.classList.remove(c))
      el.classList.add(cls)
    }
    // Apply immediately so the class is set before the async ResizeObserver fires.
    apply(el.offsetWidth)
    const ro = new ResizeObserver(([entry]) => {
      // Use borderBoxSize when available (always border-box, independent of CSS padding).
      const w = entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth
      apply(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    void window.aether.system.getVersion().then(setVersion).catch(() => { /* non-critical */ })
  }, [])
  useEffect(() =>
    window.aether.on.updateStatus((s) => {
      if (checkTimeoutRef.current) { clearTimeout(checkTimeoutRef.current); checkTimeoutRef.current = null }
      const status = s as UpdateStatus
      setUpdateStatus(status)
      if (status?.status === 'up-to-date') scheduleUpToDateDismiss()
    })
  , [])

  const dismissTimer = useRef<NodeJS.Timeout | null>(null)
  const scheduleUpToDateDismiss = (): void => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => {
      dismissTimer.current = null
      setUpdateStatus((prev) => prev?.status === 'up-to-date' ? null : prev)
    }, 3_000)
  }

  const handleCheckForUpdates = (): void => {
    setUpdateStatus({ status: 'checking' })
    void window.aether.system.checkForUpdates()
    // Fallback: if no status event arrives within 8s, assume up-to-date
    checkTimeoutRef.current = setTimeout(() => {
      checkTimeoutRef.current = null
      setUpdateStatus((prev) => {
        if (prev?.status === 'checking') { scheduleUpToDateDismiss(); return { status: 'up-to-date' } }
        return prev
      })
    }, 8_000)
  }

  if (activeTabId !== null) return null
  if (!settings) return null

  const customLinks = settings.quickLinks ?? []
  const homepageUrl = settings.homepageUrl ?? 'https://www.google.com'
  const homepageName = homepageLinkName(homepageUrl)
  const homepageFavicon = (() => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(homepageUrl).hostname}&sz=32` } catch { return null }
  })()

  const exitManageMode = (): void => {
    setManageMode(false)
    setAddingLink(false)
    setEditingLinkId(null)
    setDeleteLinkConfirmId(null)
  }

  const toggleManageMode = (): void => {
    if (manageMode) exitManageMode()
    else setManageMode(true)
  }

  const resetAddForm = (): void => {
    setAddingLink(false)
    setNewLinkUrl('')
    setNewLinkName('')
    setNewLinkDesc('')
    setNewLinkError('')
  }

  const commitAddLink = async (): Promise<void> => {
    let url = newLinkUrl.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
    try {
      const hostname = new URL(url).hostname
      if (!hostname) { setNewLinkError('Invalid URL'); return }
      const name = newLinkName.trim() || hostname.replace(/^www\./, '')
      const description = newLinkDesc.trim() || undefined
      const next: CustomLink[] = [...customLinks, { id: crypto.randomUUID(), name, url, description }]
      await window.aether.settings.set('quickLinks', next)
      resetAddForm()
    } catch {
      setNewLinkError('Invalid URL')
    }
  }

  const removeCustomLink = async (id: string): Promise<void> => {
    await window.aether.settings.set('quickLinks', customLinks.filter((l) => l.id !== id))
    if (editingLinkId === id) setEditingLinkId(null)
    if (deleteLinkConfirmId === id) setDeleteLinkConfirmId(null)
  }

  const startEditLink = (link: CustomLink): void => {
    setDeleteLinkConfirmId(null)
    setEditingLinkId(link.id)
    setEditLinkName(link.name)
    setEditLinkDesc(link.description ?? '')
  }

  const cancelEditLink = (): void => setEditingLinkId(null)

  const saveLinkEdit = async (id: string): Promise<void> => {
    const name = editLinkName.trim()
    if (!name) return
    const description = editLinkDesc.trim() || undefined
    const next: CustomLink[] = customLinks.map((l) =>
      l.id === id ? { id: l.id, name, url: l.url, description } : l
    )
    await window.aether.settings.set('quickLinks', next)
    setEditingLinkId(null)
  }

  // Drag & drop reorder — mirrors the collection-reorder pattern used elsewhere in the app.
  const handleReorderLinks = async (sourceId: string, targetId: string): Promise<void> => {
    if (sourceId === targetId) return
    const ids = customLinks.map((l) => l.id)
    const fromIdx = ids.indexOf(sourceId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...customLinks]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await window.aether.settings.set('quickLinks', reordered)
  }

  // Keyboard-operable equivalent to drag reorder (swap with the adjacent entry).
  const moveCustomLink = async (id: string, direction: 'up' | 'down'): Promise<void> => {
    const idx = customLinks.findIndex((l) => l.id === id)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= customLinks.length) return
    const reordered = [...customLinks]
    ;[reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]]
    await window.aether.settings.set('quickLinks', reordered)
  }

  const hasNew = releases?.some((r) => !seenIds.has(r.tag_name)) ?? false

  function switchTab(next: HomeTab): void {
    setHomeTab(next)
    if (next === 'news' && releases) {
      const freshIds = releases.filter((r) => !seenIds.has(r.tag_name)).map((r) => r.tag_name)
      if (freshIds.length > 0) {
        setViewingNewIds(new Set(freshIds))
        const updated = new Set([...seenIds, ...freshIds])
        localStorage.setItem(SEEN_KEY, JSON.stringify([...updated]))
        setSeenIds(updated)
      }
    }
  }

  const tabBtn = (id: HomeTab, icon: React.ReactNode, label: React.ReactNode): JSX.Element => (
    <button
      role="tab"
      aria-selected={tab === id}
      type="button"
      onClick={() => switchTab(id)}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium -mb-px border-b-2 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring',
        tab === id
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Tab bar */}
      <div role="tablist" className="flex items-center gap-1 px-3 border-b border-border shrink-0">
        {tabBtn('home', <Home size={11} />, 'Home')}
        {tabBtn('missions', <Trophy size={11} />, 'Missions')}
        {tabBtn('news', <Newspaper size={11} />,
          <>
            News
            {hasNew && (
              <span className="absolute top-1.5 right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            )}
          </>
        )}
        {tabBtn('manage', <Library size={11} />, 'Manage')}
        {tabBtn('settings', <SettingsIcon size={11} />, 'Settings')}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">

        {/* Home tab — always in DOM so the partner banner div is never unmounted */}
        <div className={cn('absolute inset-0 overflow-y-auto flex flex-col gap-5 py-5', tab !== 'home' && 'hidden')} aria-hidden={tab !== 'home'}>

          {/* ── IG partner banner ────────────────────────────────────────────── */}
          <section aria-label="Instant Gaming affiliate partner" className="flex justify-center px-5">
            <div
              ref={bannerRef}
              role="button"
              tabIndex={0}
              onClick={() => void window.aether.tabs.create(igBannerUrl)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') void window.aether.tabs.create(igBannerUrl)
              }}
              className="ig-dynamic-banner w-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 transition-opacity hover:opacity-90 active:opacity-80"
              style={{
                backgroundImage: `url('https://www.instant-gaming.com/images/bp/16/16-${igLang}.jpg?v=${IG_BANNER_IMG_V}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                height: '220px',
                maxWidth: '1200px',
                minHeight: 'unset',
              }}
              aria-label={`Instant Gaming: ${IG_PROMO[igLang]?.text ?? ''}`}
            >
              <div className="ig-dynamic-banner-logo" />
              <div className="ig-dynamic-banner-text">
                <div className="ig-dynamic-banner-title">{IG_PROMO[igLang]?.text}</div>
                <div className="ig-dynamic-banner-cta">{IG_PROMO[igLang]?.cta}</div>
              </div>
            </div>
          </section>

          {/* ── Contenu centré à 1200px max ──────────────────────────────────── */}
          <div className="w-full max-w-[1200px] mx-auto px-5 flex flex-col gap-5">

          {/* Brand header */}
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold tracking-tight text-foreground">Good to have you.</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remember: set your game to <span className="text-foreground/70">borderless windowed</span> mode for the overlay to appear on top.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          {/* Quick access */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Quick access</p>
              <button
                type="button"
                onClick={toggleManageMode}
                aria-pressed={manageMode}
                className={cn(
                  'flex items-center gap-1 text-[11px] transition-colors',
                  manageMode ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {manageMode ? <><Check size={11} /> Done</> : <><Pencil size={11} /> Edit</>}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {/* Homepage — fixed, always first, immutable. Mirrors Settings → Browser →
                  Homepage; pinning it here (never draggable/editable/removable, even in
                  manage mode) means it can't be lost by an accidental reorder or delete. */}
              <button
                type="button"
                onClick={() => void window.aether.tabs.create(homepageUrl)}
                title="Set in Settings → Browser → Homepage"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted border border-border hover:border-primary/40 hover:bg-muted/80 text-left transition-colors"
              >
                {homepageFavicon && <img src={homepageFavicon} alt="" width={16} height={16} className="rounded-sm shrink-0 opacity-80" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                <span className="text-[11px] font-medium text-foreground truncate">{homepageName}</span>
              </button>

              {/* User-managed links — CRUD gated behind "Edit": rename, describe, reorder
                  (drag or buttons), delete-with-confirmation, add-with-description. */}
              {customLinks.map((link, idx) => {
                const { id, name, url, description } = link
                const hostname = (() => { try { return new URL(url).hostname } catch { return '' } })()
                const favicon = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : null
                const isEditing = manageMode && editingLinkId === id
                const isConfirmingDelete = manageMode && deleteLinkConfirmId === id
                const isDragOver = dragOverLinkId === id && draggedLinkId !== id

                if (isEditing) {
                  return (
                    <div key={id} className="col-span-2 flex flex-col gap-1.5 px-3 py-2.5 rounded-md bg-muted border border-primary/40">
                      <input
                        autoFocus
                        type="text"
                        aria-label="Link name"
                        value={editLinkName}
                        onChange={(e) => setEditLinkName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveLinkEdit(id); if (e.key === 'Escape') cancelEditLink() }}
                        placeholder="Name"
                        className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="text"
                        aria-label="Short description (optional)"
                        value={editLinkDesc}
                        onChange={(e) => setEditLinkDesc(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveLinkEdit(id); if (e.key === 'Escape') cancelEditLink() }}
                        placeholder="Description (optional)"
                        className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button type="button" onClick={cancelEditLink} className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                        <button type="button" onClick={() => void saveLinkEdit(id)} disabled={editLinkName.trim().length === 0}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:pointer-events-none transition-colors">
                          <Check size={10} /> Save
                        </button>
                      </div>
                    </div>
                  )
                }

                if (isConfirmingDelete) {
                  return (
                    <div key={id} role="alert" className="col-span-2 flex items-center gap-2 px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                      <span className="flex-1 text-[11px]">Delete &laquo;{name}&raquo;?</span>
                      <button type="button" onClick={() => void removeCustomLink(id)}
                        className="h-6 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">
                        Delete
                      </button>
                      <button type="button" onClick={() => setDeleteLinkConfirmId(null)}
                        className="h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )
                }

                return (
                  <div
                    key={id}
                    draggable={manageMode}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedLinkId(id) }}
                    onDragOver={(e) => { e.preventDefault(); if (draggedLinkId && draggedLinkId !== id) setDragOverLinkId(id) }}
                    onDragLeave={() => setDragOverLinkId(null)}
                    onDrop={(e) => { e.preventDefault(); if (draggedLinkId && draggedLinkId !== id) void handleReorderLinks(draggedLinkId, id); setDraggedLinkId(null); setDragOverLinkId(null) }}
                    onDragEnd={() => { setDraggedLinkId(null); setDragOverLinkId(null) }}
                    className={cn(
                      'relative rounded-md transition-colors',
                      draggedLinkId === id && 'opacity-50',
                      isDragOver && 'ring-2 ring-primary',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void window.aether.tabs.create(url)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted border border-border hover:border-primary/40 hover:bg-muted/80 text-left transition-colors"
                    >
                      {favicon && <img src={favicon} alt="" width={16} height={16} className="rounded-sm shrink-0 opacity-80" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
                      <div className={cn('flex flex-col min-w-0', manageMode && 'pr-24')}>
                        <span className="text-[11px] font-medium text-foreground truncate">{name}</span>
                        {description && <span className="text-[11px] text-muted-foreground truncate">{description}</span>}
                      </div>
                    </button>

                    {/* Action cluster — only in manage mode, always visible there (no hover-reveal:
                        you deliberately opted into editing, so nothing should hide). */}
                    {manageMode && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
                        <button type="button" onClick={() => void moveCustomLink(id, 'up')} disabled={idx === 0}
                          aria-label={`Move ${name} up`} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ArrowUp size={10} />
                        </button>
                        <button type="button" onClick={() => void moveCustomLink(id, 'down')} disabled={idx === customLinks.length - 1}
                          aria-label={`Move ${name} down`} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors">
                          <ArrowDown size={10} />
                        </button>
                        <button type="button" onClick={() => startEditLink(link)}
                          aria-label={`Edit ${name}`} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil size={10} />
                        </button>
                        <button type="button" onClick={() => setDeleteLinkConfirmId(id)}
                          aria-label={`Delete ${name}`} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add tile — only in manage mode, same CRUD form shape as Edit (name + description) plus the URL */}
              {manageMode && !addingLink && (
                <button
                  type="button"
                  onClick={() => { setAddingLink(true); setEditingLinkId(null); setDeleteLinkConfirmId(null); setTimeout(() => addInputRef.current?.focus(), 0) }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
                >
                  <Plus size={12} /> Add link
                </button>
              )}

              {addingLink && (
                <div className="col-span-2 flex flex-col gap-1.5 px-3 py-2.5 rounded-md bg-muted border border-primary/40" role="form" aria-label="Add quick link">
                  <input
                    ref={addInputRef}
                    type="text"
                    aria-label="URL"
                    value={newLinkUrl}
                    onChange={(e) => { setNewLinkUrl(e.target.value); setNewLinkError('') }}
                    onKeyDown={(e) => { if (e.key === 'Escape') resetAddForm() }}
                    placeholder="example.com"
                    className={cn(
                      'rounded border bg-input px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1',
                      newLinkError ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-ring',
                    )}
                  />
                  <input
                    type="text"
                    aria-label="Name (optional)"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') resetAddForm() }}
                    placeholder="Name (defaults to the site's hostname)"
                    className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="text"
                    aria-label="Short description (optional)"
                    value={newLinkDesc}
                    onChange={(e) => setNewLinkDesc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void commitAddLink(); if (e.key === 'Escape') resetAddForm() }}
                    placeholder="Description (optional)"
                    className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {newLinkError && <p className="text-[11px] text-destructive" role="alert">{newLinkError}</p>}
                  <div className="flex gap-1.5 justify-end">
                    <button type="button" onClick={resetAddForm} className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void commitAddLink()} disabled={newLinkUrl.trim().length === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:pointer-events-none transition-colors">
                      <Check size={10} /> Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Support section */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Support Overframe</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                {
                  url: igHomeUrl,
                  favicon: 'https://www.google.com/s2/favicons?domain=instant-gaming.com&sz=32',
                  name: 'Instant Gaming',
                  desc: 'Buy games at a discount. Same price for you, small commission for us.',
                },
                {
                  url: 'https://ko-fi.com/overframe',
                  favicon: 'https://www.google.com/s2/favicons?domain=ko-fi.com&sz=32',
                  name: 'Ko-fi',
                  desc: 'One-time donation or monthly membership. Directly supports development.',
                },
              ] as const).map(({ url, favicon, name, desc }) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => void window.aether.tabs.create(url)}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-muted border border-border hover:border-primary/40 hover:bg-muted/80 text-left transition-colors group"
                >
                  <img src={favicon} alt="" width={16} height={16} className="rounded-sm shrink-0 mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground">{name}</span>
                      {name === 'Instant Gaming' && (
                        <span className="text-[11px] px-1.5 py-px rounded border leading-none border-orange-400/40 bg-orange-400/10 text-orange-200 font-medium">
                          affiliate
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground leading-snug">{desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          </div>{/* end max-w-[1200px] wrapper */}
        </div>

        {tab === 'missions' && (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="w-full max-w-[1200px] mx-auto px-5 py-4">
              <MissionsPanel />
            </div>
          </div>
        )}

        {tab === 'news' && (
          <div className="absolute inset-0 overflow-y-auto">
            <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-3 px-5 py-4">
            {releases === null && !releasesError && (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {releasesError && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <AlertCircle size={28} className="text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">Could not load releases. Check your connection.</p>
              </div>
            )}
            {releases?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <Newspaper size={28} className="text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">No releases yet. Check back soon.</p>
              </div>
            )}

            {/* Version timeline — a rail connects every release so the chronology reads
                at a glance; each entry expands in place instead of sending you to GitHub. */}
            {releases && releases.length > 0 && (
              <div role="list" aria-label="Release history">
                {releases.map(({ tag_name, name, published_at, body, html_url, prerelease }, idx) => {
                  const isNew = viewingNewIds.has(tag_name)
                  const isExpanded = expandedReleaseIds.has(tag_name)
                  const isLast = idx === releases.length - 1
                  return (
                    <div key={tag_name} role="listitem" className="relative pl-6 pb-3">
                      {!isLast && (
                        <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border" aria-hidden="true" />
                      )}
                      <span
                        className={cn(
                          'absolute left-0 top-[15px] h-2.5 w-2.5 rounded-full border-2',
                          isNew ? 'bg-primary border-primary' : 'bg-background border-border',
                        )}
                        style={isNew ? { boxShadow: '0 0 0 3px hsl(var(--primary) / 0.18)' } : undefined}
                        aria-hidden="true"
                      />

                      <div className="rounded-md border border-border bg-muted">
                        <button
                          type="button"
                          onClick={() => toggleReleaseExpanded(tag_name)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {isExpanded
                            ? <ChevronDown size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
                            : <ChevronRight size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />}
                          <span className="shrink-0 rounded border border-border bg-input px-1.5 py-0.5 text-[11px] text-foreground/85">
                            {tag_name}
                          </span>
                          {prerelease && (
                            <span className="inline-flex shrink-0 items-center rounded border border-amber-500/20 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-amber-400">
                              Early Access
                            </span>
                          )}
                          {isNew && (
                            <span className="inline-flex shrink-0 items-center rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-primary">
                              New
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
                            {releaseTitle(name, tag_name)}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(published_at)}</span>
                        </button>

                        {isExpanded && (
                          <div className="flex flex-col gap-2 px-3 pb-3 pl-9">
                            <ReleaseBody body={body} />
                            <button
                              type="button"
                              onClick={() => void window.aether.tabs.create(html_url)}
                              className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                            >
                              View on GitHub <ExternalLink size={10} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>
        )}

        {tab === 'manage' && (
          <div className="absolute inset-0">
            <ManagePanel />
          </div>
        )}

        {tab === 'settings' && (
          <div className="absolute inset-0 overflow-y-auto">
            <SettingsPanel />
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-t border-border shrink-0">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-indigo-400 transition-colors"
          onClick={() => void window.aether.tabs.create(discordUrl)}
        >
          <DiscordIcon size={11} /> Community
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => void window.aether.tabs.create('https://overframe.app')}
        >
          <Globe size={11} /> Website
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => void window.aether.system.openExternal('mailto:contact@overframe.app')}
        >
          <Mail size={11} /> Contact
        </button>

        <span className="flex-1" />

        {/* Update status feedback */}
        {updateStatus && updateStatus.status !== 'checking' && (
          <>
            {updateStatus.status === 'up-to-date' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <CheckCircle2 size={11} className="text-green-500" aria-hidden="true" />Up to date
              </span>
            )}
            {updateStatus.status === 'available' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 size={11} className="animate-spin text-blue-400" aria-hidden="true" />Downloading update…
              </span>
            )}
            {updateStatus.status === 'downloaded' && (
              <button
                type="button"
                onClick={() => void window.aether.system.restartToUpdate()}
                className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 transition-colors font-medium"
              >
                <CheckCircle2 size={11} aria-hidden="true" />Restart to update
              </button>
            )}
            {updateStatus.status === 'error' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-destructive" title={updateStatus.message}>
                <AlertCircle size={11} aria-hidden="true" />Update failed
              </span>
            )}
          </>
        )}

        {version && (
          <span className="text-[11px] text-muted-foreground" aria-label={`Version ${version}`}>
            {version}
          </span>
        )}

        <button
          type="button"
          disabled={updateStatus?.status === 'checking'}
          onClick={handleCheckForUpdates}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {updateStatus?.status === 'checking'
            ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            : <RefreshCw size={11} aria-hidden="true" />}
          {updateStatus?.status === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
    </div>
  )
}