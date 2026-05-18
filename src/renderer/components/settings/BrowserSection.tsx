import type { Settings } from '@shared/types'
import { SEARCH_ENGINES, type SearchEngineId } from '@shared/types'
import { useAppStore } from '../../store/appStore'
import { Section } from './Layout'

export function BrowserSection(): JSX.Element {
  const { settings, setSettings } = useAppStore()

  const persist = async <K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> => {
    const next = await window.aether.settings.set(key, value)
    if (next) setSettings(next as Settings)
  }

  const currentEngine: SearchEngineId = settings?.searchEngine ?? 'google'

  return (
    <Section
      title="Browser"
      description="Browser settings."
    >
      {/* Search engine */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-foreground">Default search engine</label>
        <p className="text-[11px] text-muted-foreground">
          Used when you type a query (not a URL) in the address bar.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {(Object.entries(SEARCH_ENGINES) as [SearchEngineId, { label: string; url: string }][]).map(([id, engine]) => (
            <button
              key={id}
              type="button"
              aria-pressed={currentEngine === id}
              onClick={() => void persist('searchEngine', id)}
              className={`px-3 py-1 rounded text-[11px] border transition-colors cursor-default ${
                currentEngine === id
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {engine.label}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}
