import { useEffect, useRef, useState } from 'react'
import { OverframeIcon } from './icons/OverframeIcon'
import { isIGUrl, hasIGAffiliate, addIGAffiliate } from '@shared/ig-affiliate'
import { useAppStore } from '../store/appStore'

/**
 * Instant Gaming affiliate nudge.
 *
 * WHEN the tag is injected
 * ────────────────────────
 * Only on IG *entry* — when the previous URL was NOT on Instant Gaming.
 * This covers:
 *   • New tab opened directly to an IG URL
 *   • User types an IG URL in the address bar from a non-IG page
 *   • User follows a link from a non-IG page to IG
 *
 * Internal IG navigation (IG → IG clicks) is NOT touched — the affiliate
 * cookie set by the first entry covers the whole session.
 *
 * UX:
 *   Activate  → igAutoAffiliate=true persisted, banner gone forever.
 *               Future IG entries auto-redirect without showing the banner.
 *   No thanks → dismissed for this app session; reappears on next launch.
 *
 * Legal (RGPD Art.6 + ARPP / EU 2005/29/EC):
 *   • Commercial nature disclosed at point of decision
 *   • Explicit consent before any tag is injected
 *   • "No thanks" always available and respected
 */

// Module-level: survives tab switches, resets on app restart (module re-evaluation).
let sessionDismissed = false

export function IGNudge(): JSX.Element | null {
  const { tabs, activeTabId, settings } = useAppStore()
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(sessionDismissed)

  // Track the previous URL to detect IG *entry* (non-IG → IG transition)
  const prevUrlRef = useRef<string>('')

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const url = activeTab?.url ?? ''
  const onIG = isIGUrl(url)
  const affiliated = hasIGAffiliate(url)

  // Reset banner and URL tracking on tab switch — dismissed persists for the whole session
  useEffect(() => {
    setShowBanner(false)
    prevUrlRef.current = ''
  }, [activeTabId])

  // Core logic — runs on every URL change
  useEffect(() => {
    const prevUrl = prevUrlRef.current
    prevUrlRef.current = url

    // Left IG — hide banner, no tag needed
    if (!onIG) {
      setShowBanner(false)
      return
    }

    // Internal IG navigation (IG → IG) — cookie already set, do nothing
    if (isIGUrl(prevUrl)) return

    // ── IG entry from outside ─────────────────────────────────────────────────
    // prevUrl was NOT on IG, current URL IS on IG.

    if (affiliated) return // URL already carries the tag (e.g. user clicked our IG button)

    if (settings?.igAutoAffiliate && activeTab) {
      // User has already opted in — redirect silently, no banner
      void window.aether.tabs.navigate(activeTab.id, addIGAffiliate(url))
    } else {
      // First time or not opted in — show the nudge
      setShowBanner(true)
    }
  // Intentionally only fires on URL change; settings read as current value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // Edge case: igAutoAffiliate becomes true while already on IG without the tag.
  // Covers: user clicks "Activate" while browsing IG, or app starts with the flag
  // already set and the banner was never shown (settings loaded before URL effect).
  useEffect(() => {
    if (settings?.igAutoAffiliate && onIG && !affiliated && !dismissed && activeTab) {
      void window.aether.tabs.navigate(activeTab.id, addIGAffiliate(url))
      setShowBanner(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.igAutoAffiliate])

  if (!showBanner || dismissed) return null

  const handleActivate = (): void => {
    if (!activeTab) return
    void window.aether.settings.set('igAutoAffiliate', true)
    void window.aether.tabs.navigate(activeTab.id, addIGAffiliate(url))
    setShowBanner(false)
  }

  return (
    <div
      role="status"
      aria-label="Support Overframe via Instant Gaming"
      className="no-drag relative flex items-center gap-4 px-5 h-11 bg-background border-b border-border shrink-0 overflow-hidden"
    >
      {/* IG-orange left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-ig-orange" aria-hidden="true" />

      {/* Overframe icon (IG orange) + pitch */}
      <div className="flex items-center gap-3 pl-1 shrink-0">
        <OverframeIcon size={20} variant="orange" className="shrink-0" />
        <div className="flex flex-col justify-center gap-1 leading-none">
          <span className="text-[12px] font-semibold text-foreground tracking-tight">
            Support Overframe, it's free
          </span>
          <span className="text-[11px] text-muted-foreground">
            3&nbsp;% of your Instant Gaming purchases, at no extra cost
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-[24px]" />

      {/* Single dominant CTA — one click, permanent */}
      <button
        type="button"
        onClick={handleActivate}
        aria-label="Activate Overframe support via Instant Gaming affiliate, free and permanent"
        className="flex items-center h-7 px-5 rounded text-[11px] font-bold text-white bg-ig-orange hover:bg-ig-orange-dark active:brightness-90 transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ig-orange focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        Activate support
      </button>

      {/* Understated secondary action */}
      <button
        type="button"
        onClick={() => { sessionDismissed = true; setDismissed(true) }}
        aria-label="Dismiss until next session"
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
      >
        No thanks
      </button>
    </div>
  )
}
