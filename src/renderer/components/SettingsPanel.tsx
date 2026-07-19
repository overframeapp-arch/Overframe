import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Palette, Keyboard, Gamepad2, Globe, Cpu, Info, Terminal, ExternalLink, Mail, Trash2, FolderOpen, TriangleAlert } from 'lucide-react'
import { DiscordIcon } from './icons/DiscordIcon'
import { IGLogoIcon } from './icons/IGLogoIcon'
import { KoFiIcon } from './icons/PlatformIcons'
import type { Settings } from '@shared/types'
import { DEFAULT_SHORTCUTS, MIN_OPACITY, DEFAULT_HOMEPAGE, DEFAULT_PROTECTED_DOMAINS, HOMEPAGE_PRESETS, SEARCH_ENGINES } from '@shared/types'
import type { SearchEngineId } from '@shared/types'
import type { ShortcutId, Shortcuts } from '@shared/types'
import { localizeIGUrl, IG_HOME } from '@shared/ig-affiliate'
import { useAppStore } from '../store/appStore'
import { useMissionsStore } from '../store/missionsStore'
import { useDiscordUrl } from '../hooks/useDiscordUrl'
import { Button } from './ui/Button'
import { Slider } from './ui/Slider'
import { Check, Field, Section, StringListEditor } from './settings/Layout'
import { ShortcutsSection } from './settings/ShortcutsSection'
import { GameDetectionSection } from './settings/GameDetectionSection'
import { cn } from '../lib/cn'

function isValidDomain(domain: string): boolean {
  return /^[^\s/]+\.[a-z]{2,}/i.test(domain.trim())
}

type TabId = 'appearance' | 'browser' | 'shortcuts' | 'detection' | 'system' | 'about' | 'developer'

const HOMEPAGE_TO_ENGINE: Partial<Record<string, SearchEngineId>> = {
  'https://www.google.com':   'google',
  'https://duckduckgo.com':   'duckduckgo',
  'https://www.bing.com':     'bing',
  'https://search.brave.com': 'brave',
}

interface TabDef {
  id: TabId
  label: string
  Icon: typeof Palette
}

const ALL_TABS: readonly TabDef[] = [
  { id: 'appearance', label: 'Appearance',     Icon: Palette },
  { id: 'browser',    label: 'Browser',        Icon: Globe },
  { id: 'shortcuts',  label: 'Shortcuts',      Icon: Keyboard },
  { id: 'detection',  label: 'Game detection', Icon: Gamepad2 },
  { id: 'system',     label: 'System',         Icon: Cpu },
  { id: 'about',      label: 'About',          Icon: Info },
  { id: 'developer',  label: 'Developer',      Icon: Terminal },
] as const

// Dev-only tab, computed once at module load (import.meta.env.DEV is a build-time
// constant) so the sidebar list and the roving-tabindex keyboard nav never disagree
// about which tabs exist.
const TABS: readonly TabDef[] = import.meta.env.DEV ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'developer')

