import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../lib/cn'
import { MISSIONS } from '../lib/missions'
import { useMissionsStore } from '../store/missionsStore'

export function MissionsPanel(): JSX.Element {
  const { completed, reset } = useMissionsStore()

  const total = MISSIONS.length
  const doneCount = MISSIONS.filter((m) => completed.includes(m.id)).length
  const allDone = doneCount === total

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="px-5 pt-4 pb-3 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {allDone ? 'All missions complete 🎉' : `${doneCount} / ${total} completed`}
          </span>
          {doneCount > 0 && !allDone && import.meta.env.DEV && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              onClick={reset}
            >
              Reset
            </button>
          )}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col gap-2 px-4 pb-4 overflow-y-auto">
        {MISSIONS.map(({ id, icon: Icon, title, desc, hint, hintUrl }) => {
          const done = completed.includes(id)
          return (
            <div
              key={id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-md border transition-colors',
                done ? 'bg-muted/30 border-border/40 opacity-60' : 'bg-muted border-border',
              )}
            >
              <div className="mt-0.5 shrink-0">
                {done
                  ? <CheckCircle2 size={15} className="text-primary" />
                  : <Circle size={15} className="text-muted-foreground/40" />
                }
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={11} className={cn('shrink-0', done ? 'text-muted-foreground/40' : 'text-primary/70')} />
                  <span className={cn('text-[11px] font-semibold leading-tight', done && 'line-through text-muted-foreground/50')}>
                    {title}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed">{desc}</p>
                {hint && !done && (
                  hintUrl
                    ? (
                      <button
                        type="button"
                        onClick={() => void window.aether.tabs.create(hintUrl)}
                        className="text-[10px] text-primary/60 hover:text-primary font-mono transition-colors text-left"
                      >
                        {hint} →
                      </button>
                    )
                    : <span className="text-[10px] text-muted-foreground/50 font-mono">{hint}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
