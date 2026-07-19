/** Matches the standard social cover-photo ratio (Twitter/X: 1500×500) used for the banner hero. */
export const BANNER_ASPECT_RATIO = 3

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** The scale at which `naturalW`×`naturalH` fully covers `frameW`×`frameH` (CSS object-fit: cover). */
export function coverBaseScale(naturalW: number, naturalH: number, frameW: number, frameH: number): number {
  return Math.max(frameW / naturalW, frameH / naturalH)
}

/** How far (px) the image can pan off-center before its edge would reveal empty space in the frame. */
export function maxPanOffset(naturalSize: number, frameSize: number, displayScale: number): number {
  return Math.max(0, (naturalSize * displayScale - frameSize) / 2)
}

export function clampOffset(v: number, max: number): number {
  return Math.min(max, Math.max(-max, v))
}

/** Pixel pan offset → the stored 0–100 focal-point percent (CSS object-position semantics). */
export function offsetToFocusPercent(offset: number, maxOffset: number): number {
  return maxOffset > 0 ? 50 * (1 - offset / maxOffset) : 50
}

/** Inverse of offsetToFocusPercent — seeds the pan offset from a stored focal point. */
export function focusPercentToOffset(percent: number, maxOffset: number): number {
  return maxOffset * (1 - percent / 50)
}
