import { app } from 'electron'
import fs from 'fs'
import path from 'path'

const LEVEL_NAMES = ['verbose', 'info', 'warning', 'error']
const MAX_BYTES = 500 * 1024 // 500 KB — trim to last 250 KB when exceeded

function logPath(name: string): string {
  return path.join(app.getPath('userData'), 'logs', `${name}.log`)
}

function ensureDir(p: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
}

function append(p: string, entry: string): void {
  fs.appendFileSync(p, entry, 'utf8')
  const content = fs.readFileSync(p, 'utf8')
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    fs.writeFileSync(p, content.slice(-MAX_BYTES / 2), 'utf8')
  }
}

/**
 * Pipe a webContents 'console-message' event to a named log file.
 * No-op in production builds.
 */
export function logConsole(
  source: 'renderer' | 'webview',
  level: number,
  message: string,
  line: number,
  sourceId: string
): void {
  if (app.isPackaged) return
  try {
    const p = logPath(source)
    ensureDir(p)
    const levelName = LEVEL_NAMES[level] ?? 'log'
    const origin = sourceId ? ` (${path.basename(sourceId)}:${line})` : ''
    append(p, `[${new Date().toISOString()}] [${levelName}]${origin} ${message}\n`)
  } catch {
    // logging must never crash the app
  }
}

/**
 * Read the last N lines of a dev log file.
 * Returns a placeholder string if not in dev mode or file doesn't exist yet.
 */
export function readLog(source: 'renderer' | 'webview' | 'crash', lines = 200): string {
  if (app.isPackaged) return '(not available in production)'
  try {
    const p = logPath(source)
    if (!fs.existsSync(p)) return `(no ${source} log yet — nothing has been written)`
    const content = fs.readFileSync(p, 'utf8')
    return content.split('\n').slice(-lines).join('\n')
  } catch {
    return '(error reading log)'
  }
}

/** Absolute path to a given log file (useful for shell reads). */
export function devLogPath(source: 'renderer' | 'webview' | 'crash'): string {
  return logPath(source)
}
