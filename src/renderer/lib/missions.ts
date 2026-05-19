import type { LucideIcon } from 'lucide-react'
import { Globe, Gamepad2, Bookmark, Package, MousePointer2, Swords, ArrowLeftRight } from 'lucide-react'
import { DiscordIcon } from '../components/icons/DiscordIcon'

export interface Mission {
  id: string
  icon: LucideIcon | (({ size, className }: { size?: number | string; className?: string }) => JSX.Element)
  title: string
  /** Short description shown in the missions panel */
  desc: string
  /** Optional hint shown in the panel to guide the user toward the auto-trigger */
  hint?: string
  /** If set, the hint becomes a clickable link opening this URL in a tab */
  hintUrl?: string
}

export const MISSIONS: Mission[] = [
  {
    id: 'open-tab',
    icon: Globe,
    title: 'Navigate to a website',
    desc: 'Open a tab and browse to any website (Google searches don\'t count).',
  },
  {
    id: 'overlay-toggled',
    icon: Gamepad2,
    title: 'Toggle the overlay',
    desc: 'Press your toggle shortcut (default Alt+B) to show or hide Overframe.',
  },
  {
    id: 'game-profile',
    icon: Swords,
    title: 'Activate a game profile',
    desc: 'Launch a game while Overframe is running — it will detect it and switch profile automatically. Or switch manually from the profiles panel.',
  },
  {
    id: 'use-clickthrough',
    icon: MousePointer2,
    title: 'Enable click-through mode',
    desc: 'Press your click-through shortcut (default Alt+C) to let mouse clicks pass to the game underneath.',
  },
  {
    id: 'add-bookmark',
    icon: Bookmark,
    title: 'Save your first bookmark',
    desc: 'Click the ★ star in the address bar to save the current page to a collection.',
  },
  {
    id: 'create-collection',
    icon: Package,
    title: 'Create a collection',
    desc: 'Create a new collection from the collections panel.',
  },
  {
    id: 'export-collection',
    icon: ArrowLeftRight,
    title: 'Import or export a collection',
    desc: 'Export one of your collections as a shareable link, or import one from a link.',
  },
  {
    id: 'join-discord',
    icon: DiscordIcon,
    title: 'Join our Discord',
    desc: 'Open Discord in a tab to join the community.',
    hint: 'discord.gg/A2KPZn8WNd',
    hintUrl: 'https://discord.com/channels/1501993110291349584/1501993222908674109',
  },
]
