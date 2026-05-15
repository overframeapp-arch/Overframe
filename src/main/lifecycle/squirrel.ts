import { app } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Squirrel.Windows fires the installer with `--squirrel-*` event args during
 * install / update / uninstall. Without an early bail-out the full app boots,
 * the overlay flashes on screen, then quits — looking like a crash to the user.
 * Must run BEFORE app.whenReady() so no window is ever created.
 *
 * `--squirrel-firstrun` is intentionally NOT handled: Squirrel passes it on
 * the first normal launch after install, so the app must run.
 *
 * On install/update we MUST call `Update.exe --createShortcut=overframe.exe`
 * ourselves — Squirrel.Windows no longer does it automatically. Without this
 * the install completes silently but no shortcut appears and the wrapper
 * Setup.exe reports "Installation has failed".
 */

const SHORTCUT_LOCATIONS = 'StartMenu,Desktop'

function runUpdater(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe')
    if (!fs.existsSync(updateExe)) {
      resolve()
      return
    }
    const child = spawn(updateExe, args, { detached: true, stdio: 'ignore' })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
    // Failsafe: don't block exit forever if Update.exe hangs.
    setTimeout(resolve, 4_000)
  })
}

/**
 * Returns true when the app was launched right after a fresh install
 * (Squirrel fires `--squirrel-firstrun` once, before the normal boot).
 * Use this to show an onboarding / first-run UI.
 */
export function isFirstRun(): boolean {
  return process.platform === 'win32' && process.argv[1] === '--squirrel-firstrun'
}

/** Returns true when the launch was a Squirrel event and the app should quit. */
export function handleSquirrelEvents(): boolean {
  if (process.platform !== 'win32') return false
  const arg = process.argv[1] ?? ''
  const exeName = path.basename(process.execPath)

  switch (arg) {
    case '--squirrel-install':
    case '--squirrel-updated': {
      // Create Start Menu + Desktop shortcuts, then quit.
      runUpdater([
        `--createShortcut=${exeName}`,
        `--shortcut-locations=${SHORTCUT_LOCATIONS}`,
      ]).finally(() => app.exit(0))
      return true
    }

    case '--squirrel-uninstall': {
      // Remove shortcuts, disable startup-with-Windows, wipe user data.
      app.setLoginItemSettings({ openAtLogin: false })
      try {
        fs.rmSync(app.getPath('userData'), { recursive: true, force: true })
      } catch {
        // Folder may already be gone or partially locked — not fatal.
      }
      runUpdater([
        `--removeShortcut=${exeName}`,
        `--shortcut-locations=${SHORTCUT_LOCATIONS}`,
      ]).finally(() => app.exit(0))
      return true
    }

    case '--squirrel-obsolete': {
      // Old version invoked just before being removed by the new one.
      app.exit(0)
      return true
    }

    default:
      return false
  }
}
