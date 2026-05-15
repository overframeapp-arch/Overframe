import { useEffect, useRef, useState } from 'react'
import type { Profile } from '@shared/types'
import { ProfileIcon } from './ProfileIcon'
import { cn } from '../lib/cn'
import { STRINGS } from '../lib/strings'

export interface ToastPayload {
  profile: Profile
  isNew: boolean
  /** Unique key to allow re-triggering the toast for the same profile. */
  key: number
}

export function Toast({ payload }: { payload: ToastPayload | null }): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!payload) return
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 3000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // Re-trigger only when the unique key changes (a new toast event).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.key])

  if (!payload) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-3 right-3 z-50 pointer-events-none',
        'flex items-center gap-2 px-3 py-1.5 rounded-md max-w-[260px]',
        'bg-background/95 border border-border/80 shadow-lg text-[11px]',
        'transition-all duration-200 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
      )}
    >
      <ProfileIcon iconUrl={payload.profile.iconUrl} name={payload.profile.name} size={14} />
      <span className="text-muted-foreground truncate">
        {payload.isNew ? STRINGS.toast.profileCreated : STRINGS.toast.profileActivated}
        <span className="text-foreground font-medium">{payload.profile.name}</span>
      </span>
    </div>
  )
}
