// Singleton wrapper for uiohook-napi (WH_KEYBOARD_LL — fires before game input, like Discord PTT).
// Must be started once on app init and stopped on quit.
import { uIOhook } from 'uiohook-napi'

// Each registered shortcut adds one 'keydown' listener; 50 is well above any realistic ceiling.
uIOhook.setMaxListeners(50)

let started = false

export function startGlobalHooks(): void {
  if (started) return
  uIOhook.start()
  started = true
}

export function stopGlobalHooks(): void {
  if (!started) return
  uIOhook.stop()
  started = false
}

export { uIOhook }
