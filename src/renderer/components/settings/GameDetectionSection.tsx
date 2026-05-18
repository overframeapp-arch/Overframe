import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, FolderPlus, RotateCcw, X } from 'lucide-react'
import type { Settings } from '@shared/types'
import {
  DEFAULT_BLOCKED_PROCESSES,
  DEFAULT_GAME_PATH_HINTS,
  DEFAULT_NON_GAME_DIRS,
} from '@shared/gameDefaults'
import { useAppStore } from '../../store/appStore'
import { Section, Check, StringListEditor } from './Layout'

function normaliseProcess(input: string): string {
  return input.trim().toLowerCase().replace(/\.exe$/i, '')
}

function validateProcess(input: string): string | null {
  if (input.length < 2) return 'Process name is too short.'
  if (/[\\/\s]/.test(input)) return 'Process name must not contain slashes or spaces.'
  return null
}

function normalisePathFragment(input: string): string {
  let v = input.trim().toLowerCase().replace(/\//g, '\\')
  if (!v.startsWith('\\')) v = '\\' + v
  if (!v.endsWith('\\')) v = v + '\\'
  return v
}

export function GameDetectionSection(): JSX.Element {
  const { settings, setSettings } = useAppStore()
  const [excluded, setExcluded] = useState<string[]>([])
  const [customPaths, setCustomPaths] = useState<string[]>([])
  const [excludedFilter, setExcludedFilter] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    const [ex, cp] = await Promise.all([
      window.aether.profiles.getExcluded(),
      window.aether.profiles.getCustomGamePaths(),
    ])
    setExcluded(ex)
    setCustomPaths(cp)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const persist = async <K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> => {
    const next = await window.aether.settings.set(key, value)
    if (next) setSettings(next as Settings)
  }

  const handleUnexclude = async (name: string): Promise<void> => {
    await window.aether.profiles.unexclude(name)
    setExcluded((prev) => prev.filter((n) => n !== name))
  }

  const handleAddCustomPath = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const picked = await window.aether.system.pickFolder()
      if (!picked) return
      await window.aether.profiles.addCustomGamePath(picked)
      setCustomPaths((prev) => (prev.includes(picked) ? prev : [...prev, picked]))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveCustomPath = async (p: string): Promise<void> => {
    await window.aether.profiles.removeCustomGamePath(p)
    setCustomPaths((prev) => prev.filter((c) => c !== p))
  }

  const filteredExcluded = useMemo(
    () =>
      excluded.filter((n) =>
        excludedFilter.trim() === '' || n.toLowerCase().includes(excludedFilter.toLowerCase()),
      ),
    [excluded, excludedFilter],
  )

  const gamePathHints: string[] = settings?.gamePathHints ?? [...DEFAULT_GAME_PATH_HINTS]
  const nonGameDirs: string[] = settings?.nonGameDirs ?? [...DEFAULT_NON_GAME_DIRS]
  const blockedProcesses: string[] = settings?.blockedProcesses ?? [...DEFAULT_BLOCKED_PROCESSES]
  const launcherExceptions: string[] = settings?.launcherExceptions ?? []

  return (
    <div className="space-y-4" aria-labelledby="section-game-detection">

      {/* ── Automation ───────────────────────────────────────── */}
      <Section
        title="Automation"
        description="Control what Overframe does automatically when a game is detected."
      >
        <Check
          label="Auto-create profiles for new games"
          hint="When a game with no matching profile is detected, Overframe creates one automatically."
        >
          <input
            type="checkbox"
            checked={settings?.autoCreateProfiles !== false}
            onChange={(e) => void persist('autoCreateProfiles', e.target.checked)}
          />
        </Check>
        <Check
          label="Auto-switch to matching profile"
          hint="When a known game is running, Overframe switches to its profile automatically."
        >
          <input
            type="checkbox"
            checked={settings?.autoSwitchProfile !== false}
            onChange={(e) => void persist('autoSwitchProfile', e.target.checked)}
          />
        </Check>
      </Section>

      {/* ── Custom game folders ───────────────────────────────── */}
      <Section
        title="Custom game folders"
        description="Games installed outside a known store? Add their root folder — any game launched from inside will be auto-detected."
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground/60">
              Anything launched from inside is treated as a potential game.
            </span>
            <button
              type="button"
              aria-label="Add a game folder"
              disabled={busy}
              onClick={() => void handleAddCustomPath()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <FolderPlus size={11} />
              Add
            </button>
          </div>
          {customPaths.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/40 leading-snug italic">
              No custom folders added.
            </p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto pr-0.5" aria-label="Custom game folders">
              {customPaths.map((p) => (
                <li key={p} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 min-w-0">
                  <span title={p} className="flex-1 truncate text-[10px] text-muted-foreground font-mono min-w-0">
                    {p}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${p}`}
                    onClick={() => void handleRemoveCustomPath(p)}
                    className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <X size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* ── Excluded processes ───────────────────────────────── */}
      <Section
        title="Excluded processes"
        description="Games you've removed from auto-detection. Click the restore icon to allow auto-creation again."
      >
        {excluded.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/50 leading-snug">
            None yet — when you remove a game from auto-detection it appears here.
          </p>
        ) : (
          <>
            {excluded.length > 3 && (
              <input
                type="search"
                aria-label="Filter excluded processes"
                placeholder="Filter…"
                value={excludedFilter}
                onChange={(e) => setExcludedFilter(e.target.value)}
                className="w-full mb-1.5 rounded border border-border bg-transparent px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-[11px] text-muted-foreground">
                Excluded
                {excluded.length > 0 && (
                  <span className="ml-0.5 text-[9px] bg-muted rounded px-1 py-0.5 align-middle">
                    {excluded.length}
                  </span>
                )}
              </span>
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-0.5" aria-label="Excluded processes">
              {filteredExcluded.map((name) => (
                <li key={name} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 min-w-0">
                  <span className="flex-1 truncate text-[10px] text-muted-foreground font-mono min-w-0">
                    {name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Re-enable ${name}`}
                    title="Restore"
                    onClick={() => void handleUnexclude(name)}
                    className="shrink-0 text-muted-foreground/50 hover:text-emerald-400 transition-colors"
                  >
                    <RotateCcw size={11} />
                  </button>
                </li>
              ))}
              {filteredExcluded.length === 0 && excludedFilter.trim() !== '' && (
                <p className="text-[10px] text-muted-foreground/50">No matches.</p>
              )}
            </ul>
          </>
        )}
      </Section>

      {/* ── Advanced (collapsible) ────────────────────────────── */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer list-none select-none text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/70 hover:text-foreground transition-colors">
          <ChevronRight size={10} className="transition-transform duration-150 group-open:rotate-90 shrink-0" />
          Advanced detection settings
        </summary>

        <div className="mt-3 space-y-4">

          {/* Store paths */}
          <Section
            title="Recognized store paths"
            description="Path fragments that tell Overframe a folder contains store-installed games (e.g. \\steamapps\\). Remove one to stop detecting that store; add your own for any unlisted store."
          >
            <StringListEditor
              label="Store path fragments"
              hint="e.g. \\steamapps\\ identifies Steam games, \\epic games\\ for Epic. Remove to stop detecting that store."
              values={gamePathHints}
              placeholder="\\mygames\\"
              normalize={normalisePathFragment}
              validate={(v) => (v.length < 4 ? 'Path fragment is too short.' : null)}
              emptyText="No store fragments — only custom folders and fullscreen detection will be used."
              onReset={() => void persist('gamePathHints', [...DEFAULT_GAME_PATH_HINTS])}
              onChange={(next) => void persist('gamePathHints', next)}
            />
          </Section>

          {/* System directories */}
          <Section
            title="System directories"
            description="Path fragments that mark a location as a system folder, not a game install. Remove an entry if you actually have games installed there."
          >
            <StringListEditor
              label="Excluded path fragments"
              hint="e.g. \\appdata\\local\\ prevents AppData apps from being detected as games. Remove to allow detection in that folder."
              values={nonGameDirs}
              placeholder="\\my apps\\"
              normalize={normalisePathFragment}
              validate={(v) => (v.length < 4 ? 'Path fragment is too short.' : null)}
              emptyText="No excluded paths — every location is treated as a potential game install."
              onReset={() => void persist('nonGameDirs', [...DEFAULT_NON_GAME_DIRS])}
              onChange={(next) => void persist('nonGameDirs', next)}
            />
          </Section>

          {/* Blocked processes */}
          <Section
            title="Blocked processes"
            description="Process names that are never auto-detected as games regardless of where they run from. 'electron' and 'overframe' are always blocked."
          >
            <StringListEditor
              label="Blocked process names"
              hint="Lowercase names without .exe — e.g. 'discord', 'obs64'. Remove an entry to allow that process to be auto-detected as a game."
              values={blockedProcesses}
              placeholder="obs64"
              normalize={normaliseProcess}
              validate={validateProcess}
              emptyText="No blocked processes — all running processes are candidates for auto-detection."
              onReset={() => void persist('blockedProcesses', [...DEFAULT_BLOCKED_PROCESSES])}
              onChange={(next) => void persist('blockedProcesses', next)}
            />
          </Section>

          {/* Launcher exceptions */}
          <Section
            title="Launcher exceptions"
            description="Some games have 'launcher', 'helper' or 'agent' in their process name and get incorrectly filtered out. Add them here to force detection."
          >
            <StringListEditor
              label="Exception names"
              hint="e.g. if 'mygamelauncher' is a real game exe, add it here to bypass the launcher filter."
              values={launcherExceptions}
              placeholder="mygamelauncher"
              normalize={normaliseProcess}
              validate={validateProcess}
              emptyText="None — the launcher filter skips obvious helpers (*launcher, *updater, *service…)."
              onChange={(next) => void persist('launcherExceptions', next)}
            />
          </Section>

        </div>
      </details>

    </div>
  )
}
