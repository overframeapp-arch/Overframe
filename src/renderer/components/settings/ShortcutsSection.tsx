import { useMemo } from 'react'
import type { ShortcutId, Shortcuts } from '@shared/types'
import { SHORTCUT_GROUPS, SHORTCUT_IDS, SHORTCUT_LABELS } from '@shared/types'
import { ShortcutInput } from '../ui/ShortcutInput'

interface ShortcutsSectionProps {
  shortcuts: Shortcuts
  onChange: (id: ShortcutId, value: string | null) => Promise<void>
  onReset: () => Promise<void>
}

export function ShortcutsSection({ shortcuts, onChange, onReset }: ShortcutsSectionProps): JSX.Element {
  /** Reverse map (accelerator → label) for conflict detection. */
  const conflictMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const id of SHORTCUT_IDS) {
      const acc = shortcuts[id]
      if (acc) map.set(acc, SHORTCUT_LABELS[id])
    }
    return map
  }, [shortcuts])

  const conflictFor = (id: ShortcutId): string | null => {
    const acc = shortcuts[id]
    if (!acc) return null
    const otherLabel = conflictMap.get(acc)
    return otherLabel && otherLabel !== SHORTCUT_LABELS[id] ? otherLabel : null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
          Shortcuts
        </h3>
        <button
          type="button"
          aria-label="Reset all shortcuts to defaults"
          onClick={() => void onReset()}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset all
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Click a field to record a new shortcut. Press <kbd className="font-mono">Delete</kbd> to disable.
      </p>
      <div className="space-y-4">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground mb-2">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.ids.map((id) => (
                <div key={id} className="flex items-start justify-between gap-2">
                  <span className="text-xs text-foreground/80 pt-0.5 flex-1">
                    {SHORTCUT_LABELS[id]}
                  </span>
                  <ShortcutInput
                    value={shortcuts[id] ?? null}
                    usedBy={conflictFor(id)}
                    onChange={(val) => void onChange(id, val)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
