import type { GameUndetectedPayload } from '@shared/types'
import { AlertCircle, Ban } from 'lucide-react'

interface Props {
  data: GameUndetectedPayload
}

export function GameUndetectedPopup({ data }: Props): JSX.Element {
  const { candidates } = data

  // Best display name: prefer the first candidate with a real displayName, else processName
  const firstName =
    candidates.find((c) => c.displayName && c.displayName !== c.processName)?.displayName ??
    candidates[0]?.displayName ??
    candidates[0]?.processName ??
    'Unknown game'

  const extra = candidates.length > 1 ? ` +${candidates.length - 1}` : ''
  const processName = candidates[0]?.processName ?? ''

  const handleCreate = (): void => {
    window.aether.overlay.show()
    void window.aether.popup.openPanel('profiles', undefined, { name: firstName, processName })
    window.aether.popup.closeNotification()
  }

  const handleBlock = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (processName) void window.aether.profiles.exclude(processName)
    window.aether.popup.closeNotification()
  }

  return (
    <div
      className={[
        'h-full flex items-center gap-2.5 px-3',
        'rounded-lg select-none',
        'bg-background/95 border border-amber-500/40 shadow-xl',
      ].join(' ')}
    >
      {/* Left — clickable zone: open overlay + create profile */}
      <button
        type="button"
        onClick={handleCreate}
        aria-label={`Unrecognized game: ${firstName}${extra}. Create a profile.`}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
      >
        <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
          <AlertCircle size={16} aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="text-[10px] text-amber-400/80 leading-none mb-0.5">
            Unrecognized game
          </span>
          <span className="text-[13px] font-semibold text-foreground truncate leading-tight">
            {firstName}{extra}
          </span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors pr-1">
          Create profile →
        </span>
      </button>

      {/* Right — block button */}
      <button
        type="button"
        onClick={handleBlock}
        aria-label={`Block detection of ${processName}`}
        title="Block"
        className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
      >
        <Ban size={13} aria-hidden="true" />
      </button>
    </div>
  )
}
