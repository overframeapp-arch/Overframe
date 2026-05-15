import { useEffect, useState } from 'react'
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { notify, type Notification } from '../lib/notify'
import { cn } from '../lib/cn'

// Renders active notifications stacked top-right, subscribed to the global notify bus.
export function NotificationCenter(): JSX.Element | null {
  const [items, setItems] = useState<readonly Notification[]>([])

  useEffect(() => notify.subscribe(setItems), [])

  if (items.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed top-3 right-3 z-50 flex flex-col gap-1.5 pointer-events-none"
    >
      {items.map((n) => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </div>
  )
}

function NotificationItem({ notification }: { notification: Notification }): JSX.Element {
  const Icon = notification.level === 'error'   ? AlertCircle
             : notification.level === 'success' ? CheckCircle2
             : Info
  const accent = notification.level === 'error'   ? 'text-destructive'
                : notification.level === 'success' ? 'text-emerald-400'
                : 'text-primary'
  return (
    <div
      role={notification.level === 'error' ? 'alert' : 'status'}
      aria-live={notification.level === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-md max-w-[300px]',
        'bg-background/95 border border-border/80 shadow-lg text-[11px]',
        'animate-in fade-in slide-in-from-top-1 duration-150'
      )}
    >
      <Icon size={13} className={cn('mt-px shrink-0', accent)} />
      <span className="text-foreground flex-1 leading-snug">{notification.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => notify.dismiss(notification.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X size={11} />
      </button>
    </div>
  )
}
