'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ArrowLeft, ArrowRight, RotateCw, Home,
  Star, Library, Settings, Plus, X, Minimize2, Maximize2,
  Heart, MemoryStick,
} from 'lucide-react'

// ── App colour constants — exact match src/renderer/styles.css ────────────────

const BG       = '#141414'  // --background  (tab bar)
const SURFACE  = '#212121'  // --muted        (address + collection bars)
const ACTIVE   = '#1d1d1d'  // active tab bg
const INPUT_BG = '#1f1f1f'  // --input
const BORDER   = '#303030'  // --border
const FG       = '#ebebeb'  // --foreground
const MUTED_FG = '#757575'  // --muted-foreground
const PRIMARY  = '#7c3aed'  // --primary

// ── Ziz avatar — inline SVG (replace with <img src="/ziz.jpg"> once saved to public/) ──

function ZizAvatar({ size = 30 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size, borderRadius: 6, flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ziz-bg" cx="50%" cy="60%" r="55%">
          <stop offset="0%"   stopColor="#0d1f45" />
          <stop offset="100%" stopColor="#040810" />
        </radialGradient>
        <filter id="ziz-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="ziz-glow-strong">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feFlood floodColor="#3b82f6" floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feComposite in="SourceGraphic" in2="glow" operator="over" />
        </filter>
      </defs>
      <rect width="100" height="100" fill="url(#ziz-bg)" />
      {/* Glow halo */}
      <text
        x="50" y="65"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fontWeight="bold"
        fontSize="46"
        fill="#3b82f6"
        opacity="0.5"
        filter="url(#ziz-glow)"
      >Ziz</text>
      {/* Sharp white text */}
      <text
        x="50" y="65"
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontStyle="italic"
        fontWeight="bold"
        fontSize="46"
        fill="white"
      >Ziz</text>
    </svg>
  )
}

// ── PoE profile icon — img with fallback ─────────────────────────────────────

function PoeIcon({ size = 30 }: { size?: number }) {
  const [err, setErr] = useState(false)
  return err ? (
    // fallback: red gem lettermark
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: 'linear-gradient(135deg, #1a0505, #2d0909)',
      border: '1px solid #4a1010',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700, color: '#c0392b', fontFamily: 'Georgia, serif',
    }}>PoE</div>
  ) : (
    <img
      src="https://pathofexile2.com/favicon.ico"
      alt="Path of Exile 2"
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}

// ── Notification Toast — 100% match GameNotificationPopup.tsx ────────────────

function NotifToast({ visible }: { visible: boolean }) {
  const barRef = useRef<HTMLDivElement>(null)

  // Trigger CSS transition on bar when becoming visible
  useEffect(() => {
    if (!visible) return
    const el = barRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'scaleX(1)'
    el.style.transformOrigin = 'left'
    // Force reflow so browser registers the start value
    void el.getBoundingClientRect()
    el.style.transition = 'transform 3000ms linear'
    el.style.transform = 'scaleX(0)'
  }, [visible])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 240,
        // exact match GameNotificationPopup: bg-background/95 border border-border/60 shadow-xl rounded-lg
        background: `rgba(20,20,20,0.95)`,
        border: `1px solid rgba(48,48,48,0.6)`,
        borderRadius: 8,
        boxShadow: '0 10px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        transform: visible ? 'translateY(0)' : 'translateY(-115%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 300ms cubic-bezier(0.34,1.26,0.64,1), opacity 220ms ease',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* ── Content row — flex items-center gap-2.5 px-3 flex-1 ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 10, padding: '10px 12px', flex: 1,
      }}>
        {/* ProfileIcon 30×30 — PoE favicon */}
        <PoeIcon size={30} />

        {/* Text column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 10, color: MUTED_FG, lineHeight: 1, marginBottom: 3 }}>
            Profile activated
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600, color: FG,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
          }}>
            Path of Exile 2
          </span>
        </div>

        {/* Right — "Open overlay" + kbd shortcut */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 10, color: `rgba(117,117,117,0.6)`, lineHeight: 1 }}>
            Open overlay
          </span>
          <kbd style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 6px', borderRadius: 4,
            background: `rgba(33,33,33,0.8)`,
            border: `1px solid rgba(48,48,48,0.5)`,
            color: PRIMARY, fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
            lineHeight: 1.4,
          }}>
            Alt+B
          </kbd>
        </div>
      </div>

      {/* ── Progress bar — h-[3px] bg-border/20, inner bg-primary/50 scaleX 1→0 ── */}
      <div style={{ height: 3, background: `rgba(48,48,48,0.2)`, flexShrink: 0 }}>
        <div
          ref={barRef}
          style={{ height: '100%', background: `rgba(124,58,237,0.5)` }}
        />
      </div>
    </div>
  )
}

