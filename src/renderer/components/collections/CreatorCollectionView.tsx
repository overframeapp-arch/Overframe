import { useMemo } from 'react'
import { Download, Globe, Pencil } from 'lucide-react'
import type { Collection, CreatorLink, CreatorPlatform } from '@shared/types'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import { Favicon } from './atoms'
import { bannerImageStyle } from '../../lib/bannerFocusStyle'
import { DiscordIcon } from '../icons/DiscordIcon'
import {
  TwitchIcon,
  KoFiIcon,
  PatreonIcon,
  TikTokIcon,
  KickIcon,
  XIcon as XSvgIcon,
} from '../icons/PlatformIcons'

// ── Platform metadata ─────────────────────────────────────────────────────────

interface PlatformMeta {
  label: string
  color: string        // background tint (used at low opacity)
  textColor: string    // readable text on dark surface
  Icon: (props: { size?: number; className?: string }) => JSX.Element
}

function WebsiteIcon({ size = 14, className }: { size?: number; className?: string }): JSX.Element {
  return <Globe size={size} className={className} />
}

export const PLATFORM_META: Record<CreatorPlatform, PlatformMeta> = {
  twitch:  { label: 'Twitch',   color: '#9146FF', textColor: '#c4a3ff', Icon: TwitchIcon  },
  youtube: { label: 'YouTube',  color: '#FF0000', textColor: '#ff7070', Icon: ({ size, className }) => (
    <svg width={size ?? 14} height={size ?? 14} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )},
  kick:    { label: 'Kick',     color: '#53FC18', textColor: '#a8ff7a', Icon: KickIcon    },
  discord: { label: 'Discord',  color: '#5865F2', textColor: '#8a95ff', Icon: ({ size, className }) => <DiscordIcon size={size} className={className} /> },
  kofi:    { label: 'Ko-fi',    color: '#FF5E5B', textColor: '#ff9998', Icon: KoFiIcon    },
  patreon: { label: 'Patreon',  color: '#FF424D', textColor: '#ff8a91', Icon: PatreonIcon },
  twitter: { label: 'X',        color: '#ffffff', textColor: '#e0e0e0', Icon: XSvgIcon   },
  tiktok:  { label: 'TikTok',   color: '#ee1d52', textColor: '#ff8aaa', Icon: TikTokIcon  },
  website: { label: 'Website',  color: '#6366f1', textColor: '#a5b4fc', Icon: WebsiteIcon },
}

const SOCIAL_PLATFORMS  = new Set<CreatorPlatform>(['twitch', 'youtube', 'kick', 'twitter', 'tiktok', 'discord', 'website'])
const SUPPORT_PLATFORMS = new Set<CreatorPlatform>(['kofi', 'patreon'])

// ── Sub-components ────────────────────────────────────────────────────────────

function PlatformButton({ link }: { link: CreatorLink }): JSX.Element {
  const meta = PLATFORM_META[link.platform]
  const { Icon } = meta
  return (
    <button
      type="button"
      onClick={() => void window.aether.tabs.create(link.url)}
      aria-label={`Open ${meta.label}`}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border transition-colors text-[11px] font-medium"
      style={{
        borderColor: `${meta.color}30`,
        backgroundColor: `${meta.color}12`,
        color: meta.textColor,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${meta.color}22` }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${meta.color}12` }}
    >
      <Icon size={12} />
      {meta.label}
    </button>
  )
}

function PlatformIconButton({ link }: { link: CreatorLink }): JSX.Element {
  const meta = PLATFORM_META[link.platform]
  const { Icon } = meta
  return (
    <Tooltip label={meta.label}>
      <button
        type="button"
        onClick={() => void window.aether.tabs.create(link.url)}
        aria-label={`Open ${meta.label}`}
        className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: `${meta.color}30`,
          backgroundColor: `${meta.color}12`,
          color: meta.textColor,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${meta.color}22` }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${meta.color}12` }}
      >
        <Icon size={13} />
      </button>
    </Tooltip>
  )
}

function CreatorLinkGroup({ title, links }: { title: string; links: CreatorLink[] }): JSX.Element | null {
  if (links.length === 0) return null
  return (
    <section className="px-5 py-3.5 border-b border-border/60">
      <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground mb-2.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => <PlatformButton key={l.platform} link={l} />)}
      </div>
    </section>
  )
}

// ── Link item ────────────────────────────────────────────────────────────────

function LinkItem({ link }: { link: Collection['links'][number] }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => void window.aether.tabs.create(link.url)}
      aria-label={`Open ${link.title || link.url}`}
      className={cn('w-full flex items-start gap-2.5 text-left hover:opacity-90 transition-opacity')}
    >
      <Favicon url={link.url} favicon={link.favicon} className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-foreground truncate">
          {link.title || link.url}
        </p>
        {link.note && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{link.note}</p>
        )}
      </div>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface CreatorCollectionViewProps {
  collection: Collection
  onEdit: () => void
  onExport: (id: string) => void
}

