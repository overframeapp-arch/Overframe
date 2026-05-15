import { Loader2, Search } from 'lucide-react'
import { useGameDetect, type VisibleGame } from '../../hooks/useGameDetect'
import { InfoTip } from './atoms'

interface GamePickerProps {
  games: { processName: string; exePath: string; displayName: string }[]
  onPick: (game: { processName: string; exePath: string; displayName: string }) => void
}

export function GamePicker({ games, onPick }: GamePickerProps): JSX.Element {
  return (
    <div className="flex flex-col rounded border border-border bg-background shadow-md overflow-hidden">
      {games.length === 0
        ? <p className="px-3 py-2 text-[11px] text-muted-foreground">No running games detected.</p>
        : games.map((g) => (
          <button key={g.exePath} type="button" onClick={() => onPick(g)}
            className="flex items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
            <span className="flex-1 truncate">{g.displayName || g.processName}</span>
            <span className="text-muted-foreground/60 text-[10px] shrink-0">{g.processName.toLowerCase()}</span>
          </button>
        ))
      }
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
          className="flex items-center gap-1 h-5 px-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">
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
