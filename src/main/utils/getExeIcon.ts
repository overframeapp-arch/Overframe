import { app } from 'electron'
import { execFile } from 'node:child_process'

/**
 * Strict allowlist: only alphanumeric, dots, hyphens, underscores and spaces.
 * Prevents any command injection via user-supplied process names.
 */
function isSafeProcessName(name: string): boolean {
  return /^[\w.\-\s]+$/i.test(name) && name.length <= 128
}

/**
 * Resolve the full filesystem path of a running process by name using PowerShell.
 * Returns null if the process is not currently running or the path cannot be resolved.
 */
function findExePath(processName: string): Promise<string | null> {
  // Strip .exe for PowerShell Get-Process (it uses bare name)
  const bare = processName.replace(/\.exe$/i, '')
  if (!isSafeProcessName(bare)) return Promise.resolve(null)

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Process -Name '${bare}' -ErrorAction SilentlyContinue | Select-Object -First 1).Path`,
      ],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) return resolve(null)
        const path = stdout.trim()
        resolve(path.length > 0 ? path : null)
      }
    )
  })
}

/**
 * Given a process name (e.g. "PathOfExile.exe"), returns a PNG data URL of the
 * executable's icon, or null if the process isn't running / icon can't be extracted.
 */
export async function getExeIcon(processName: string): Promise<string | null> {
  try {
    const exePath = await findExePath(processName)
    if (!exePath) return null
    const icon = await app.getFileIcon(exePath, { size: 'large' })
    return icon.toDataURL()
  } catch {
    return null
  }
}
