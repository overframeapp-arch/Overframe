import { useId, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import type { Profile } from '@shared/types'
import { cn } from '../../lib/cn'
import { useGameDetect } from '../../hooks/useGameDetect'
import { ProfileIcon } from '../ProfileIcon'
import { InfoTip } from './atoms'
import { GamePicker, ProcessNamesField } from './GamePicker'

interface ProfileEditFormProps {
  profile: Profile
  isDefault: boolean
  onSave: (patch: Partial<Profile>) => void
  onCancel: () => void
}

export function ProfileEditForm({ profile, isDefault, onSave, onCancel }: ProfileEditFormProps): JSX.Element {
  const [name, setName] = useState(profile.name)
  const [iconUrl, setIconUrl] = useState(profile.iconUrl ?? '')
  const [processNames, setProcessNames] = useState(profile.processNames.join(', '))
  const nameId = useId()
  const iconId = useId()
  const processId = useId()

  const handleSave = (): void => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      name: trimmed,
      iconUrl: iconUrl.trim() || undefined,
      processNames: processNames.split(',').map((s) => s.trim()).filter(Boolean),
    })
  }

  return (
    <div className="px-3 py-2.5 flex flex-col gap-2.5 border-b border-border/40">
      <div className="flex items-center gap-2">
        <ProfileIcon iconUrl={iconUrl || undefined} name={name || profile.name} size={24} />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <label htmlFor={iconId} className="text-[11px] text-muted-foreground flex items-center">
            Icon URL
            <InfoTip text="Fetched automatically from the game on first launch. Paste a URL to override it." />
          </label>
          <input id={iconId} value={iconUrl} onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://…/favicon.ico"
            className="h-7 px-2.5 rounded text-[12px] bg-input border border-border focus:outline-none focus:border-primary/60" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-[11px] text-muted-foreground">Name</label>
        <input id={nameId} autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={isDefault}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
          className={cn('h-7 px-2.5 rounded text-[12px] bg-input border border-border focus:outline-none focus:border-primary/60', isDefault && 'opacity-50 cursor-not-allowed')} />
      </div>
      <ProcessNamesField
        id={processId}
        value={processNames}
        onChange={setProcessNames}
        onPickGame={(g) => {
          if (g.displayName && !isDefault) setName(g.displayName)
        }}
      />
      <div className="flex gap-2">
        <button type="button" onClick={handleSave}
          className="flex-1 h-7 rounded text-[12px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
        <button type="button" onClick={onCancel}
          className="flex-1 h-7 rounded text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

interface ProfileCreateFormProps {
  onSave: (input: { name: string; processNames: string[] }) => Promise<void>
  onCancel: () => void
  initialName?: string
  initialProcessName?: string
}

export function ProfileCreateForm({ onSave, onCancel, initialName, initialProcessName }: ProfileCreateFormProps): JSX.Element {
  const [name, setName] = useState(initialName ?? '')
  const [processNames, setProcessNames] = useState(initialProcessName ?? '')
  const [saving, setSaving] = useState(false)
  const nameId = useId()
  const processId = useId()
  const { visibleGames, showPicker, detectLoading, detect, pickGame } = useGameDetect()

  const submit = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onSave({ name: trimmed, processNames: processNames.split(',').map((s) => s.trim()).filter(Boolean) })
    } finally {
      setSaving(false)
    }
  }

  const handlePickGame = (g: { processName: string; exePath: string; displayName: string }): void => {
    setProcessNames(pickGame(g, processNames))
    if (!name.trim() && g.displayName) setName(g.displayName)
  }

  return (
    <div className="px-3 py-2.5 flex flex-col gap-2.5 border-b border-border/40" role="form" aria-label="Create profile">
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-[11px] text-muted-foreground">Profile name</label>
        <input id={nameId} autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          placeholder="e.g. Path of Exile 2"
          className="h-7 px-2.5 rounded text-[12px] bg-input border border-border focus:outline-none focus:border-primary/60" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor={processId} className="text-[11px] text-muted-foreground flex items-center">
            Process names
            <InfoTip text="Comma-separated .exe names (e.g. Game.exe). Overframe switches to this profile automatically when one of these processes becomes active." />
          </label>
          <button type="button" aria-label="Detect running games" onClick={() => void detect()} disabled={detectLoading}
            className="flex items-center gap-1 h-5 px-1.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">
            {detectLoading ? <Loader2 size={10} className="animate-spin" aria-hidden="true" /> : <Search size={10} aria-hidden="true" />}
            Detect
          </button>
        </div>
        <input id={processId} value={processNames} onChange={(e) => setProcessNames(e.target.value)}
          placeholder="Game.exe, Game2.exe"
          className="h-7 px-2.5 rounded text-[12px] bg-input border border-border focus:outline-none focus:border-primary/60" />
        {showPicker && <GamePicker games={visibleGames} onPick={handlePickGame} />}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void submit()} disabled={!name.trim() || saving}
          className="flex-1 h-7 rounded text-[12px] bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 h-7 rounded text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
      </div>
    </div>
  )
}