// ── Page content: pathofexile2.com/ancients ─────────────────────────────────
// Proxied via /api/poe2 (see app/api/poe2/route.ts) which strips
// X-Frame-Options and injects a <base> tag for asset resolution.

function Poe2AncientsContent() {
  return (
    <iframe
      src="https://www.youtube.com/embed/vxgYGGFNs98?autoplay=1&mute=0&rel=0&modestbranding=1"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="Path of Exile 2 — Return of the Ancients"
      allow="autoplay; fullscreen"
    />
  )
}

// ── Overframe overlay panel ───────────────────────────────────────────────────

const TABS = [
  { title: 'Return of the Ancients — PoE2', active: true,  dotColor: '#c8a06a' },
  { title: 'Build Planner',                  active: false, dotColor: '#6366f1' },
]

const DEFAULT_W  = 700
const DEFAULT_H  = 680
const MIN_W      = 360
const MIN_H      = 260
const HANDLE_PX  = 6

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

function OverframePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pos,       setPos]       = useState({ x: 0, y: 0 })
  const [size,      setSize]      = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [maximized, setMaximized] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [blocking,  setBlocking]  = useState(false)

  // Live refs so closures never read stale values
  const posRef  = useRef(pos);  posRef.current  = pos
  const sizeRef = useRef(size); sizeRef.current = size
  const savedRef = useRef<{ pos: typeof pos; size: typeof size } | null>(null)

  // ── Init position on first open ─────────────────────────────────────────
  const initRef = useRef(false)
  useEffect(() => {
    if (open && !initRef.current) {
      initRef.current = true
      setPos({
        x: Math.max(8, window.innerWidth  - DEFAULT_W - 12),
        y: Math.max(8, Math.round((window.innerHeight - DEFAULT_H) / 2)),
      })
    }
    if (!open) setMinimized(false)
  }, [open])

  // ── Drag (mousedown on tab bar) ─────────────────────────────────────────
  const handleTitleDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if (maximized) return
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    const sp = { ...posRef.current }
    setBlocking(true)
    const onMove = (ev: MouseEvent) =>
      setPos({ x: sp.x + ev.clientX - sx, y: sp.y + ev.clientY - sy })
    const cleanup = () => {
      setBlocking(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
  }, [maximized])

  // ── Resize ──────────────────────────────────────────────────────────────
  const handleResizeDown = useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const ss = { ...sizeRef.current }, sp = { ...posRef.current }
    setBlocking(true)
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      let { w, h } = ss, { x, y } = sp
      if (dir.includes('e')) w = Math.max(MIN_W, ss.w + dx)
      if (dir.includes('s')) h = Math.max(MIN_H, ss.h + dy)
      if (dir.includes('w')) { w = Math.max(MIN_W, ss.w - dx); x = sp.x + ss.w - w }
      if (dir.includes('n')) { h = Math.max(MIN_H, ss.h - dy); y = sp.y + ss.h - h }
      setSize({ w, h }); setPos({ x, y })
    }
    const cleanup = () => {
      setBlocking(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', cleanup)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', cleanup)
  }, [])

  // ── Window controls ─────────────────────────────────────────────────────
  const doMinimize = () => setMinimized(m => !m)

  const doMaximize = () => {
    if (maximized) {
      if (savedRef.current) {
        setPos(savedRef.current.pos)
        setSize(savedRef.current.size)
      }
      setMaximized(false)
    } else {
      savedRef.current = { pos: posRef.current, size: sizeRef.current }
      setPos({ x: 0, y: 0 })
      setSize({ w: window.innerWidth, h: window.innerHeight })
      setMaximized(true)
    }
  }

  // ── 8 resize handles ────────────────────────────────────────────────────
  const resizeHandles: { dir: ResizeDir; style: React.CSSProperties }[] = [
    { dir: 'n',  style: { top: 0, left: HANDLE_PX * 2, right: HANDLE_PX * 2, height: HANDLE_PX, cursor: 'n-resize' } },
    { dir: 's',  style: { bottom: 0, left: HANDLE_PX * 2, right: HANDLE_PX * 2, height: HANDLE_PX, cursor: 's-resize' } },
    { dir: 'e',  style: { right: 0, top: HANDLE_PX * 2, bottom: HANDLE_PX * 2, width: HANDLE_PX, cursor: 'e-resize' } },
    { dir: 'w',  style: { left: 0, top: HANDLE_PX * 2, bottom: HANDLE_PX * 2, width: HANDLE_PX, cursor: 'w-resize' } },
    { dir: 'ne', style: { top: 0, right: 0, width: HANDLE_PX * 3, height: HANDLE_PX * 3, cursor: 'ne-resize' } },
    { dir: 'nw', style: { top: 0, left: 0, width: HANDLE_PX * 3, height: HANDLE_PX * 3, cursor: 'nw-resize' } },
    { dir: 'se', style: { bottom: 0, right: 0, width: HANDLE_PX * 3, height: HANDLE_PX * 3, cursor: 'se-resize' } },
    { dir: 'sw', style: { bottom: 0, left: 0, width: HANDLE_PX * 3, height: HANDLE_PX * 3, cursor: 'sw-resize' } },
  ]

  const panelLeft = maximized ? 0 : pos.x
  const panelTop  = maximized ? 0 : pos.y
  const panelW    = maximized ? '100vw' : size.w
  const panelH    = minimized ? 40 : (maximized ? '100vh' : size.h)

  // Narrow panel → collapse some chrome
  const narrow = !maximized && size.w < 480

  // Shared button style
  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    color: MUTED_FG, borderRadius: 4, flexShrink: 0, ...extra,
  })

  return (
    <div style={{
      position: 'fixed',
      left: panelLeft,
      top: panelTop,
      width: panelW,
      height: panelH,
      zIndex: 9999,
      background: BG,
      border: maximized ? 'none' : `1px solid ${BORDER}`,
      borderRadius: maximized ? 0 : 8,
      boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
      transform: open ? 'scale(1)' : 'scale(0.97)',
      transition: 'opacity 300ms ease, transform 300ms ease',
    }}>

      {/* Resize handles — disabled when maximized or minimized */}
      {!maximized && !minimized && resizeHandles.map(h => (
        <div
          key={h.dir}
          onMouseDown={handleResizeDown(h.dir)}
          style={{ position: 'absolute', zIndex: 10, ...h.style }}
        />
      ))}

      {/* Blocks iframe mouse capture during drag / resize */}
      {blocking && <div style={{ position: 'absolute', inset: 0, zIndex: 8 }} />}

      {/* ══════════════════════════════════════════════════════════════════
          TAB BAR  —  h-10 / bg --background (#141414)
          Exact match: src/renderer/components/TabBar.tsx
      ══════════════════════════════════════════════════════════════════ */}
      <div
        onMouseDown={handleTitleDown}
        style={{
          height: 40, background: BG,
          display: 'flex', alignItems: 'stretch',
          padding: '0 4px',
          flexShrink: 0,
          cursor: maximized ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        {/* Profile icon — PoE2 favicon */}
        <button type="button" style={{ ...btn({ width: 32, height: 32, margin: 'auto 4px auto 0', borderRadius: 6 }) }}>
          <PoeIcon size={24} />
        </button>

        {/* Tab strip */}
        <div style={{
          display: 'flex', alignItems: 'center',
          flex: 1, minWidth: 0, overflow: 'hidden',
          padding: '4px 0', gap: 4,
        }}>
          {TABS.map(t => (
            <div key={t.title} style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 6px',
              height: '100%',
              maxWidth: narrow ? 110 : 180,
              minWidth: 32,
              borderRadius: 6,
              background: t.active ? ACTIVE : 'transparent',
              color: t.active ? FG : MUTED_FG,
              fontSize: 12,
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              {/* Favicon */}
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                background: t.dotColor, opacity: 0.85, flexShrink: 0,
              }} />

              {/* Title with fade mask */}
              <span style={{
                fontSize: 12, lineHeight: 1, flex: 1, minWidth: 0,
                whiteSpace: 'nowrap', paddingRight: '1.5rem',
                maskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent calc(100% - 16px))',
                WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent calc(100% - 16px))',
              }}>
                {t.title}
              </span>

              {/* Close × */}
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.active ? ACTIVE : 'transparent',
              }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, borderRadius: 4,
                  color: MUTED_FG,
                }}>
                  <X size={11} strokeWidth={2.5} />
                </span>
              </div>

              {/* Active — violet bottom line */}
              {t.active && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: 2, background: PRIMARY, borderRadius: '1px 1px 0 0',
                }} />
              )}
            </div>
          ))}

          {/* + New tab */}
          <button type="button" style={{
            ...btn({ width: 28, height: 28, borderRadius: 4, flexShrink: 0 }),
          }}>
            <Plus size={15} />
          </button>
        </div>

        {/* Filler + window controls */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 4, gap: 1,
        }}>
          <button type="button" onClick={doMinimize} title="Minimize"
            style={btn({ width: 28, height: 28 })}>
            <Minimize2 size={13} />
          </button>
          <button type="button" onClick={doMaximize} title={maximized ? 'Restore' : 'Maximize'}
            style={btn({ width: 28, height: 28 })}>
            <Maximize2 size={12} />
          </button>
          <button type="button" onClick={onClose} title="Close"
            style={btn({ width: 28, height: 28 })}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Content — hidden when minimized ──────────────────────────────── */}
      {!minimized && (
        <>
          {/* ════════════════════════════════════════════════════════════════
              ADDRESS BAR  —  h-10 / bg --muted (#212121)
              Exact match: src/renderer/components/AddressBar.tsx
          ════════════════════════════════════════════════════════════════ */}
          <div style={{
            height: 40, background: SURFACE,
            display: 'flex', alignItems: 'center',
            padding: '0 8px', gap: 4, flexShrink: 0,
          }}>
            {/* Home */}
            <button type="button" title="Home" style={btn({ width: 28, height: 28 })}>
              <Home size={14} />
            </button>
            {/* Back */}
            <button type="button" title="Back" style={{ ...btn({ width: 28, height: 28 }), opacity: 0.3, cursor: 'default' }}>
              <ArrowLeft size={15} />
            </button>
            {/* Forward */}
            <button type="button" title="Forward" style={{ ...btn({ width: 28, height: 28 }), opacity: 0.3, cursor: 'default' }}>
              <ArrowRight size={15} />
            </button>
            {/* Reload */}
            <button type="button" title="Reload" style={btn({ width: 28, height: 28 })}>
              <RotateCw size={14} />
            </button>

            {/* URL input */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative', margin: '0 4px' }}>
              {/* Favicon inside input */}
              <div style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                width: 14, height: 14, borderRadius: 3,
                background: '#c8a06a', opacity: 0.9,
                pointerEvents: 'none', zIndex: 1,
              }} />
              <div style={{
                height: 32, width: '100%',
                display: 'flex', alignItems: 'center',
                background: INPUT_BG,
                border: `1px solid rgba(48,48,48,0.6)`,
                borderRadius: 6, paddingLeft: 28, paddingRight: 28,
                fontSize: 12, color: FG,
                overflow: 'hidden',
              }}>
                <span style={{ color: MUTED_FG, flexShrink: 0 }}>pathofexile2.com/</span>
                <span style={{ color: FG }}>ancients</span>
              </div>
              {/* Star (bookmarked → primary) */}
              <button type="button" title="Bookmark" style={{
                ...btn({ width: 20, height: 20 }),
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                color: PRIMARY,
              }}>
                <Star size={13} fill="currentColor" />
              </button>
            </div>

            {!narrow && (
              <>
                {/* Library */}
                <button type="button" title="Manage collections" style={btn({ width: 28, height: 28 })}>
                  <Library size={15} />
                </button>
                {/* Memory */}
                <button type="button" title="Memory usage" style={{
                  ...btn({ height: 28, padding: '0 8px', gap: 6, borderRadius: 4 }),
                  fontSize: 11,
                }}>
                  <MemoryStick size={13} />
                  <span style={{ color: MUTED_FG, fontVariantNumeric: 'tabular-nums' }}>248 MB</span>
                </button>
                {/* Ko-fi heart */}
                <button type="button" title="Support development" style={btn({ width: 28, height: 28 })}>
                  <Heart size={15} />
                </button>
                {/* Settings */}
                <button type="button" title="Settings" style={btn({ width: 28, height: 28 })}>
                  <Settings size={15} />
                </button>
              </>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              COLLECTION BAR  —  h-10 / bg --muted (#212121) / border-b
              Exact match: src/renderer/components/CollectionBar.tsx
          ════════════════════════════════════════════════════════════════ */}
          <div style={{
            height: 40, background: SURFACE,
            borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center',
            padding: '0 6px', gap: 6, flexShrink: 0,
            overflow: 'hidden',
          }}>
            {/* Collection picker button */}
            <button type="button" title="Select collection" style={{
              ...btn({ height: 32, padding: '0 8px', gap: 6, borderRadius: 4 }),
              fontSize: 12, maxWidth: 140, overflow: 'hidden',
              flexShrink: 0,
            }}>
              <ZizAvatar size={18} />
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: MUTED_FG, maxWidth: 100,
              }}>
                PoE2: Ancients
              </span>
            </button>

            {/* Separator */}
            <div style={{ width: 1, height: 16, background: BORDER, flexShrink: 0 }} />

            {/* Bookmark links */}
            {[
              { label: 'Build Planner',  color: '#6366f1' },
              { label: 'My Build',       color: '#7c3aed' },
              { label: 'Maxroll Guide',  color: '#2563eb' },
            ].map(b => (
              <button key={b.label} type="button" title={b.label} style={{
                ...btn({ height: 24, padding: '0 10px', gap: 6, borderRadius: 4 }),
                fontSize: 12, maxWidth: 160, flexShrink: 0,
                overflow: 'hidden',
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: b.color, opacity: 0.8, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MUTED_FG }}>
                  {b.label}
                </span>
              </button>
            ))}

            <button type="button" style={{
              ...btn({ height: 24, padding: '0 8px', borderRadius: 4, flexShrink: 0 }),
              fontSize: 11, fontWeight: 500,
            }}>
              +3
            </button>
          </div>

          {/* Page content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Poe2AncientsContent />
          </div>
        </>
      )}
    </div>
  )
}

// ── Hint badge ────────────────────────────────────────────────────────────────

function HintBadge({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9997,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: 'rgba(14,14,14,0.93)',
        border: '1px solid rgba(124,58,237,0.35)',
        borderRadius: 12,
        cursor: 'pointer',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 28px rgba(124,58,237,0.16), 0 0 0 1px rgba(255,255,255,0.02)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.94)',
        transition: 'opacity 400ms ease, transform 400ms ease',
        pointerEvents: visible ? 'auto' : 'none',
        color: 'inherit',
        font: 'inherit',
      }}
    >
      {/* Amber logo */}
      <svg viewBox="0 0 32 32" style={{ width: 20, height: 20, flexShrink: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="hb-fill" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#FCD34D" />
            <stop offset="50%"  stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="hb-deep" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#7C2D12" />
            <stop offset="100%" stopColor="#1F0A02" />
          </linearGradient>
        </defs>
        <rect x="4"  y="4"  width="18" height="18" rx="3.5" fill="url(#hb-deep)" stroke="url(#hb-fill)" strokeWidth="1.6" />
        <rect x="10" y="10" width="18" height="18" rx="3.5" fill="url(#hb-fill)" />
      </svg>

      <span style={{ fontSize: 13, color: '#ebebeb', fontWeight: 500 }}>Try the overlay</span>

      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <kbd style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 7px', borderRadius: 4,
          background: '#1a1a1a', border: '1px solid #333',
          color: '#7c3aed', fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
        }}>Alt</kbd>
        <span style={{ fontSize: 11, color: '#505050' }}>+</span>
        <kbd style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 7px', borderRadius: 4,
          background: '#1a1a1a', border: '1px solid #333',
          color: '#7c3aed', fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
        }}>B</kbd>
      </div>
    </button>
  )
}

