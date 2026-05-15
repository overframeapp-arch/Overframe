import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info, Plus, X } from 'lucide-react'

export function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}): JSX.Element {
  const slug = title.replace(/\s+/g, '-').toLowerCase()
  return (
    <section aria-labelledby={`section-${slug}`}>
      <h3
        id={`section-${slug}`}
        className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 mb-1.5"
      >
        {title}
      </h3>
      {description && (
        <p className="text-[10px] text-muted-foreground/60 leading-snug mb-2.5">{description}</p>
      )}
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label className="block text-[11px] text-muted-foreground">{label}</label>
        {hint && <InfoTip text={hint} />}
      </div>
      {children}
    </div>
  )
}

export function Check({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 cursor-pointer text-[11px] hover:text-foreground transition-colors text-muted-foreground">
        {children}
        {label}
      </label>
      {hint && <InfoTip text={hint} />}
    </div>
  )
}

/**
 * Accessible help icon with a tooltip rendered via portal so it is never
 * clipped by any overflow:hidden/auto ancestor (scroll containers, panels…).
 */
export function InfoTip({ text }: { text: string }): JSX.Element {
  const id = useId()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const updatePos = (): void => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.bottom + 6 })
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        aria-label="More information"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => { updatePos(); setOpen(true) }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => { updatePos(); setOpen(true) }}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); updatePos(); setOpen((v) => !v) }}
        className="text-muted-foreground/40 hover:text-foreground focus:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded transition-colors"
      >
        <Info size={11} />
      </button>
      {open && createPortal(
        <span
          id={id}
          role="tooltip"
          style={{ position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
          className="z-[9999] w-56 px-2.5 py-1.5 rounded bg-muted border border-border text-[10px] text-foreground leading-snug shadow-lg pointer-events-none"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}

interface StringListEditorProps {
  label: string
  hint?: string
  values: string[]
  /** Show a filter input above chips when list length exceeds this. Default: 8. */
  filterThreshold?: number
  /** When provided, shows a "Reset to defaults" button. */
  onReset?: () => void
  placeholder?: string
  onChange: (next: string[]) => void
  normalize?: (input: string) => string
  validate?: (input: string) => string | null
  emptyText?: string
}

/**
 * Reusable list editor: add/remove string entries with optional filter and reset-to-defaults.
 */
export function StringListEditor({
  label,
  hint,
  values,
  filterThreshold,
  onReset,
  placeholder,
  onChange,
  normalize,
  validate,
  emptyText,
}: StringListEditorProps): JSX.Element {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const inputId = useId()
  const filterId = useId()
  const threshold = filterThreshold ?? 8
  const showFilter = values.length > threshold

  const visibleValues = filter.trim()
    ? values.filter((v) => v.toLowerCase().includes(filter.toLowerCase().trim()))
    : values

  const submit = (): void => {
    const raw = draft.trim()
    if (!raw) return
    const value = normalize ? normalize(raw) : raw
    if (!value) return
    const err = validate ? validate(value) : null
    if (err) { setError(err); return }
    if (values.includes(value)) { setError('Already in the list.'); return }
    onChange([...values, value])
    setDraft('')
    setError(null)
  }

  const remove = (entry: string): void => {
    onChange(values.filter((v) => v !== entry))
  }

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center gap-1 mb-1.5">
        <label htmlFor={inputId} className="block text-[11px] text-muted-foreground">
          {label}
          {values.length > 0 && (
            <span className="ml-1.5 text-[9px] bg-muted rounded px-1 py-0.5 align-middle">
              {values.length}
            </span>
          )}
        </label>
        {hint && <InfoTip text={hint} />}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-[9px] text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            Reset defaults
          </button>
        )}
      </div>

      {/* Add input */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); if (error) setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-err` : undefined}
          className="flex-1 min-w-0 rounded border border-border bg-transparent px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          aria-label={`Add ${label}`}
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Plus size={11} />
          Add
        </button>
      </div>

      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-[10px] text-destructive mb-1.5">
          {error}
        </p>
      )}

      {/* Filter — only shown when list is long */}
      {showFilter && values.length > 0 && (
        <input
          id={filterId}
          type="search"
          aria-label={`Filter ${label}`}
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full mb-1.5 rounded border border-border bg-transparent px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      {/* Chip list */}
      {values.length === 0 ? (
        emptyText && (
          <p className="text-[10px] text-muted-foreground/50 leading-snug">{emptyText}</p>
        )
      ) : visibleValues.length === 0 ? (
        <p className="text-[10px] text-muted-foreground/50">No matches for "{filter}".</p>
      ) : (
        <ul
          className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1"
          aria-label={label}
        >
          {visibleValues.map((v) => (
            <li
              key={v}
              className="flex items-center gap-1 rounded bg-muted/40 pl-2 pr-1 py-0.5 text-[10px] text-muted-foreground font-mono min-w-0 max-w-full"
            >
              <span title={v} className="truncate">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => remove(v)}
                className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
