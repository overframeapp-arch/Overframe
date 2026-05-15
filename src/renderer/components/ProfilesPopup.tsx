import { useId, useMemo, useState, useEffect } from 'react'
import { Check, Settings2, X } from 'lucide-react'
import type { Profile } from '@shared/types'
import { cn } from '../lib/cn'
import { ProfileIcon } from './ProfileIcon'

export function ProfilesPopup(): JSX.Element {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    void Promise.all([
      window.aether.profiles.getAll(),
      window.aether.profiles.getCurrent(),
    ]).then(([all, current]) => {
      setProfiles(all)
      setActiveId(current.id)
    })
  }, [])

  useEffect(() => {
    return window.aether.on.profileChanged((p) => {
      setActiveId(p.id)
      void window.aether.profiles.getAll().then(setProfiles)
    })
  }, [])

  const switchProfile = async (id: string): Promise<void> => {
    await window.aether.profiles.setActive(id)
    setActiveId(id)
    setTimeout(() => window.aether.popup.close(), 120)
  }

  const sortedProfiles = useMemo(() => {
    if (!activeId) return profiles
    const active = profiles.find((p) => p.id === activeId)
    if (!active) return profiles
    return [active, ...profiles.filter((p) => p.id !== activeId)]
  }, [profiles, activeId])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="h-full bg-background border border-border rounded-lg flex flex-col overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
        <h2 id={titleId} className="text-[11px] font-semibold flex-1 truncate">Profiles</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => window.aether.popup.close()}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </div>

      {/* Profile list */}
      <ul role="list" className="flex-1 overflow-y-auto">
        {sortedProfiles.map((p) => {
          const isActive = p.id === activeId
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={isActive}
                aria-label={`${isActive ? 'Active profile: ' : 'Switch to '}${p.name}`}
                onClick={() => void switchProfile(p.id)}
                className={cn(
                  'w-full text-left flex items-center gap-2.5 px-3 py-2',
                  'hover:bg-muted/40 border-b border-border/30 transition-colors',
                  isActive && 'bg-muted/20'
                )}
              >
                <ProfileIcon iconUrl={p.iconUrl} name={p.name} size={14} profileId={p.id} />
                <span className={cn('text-[12px] flex-1 truncate', isActive && 'text-primary font-medium')}>
                  {p.name}
                </span>
                {isActive && <Check size={12} className="text-primary shrink-0" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
        {profiles.length === 0 && (
          <li className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            No profiles
          </li>
        )}
      </ul>

      {/* Footer */}
      <div className="border-t border-border shrink-0 px-2 py-1.5">
        <button
          type="button"
          aria-label="Manage profiles"
          onClick={() => void window.aether.popup.openPanel('profiles')}
          className="w-full flex items-center gap-2 h-6 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Settings2 size={12} aria-hidden="true" />
          Manage profiles
        </button>
      </div>
    </div>
  )
}
