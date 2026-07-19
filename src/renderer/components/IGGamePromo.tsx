import { X } from 'lucide-react'
import type { IGPromoPayload } from '@shared/types'
import { IGLogoIcon } from './icons/IGLogoIcon'

interface Props { data: IGPromoPayload }

/**
 * IG promo card. Rendered inside an opaque BrowserWindow embedded as a WS_CHILD
 * of the overlay (floats over the WebView2 content without being a separate
 * top-level window). The window itself is clipped to a rounded-rect region
 * (native SetWindowRgn), so the card fills it flat — no CSS rounded corners /
 * drop shadow here (those need transparency, which an embedded child can't have).
 */
export function IGGamePromo({ data }: Props): JSX.Element {
  const { purchaseHint, browseUrl } = data

  const handleShop = (): void => {
    void window.aether.tabs.create(browseUrl)
    window.aether.igPromo.close(true)
  }

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden border-x border-b border-border">
      {/* Orange accent doubles as the top border, so the card stays flush at the top. */}
      <div className="h-[3px] bg-gradient-to-r from-ig-orange to-ig-orange-light shrink-0" />
      <div className="flex flex-col gap-2 px-3 py-2.5">

        <div className="flex items-center gap-2">
          <IGLogoIcon size={14} className="shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-foreground flex-1 leading-none truncate">
            {purchaseHint} at a discount
          </span>
          <button
            type="button"
            onClick={() => { window.aether.igPromo.close(true) }}
            aria-label="Dismiss Instant Gaming promo"
            className="flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleShop}
          className="w-full py-1.5 rounded-md bg-ig-orange hover:bg-ig-orange-dark active:brightness-90 transition-colors text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ig-orange focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          Shop on Instant Gaming
        </button>

      </div>
    </div>
  )
}
