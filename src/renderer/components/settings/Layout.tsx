import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info, Plus, X, FileSearch } from 'lucide-react'

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
        className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-2"
      >
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground leading-snug mb-3">{description}</p>
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
        <label className="block text-xs text-foreground/80">{label}</label>
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
      <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground/80 hover:text-foreground transition-colors">
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
        className="text-muted-foreground hover:text-foreground focus:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded transition-colors"
      >
        <Info size={11} />
      </button>
      {open && createPortal(
        <span
          id={id}
          role="tooltip"
          style={{ position: 'fixed', left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
          className="z-[9999] w-56 px-2.5 py-1.5 rounded bg-muted border border-border text-xs text-foreground leading-snug shadow-lg pointer-events-none"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}

interface ChipListProps {
  values: string[]
  ariaLabel: string
  /** Inner content of each chip (label + action button) — the list only owns layout/collapse/filter. */
  renderChip: (value: string) => ReactNode
  /** Show a filter input above the chips once expanded, when the list exceeds this. Default: 8. */
  filterThreshold?: number
  filterPlaceholder?: string
}

/**
 * A list of many string chips that stays out of the way: collapsed to ONE
 * clipped line ending in a "+N" toggle by default, expandable (with an
 * optional filter for long lists) on demand. Shared by StringListEditor
 * (editable) and any read-only chip list (e.g. Excluded processes) so both
 * scale the same way to 100+ entries.
 */
export function ChipList({ values, ariaLabel, renderChip, filterThreshold, filterPlaceholder }: ChipListProps): JSX.Element {
  const [filter, setFilter] = useState('')
  const filterId = useId()
  const threshold = filterThreshold ?? 8
  const showFilter = values.length > threshold

  // Collapsed by default: the chips render as ONE line ending with a "+N"
  // toggle, so long lists don't eat vertical space. Expanding (or typing a
  // filter) shows the full wrapped list.
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef<HTMLUListElement>(null)
  /** How many chips fit on the collapsed line. null = needs (re)measuring. */
  const [fitCount, setFitCount] = useState<number | null>(null)
  const filtering = filter.trim() !== ''
  const collapsed = !expanded && !filtering

  // Any change to the list or view mode invalidates the measurement.
  useLayoutEffect(() => { setFitCount(null) }, [values, collapsed])
  useEffect(() => {
    const onResize = (): void => setFitCount(null)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Measuring pass: all chips are rendered on one clipped line; count how many
  // fit, reserving room for the "+N" toggle when not everything fits.
  useLayoutEffect(() => {
    if (!collapsed || fitCount !== null) return
    const el = listRef.current
    if (!el) return
    const GAP = 4 // gap-1
    const RESERVE = 56 // room for the "+N" chip
    const widths = (Array.from(el.children) as HTMLElement[])
      .filter((c) => !c.dataset.overflowChip)
      .map((c) => c.offsetWidth)
    const fits = (budget: number): number => {
      let used = 0
      let n = 0
      for (const w of widths) {
        const next = used + (n > 0 ? GAP : 0) + w
        if (next > budget) break
        used = next
        n++
      }
      return n
    }
    const all = fits(el.clientWidth)
    setFitCount(all >= widths.length ? widths.length : fits(el.clientWidth - RESERVE))
  }, [collapsed, fitCount])

  const visibleValues = filter.trim()
    ? values.filter((v) => v.toLowerCase().includes(filter.toLowerCase().trim()))
    : values

  const collapsedValues = fitCount === null ? values : values.slice(0, fitCount)
  const overflowCount = values.length - collapsedValues.length

  return (
    <>
      {/* Filter — only in the expanded view of a long list */}
      {showFilter && !collapsed && (
        <input
          id={filterId}
          type="search"
          aria-label={`Filter ${ariaLabel}`}
          placeholder={filterPlaceholder ?? 'Filter…'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full mb-1.5 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      {collapsed ? (
        <ul
          ref={listRef}
          className="flex flex-nowrap items-center gap-1 overflow-hidden"
          aria-label={ariaLabel}
        >
          {collapsedValues.map((v) => (
            <li
              key={v}
              className="flex items-center gap-1 rounded bg-muted/40 pl-2 pr-1 py-0.5 text-[11px] text-foreground/80 font-mono shrink-0"
            >
              {renderChip(v)}
            </li>
          ))}
          {overflowCount > 0 && (
            <li data-overflow-chip="true" className="shrink-0">
              <button
                type="button"
                aria-expanded={false}
                aria-label={`Show ${overflowCount} more`}
                onClick={() => setExpanded(true)}
                className="rounded bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                +{overflowCount}
              </button>
            </li>
          )}
        </ul>
      ) : visibleValues.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matches for "{filter}".</p>
      ) : (
        <ul
          className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1"
          aria-label={ariaLabel}
        >
          {visibleValues.map((v) => (
            <li
              key={v}
              className="flex items-center gap-1 rounded bg-muted/40 pl-2 pr-1 py-0.5 text-[11px] text-foreground/80 font-mono min-w-0 max-w-full"
            >
              {renderChip(v)}
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-expanded={true}
              onClick={() => { setExpanded(false); setFilter('') }}
              className="rounded bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Show less
            </button>
          </li>
        </ul>
      )}
    </>
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
  /**
   * When provided, shows a "Browse…" button (native file picker) next to Add.
   * Return the raw picked value (e.g. a file path) — it goes through the same
   * normalize/validate/dedupe pipeline as manual entry. Return null on cancel.
   */
  onBrowse?: () => Promise<string | null>
  browseLabel?: string
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
  onBrowse,
  browseLabel,
}: StringListEditorProps): JSX.Element {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()

  const commit = (raw: string): void => {
    const value = normalize ? normalize(raw) : raw
    if (!value) return
    const err = validate ? validate(value) : null
    if (err) { setError(err); return }
    if (values.includes(value)) { setError('Already in the list.'); return }
    onChange([...values, value])
    setError(null)
  }

  const submit = (): void => {
    const raw = draft.trim()
    if (!raw) return
    commit(raw)
    setDraft('')
  }

  const browse = async (): Promise<void> => {
    if (!onBrowse) return
    const picked = await onBrowse()
    if (picked) commit(picked)
  }

  const remove = (entry: string): void => {
    onChange(values.filter((v) => v !== entry))
  }

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center gap-1 mb-1.5">
        <label htmlFor={inputId} className="block text-xs text-foreground/80">
          {label}
          {values.length > 0 && (
            <span className="ml-1.5 text-[11px] bg-muted rounded px-1 py-0.5 align-middle text-muted-foreground">
              {values.length}
            </span>
          )}
        </label>
        {hint && <InfoTip text={hint} />}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
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
          className="flex-1 min-w-0 rounded border border-border bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          aria-label={`Add ${label}`}
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <Plus size={11} />
          Add
        </button>
        {onBrowse && (
          <button
            type="button"
            aria-label={browseLabel ?? `Browse for ${label}`}
            onClick={() => void browse()}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <FileSearch size={11} />
            Browse&hellip;
          </button>
        )}
      </div>

      {error && (
        <p id={`${inputId}-err`} role="alert" className="text-xs text-destructive mb-1.5">
          {error}
        </p>
      )}

      {/* Chip list — one clipped line with a "+N" toggle when collapsed */}
      {values.length === 0 ? (
        emptyText && (
          <p className="text-xs text-muted-foreground leading-snug">{emptyText}</p>
        )
      ) : (
        <ChipList
          values={values}
          ariaLabel={label}
          filterThreshold={filterThreshold}
          renderChip={(v) => (
            <>
              <span title={v} className="truncate max-w-[180px]">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => remove(v)}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={10} />
              </button>
            </>
          )}
        />
      )}
    </div>
  )
}
