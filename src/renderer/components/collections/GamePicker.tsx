import { Gamepad2, Loader2, Search } from 'lucide-react'
import { useGameDetect, type VisibleGame } from '../../hooks/useGameDetect'
import { ProfileIcon } from '../ProfileIcon'
import { InfoTip } from './atoms'

interface GamePickerProps {
  games: VisibleGame[]
  onPick: (game: VisibleGame) => void
}

export function GamePicker({ games, onPick }: GamePickerProps): JSX.Element {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-background px-3 py-5 text-center shadow-lg">
        <Gamepad2 size={18} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-[11px] text-muted-foreground">No running games detected.</p>
      </div>
    )
  }
  return (
    <div className="flex max-h-56 flex-col overflow-y-auto rounded-md border border-border bg-background shadow-lg">
      {games.map((g) => {
        const label = g.displayName || g.windowTitle || g.processName
        return (
          <button
            key={g.exePath}
            type="button"
            onClick={() => onPick(g)}
            className="flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors border-b border-border/30 last:border-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ProfileIcon iconUrl={g.iconDataUrl || undefined} name={label} size={22} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[12px] font-medium text-foreground">{label}</span>
              <span className="truncate text-[11px] text-muted-foreground">{g.processName.toLowerCase()}.exe</span>
            </div>
            {g.isFullscreen && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                Fullscreen
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface ProcessNamesFieldProps {
  id: string
  value: string
  onChange: (v: string) => void
  /** Called when a game is picked from the detector, with the full game object. */
  onPickGame?: (game: VisibleGame) => void
}

export function ProcessNamesField({ id, value, onChange, onPickGame }: ProcessNamesFieldProps): JSX.Element {
  const { visibleGames, showPicker, detectLoading, detect, pickGame } = useGameDetect()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] text-muted-foreground flex items-center">
          Process names
          <InfoTip text="Comma-separated .exe names (e.g. Game.exe). Overframe switches to this profile automatically when one of these processes becomes active." />
        </label>
        <button type="button" aria-label="Detect running games" onClick={() => void detect()} disabled={detectLoading}
          className="flex items-center gap-1 h-5 px-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">
          {detectLoading ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Search size={10} aria-hidden="true" />}
          Detect
        </button>
      </div>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Game.exe, Game2.exe"
        className="h-7 px-2.5 rounded text-[12px] bg-input border border-border focus:outline-none focus:border-primary/60" />
      {showPicker && (
        <GamePicker
          games={visibleGames}
          onPick={(g) => {
            onChange(pickGame(g, value))
            onPickGame?.(g)
          }}
        />
      )}
    </div>
  )
}
