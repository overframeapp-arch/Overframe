// Lightweight pub/sub notification bus — emit via notify.error/info/success, render via <NotificationCenter />.

export type NotificationLevel = 'info' | 'error' | 'success'

export interface Notification {
  id: number
  level: NotificationLevel
  message: string
  /** UNIX ms when the notification was created. */
  createdAt: number
}

const DEFAULT_TTL_MS = 5_000

type Listener = (notifications: readonly Notification[]) => void

class NotificationBus {
  private notifications: Notification[] = []
  private listeners = new Set<Listener>()
  private nextId = 1

  push(level: NotificationLevel, message: string, ttlMs = DEFAULT_TTL_MS): number {
    const id = this.nextId++
    const note: Notification = { id, level, message, createdAt: Date.now() }
    this.notifications = [...this.notifications, note]
    this.emit()
    if (ttlMs > 0) {
      setTimeout(() => this.dismiss(id), ttlMs)
    }
    return id
  }

  dismiss(id: number): void {
    const next = this.notifications.filter((n) => n.id !== id)
    if (next.length === this.notifications.length) return
    this.notifications = next
    this.emit()
  }

  clear(): void {
    if (this.notifications.length === 0) return
    this.notifications = []
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.notifications)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.notifications)
  }
}

const bus = new NotificationBus()

/** Public API used by components. */
export const notify = {
  info:    (message: string, ttlMs?: number): number => bus.push('info', message, ttlMs),
  error:   (message: string, ttlMs?: number): number => bus.push('error', message, ttlMs),
  success: (message: string, ttlMs?: number): number => bus.push('success', message, ttlMs),
  dismiss: (id: number): void => bus.dismiss(id),
  clear:   (): void => bus.clear(),
  subscribe: (listener: Listener): (() => void) => bus.subscribe(listener),
}
