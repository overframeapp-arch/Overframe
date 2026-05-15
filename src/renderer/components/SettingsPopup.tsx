import { useEffect, useId, useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { SettingsPanel } from './SettingsPanel'

export function SettingsPopup(): JSX.Element {
  const { setSettings, setProfiles, setActiveProfile } = useAppStore()
  const [ready, setReady] = useState(false)
  const titleId = useId()

  useEffect(() => {
    void Promise.all([
      window.aether.settings.get(),
      window.aether.profiles.getAll(),
      window.aether.profiles.getCurrent(),
    ]).then(([settings, profiles, current]) => {
      setSettings(settings)
      setProfiles(profiles)
      setActiveProfile(current)
      setReady(true)
    })
  }, [setSettings, setProfiles, setActiveProfile])

  if (!ready) {
    return (
      <div
        role="status"
        className="h-full bg-background border border-border rounded-lg flex items-center justify-center"
      >
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="h-full bg-background border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
        <h2 id={titleId} className="text-[11px] font-semibold flex-1">Settings</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => window.aether.popup.close()}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <SettingsPanel />
      </div>
    </div>
  )
}
