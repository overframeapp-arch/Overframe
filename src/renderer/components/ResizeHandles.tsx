import { useCallback, memo } from 'react'
import { useAppStore } from '../store/appStore'
import { CHROME_HEIGHT, RESIZE_BORDER } from '@shared/types'

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_W = 500
// Minimum window height = chrome bars + top/bottom resize inset + 1px CSS border (top only)
const MIN_H = CHROME_HEIGHT + RESIZE_BORDER * 2 + 1

function ResizeHandle({ dir, className }: { dir: Dir; className: string }) {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const startX = e.screenX
      const startY = e.screenY
      const startW = window.outerWidth
      const startH = window.outerHeight
      const startL = window.screenX
      const startT = window.screenY

      // Retract the IG promo for the whole drag instead of re-tracking it on every
      // setBounds tick — the per-frame reposition otherwise reads as a flicker.
      window.aether.overlay.resizeStart()

      const onMove = (ev: MouseEvent) => {
        const dx = ev.screenX - startX
        const dy = ev.screenY - startY
        const b = { x: startL, y: startT, width: startW, height: startH }

        if (dir.includes('w')) { b.x = startL + dx; b.width = Math.max(MIN_W, startW - dx) }
        if (dir.includes('e')) { b.width = Math.max(MIN_W, startW + dx) }
        if (dir.includes('n')) { b.y = startT + dy; b.height = Math.max(MIN_H, startH - dy) }
        if (dir.includes('s')) { b.height = Math.max(MIN_H, startH + dy) }

        window.aether.overlay.setBounds(b)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        window.aether.overlay.resizeEnd()
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [dir],
  )

  return <div className={`absolute pointer-events-auto ${className}`} onMouseDown={onMouseDown} />
}

export const ResizeHandles = memo(function ResizeHandles() {
  const overlayState = useAppStore(s => s.overlayState)
  const isMaximized = useAppStore(s => s.isMaximized)
  if (overlayState === 'CLICK_THROUGH' || isMaximized) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[100]">
      {/* Corners (12×12, placed first so edges don't overlap them) */}
      <ResizeHandle dir="nw" className="top-0 left-0 w-3 h-3 cursor-nwse-resize" />
      <ResizeHandle dir="ne" className="top-0 right-0 w-3 h-3 cursor-nesw-resize" />
      <ResizeHandle dir="sw" className="bottom-0 left-0 w-3 h-3 cursor-nesw-resize" />
      <ResizeHandle dir="se" className="bottom-0 right-0 w-3 h-3 cursor-nwse-resize" />
      {/* Edges (between corners) */}
      <ResizeHandle dir="n" className="top-0 left-3 right-3 h-[3px] cursor-ns-resize" />
      <ResizeHandle dir="s" className="bottom-0 left-3 right-3 h-1.5 cursor-ns-resize" />
      <ResizeHandle dir="w" className="left-0 top-3 bottom-3 w-1.5 cursor-ew-resize" />
      <ResizeHandle dir="e" className="right-0 top-3 bottom-3 w-1.5 cursor-ew-resize" />
    </div>
  )
})
