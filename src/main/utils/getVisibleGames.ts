import { execFile } from 'node:child_process'

export interface VisibleGame {
  /** Process name without .exe, e.g. "PathOfExile_x64Steam" */
  processName: string
  /** Full path to the executable */
  exePath: string
  /** Human-readable name from PE version info (FileDescription / ProductName) or '' */
  displayName: string
  /** Main window title as shown in the taskbar — often the clean game name when PE metadata is absent. */
  windowTitle: string
  /** True when the process window covers an entire display — strong signal this is a game.
   *  Fullscreen processes bypass the install-path filter so games installed anywhere are detected. */
  isFullscreen: boolean
  /** Centre X of the game window in screen coordinates — used to show notifications on the game's display. */
  windowCX: number
  /** Centre Y of the game window in screen coordinates. */
  windowCY: number
}

/**
 * Returns all processes that have a visible window (MainWindowHandle != 0)
 * and whose exe is NOT in a Windows system directory.
 *
 * Uses a single PowerShell call. For elevated processes (most games) where
 * Get-Process cannot read .Path, falls back to WMI (Get-CimInstance) which
 * works across elevation boundaries.
 *
 * Fullscreen detection works like Discord: if the process window covers the
 * full bounds of any display it is almost certainly a game regardless of the
 * install path. Uses GetWindowRect (user32) + System.Windows.Forms.Screen via
 * PowerShell Add-Type — both degrade gracefully (isFullscreen = false) if
 * the P/Invoke type fails to compile.
 */
export async function getVisibleGames(): Promise<VisibleGame[]> {
  const raw = await new Promise<string>((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-OutputEncoding', 'UTF8',
        '-Command',
        `
$screens = $null
try { Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop; $screens = [System.Windows.Forms.Screen]::AllScreens } catch {}
try { Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class WinRect{[StructLayout(LayoutKind.Sequential)]public struct RECT{public int L,T,R,B;}[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);}' -ErrorAction Stop } catch {}
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
  $name = $_.ProcessName
  $path = $_.Path
  if (-not $path) {
    $path = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).ExecutablePath
  }
  if (-not $path) { return }
  if ($path -match '(?i)^C:\\\\Windows\\\\|\\\\system32\\\\|\\\\syswow64\\\\|\\\\microsoft\\.net\\\\|\\\\WindowsApps\\\\') { return }
  $isFs = $false
  $cx = 0; $cy = 0
  try {
    $r = [WinRect+RECT]::new()
    if ([WinRect]::GetWindowRect([IntPtr]$_.MainWindowHandle, [ref]$r)) {
      $w = $r.R - $r.L; $h = $r.B - $r.T
      $cx = [int](($r.L + $r.R) / 2)
      $cy = [int](($r.T + $r.B) / 2)
      if ($screens) { foreach ($s in $screens) { if ($s.Bounds.Width -eq $w -and $s.Bounds.Height -eq $h) { $isFs = $true; break } } }
    }
  } catch {}
  $vi = (Get-Item $path -ErrorAction SilentlyContinue).VersionInfo
  $d = ''
  if ($vi) {
    if ($vi.FileDescription -and $vi.FileDescription.Trim()) { $d = $vi.FileDescription.Trim() }
    elseif ($vi.ProductName -and $vi.ProductName.Trim()) { $d = $vi.ProductName.Trim() }
  }
  $wt = if ($_.MainWindowTitle) { ($_.MainWindowTitle -replace '[|\r\n]', ' ').Trim() } else { '' }
  Write-Output "$name|$path|$d|$isFs|$cx|$cy|$wt"
}
`.trim(),
      ],
      { timeout: 12000, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          // Don't crash main on detection failure — just log and yield no games.
          // PowerShell can fail on locked machines, AV interference, or transient timeouts.
          console.warn('[overframe] getVisibleGames: PowerShell error:', err.message)
        }
        resolve(stdout ?? '')
      }
    )
  })

  const results: VisibleGame[] = []
  for (const line of raw.split('\n')) {
    // Pipe (|) is the field separator. Paths can't contain | on Windows; display names
    // might, so processName and exePath are taken from the start, and cx/cy/isFs are
    // popped from the end — anything left in the middle is the (possibly pipe-containing)
    // display name.
    const parts = line.trim().split('|')
    if (parts.length < 7) continue
    const [processName, exePath, ...rest] = parts
    if (!processName || !exePath) continue
    const windowTitle = rest.pop()?.trim() ?? ''
    const cyStr = rest.pop()?.trim() ?? '0'
    const cxStr = rest.pop()?.trim() ?? '0'
    const isFullscreen = rest.pop()?.trim() === 'True'
    results.push({
      processName: processName.trim(),
      exePath: exePath.trim(),
      displayName: rest.join('|').trim(),
      windowTitle,
      isFullscreen,
      windowCX: parseInt(cxStr, 10) || 0,
      windowCY: parseInt(cyStr, 10) || 0,
    })
  }
  return results
}
