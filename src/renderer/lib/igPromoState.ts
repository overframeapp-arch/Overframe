import type { IGPromoPayload } from '@shared/types'

/** Module-level singleton that tracks whether the IG promo should re-appear
 *  when the user returns to a web tab. Kept outside React to avoid re-render churn. */
export const igPromoState = {
  payload: null as IGPromoPayload | null,
  dismissed: false,

  reset(): void {
    this.payload = null
    this.dismissed = false
  },

  dismiss(): void {
    this.dismissed = true
  },
}
