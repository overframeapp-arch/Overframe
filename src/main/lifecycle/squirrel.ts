import { app } from 'electron'
import fs from 'node:fs'

/**
 * Squirrel.Windows fires the installer with `--squirrel-*` event args during
 * install / update / uninstall. Without an early bail-out the full app boots,
 * the overlay flashes on screen, then quits — looking like a crash to the user.
 * Must run BEFORE app.whenReady() so no window is ever created.
 *
 * `--squirrel-firstrun` is intentionally NOT in the quit set: Squirrel passes
 * it on the first normal launch after install, so the app must run.
 */
const SQUIRREL_QUIT_EVENTS = new Set([
  '--squirrel-install',
  '--squirrel-updated',
  '--squirrel-uninstall',
  '--squirrel-obsolete',
])

export function handleSquirrelEvents(): void {
  if (process.platform !== 'win32') return
  const arg = process.argv[1] ?? ''
  if (!SQUIRREL_QUIT_EVENTS.has(arg)) return

  if (arg === '--squirrel-uninstall') {
    // Remove "start with Windows" registry entry so the app doesn't auto-start
    // after it's been uninstalled.
    app.setLoginItemSettings({ openAtLogin: false })

    // Delete all user data: settings, profiles, collections, browser sessions,
    // cookies, cache, localStorage — nothing is left behind.
    try {
      fs.rmSync(app.getPath('userData'), { recursive: true, force: true })
    } catch {
      // Directory may already be gone or partially locked — not a fatal error.
    }
  }

  app.quit()
  process.exit(0)
}
