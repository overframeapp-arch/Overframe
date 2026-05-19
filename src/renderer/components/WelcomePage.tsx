import { useState, useEffect } from 'react'
import { Home, Newspaper, Trophy, Heart, Globe, RefreshCw, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'
import { useAppStore } from '../store/appStore'
import { cn } from '../lib/cn'
import { MissionsPanel } from './MissionsPanel'

// â”€â”€ Seen-news persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SEEN_KEY = 'overframe:seenAnnouncements'
function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

// â”€â”€ Quick links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface QuickLink { name: string; url: string; description: string }
const QUICK_LINKS: QuickLink[] = [
  { name: 'Google',      url: 'https://www.google.com',             description: 'Search the web'       },
  { name: 'YouTube',     url: 'https://www.youtube.com',            description: 'Watch videos'          },
  { name: 'Twitch',      url: 'https://www.twitch.tv',              description: 'Live streaming'        },
  { name: 'Discord',     url: 'https://discord.com/app',            description: 'Chats & servers'       },
  { name: 'Steam',       url: 'https://store.steampowered.com',     description: 'PC gaming platform'    },
  { name: 'Reddit',      url: 'https://www.reddit.com',             description: 'Communities & news'    },
  { name: 'Speedrun.com',url: 'https://www.speedrun.com',           description: 'Leaderboards & runs'   },
  { name: 'Wikipedia',   url: 'https://www.wikipedia.org',          description: 'Free encyclopedia'     },
]

// â”€â”€ News / patch-notes feed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Announcement {
  id: string
  date: string
  title: string
  body: string
  tag?: string
  url?: string
  isNew?: boolean
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'v0.1-launch',
    date: 'May 15, 2026',
    title: 'Overframe v0.1',
    body: 'First public build. Everything you need to browse without leaving your game is here — tabs, profiles, collections, shortcuts, game detection. Rough edges exist; drop them on Discord and I\'ll get them fixed. Thanks for being first.',
    tag: 'Early Access',
    isNew: true,
  },
]

type HomeTab = 'home' | 'missions' | 'news'

type UpdateStatus =
  | null
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string }
  | { status: 'dev' }

export function WelcomePage(): JSX.Element | null {
  const { activeTabId, settings } = useAppStore()
  const [tab, setTab] = useState<HomeTab>('home')
  const [seenIds, setSeenIds] = useState<Set<string>>(loadSeenIds)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>(null)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.aether.system.getVersion().then(setVersion).catch(() => { /* non-critical */ })
  }, [])
  useEffect(() =>
    window.aether.on.updateStatus(setUpdateStatus as (p: { status: string; version?: string; message?: string }) => void)
  , [])

  if (activeTabId !== null) return null
  if (!settings) return null

  const hasAnnouncements = ANNOUNCEMENTS.length > 0
  const hasNew = ANNOUNCEMENTS.some((a) => a.isNew && !seenIds.has(a.id))

  function switchTab(next: HomeTab): void {
    setTab(next)
    if (next === 'news') {
      const freshIds = ANNOUNCEMENTS.filter((a) => a.isNew && !seenIds.has(a.id)).map((a) => a.id)
      if (freshIds.length > 0) {
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
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {tab === 'home' && (
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* Brand header — only shown on the home tab */}
            <div className="flex flex-col gap-1">
              <p className="text-[14px] font-semibold tracking-tight text-foreground">Good to have you.</p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                Open a tab below, or type a URL in the bar above. Your game is still running.
              </p>
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">Quick access</p>
              <div className="grid grid-cols-2 gap-1.5">
              {QUICK_LINKS.map(({ name, url, description }) => {
                const hostname = new URL(url).hostname
                const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => void window.aether.tabs.create(url)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-muted border border-border hover:border-primary/40 hover:bg-muted/80 text-left transition-colors group"
                  >
                    <img
                      src={favicon}
                      alt=""
                      width={16}
                      height={16}
                      className="rounded-sm shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-medium text-foreground truncate">{name}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{description}</span>
                    </div>
                  </button>
                )
              })}
              </div>
            </div>
          </div>
        )}

        {tab === 'missions' && <MissionsPanel />}

        {tab === 'news' && (
          <div className="flex flex-col gap-3 px-5 py-4">
            {hasAnnouncements ? (
              ANNOUNCEMENTS.map(({ id, date, title, body, tag, url, isNew }) => (
                <div
                  key={id}
                  className="flex flex-col gap-2 p-3 rounded-md border bg-muted border-border"
                >
                  <div className="flex items-center gap-2">
                    {tag && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/20 leading-none">
                        {tag}
                      </span>
                    )}
                    {isNew && !seenIds.has(id) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 leading-none">
                        new
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{title}</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground/40">{date}</span>
                    {url && (
                      <button
                        type="button"
                        onClick={() => void window.aether.tabs.create(url)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Read more â†’
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <Newspaper size={28} className="text-muted-foreground/30" />
                <p className="text-[11px] text-muted-foreground/50">No news yet â€” check back soon.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-t border-border shrink-0">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-indigo-400 transition-colors"
          onClick={() => void window.aether.tabs.create('https://discord.gg/A2KPZn8WNd')}
        >
          <DiscordIcon size={11} /> Community
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-pink-400 transition-colors"
          onClick={() => void window.aether.tabs.create('https://ko-fi.com/overframe')}
        >
          <Heart size={11} /> Donate
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
          onClick={() => void window.aether.tabs.create('https://overframe.app')}
        >
          <Globe size={11} /> Website
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
          onClick={() => void window.aether.system.openExternal('mailto:contact@overframe.app')}
        >
          <Mail size={11} /> Contact
        </button>

        <span className="flex-1" />

        {/* Update status feedback */}
        {updateStatus && updateStatus.status !== 'checking' && updateStatus.status !== 'dev' && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
            {updateStatus.status === 'up-to-date' && <><CheckCircle2 size={10} className="text-green-500" aria-hidden="true" />Up to date</>}
            {updateStatus.status === 'available' && <><Loader2 size={10} className="animate-spin text-blue-400" aria-hidden="true" />Downloading…</>}
            {updateStatus.status === 'downloaded' && <><CheckCircle2 size={10} className="text-green-500" aria-hidden="true" />Restart to update</>}
            {updateStatus.status === 'error' && <><AlertCircle size={10} className="text-destructive" aria-hidden="true" />Update failed</>}
          </span>
        )}

        {version && (
          <span className="text-[10px] text-muted-foreground/30" aria-label={`Version ${version}`}>
            {version}
          </span>
        )}

        <button
          type="button"
          disabled={updateStatus?.status === 'checking'}
          onClick={() => {
            setUpdateStatus({ status: 'checking' })
            void window.aether.system.checkForUpdates()
          }}
          className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
