import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Heart, Palette, Keyboard, Gamepad2, Globe, Cpu, Info, ExternalLink, Mail, Trash2, FolderOpen } from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'
import type { Settings } from '@shared/types'
import { DEFAULT_SHORTCUTS, MIN_OPACITY } from '@shared/types'
import type { ShortcutId, Shortcuts } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { Button } from './ui/Button'
import { Slider } from './ui/Slider'
import { Check, Field, Section } from './settings/Layout'
import { ShortcutsSection } from './settings/ShortcutsSection'
import { GameDetectionSection } from './settings/GameDetectionSection'
import { cn } from '../lib/cn'

type TabId = 'appearance' | 'shortcuts' | 'detection' | 'system' | 'about'

interface TabDef {
  id: TabId
  label: string
  Icon: typeof Palette
}

const TABS: readonly TabDef[] = [
  { id: 'appearance', label: 'Appearance',     Icon: Palette },
  { id: 'shortcuts',  label: 'Shortcuts',      Icon: Keyboard },
  { id: 'detection',  label: 'Game detection', Icon: Gamepad2 },
  { id: 'system',     label: 'System',         Icon: Cpu },
  { id: 'about',      label: 'About',          Icon: Info },
] as const

export function SettingsPanel(): JSX.Element {
  const { settings, setSettings, activeProfile, setActiveProfile } = useAppStore()
  const [active, setActive] = useState<TabId>('appearance')
  const [version, setVersion] = useState('')
  const [liveOpacity, setLiveOpacity] = useState(activeProfile?.opacity ?? 1)

  useEffect(() => {
    void window.aether.system.getVersion().then(setVersion).catch(() => { /* non-critical */ })
  }, [])
  useEffect(() => {
    setLiveOpacity(activeProfile?.opacity ?? 1)
  }, [activeProfile?.opacity])
  useEffect(() => window.aether.on.opacityChanged(setLiveOpacity), [])

  const updateSetting = useMemo(
    () =>
      async <K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> => {
        const next = await window.aether.settings.set(key, value)
        if (next) setSettings(next as Settings)
      },
    [setSettings],
  )

  if (!settings) return <div className="p-4 text-xs text-muted-foreground">Loading…</div>

  const setOpacity = async (val: number): Promise<void> => {
    if (!activeProfile) return
    setLiveOpacity(val)
    await window.aether.overlay.setOpacity(val)
    setActiveProfile({ ...activeProfile, opacity: val })
  }

  const shortcuts: Shortcuts = settings.shortcuts ?? DEFAULT_SHORTCUTS

  const handleShortcutChange = async (id: ShortcutId, value: string | null): Promise<void> => {
    const next: Shortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts, [id]: value }
    await updateSetting('shortcuts', next)
  }

  const resetAllShortcuts = async (): Promise<void> => {
    await updateSetting('shortcuts', DEFAULT_SHORTCUTS)
  }

  // Roving tabindex / arrow-key nav for the sidebar (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const idx = TABS.findIndex((t) => t.id === active)
    if (idx < 0) return
    let next = idx
    if (e.key === 'ArrowDown') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowUp') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setActive(TABS[next].id)
  }

  return (
    <div className="flex h-full bg-background text-foreground" role="dialog" aria-label="Settings">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <nav
        role="tablist"
        aria-orientation="vertical"
        aria-label="Settings categories"
        onKeyDown={onTabKeyDown}
        className="shrink-0 w-[150px] border-r border-border bg-muted/30 py-2 px-1.5 flex flex-col gap-0.5 overflow-y-auto"
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
              )}
            >
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Panels ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className="p-4 space-y-4"
        >
          {active === 'appearance' && (
            <Section
              title="Appearance"
              description="Visual settings for the active profile."
            >
              <Field
                label={`Opacity — ${Math.round(liveOpacity * 100)}%`}
                hint="Adjust the overlay's transparency. Use the opacity shortcuts to change this in-game."
              >
                <Slider
                  value={[liveOpacity]}
                  min={MIN_OPACITY}
                  max={1}
                  step={0.05}
                  onValueChange={(v) => void setOpacity(v[0])}
                />
              </Field>
              <Check
                label="Show memory usage in the tab bar"
                hint="Displays a live memory-usage widget. Click it to see per-tab breakdown."
              >
                <input
                  type="checkbox"
                  checked={settings.showMemoryUsage ?? false}
                  onChange={(e) => void updateSetting('showMemoryUsage', e.target.checked)}
                />
              </Check>
            </Section>
          )}

          {active === 'shortcuts' && (
            <ShortcutsSection
              shortcuts={shortcuts}
              onChange={handleShortcutChange}
              onReset={resetAllShortcuts}
            />
          )}

          {active === 'detection' && <GameDetectionSection />}

          {active === 'system' && (
            <>
              <Section
                title="System"
                description="Operating-system integration and performance trade-offs."
              >
                <Check
                  label="Launch at Windows startup"
                  hint="Starts Overframe minimised in the tray when Windows boots."
                >
                  <input
                    type="checkbox"
                    checked={settings.startWithWindows}
                    onChange={(e) => void updateSetting('startWithWindows', e.target.checked)}
                  />
                </Check>
                <Check
                  label="Performance mode — fully unload tabs when overlay is hidden"
                  hint="Releases ~all memory used by hidden tabs at the cost of a brief reload when you re-open the overlay."
                >
                  <input
                    type="checkbox"
                    checked={settings.performanceMode ?? false}
                    onChange={(e) => void updateSetting('performanceMode', e.target.checked)}
                  />
                </Check>
              </Section>

              <Section
                title="Folders"
                description="Open key directories in Windows Explorer."
              >
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openFolder('userData')}
                    className="justify-start gap-2"
                  >
                    <FolderOpen size={11} /> User data — profiles, collections, settings
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openFolder('app')}
                    className="justify-start gap-2"
                  >
                    <FolderOpen size={11} /> Installation folder
                  </Button>
                </div>
              </Section>

              <Section
                title="Reset"
                description="Erase all profiles, collections, bookmarks, shortcuts and settings."
              >
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void window.aether.system.resetData()}
                  className="justify-start gap-2"
                >
                  <Trash2 size={11} /> Reset all data &amp; relaunch
                </Button>
              </Section>

              <Section
                title="Uninstall"
                description="Permanently remove Overframe from your system."
              >
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void window.aether.system.uninstall()}
                  className="justify-start gap-2"
                >
                  <Trash2 size={11} /> Uninstall Overframe
                </Button>
              </Section>
            </>
          )}

          {active === 'about' && (
            <div className="space-y-4">
              <Section title="Overframe">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A lightweight overlay browser for gamers. Browse guides, wikis and streams without leaving your game.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Version <span className="text-foreground font-medium">{version || '\u2014'}</span>
                  <span className="text-muted-foreground/40"> · </span>
                  MIT License
                </p>
              </Section>

              <Section title="Community &amp; support">
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create('https://discord.gg/A2KPZn8WNd')}
                    className="justify-start gap-2 hover:border-indigo-500/50 hover:text-indigo-400"
                  >
                    <DiscordIcon size={11} /> Discord &mdash; bugs, ideas &amp; chat
                    <ExternalLink size={10} className="ml-auto text-muted-foreground/40" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create('https://overframe.app')}
                    className="justify-start gap-2"
                  >
                    <Globe size={11} /> overframe.app
                    <ExternalLink size={10} className="ml-auto text-muted-foreground/40" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openExternal('mailto:contact@overframe.app')}
                    className="justify-start gap-2"
                  >
                    <Mail size={11} /> contact@overframe.app
                    <ExternalLink size={10} className="ml-auto text-muted-foreground/40" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create('https://ko-fi.com/overframe')}
                    className="justify-start gap-2 hover:border-pink-500/50 hover:text-pink-400"
                  >
                    <Heart size={11} /> Support development on Ko-fi
                    <ExternalLink size={10} className="ml-auto text-muted-foreground/40" />
                  </Button>
                </div>
              </Section>

              <Section title="Legal">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No analytics, no telemetry, no account required. All data stays on your machine.
                  Provided as-is under the MIT license.
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void window.aether.tabs.create('https://overframe.app/privacy')}
                    className="justify-start gap-1.5 text-muted-foreground"
                  >
                    <ExternalLink size={10} /> Privacy policy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void window.aether.tabs.create('https://overframe.app/terms')}
                    className="justify-start gap-1.5 text-muted-foreground"
                  >
                    <ExternalLink size={10} /> Terms of use
                  </Button>
                </div>
              </Section>

              {import.meta.env.DEV && (
                <Section title="Developer">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void window.aether.system.devStoreReset()}
                  >
                    Reset store &amp; relaunch
                  </Button>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