export function CreatorCollectionView({ collection, onEdit, onExport }: CreatorCollectionViewProps): JSX.Element {
  const { author, iconUrl, name, description, links, sections } = collection
  const accentColor = author?.color ?? '#6366f1'

  const socialLinks = useMemo(
    () => author?.links?.filter((l) => SOCIAL_PLATFORMS.has(l.platform)) ?? [],
    [author?.links],
  )
  const supportLinks = useMemo(
    () => author?.links?.filter((l) => SUPPORT_PLATFORMS.has(l.platform)) ?? [],
    [author?.links],
  )

  // Group links by section when sections are defined
  const sortedLinks = useMemo(() => [...links].sort((a, b) => a.order - b.order), [links])
  const groupedLinks = useMemo(() => {
    if (!sections) return null
    const map = new Map<string, typeof links>()
    for (const s of sections) map.set(s, [])
    const unsorted: typeof links = []
    for (const l of sortedLinks) {
      if (l.section && map.has(l.section)) map.get(l.section)!.push(l)
      else unsorted.push(l)
    }
    return { bySection: map, unsorted }
  }, [sections, sortedLinks])

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Hero: banner + icon ───────────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <div className="w-full aspect-[3/1] max-h-40 overflow-hidden">
          {collection.bannerUrl ? (
            <img
              src={collection.bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              style={bannerImageStyle(collection.bannerFocus)}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: `linear-gradient(135deg, ${accentColor}50 0%, ${accentColor}28 60%, ${accentColor}08 100%)` }}
            />
          )}
        </div>

        {/* Icon overlaps the banner — a solid background-coloured backing sits behind
            it so a transparent PNG shows the page background, not the banner. */}
        <div className="absolute -bottom-6 left-4">
          {iconUrl ? (
            <div className="h-14 w-14 rounded-2xl bg-background shadow-lg ring-4 ring-background overflow-hidden">
              <img
                src={iconUrl}
                alt={name}
                className="h-full w-full object-cover"
                style={bannerImageStyle(collection.iconFocus)}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          ) : (
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white/80 shadow-lg ring-4 ring-background"
              style={{ background: `linear-gradient(135deg, ${accentColor}70, ${accentColor}40)` }}
              aria-hidden="true"
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── Identity: name/handle on the left, social links on the right ────────── */}
      <div className="px-5 pt-8 pb-3 border-b border-border/60 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-foreground leading-tight truncate">{name}</h2>
            {author?.handle && (
              <p className="text-[11px] font-medium truncate" style={{ color: accentColor }}>
                @{author.handle}
              </p>
            )}
          </div>
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {socialLinks.map((l) => <PlatformIconButton key={l.platform} link={l} />)}
            </div>
          )}
        </div>

        {description && (
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* ── Support ───────────────────────────────────────────────────────────── */}
      <CreatorLinkGroup title="Support" links={supportLinks} />

      {/* ── Links header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0">
        <span className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground flex-1">
          Links · {links.length}
        </span>
        <Tooltip label="Edit links">
          <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Edit collection links" onClick={onEdit}>
            <Pencil size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Export to clipboard">
          <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Export collection" onClick={() => onExport(collection.id)}>
            <Download size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>

      {/* ── Flat list (no sections) ─────────────────────────────────────────── */}
      {!groupedLinks && (
        <ul className="flex-1 divide-y divide-border/30" role="list" aria-label={`Links in ${name}`}>
          {links.length === 0 && (
            <li className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Globe size={20} aria-hidden="true" />
              <p className="text-[11px]">No links yet.</p>
            </li>
          )}
          {sortedLinks.map((link) => (
            <li key={link.id} className="group px-5 py-2.5">
              <LinkItem link={link} />
            </li>
          ))}
        </ul>
      )}

      {/* ── Grouped by section ──────────────────────────────────────────────── */}
      {groupedLinks && (
        <div className="flex-1">
          {(sections ?? []).map((sectionName) => {
            const sectionLinks = groupedLinks.bySection.get(sectionName) ?? []
            // A published page never shows empty shelves — skip sections with no links.
            if (sectionLinks.length === 0) return null
            return (
              <div key={sectionName}>
                <div className="px-5 py-2 bg-muted/10 border-y border-border/20">
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                    {sectionName}
                  </p>
                </div>
                <ul className="divide-y divide-border/30" role="list">
                  {sectionLinks.map((link) => (
                    <li key={link.id} className="px-5 py-2.5">
                      <LinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {groupedLinks.unsorted.length > 0 && (
            <div>
              <div className="px-5 py-2 bg-muted/10 border-y border-border/20">
                <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                  Other
                </p>
              </div>
              <ul className="divide-y divide-border/30" role="list">
                {groupedLinks.unsorted.map((link) => (
                  <li key={link.id} className="px-5 py-2.5">
                    <LinkItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {links.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Globe size={20} aria-hidden="true" />
              <p className="text-[11px]">No links yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