export function SettingsPanel(): JSX.Element {
  const { settings, setSettings, activeProfile, setActiveProfile } = useAppStore()
  const resetMissions = useMissionsStore((s) => s.reset)
  const discordUrl = useDiscordUrl()
  const [active, setActive] = useState<TabId>('appearance')
  const [version, setVersion] = useState('')
  const [liveOpacity, setLiveOpacity] = useState(activeProfile?.opacity ?? 1)
  const [homepageInput, setHomepageInput] = useState(settings?.homepageUrl ?? DEFAULT_HOMEPAGE)
  const [homepageError, setHomepageError] = useState(false)

  useEffect(() => {
    void window.aether.system.getVersion().then(setVersion).catch(() => { /* non-critical */ })
  }, [])
  useEffect(() => {
    setHomepageInput(settings?.homepageUrl ?? DEFAULT_HOMEPAGE)
  }, [settings?.homepageUrl])
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

  const saveHomepage = async (url: string): Promise<void> => {
    const domain = url.replace(/^https?:\/\//i, '').trim()
    if (!domain) { setHomepageInput(settings?.homepageUrl ?? DEFAULT_HOMEPAGE); setHomepageError(false); return }
    if (!isValidDomain(domain)) { setHomepageError(true); return }
    setHomepageError(false)
    const next = await window.aether.settings.set('homepageUrl', 'https://' + domain)
    if (next) { setSettings(next as Settings); setHomepageInput('https://' + domain) }
    else setHomepageInput(settings?.homepageUrl ?? DEFAULT_HOMEPAGE)
  }

  const selectHomepagePreset = async (url: string): Promise<void> => {
    setHomepageInput(url)
    await saveHomepage(url)
    const engineId = HOMEPAGE_TO_ENGINE[url]
    if (engineId && SEARCH_ENGINES[engineId]) {
      const next = await window.aether.settings.set('searchEngine', engineId)
      if (next) setSettings(next as Settings)
    }
  }

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
    let next: number
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
          className="px-6 py-5 space-y-6 max-w-[640px] mx-auto"
        >
          {active === 'appearance' && (
            <Section title="Appearance">
              <Field
                label={`Opacity: ${Math.round(liveOpacity * 100)}%`}
                hint="How see-through the overlay is. You can also use Ctrl+Shift+↑ and Ctrl+Shift+↓ while in-game."
              >
                <div className="max-w-[280px]">
                  <Slider
                    value={[liveOpacity]}
                    min={MIN_OPACITY}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => void setOpacity(v[0])}
                  />
                </div>
              </Field>
              <Check
                label="Show memory usage in the tab bar"
                hint="Click it for a breakdown per tab."
              >
                <input
                  type="checkbox"
                  checked={settings.showMemoryUsage ?? false}
                  onChange={(e) => void updateSetting('showMemoryUsage', e.target.checked)}
                />
              </Check>
            </Section>
          )}

          {active === 'browser' && (
            <>
              {/* ── Homepage ──────────────────────────────────── */}
              <Section
                title="Homepage"
                description="The page that opens when you create a new tab."
              >
                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {HOMEPAGE_PRESETS.map(({ label, url }) => {
                      const checked = (settings.homepageUrl ?? DEFAULT_HOMEPAGE) === url
                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => void selectHomepagePreset(url)}
                          className={cn(
                            'flex items-center justify-center h-8 rounded border text-xs font-medium transition-colors',
                            checked
                              ? 'border-primary/60 bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <Field label="Custom URL">
                    <div className="flex gap-2 items-start">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className={cn(
                          'flex h-8 rounded border bg-input text-xs overflow-hidden focus-within:ring-1',
                          homepageError
                            ? 'border-destructive focus-within:ring-destructive'
                            : 'border-border focus-within:ring-ring',
                        )}>
                          <span className="flex items-center px-2 text-muted-foreground bg-muted/40 border-r border-border/60 select-none shrink-0">
                            https://
                          </span>
                          <input
                            type="text"
                            value={homepageInput.replace(/^https?:\/\//i, '')}
                            onChange={(e) => { setHomepageError(false); setHomepageInput('https://' + e.target.value) }}
                            onBlur={() => void saveHomepage(homepageInput)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                            placeholder="example.com"
                            spellCheck={false}
                            aria-invalid={homepageError}
                            aria-describedby={homepageError ? 'homepage-url-error' : undefined}
                            className="flex-1 min-w-0 bg-transparent px-2 text-foreground placeholder:text-muted-foreground focus:outline-none"
                          />
                        </div>
                        {homepageError && (
                          <p id="homepage-url-error" role="alert" className="text-[11px] text-destructive">
                            Enter a valid domain, e.g. example.com
                          </p>
                        )}
                      </div>
                      {homepageInput !== (settings.homepageUrl ?? DEFAULT_HOMEPAGE) && (
                        <button
                          type="button"
                          onClick={() => void saveHomepage(homepageInput)}
                          className="h-8 px-3 rounded border border-primary/60 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          Save
                        </button>
                      )}
                    </div>
                  </Field>
                </div>
              </Section>

              {/* ── Browsing toggles ─────────────────────────── */}
              <Section title="Browsing">
                <Check
                  label="Enable dark mode for websites"
                  hint="Sites that support it follow the overlay's dark theme."
                >
                  <input
                    type="checkbox"
                    checked={settings.applyDarkMode ?? true}
                    onChange={(e) => void updateSetting('applyDarkMode', e.target.checked)}
                  />
                </Check>
                <Check
                  label="Show Instant Gaming deal cards"
                  hint="Overframe is affiliated with Instant Gaming — a small deal card may appear occasionally while browsing."
                >
                  <input
                    type="checkbox"
                    checked={settings.showIGPromo ?? true}
                    onChange={(e) => void updateSetting('showIGPromo', e.target.checked)}
                  />
                </Check>
                {/* Ad blocking is dead until further notice: uBlock Origin is a Manifest V2
                    extension and the WebView2 runtime (Edge 150+) permanently removed MV2 —
                    install/enable still report success but the extension never runs. Showing a
                    live toggle here would lie to the user. See TASKS.md [BUG] for the fix paths. */}
                <Check
                  label="Block ads &amp; cookie banners"
                  hint="Temporarily unavailable."
                >
                  <input type="checkbox" checked={false} disabled readOnly />
                </Check>
                <div className="flex items-start gap-2 rounded border border-amber-500/25 bg-amber-500/10 px-2.5 py-2">
                  <TriangleAlert size={13} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                  <p className="text-[11px] text-amber-400 leading-snug">
                    A Microsoft Edge update switched off the ad blocker Overframe was using — that
                    affects every app built on Edge, not just Overframe. Edge&apos;s built-in tracker
                    protection still runs, but ads are no longer blocked until we ship a replacement.
                  </p>
                </div>
              </Section>

              {/* ── Protected tabs ───────────────────────────────── */}
              <Section
                title="Protected tabs"
                description="These sites stay open when you switch profiles or hide the overlay."
              >
                <StringListEditor
                  label="Protected domains"
                  hint="e.g. 'zoom.us', 'meet.google.com'."
                  values={settings.protectedDomains ?? DEFAULT_PROTECTED_DOMAINS}
                  placeholder="example.com"
                  normalize={(v) => v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                  validate={(v) => v.includes('.') ? null : 'Enter a valid domain (e.g. discord.com)'}
                  emptyText="No protected tabs. All tabs close on profile switch."
                  onReset={() => void updateSetting('protectedDomains', DEFAULT_PROTECTED_DOMAINS)}
                  onChange={(next) => void updateSetting('protectedDomains', next)}
                />
              </Section>

            </>
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
              <Section title="System">
                <Check
                  label="Launch at Windows startup"
                  hint="Starts Overframe in the tray when Windows boots."
                >
                  <input
                    type="checkbox"
                    checked={settings.startWithWindows}
                    onChange={(e) => void updateSetting('startWithWindows', e.target.checked)}
                  />
                </Check>
                <Check
                  label="Free up memory when the overlay is hidden"
                  hint="Tabs reload when you reopen the overlay."
                >
                  <input
                    type="checkbox"
                    checked={settings.performanceMode ?? false}
                    onChange={(e) => void updateSetting('performanceMode', e.target.checked)}
                  />
                </Check>
              </Section>

              <Section title="Folders">
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openFolder('userData')}
                    className="justify-start gap-2"
                  >
                    <FolderOpen size={11} /> User data: profiles, collections, settings
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openFolder('app')}
                    className="justify-start gap-2"
                  >
                    <FolderOpen size={11} /> Installation folder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openFolder('logs')}
                    className="justify-start gap-2"
                  >
                    <FolderOpen size={11} /> Crash logs
                  </Button>
                </div>
              </Section>

              <Section title="Danger zone">
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void window.aether.system.resetData()}
                    className="justify-start gap-2"
                  >
                    <Trash2 size={11} /> Reset all data &amp; relaunch
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void window.aether.system.uninstall()}
                    className="justify-start gap-2"
                  >
                    <Trash2 size={11} /> Uninstall Overframe
                  </Button>
                </div>
              </Section>
            </>
          )}

          {active === 'about' && (
            <div className="space-y-6">
              <Section title="Overframe">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A lightweight overlay browser for gamers. Browse guides, wikis and streams without leaving your game.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Version <span className="text-foreground font-medium">{version || '\u2014'}</span>
                  <span className="text-muted-foreground"> · </span>
                  MIT License
                </p>
              </Section>

              <Section title="Community &amp; support">
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create(discordUrl)}
                    className="justify-start gap-2 hover:border-indigo-500/50 hover:text-indigo-400"
                  >
                    <DiscordIcon size={11} /> Discord &mdash; bugs, ideas &amp; chat
                    <ExternalLink size={10} className="ml-auto text-muted-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create('https://overframe.app')}
                    className="justify-start gap-2"
                  >
                    <Globe size={11} /> overframe.app
                    <ExternalLink size={10} className="ml-auto text-muted-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.system.openExternal('mailto:contact@overframe.app')}
                    className="justify-start gap-2"
                  >
                    <Mail size={11} /> contact@overframe.app
                    <ExternalLink size={10} className="ml-auto text-muted-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create(localizeIGUrl(IG_HOME))}
                    className="justify-start gap-2 hover:border-ig-orange/50 hover:text-ig-orange"
                  >
                    <IGLogoIcon size={11} mono /> Instant Gaming &mdash; games at a discount
                    <ExternalLink size={10} className="ml-auto text-muted-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void window.aether.tabs.create('https://ko-fi.com/overframe')}
                    className="justify-start gap-2 hover:border-ko-fi-red/50 hover:text-ko-fi-red"
                  >
                    <KoFiIcon size={11} /> Support development on Ko-fi
                    <ExternalLink size={10} className="ml-auto text-muted-foreground" />
                  </Button>
                </div>
              </Section>

              <Section title="Legal">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No analytics, no telemetry, no account required. All data stays on your machine.
                  Provided as-is under the MIT license.
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Overframe is an Instant Gaming affiliate: game purchases made through links in
                  the app earn us a small commission, at no extra cost to you.
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
            </div>
          )}

          {active === 'developer' && import.meta.env.DEV && (
            <Section title="Developer" description="Dev-build tools — not present in production.">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void window.aether.system.devStoreReset()}
                >
                  Reset store &amp; relaunch
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetMissions}
                >
                  Reset missions
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void window.aether.settings.set('hasCompletedOnboarding', false).then((s) => { if (s) useAppStore.getState().setSettings(s) })}
                >
                  Show onboarding
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void window.aether.system.simulateCrash()}
                >
                  Write test crash
                </Button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
