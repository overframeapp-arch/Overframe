import { MousePointer2, Plus, Volume2, VolumeX, X, Minimize2, Maximize2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { cn } from '../lib/cn'
import { ProfileIcon } from './ProfileIcon'
import type { TabState } from '@shared/types'

const MAX_TABS = 10
const TAB_MIN_W = 20
const TAB_HIDE_ICON_W = 50
const PLUS_W = 28
const GAP = 4
const GAP_AFTER = 4

export function TabBar(): JSX.Element {
  const { tabs, activeTabId, activeProfile, overlayState } = useAppStore()
  const TAB_MAX_W = Math.round(window.screen.width * 180 / 1920)
  const [maximized, setMaximized] = useState(false)
  useEffect(() => { void window.aether.overlay.isMaximized().then(setMaximized) }, [])

  // ── Tab order ─────────────────────────────────────────────────────────────────

  const [order, setOrder] = useState<string[]>(() => tabs.map((t) => t.id))
  const [openingIds, setOpeningIds] = useState<Set<string>>(new Set())
  const prevOrderRef = useRef<string[]>([])

  useEffect(() => {
    setOrder((prev) => {
      const ids = new Set(tabs.map((t) => t.id))
      const kept = prev.filter((id) => ids.has(id))
      const added = tabs.map((t) => t.id).filter((id) => !kept.includes(id))
      if (added.length === 0) return kept
      return [...kept, ...added]
    })
  }, [tabs])

  useEffect(() => {
    const prevIds = new Set(prevOrderRef.current)
    const added = order.filter((id) => !prevIds.has(id))
    prevOrderRef.current = [...order]
    if (added.length === 0) return
    setOpeningIds((s) => new Set([...s, ...added]))
    requestAnimationFrame(() => {
      setOpeningIds((s) => {
        const next = new Set(s)
        added.forEach((id) => next.delete(id))
        return next
      })
    })
  }, [order])

  const orderedTabs = order
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is TabState => !!t)
  const n = orderedTabs.length

  // ── Geometry ──────────────────────────────────────────────────────────────────

  const stripRef = useRef<HTMLDivElement>(null)
  const [stripW, setStripW] = useState(600)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStripW(e.contentRect.width))
    ro.observe(el)
    setStripW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const tabAreaW = Math.max(0, stripW - PLUS_W - GAP_AFTER)
  const containerW = Math.min(n * TAB_MAX_W, tabAreaW)
  const naturalTabW = n > 0 ? Math.max(0, (containerW - (n - 1) * GAP) / n) : 0

  // ── Close animation ───────────────────────────────────────────────────────────

  const [frozenTabW, setFrozenTabW] = useState<number | null>(null)
  const frozenWTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hoverTrigger, setHoverTrigger] = useState(0)

  const actualTabW = frozenTabW !== null ? frozenTabW : naturalTabW
  const slotW = actualTabW + GAP
  const effectiveContainerW = n > 0 ? n * slotW - GAP : 0

  useEffect(() => {
    if (frozenTabW !== null) {
      setFrozenTabW(null)
      setHoveredCloseId(null)
      if (frozenWTimer.current) { clearTimeout(frozenWTimer.current); frozenWTimer.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAreaW])

  const releaseFrozenW = (): void => {
    if (frozenWTimer.current) clearTimeout(frozenWTimer.current)
    frozenWTimer.current = setTimeout(() => {
      setFrozenTabW(null)
      setHoveredCloseId(null)
      frozenWTimer.current = null
      setHoverTrigger((t) => t + 1)
    }, 150)
  }
  const cancelReleaseFrozenW = (): void => {
    if (frozenWTimer.current) { clearTimeout(frozenWTimer.current); frozenWTimer.current = null }
  }

  const [closingIds, setClosingIds] = useState<Set<string>>(new Set())
  const closeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const cursorXInStrip = useRef(-1)
  const [hoveredCloseId, setHoveredCloseId] = useState<string | null>(null)

  useEffect(() => {
    if (orderedTabs.length === 0) {
      setFrozenTabW(null)
      setHoveredCloseId(null)
      setClosingIds(new Set())
      setOpeningIds(new Set())
      closeTimers.current.forEach(clearTimeout)
      closeTimers.current.clear()
      if (frozenWTimer.current) { clearTimeout(frozenWTimer.current); frozenWTimer.current = null }
      return
    }
    const x = cursorXInStrip.current
    if (x < 0) {
      if (frozenTabW !== null) releaseFrozenW()
      return
    }
    const idx = Math.floor(x / slotW)
    const xInTab = x - idx * slotW
    const overClose = idx >= 0 && idx < orderedTabs.length && xInTab >= actualTabW - 28
    setHoveredCloseId(overClose ? orderedTabs[idx].id : null)
    if (frozenTabW !== null) {
      if (overClose) cancelReleaseFrozenW()
      else releaseFrozenW()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedTabs.length, hoverTrigger])

  const triggerClose = (tabId: string): void => {
    if (orderedTabs.length > 1 && naturalTabW < TAB_MAX_W) {
      setFrozenTabW(actualTabW)
    } else if (orderedTabs.length <= 1) {
      setFrozenTabW(null)
      setHoveredCloseId(null)
      if (frozenWTimer.current) { clearTimeout(frozenWTimer.current); frozenWTimer.current = null }
    }
    if (tabId === activeTabId && orderedTabs.length > 1) {
      const ci = orderedTabs.findIndex((t) => t.id === tabId)
      const next = orderedTabs[ci + 1] ?? orderedTabs[ci - 1]
      void window.aether.tabs.setActive(next.id)
    }
    setClosingIds((prev) => new Set([...prev, tabId]))
    if (closeTimers.current.has(tabId)) clearTimeout(closeTimers.current.get(tabId)!)
    const t = setTimeout(() => {
      void window.aether.tabs.close(tabId)
      closeTimers.current.delete(tabId)
    }, 150)
    closeTimers.current.set(tabId, t)
  }

  useEffect(() => {
    setClosingIds((prev) => {
      if (prev.size === 0) return prev
      const tabIds = new Set(orderedTabs.map((t) => t.id))
      const next = new Set([...prev].filter((id) => tabIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [orderedTabs])

  // ── Favicon pop ───────────────────────────────────────────────────────────────

  const prevFaviconsRef = useRef<Map<string, string | null>>(new Map())
  const [poppingFavicons, setPoppingFavicons] = useState<Set<string>>(new Set())

  useEffect(() => {
    const prev = prevFaviconsRef.current
    const newlyPopped: string[] = []
    for (const tab of tabs) {
      const was = prev.get(tab.id) ?? null
      if (!was && tab.favicon) newlyPopped.push(tab.id)
      prev.set(tab.id, tab.favicon)
    }
    for (const id of prev.keys()) {
      if (!tabs.some((t) => t.id === id)) prev.delete(id)
    }
    if (newlyPopped.length === 0) return
    setPoppingFavicons((s) => new Set([...s, ...newlyPopped]))
    const t = setTimeout(() => {
      setPoppingFavicons((s) => {
        const next = new Set(s)
        newlyPopped.forEach((id) => next.delete(id))
        return next
      })
    }, 300)
    return () => clearTimeout(t)
  }, [tabs])

  // ── Drag reorder ──────────────────────────────────────────────────────────────

  const dragging = useRef(false)
  const dragIdRef = useRef<string | null>(null)
  const dropIdxRef = useRef<number | null>(null)
  const dragStartX = useRef(0)
  const dragOffsetX = useRef(0)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [dragX, setDragX] = useState(0)
  const [noTransition, setNoTransition] = useState(false)

  const resetDrag = (commitId?: string): void => {
    if (commitId && dragging.current && dropIdxRef.current !== null) {
      const target = dropIdxRef.current
      setNoTransition(true)
      setOrder((prev) => {
        const next = [...prev.filter((x) => x !== commitId)]
        next.splice(target, 0, commitId)
        void window.aether.tabs.reorder(next)
        return next
      })
      void window.aether.tabs.setActive(commitId)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setNoTransition(false))
      })
    }
    dragIdRef.current = null
    dropIdxRef.current = null
    dragging.current = false
    setDragId(null)
    setDropIdx(null)
    setDragX(0)
  }

  useEffect(() => {
    const onGlobal = (): void => { if (dragIdRef.current) resetDrag() }
    window.addEventListener('pointerup', onGlobal)
    window.addEventListener('pointercancel', onGlobal)
    return () => {
      window.removeEventListener('pointerup', onGlobal)
      window.removeEventListener('pointercancel', onGlobal)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string, tabIdx: number): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const stripLeft = stripRef.current?.getBoundingClientRect().left ?? 0
    dragStartX.current = e.clientX
    dragOffsetX.current = e.clientX - stripLeft - tabIdx * slotW
    dragging.current = false
    dragIdRef.current = id
    setDragId(null)
    setDropIdx(null)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragIdRef.current) return
    const id = dragIdRef.current
    if (!dragging.current) {
      if (Math.abs(e.clientX - dragStartX.current) <= 5) return
      dragging.current = true
      setDragId(id)
    }
    const strip = stripRef.current
    if (!strip) return
    const relX = e.clientX - strip.getBoundingClientRect().left
    const ghostLeft = Math.max(0, Math.min(containerW - actualTabW, relX - dragOffsetX.current))
    setDragX(ghostLeft)
    const idx = Math.max(0, Math.min(n - 1, Math.round(ghostLeft / slotW)))
    if (idx !== dropIdxRef.current) {
      dropIdxRef.current = idx
      setDropIdx(idx)
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>, id: string): void => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    resetDrag(id)
  }

  // ── Window drag ───────────────────────────────────────────────────────────────

  const windowDragging = useRef(false)
  const unmaximizing = useRef(false)
  const windowDragAborted = useRef(false)
  const fillerPointerCaptured = useRef(false)
  const captureX = useRef(0)
  const captureY = useRef(0)
  const pointerDownScreenX = useRef(0)

  const onFillerPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    fillerPointerCaptured.current = true
    windowDragging.current = false
    unmaximizing.current = false
    windowDragAborted.current = false
    captureX.current = e.clientX
    captureY.current = e.clientY
    pointerDownScreenX.current = e.screenX
  }

  const onFillerPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!fillerPointerCaptured.current) return
    if (!e.buttons) return
    if (unmaximizing.current) return

    if (!windowDragging.current) {
      if (Math.abs(e.screenX - pointerDownScreenX.current) < 4) return
      windowDragging.current = true

      if (maximized) {
        unmaximizing.current = true
        windowDragAborted.current = false
        const sx = e.screenX
        const sy = e.screenY
        const maxW = window.innerWidth
        const clickX = captureX.current
        void (async () => {
          const bounds = await window.aether.overlay.unmaximize()
          if (windowDragAborted.current) return
          setMaximized(false)
          if (bounds) {
            const newCaptureX = Math.round(clickX * bounds.width / maxW)
            captureX.current = newCaptureX
            window.aether.overlay.setPosition(
              Math.round(sx - newCaptureX),
              Math.round(sy - captureY.current),
            )
          }
          unmaximizing.current = false
        })()
        return
      }
    }

    window.aether.overlay.setPosition(
      Math.round(e.screenX - captureX.current),
      Math.round(e.screenY - captureY.current),
    )
  }

  const onFillerPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    fillerPointerCaptured.current = false
    windowDragging.current = false
    unmaximizing.current = false
    windowDragAborted.current = true
    // If pointer left the drag zone during the drag, release mouse interactive (no-op outside click-through)
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      window.aether.overlay.setMouseInteractive(false)
    }
  }

  const canCreate = n < MAX_TABS
  const create = (): void => { if (canCreate) void window.aether.tabs.create() }
  const activate = (id: string): void => { if (id !== activeTabId) void window.aether.tabs.setActive(id) }

  return (
    <div className="flex items-stretch h-10 px-1 bg-background">

      {/* Active profile */}
      <button
        type="button"
        aria-label={activeProfile?.name ?? 'Overframe'}
        title={activeProfile?.name ?? 'Overframe'}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          void window.aether.popup.openProfiles({ anchorX: Math.round(r.left) + 240, anchorY: Math.round(r.bottom) })
        }}
        className="no-drag flex items-center justify-center h-8 w-8 mr-1 my-auto shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-default"
      >
        <ProfileIcon
          iconUrl={activeProfile?.iconUrl}
          name={activeProfile?.name ?? 'Overframe'}
          size={24}
          profileId={activeProfile?.id}
        />
      </button>

      {/* Tab strip */}
      <div
        ref={stripRef}
        className="no-drag flex-1 min-w-[300px] flex items-center overflow-hidden py-1"
        onMouseMove={(e) => {
          const stripLeft = stripRef.current?.getBoundingClientRect().left ?? 0
          const x = e.clientX - stripLeft
          cursorXInStrip.current = x
          const idx = Math.floor(x / slotW)
          const xInTab = x - idx * slotW
          const overClose = idx >= 0 && idx < orderedTabs.length && xInTab >= actualTabW - 28
          setHoveredCloseId(overClose ? orderedTabs[idx].id : null)
          if (frozenTabW !== null) {
            if (overClose) cancelReleaseFrozenW()
            else releaseFrozenW()
          }
        }}
        onMouseLeave={() => { cursorXInStrip.current = -1; setHoveredCloseId(null); releaseFrozenW() }}
        onMouseEnter={cancelReleaseFrozenW}
      >
        {/* Tab container + new-tab button */}
        <div className="flex items-stretch shrink-0 mr-1 h-full">
          <div
          className="relative flex items-stretch overflow-hidden h-full"
            style={{ width: effectiveContainerW, flex: '0 0 auto' }}
          >
          {orderedTabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId
            const isDragged = dragId === tab.id
            const isClosing = closingIds.has(tab.id)
            const isOpening = openingIds.has(tab.id)
            const showClose = !isClosing && !isOpening && (isActive || isDragged || actualTabW >= 80)
            const hideIcon = showClose && actualTabW < TAB_HIDE_ICON_W

            const fromIdx = dragId ? orderedTabs.findIndex((t) => t.id === dragId) : -1

            let shift = 0
            if (dragId && !isDragged && dropIdx !== null && fromIdx >= 0) {
              if (fromIdx < dropIdx) {
                if (idx > fromIdx && idx <= dropIdx) shift = -slotW
              } else if (fromIdx > dropIdx) {
                if (idx >= dropIdx && idx < fromIdx) shift = slotW
              }
            }

            return (
              <div
                key={tab.id}
                onPointerDown={(e) => { if (isClosing) return; activate(tab.id); onPointerDown(e, tab.id, idx) }}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, tab.id)}
                onPointerCancel={() => resetDrag()}
                style={{
                  flex: '0 0 auto',
                  width: actualTabW,
                  minWidth: TAB_MIN_W,
                  maxWidth: TAB_MAX_W,
                  marginRight: idx === orderedTabs.length - 1 ? 0 : GAP,
                  transform: isClosing
                    ? `translateX(${shift}px) scale(0.88)`
                    : `translateX(${shift}px)`,
                  transition: noTransition
                    ? undefined
                    : isClosing
                      ? 'opacity 140ms ease-in, transform 140ms ease-in'
                      : 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: (isClosing || isOpening) ? 0 : (isDragged ? 0 : 1),
                  pointerEvents: isClosing || isOpening || isDragged ? 'none' : undefined,
                }}
                className={cn(
                  'no-drag relative flex items-center gap-2 px-1.5 h-full',
                  'select-none overflow-hidden transition-colors duration-100',
                  'rounded-md',
                  isActive
                    ? 'bg-[#1d1d1d] text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground/80',
                )}
              >
                  {!hideIcon && tab.favicon && (
                    <img
                      src={tab.favicon}
                      alt=""
                      className={cn('h-4 w-4 shrink-0', poppingFavicons.has(tab.id) ? 'favicon-pop' : 'opacity-80')}
                    />
                  )}

                  {/* Audio indicator — shown when audio is playing or tab is muted */}
                  {(tab.isAudioPlaying || tab.isMuted) && (
                    <button
                      type="button"
                      aria-label={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
                      title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation()
                        void window.aether.tabs.setMuted(tab.id, !tab.isMuted)
                      }}
                      className="flex-shrink-0 flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground transition-colors cursor-default"
                    >
                      {tab.isMuted
                        ? <VolumeX size={11} />
                        : <Volume2 size={11} />}
                    </button>
                  )}

                  <span
                    className="text-[12px] h-full items-center flex text-foreground leading-none whitespace-nowrap flex-1 min-w-0"
                    style={{
                      paddingRight: showClose ? '1.75rem' : 0,
                      maskImage: showClose
                        ? 'linear-gradient(to right, black calc(100% - 44px), transparent calc(100% - 20px))'
                        : 'linear-gradient(to right, black calc(100% - 12px), transparent)',
                      WebkitMaskImage: showClose
                        ? 'linear-gradient(to right, black calc(100% - 44px), transparent calc(100% - 20px))'
                        : 'linear-gradient(to right, black calc(100% - 12px), transparent)',
                    }}
                  >
                    {tab.title || 'New tab'}
                  </span>

                  {showClose && (
                    <button
                      type="button"
                      aria-label="Close tab"
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        if (e.button !== 0) return
                        activate(tab.id)
                        e.currentTarget.setPointerCapture(e.pointerId)
                        const stripLeft = stripRef.current?.getBoundingClientRect().left ?? 0
                        dragStartX.current = e.clientX
                        dragOffsetX.current = e.clientX - stripLeft - idx * slotW
                        dragging.current = false
                        dragIdRef.current = tab.id
                        setDragId(null)
                        setDropIdx(null)
                      }}
                      onPointerMove={(e) => onPointerMove(e as unknown as React.PointerEvent<HTMLDivElement>)}
                      onPointerUp={(e) => {
                        const wasDragging = dragging.current
                        e.currentTarget.releasePointerCapture(e.pointerId)
                        resetDrag(wasDragging ? tab.id : undefined)
                        if (!wasDragging) triggerClose(tab.id)
                      }}
                      onPointerCancel={() => resetDrag()}
                      className={cn(
                        'absolute right-0 inset-y-0 w-7 flex items-center justify-center cursor-default',
                        isActive ? 'bg-[#1d1d1d]' : 'bg-transparent',
                      )}
                    >
                      <span className={cn(
                        'flex items-center justify-center w-[16px] h-[16px] rounded-sm text-muted-foreground transition-colors',
                        hoveredCloseId === tab.id ? 'text-foreground bg-foreground/10' : '',
                      )}>
                        <X size={12} strokeWidth={2.5} />
                      </span>
                    </button>
                  )}
              </div>
            )
          })}

          {/* Ghost — floats absolutely while dragging */}
          {dragId && (() => {
            const tab = orderedTabs.find((t) => t.id === dragId)
            if (!tab) return null
            const isActive = tab.id === activeTabId
            return (
              <div
                style={{
                  position: 'absolute',
                  left: dragX,
                  top: 0,
                  bottom: 0,
                  width: actualTabW,
                  pointerEvents: 'none',
                  zIndex: 50,
                }}
                className={cn(
                  'flex items-center gap-2 px-1.5 rounded-md overflow-hidden select-none',
                  isActive ? 'bg-[#1d1d1d] text-foreground' : 'bg-muted/40 text-muted-foreground',
                )}
              >
                {tab.favicon && (
                  <img
                    src={tab.favicon}
                    alt=""
                    className={cn('h-4 w-4 shrink-0', poppingFavicons.has(tab.id) ? 'favicon-pop' : 'opacity-80')}
                  />
                )}
                <span
                  className="text-[12px] h-full items-center flex leading-none whitespace-nowrap flex-1 min-w-0"
                  style={{
                    paddingRight: '1.75rem',
                    maskImage: 'linear-gradient(to right, black calc(100% - 44px), transparent calc(100% - 20px))',
                    WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 44px), transparent calc(100% - 20px))',
                  }}
                >
                  {tab.title || 'New tab'}
                </span>
                <div className={cn(
                  'absolute right-0 inset-y-0 w-7 flex items-center justify-center',
                  isActive ? 'bg-[#1d1d1d]' : 'bg-muted/40',
                )}>
                  <X size={12} strokeWidth={2.5} />
                </div>
              </div>
            )
          })()}
        </div>

        <button
          type="button"
          aria-label={canCreate ? 'New tab' : `Maximum ${MAX_TABS} tabs reached`}
          onClick={create}
          disabled={!canCreate}
          style={{ width: PLUS_W, minWidth: PLUS_W }}
          className={cn(
            'flex items-center justify-center shrink-0 h-full transition-colors cursor-default ml-1',
            canCreate
              ? 'text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded'
              : 'text-muted-foreground/25',
          )}
        >
          <Plus size={16} />
        </button>
        </div>

        {/* Drag filler — remaining space used as window drag target */}
        <div
          className="no-drag pointer-events-auto flex-1 h-full flex items-center justify-end pr-1"
          onPointerDown={onFillerPointerDown}
          onPointerMove={onFillerPointerMove}
          onPointerUp={onFillerPointerUp}
          onMouseEnter={() => window.aether.overlay.setMouseInteractive(true)}
          onMouseLeave={() => { if (!windowDragging.current) window.aether.overlay.setMouseInteractive(false) }}
        >
          {overlayState === 'CLICK_THROUGH' && (
            <button
              type="button"
              aria-label="Click-through mode is active. Click to exit."
              title="Overlay is transparent to clicks. Click to exit click-through mode."
              onClick={() => window.aether.overlay.leaveClickThrough()}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto flex items-center gap-1 shrink-0 h-5 px-2 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/35 hover:text-amber-300 border border-amber-500/35 transition-colors cursor-default"
            >
              <MousePointer2 size={10} />
              pass-through
            </button>
          )}
        </div>
      </div>

      {/* Right widgets */}
      <div className="no-drag flex items-center gap-0.5 shrink-0">

        <div
          className="no-drag pointer-events-auto flex items-center justify-center h-7 w-[41.09px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          title="Drag to move"
          onPointerDown={onFillerPointerDown}
          onPointerMove={onFillerPointerMove}
          onPointerUp={onFillerPointerUp}
          onMouseEnter={() => window.aether.overlay.setMouseInteractive(true)}
          onMouseLeave={() => { if (!windowDragging.current) window.aether.overlay.setMouseInteractive(false) }}
        />

        <button
          type="button"
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
          onClick={() => void window.aether.overlay.toggleMaximize().then(() => setMaximized((v) => !v))}
          className="flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-default"
        >
          {maximized ? <Minimize2 size={16} strokeWidth={1.5} /> : <Maximize2 size={16} strokeWidth={1.5} />}
        </button>

        <button
          type="button"
          aria-label="Hide overlay"
          onClick={() => void window.aether.overlay.hide()}
          onMouseEnter={() => window.aether.overlay.setMouseInteractive(true)}
          onMouseLeave={() => window.aether.overlay.setMouseInteractive(false)}
          className="pointer-events-auto flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-default"
        >
          <X size={20} strokeWidth={1} />
        </button>
      </div>
    </div>
  )
}
