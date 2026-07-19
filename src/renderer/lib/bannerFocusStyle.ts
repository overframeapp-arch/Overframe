import type { CSSProperties } from 'react'
import type { BannerFocus } from '@shared/types'

/** Inline style for a `object-fit: cover` banner `<img>` that honours a saved pan/zoom focus. */
export function bannerImageStyle(focus?: BannerFocus): CSSProperties {
  const x = focus?.x ?? 50
  const y = focus?.y ?? 50
  const zoom = focus?.zoom ?? 1
  return {
    objectPosition: `${x}% ${y}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${x}% ${y}%`,
  }
}
