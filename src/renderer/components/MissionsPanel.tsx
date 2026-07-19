import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../lib/cn'
import { MISSIONS } from '../lib/missions'
import { resolveMissionDesc } from '../lib/missionHelpers'
import { useMissionsStore } from '../store/missionsStore'
import { useAppStore } from '../store/appStore'

export function MissionsPanel(): JSX.Element {
  const { completed } = useMissionsStore()
  const shortcuts = useAppStore((s) => s.settings?.shortcuts)

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
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${(doneCount / total) * 100}%` }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 flex flex-col gap-2 px-4 pb-4 overflow-y-auto">
        {MISSIONS.map((mission) => {
          const { id, icon: Icon, iconClassName, title, hint, hintUrl } = mission
          const done = completed.includes(id)
          const desc = resolveMissionDesc(mission, shortcuts)
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
                  : <Circle size={15} className="text-muted-foreground" />
                }
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {/* Brand icons (Discord indigo, IG orange…) keep their own color in both
                      states; generic icons mirror the title's color exactly — foreground while
                      active, muted once done — instead of an unrelated default (e.g. violet). */}
                  <Icon
                    size={11}
                    className={cn('shrink-0', iconClassName ?? (done ? 'text-muted-foreground' : 'text-foreground'))}
                  />
                  <span className={cn('text-[11px] font-semibold leading-tight', done && 'line-through text-muted-foreground')}>
                    {title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                {hint && !done && (
                  hintUrl
                    ? (
                      <button
                        type="button"
                        onClick={() => void window.aether.tabs.create(hintUrl)}
                        className="text-[11px] text-primary hover:text-primary/80 font-mono transition-colors text-left"
                      >
                        {hint} →
                      </button>
                    )
                    : <span className="text-[11px] text-muted-foreground font-mono">{hint}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
