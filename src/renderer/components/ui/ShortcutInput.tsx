// Keyboard-shortcut capture field.
// Stores logical characters (AZERTY-aware). Intercepts at window capture phase.
// Escape = cancel · Delete/Backspace = disable · modifier+key = save
import { useRef, useState, useEffect } from 'react'

interface ShortcutInputProps {
  value: string | null
  /** Label of another shortcut that uses the same combo (conflict hint). */
  usedBy?: string | null
  onChange: (value: string | null) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta'])

// Build an Electron-style accelerator from a KeyboardEvent (logical/AZERTY-aware).
function buildAccelerator(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  if (!e.ctrlKey && !e.altKey && !e.shiftKey) return null

  const parts: string[] = []
  if (e.ctrlKey)  parts.push('Ctrl')
  if (e.altKey)   parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key: string
  if (/^[a-zA-Z]$/.test(e.key))       key = e.key.toUpperCase()  // logical letter (AZERTY-aware)
  else if (/^[0-9]$/.test(e.key))     key = e.key                 // logical digit
  else if (e.code.startsWith('Arrow')) key = e.code.slice(5)       // ArrowLeft → Left
  else if (e.code === 'Tab')           key = 'Tab'
  else if (e.code === 'Space')         key = 'Space'
  else if (e.code === 'Enter')         key = 'Enter'
  else if (e.code === 'Escape')        key = 'Escape'
  else if (e.code === 'Backspace')     key = 'Backspace'
  else if (e.code === 'Delete')        key = 'Delete'
  else if (e.code === 'Insert')        key = 'Insert'
  else if (e.code === 'Home')          key = 'Home'
  else if (e.code === 'End')           key = 'End'
  else if (e.code === 'PageUp')        key = 'PageUp'
  else if (e.code === 'PageDown')      key = 'PageDown'
  else                                 key = e.key

  parts.push(key)
  return parts.join('+')
}

export function ShortcutInput({ value, usedBy, onChange }: ShortcutInputProps): JSX.Element {
  const [recording, setRecording] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Stop recording when focus leaves the element
  useEffect(() => {
    if (!recording) return
    const onBlur = (): void => setRecording(false)
    const el = ref.current
    el?.addEventListener('blur', onBlur)
    return () => el?.removeEventListener('blur', onBlur)
  }, [recording])

  // Capture-phase keydown listener: fires before Chromium's own handling.
  useEffect(() => {
    if (!recording) return

    const capture = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopImmediatePropagation()

      if (e.key === 'Escape') { setRecording(false); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onChange(null)
        setRecording(false)
        return
      }
      const combo = buildAccelerator(e)
      if (!combo) return  // modifier-only keypress, keep recording
      onChange(combo)
      setRecording(false)
    }

    window.addEventListener('keydown', capture, { capture: true })
    return () => window.removeEventListener('keydown', capture, { capture: true })
  }, [recording, onChange])

  const start = (): void => {
    setRecording(true)
    ref.current?.focus()
  }

  return (
    <div className="space-y-1">
      <div
        ref={ref}
        tabIndex={0}
        role="button"
        aria-label={recording ? 'Recording shortcut — press a key combination' : `Shortcut: ${value ?? 'disabled'}`}
        className={[
          'inline-flex items-center h-6 px-2 rounded border text-[11px] font-mono',
          'cursor-pointer select-none outline-none transition-colors min-w-[120px]',
          recording
            ? 'border-primary bg-primary/10 text-primary'
            : value
              ? 'border-border bg-input hover:border-primary/50 text-foreground'
              : 'border-border/40 bg-transparent text-muted-foreground/50 hover:border-border',
        ].join(' ')}
        onClick={start}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start() } }}
        aria-pressed={recording}
      >
        {recording
          ? <span className="animate-pulse">Press shortcut…</span>
          : <span>{value ?? '—'}</span>
        }
      </div>
      {Boolean(usedBy) && !recording && (
        <p className="text-[10px] text-amber-500">Conflicts with &quot;{usedBy}&quot;</p>
      )}
    </div>
  )
}
