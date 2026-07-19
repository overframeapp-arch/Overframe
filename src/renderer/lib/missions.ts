import type { LucideIcon } from 'lucide-react'
import { Globe, Gamepad2, Bookmark, Package, MousePointer2, Swords, ArrowLeftRight } from 'lucide-react'
import { DiscordIcon } from '../components/icons/DiscordIcon'
import { IGLogoIcon } from '../components/icons/IGLogoIcon'
import { localizeIGUrl, IG_HOME } from '@shared/ig-affiliate'
import type { ShortcutId } from '@shared/types'

/** Invite link — used before the user has joined the server. */
export const DISCORD_INVITE_URL = 'https://discord.gg/VASGwMVGu6'
/** Announcements channel — used once the user has joined (join-discord mission completed). */
export const DISCORD_CHANNEL_URL = 'https://discord.com/channels/1501993110291349584/1501996196103979251'

export interface Mission {
  id: string
  icon: LucideIcon | (({ size, className }: { size?: number | string; className?: string }) => JSX.Element)
  /** Override the default icon color with a Tailwind class (e.g. brand colors). */
  iconClassName?: string
  title: string
  /** Short description shown in the missions panel. May contain the token "{shortcut}" — see shortcutId. */
  desc: string
  /**
   * When set, the "{shortcut}" token in `desc` is replaced at render time with
   * the user's CURRENT accelerator for this action (via resolveMissionDesc in
   * missionHelpers.ts) — never a hardcoded default, so a rebound shortcut is
   * reflected immediately instead of showing a stale key combo.
   */
  shortcutId?: ShortcutId
  /** Optional hint shown in the panel to guide the user toward the auto-trigger */
  hint?: string
  /** If set, the hint becomes a clickable link opening this URL in a tab */
  hintUrl?: string
}

export const MISSIONS: Mission[] = [
  {
    id: 'open-tab',
    icon: Globe,
    title: 'Open a website',
    desc: 'Type a URL or search above.',
  },
  {
    id: 'overlay-toggled',
    icon: Gamepad2,
    title: 'Toggle the overlay',
    desc: 'Press {shortcut} over your game.',
    shortcutId: 'toggleOverlay',
  },
  {
    id: 'game-profile',
    icon: Swords,
    title: 'Switch to a game profile',
    desc: 'Launch a game. Overframe switches profile automatically.',
  },
  {
    id: 'use-clickthrough',
    icon: MousePointer2,
    title: 'Enable click-through',
    desc: 'Press {shortcut} to click through to your game.',
    shortcutId: 'clickThrough',
  },
  {
    id: 'add-bookmark',
    icon: Bookmark,
    title: 'Save your first bookmark',
    desc: 'Click the ★ in the address bar.',
  },
  {
    id: 'create-collection',
    icon: Package,
    title: 'Create a collection',
    desc: 'Group bookmarks by game or topic.',
  },
  {
    id: 'export-collection',
    icon: ArrowLeftRight,
    title: 'Share a collection',
    desc: 'Export a link, or import one someone shared with you.',
  },
  {
    id: 'visit-ig',
    icon: IGLogoIcon,
    title: 'Try Instant Gaming',
    desc: 'Games at a discount. A small commission supports us, at no cost to you.',
    hint: 'instant-gaming.com',
    hintUrl: localizeIGUrl(IG_HOME),
  },
  {
    id: 'join-discord',
    icon: DiscordIcon,
    iconClassName: 'text-indigo-400',
    title: 'Join the community',
    desc: 'Get help and stay updated on new features.',
    hint: 'discord.gg/VASGwMVGu6',
    hintUrl: DISCORD_INVITE_URL,
  },
]
