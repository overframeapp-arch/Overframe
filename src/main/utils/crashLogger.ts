import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const MAX_BYTES = 200 * 1024 // 200 KB — trim to last 100 KB when exceeded

function logPath(): string {
  return path.join(app.getPath('userData'), 'logs', 'crash.log')
}

function ensureDir(): void {
  fs.mkdirSync(path.dirname(logPath()), { recursive: true })
}

export function logCrash(type: string, error: unknown): void {
  try {
    ensureDir()
    const file = logPath()

    const header = `\n[${new Date().toISOString()}] ${type}\n`
    const body =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ''}`
        : String(error)
    const entry = `${header}${body}\n${'─'.repeat(60)}\n`

    fs.appendFileSync(file, entry, 'utf8')

    // Trim if the file grew too large — keep the most recent half.
    const stat = fs.statSync(file)
    if (stat.size > MAX_BYTES) {
      const content = fs.readFileSync(file, 'utf8')
      fs.writeFileSync(file, content.slice(-MAX_BYTES / 2), 'utf8')
    }
  } catch {
    // Logging must never crash the app itself.
  }
}

/** Returns the full path to the crash log so it can be shown to the user. */
export function crashLogPath(): string {
  return logPath()
}

/** Ensures the logs directory exists — call before shell.openPath so the folder is always there. */
export function ensureLogsDir(): void {
  try {
    ensureDir()
  } catch {
    // ignore
  }
}