// ── Backdrop ─────────────────────────────────────────────────────────────────

function Backdrop({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: visible ? 'blur(1px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(1px)' : 'none',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 300ms ease',
      }}
    />
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

type Phase = 'hidden' | 'notif' | 'open'

export function LiveOverlay() {
  const [phase, setPhase] = useState<Phase>('hidden')
  const [hintVisible, setHintVisible] = useState(false)
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Delayed hint appearance
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(true), 1800)
    return () => clearTimeout(t)
  }, [])

  // notif → open auto-advance
  useEffect(() => {
    if (phase === 'notif') {
      notifTimerRef.current = setTimeout(() => setPhase('open'), 900)
    }
    return () => {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    }
  }, [phase])

  const open = () => setPhase('notif')
  const close = () => setPhase('hidden')

  // Global Alt+B + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setPhase(prev => prev === 'hidden' ? 'notif' : 'hidden')
      }
      if (e.key === 'Escape') {
        setPhase('hidden')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isOpen = phase === 'open'

  return (
    <>
      <NotifToast visible={phase === 'notif'} />
      <Backdrop visible={isOpen} onClick={close} />
      <OverframePanel open={isOpen} onClose={close} />
      <HintBadge visible={hintVisible && phase === 'hidden'} onClick={open} />
    </>
  )
}
