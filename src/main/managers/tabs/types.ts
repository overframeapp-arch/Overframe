import type { WebContentsView } from 'electron'
import type { DownloadEvent, TabState } from '@shared/types'

export interface ManagedTab {
  id: string
  view: WebContentsView
  state: TabState
}

export type TabEvent =
  | { type: 'updated'; tab: TabState }
  | { type: 'removed'; id: string }
  | { type: 'activeChanged'; id: string | null }
  | { type: 'download'; event: DownloadEvent }

export const POPUP_DEDUP_WINDOW_MS = 2_000
export const POPUP_DEDUP_EVICT_THRESHOLD = 256
export const POPUP_DEDUP_MAX_AGE_MS = 60_000
