import { useCallback } from 'react'
import { Settings as SettingsIcon, Heart, X } from 'lucide-react'
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'

export function DragBar(): JSX.Element {
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    // Capture screen coords at mousedown for immediate use
    const startScreenX = e.screenX
    const startScreenY = e.screenY
    const startClientX = e.clientX
    const startClientY = e.clientY

    void (async () => {
      const isMax = await window.aether.overlay.isMaximized()

      let offsetX: number
      let offsetY: number

      if (isMax) {
        // Unmaximize and reposition so cursor stays inside the restored title bar
        // (standard Windows drag-to-unmaximize behaviour)
        const restored = await window.aether.overlay.unmaximize()
        if (restored) {
          offsetX = Math.min(startClientX, restored.width - 20)
          offsetY = startClientY
          window.aether.overlay.setPosition(
            Math.round(startScreenX - offsetX),
            Math.round(startScreenY - offsetY)
          )
        } else {
          offsetX = startClientX
          offsetY = startClientY
        }
      } else {
        offsetX = startClientX
        offsetY = startClientY
      }

      const onMove = (ev: MouseEvent): void => {
        window.aether.overlay.setPosition(
          Math.round(ev.screenX - offsetX),
          Math.round(ev.screenY - offsetY)
        )
      }

      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })()
  }, [])

  const onDoubleClick = useCallback(() => {
    void window.aether.overlay.toggleMaximize()
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const STEP = 20
    const map: Record<string, [number, number]> = {
      ArrowLeft:  [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp:    [0, -STEP],
      ArrowDown:  [0, STEP],
    }
    const delta = map[e.key]
    if (!delta) return
    e.preventDefault()
    // window.screenX/Y are the BrowserWindow's screen position (Electron exposes them)
    window.aether.overlay.setPosition(window.screenX + delta[0], window.screenY + delta[1])
  }, [])

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Drag to move window. Use arrow keys to nudge."
      className="no-drag flex items-center justify-between h-[10px] bg-background/90 border-b border-border/50 cursor-move focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    />
  )
}

export function TopToolbar(): JSX.Element {
  return (
    <div className="no-drag flex items-center gap-1 px-2 h-7 bg-background/90 border-b border-border">
      <div className="flex items-center gap-1.5 ml-2 text-muted-foreground/60 select-none">
        <img src="/icons/icon-amber.svg" alt="" className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[10px] font-medium tracking-widest uppercase">Overframe</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Tooltip label="Support development">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Support development"
            onClick={() => void window.aether.tabs.create('https://ko-fi.com/')}
          >
            <Heart size={14} className="text-pink-400" />
          </Button>
        </Tooltip>
        <Tooltip label="Settings">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Settings"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              void window.aether.popup.openSettings({ anchorX: Math.round(r.right), anchorY: Math.round(r.bottom) })
            }}
          >
            <SettingsIcon size={14} />
          </Button>
        </Tooltip>
        <Tooltip label="Hide overlay (toggle hotkey)">
          <Button size="icon" variant="ghost" aria-label="Hide overlay" onClick={() => void window.aether.overlay.hide()}>
            <X size={14} />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
