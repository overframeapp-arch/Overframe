import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, FolderPlus, RotateCcw, X } from 'lucide-react'
import type { Settings } from '@shared/types'
import {
  DEFAULT_BLOCKED_PROCESSES,
  DEFAULT_GAME_PATH_HINTS,
  DEFAULT_NON_GAME_DIRS,
  LAUNCHER_NAME_PATTERNS,
} from '@shared/gameDefaults'
import { useAppStore } from '../../store/appStore'
import { Section, Check, StringListEditor, ChipList } from './Layout'

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

/** Native .exe file picker — returns just the filename (normalize() strips .exe/case). */
async function browseForExecutableName(): Promise<string | null> {
  const picked = await window.aether.system.pickExecutable()
  return picked ? (picked.split(/[\\/]/).pop() ?? picked) : null
}

/** Native folder picker — returns just the trailing folder name (normalize() wraps it in \'s). */
async function browseForFolderFragment(): Promise<string | null> {
  const picked = await window.aether.system.pickFolder()
  if (!picked) return null
  const parts = picked.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}

export function GameDetectionSection(): JSX.Element {
  const { settings, setSettings } = useAppStore()
  const [excluded, setExcluded] = useState<string[]>([])
  const [customPaths, setCustomPaths] = useState<string[]>([])
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

  const gamePathHints: string[] = settings?.gamePathHints ?? [...DEFAULT_GAME_PATH_HINTS]
  const nonGameDirs: string[] = settings?.nonGameDirs ?? [...DEFAULT_NON_GAME_DIRS]
  const blockedProcesses: string[] = settings?.blockedProcesses ?? [...DEFAULT_BLOCKED_PROCESSES]
  const launcherPatterns: string[] = settings?.launcherPatterns ?? [...LAUNCHER_NAME_PATTERNS]
  const launcherExceptions: string[] = settings?.launcherExceptions ?? []

  return (
    <div className="space-y-6" aria-labelledby="section-game-detection">

      {/* ── Automation ───────────────────────────────────────── */}
      <Section
        title="Automation"
        description="What Overframe does automatically when a game starts."
      >
        <Check
          label="Auto-create profiles for new games"
        >
          <input
            type="checkbox"
            checked={settings?.autoCreateProfiles !== false}
            onChange={(e) => void persist('autoCreateProfiles', e.target.checked)}
          />
        </Check>
        <Check
          label="Auto-switch to matching profile"
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
        description="Add folders where you install games outside Steam or Epic."
      >
        <div>
          <button
            type="button"
            aria-label="Add a game folder"
            disabled={busy}
            onClick={() => void handleAddCustomPath()}
            className="flex items-center gap-1 mb-1.5 rounded border border-border px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 transition-colors"
          >
            <FolderPlus size={11} />
            Add folder
          </button>
          {customPaths.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-snug">
              No custom folders added.
            </p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto pr-0.5" aria-label="Custom game folders">
              {customPaths.map((p) => (
                <li key={p} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1 min-w-0">
                  <span title={p} className="flex-1 truncate text-[11px] text-foreground/80 font-mono min-w-0">
                    {p}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${p}`}
                    onClick={() => void handleRemoveCustomPath(p)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
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
        description="Games you've told Overframe to ignore."
      >
        {excluded.length === 0 ? (
          <p className="text-xs text-muted-foreground leading-snug">
            Nothing here yet.
          </p>
        ) : (
          <ChipList
            values={excluded}
            ariaLabel="Excluded processes"
            filterPlaceholder="Filter…"
            renderChip={(name) => (
              <>
                <span title={name} className="truncate max-w-[180px]">{name}</span>
                <button
                  type="button"
                  aria-label={`Re-enable ${name}`}
                  title="Restore"
                  onClick={() => void handleUnexclude(name)}
                  className="shrink-0 text-muted-foreground hover:text-emerald-400 transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
              </>
            )}
          />
        )}
      </Section>

      {/* ── Advanced (collapsible) ────────────────────────────── */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer list-none select-none text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight size={10} className="transition-transform duration-150 group-open:rotate-90 shrink-0" />
          Advanced detection settings
        </summary>

        <div className="mt-4 space-y-6">

          {/* Store paths */}
          <Section
            title="Recognized store paths"
            description="Folder names that identify a game store (e.g. \\steamapps\\)."
          >
            <StringListEditor
              label="Store path fragments"
              hint="e.g. \\steamapps\\ for Steam, \\epic games\\ for Epic."
              values={gamePathHints}
              placeholder="\\mygames\\"
              normalize={normalisePathFragment}
              validate={(v) => (v.length < 4 ? 'Path fragment is too short.' : null)}
              emptyText="No store fragments. Only custom folders and fullscreen detection will be used."
              onReset={() => void persist('gamePathHints', [...DEFAULT_GAME_PATH_HINTS])}
              onChange={(next) => void persist('gamePathHints', next)}
              onBrowse={browseForFolderFragment}
              browseLabel="Browse for a store folder"
            />
          </Section>

          {/* System directories */}
          <Section
            title="System directories"
            description="Folders skipped when looking for games."
          >
            <StringListEditor
              label="Excluded path fragments"
              hint="e.g. \\appdata\\local\\ stops apps in AppData from being detected as games."
              values={nonGameDirs}
              placeholder="\\my apps\\"
              normalize={normalisePathFragment}
              validate={(v) => (v.length < 4 ? 'Path fragment is too short.' : null)}
              emptyText="No excluded paths. Every location is treated as a potential game install."
              onReset={() => void persist('nonGameDirs', [...DEFAULT_NON_GAME_DIRS])}
              onChange={(next) => void persist('nonGameDirs', next)}
              onBrowse={browseForFolderFragment}
              browseLabel="Browse for a folder to exclude"
            />
          </Section>

          {/* Blocked processes */}
          <Section
            title="Blocked processes"
            description="Apps never treated as a game."
          >
            <StringListEditor
              label="Blocked process names"
              hint="e.g. 'discord', 'obs64'. No .exe needed."
              values={blockedProcesses}
              placeholder="obs64"
              normalize={normaliseProcess}
              validate={validateProcess}
              emptyText="No blocked processes. All running processes are candidates for auto-detection."
              onReset={() => void persist('blockedProcesses', [...DEFAULT_BLOCKED_PROCESSES])}
              onChange={(next) => void persist('blockedProcesses', next)}
              onBrowse={browseForExecutableName}
              browseLabel="Browse for an .exe to block"
            />
          </Section>

          {/* Launcher keywords */}
          <Section
            title="Launcher keywords"
            description="Apps whose process name contains one of these words are treated as utilities and skipped, unless listed as an exception below."
          >
            <StringListEditor
              label="Excluded keywords"
              hint="Partial match, case-insensitive — e.g. 'launcher' matches 'GameLauncher.exe'."
              values={launcherPatterns}
              placeholder="launcher"
              normalize={normaliseProcess}
              validate={validateProcess}
              emptyText="No keywords. Nothing is skipped based on its name alone."
              onReset={() => void persist('launcherPatterns', [...LAUNCHER_NAME_PATTERNS])}
              onChange={(next) => void persist('launcherPatterns', next)}
            />
          </Section>

          {/* Launcher exceptions */}
          <Section
            title="Launcher exceptions"
            description="Force detection for a specific game skipped by the keywords above."
          >
            <StringListEditor
              label="Exception names"
              hint="The exact process name, without .exe — e.g. 'mygamelauncher'."
              values={launcherExceptions}
              placeholder="mygamelauncher"
              normalize={normaliseProcess}
              validate={validateProcess}
              emptyText="No exceptions yet."
              onChange={(next) => void persist('launcherExceptions', next)}
              onBrowse={browseForExecutableName}
              browseLabel="Browse for the game's .exe"
            />
          </Section>

        </div>
      </details>

    </div>
  )
}
