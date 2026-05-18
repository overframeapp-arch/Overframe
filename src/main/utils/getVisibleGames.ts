import koffi from 'koffi'
import { screen } from 'electron'
import path from 'node:path'

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

// ── Win32 constants ────────────────────────────────────────────────────────────

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const MAX_PATH = 260

const SYS_PATH_RE =
  /^C:\\Windows\\|\\system32\\|\\syswow64\\|\\microsoft\.net\\|\\WindowsApps\\/i

// ── Win32 type definitions ─────────────────────────────────────────────────────

const RECT = koffi.struct('RECT', {
  left:   'int32',
  top:    'int32',
  right:  'int32',
  bottom: 'int32',
})

// ── DLL bindings (loaded once at module level) ─────────────────────────────────

const user32   = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

// Callback type for EnumWindows — HWND is received as BigInt in the JS body
const EnumWindowsProc = koffi.proto(
  'bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)'
)

const EnumWindows = user32.func(
  'bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr lParam)'
)
const IsWindowVisible = user32.func(
  'bool __stdcall IsWindowVisible(void *hWnd)'
)
const GetWindowRect = user32.func(
  'bool __stdcall GetWindowRect(void *hWnd, _Out_ RECT *lpRect)'
)
const GetWindowTextW = user32.func(
  'int __stdcall GetWindowTextW(void *hWnd, uint8_t *lpString, int nMaxCount)'
)
const GetWindowThreadProcessId = user32.func(
  'uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)'
)

const OpenProcess = kernel32.func(
  'void * __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
)
const CloseHandle = kernel32.func(
  'bool __stdcall CloseHandle(void *hObject)'
)
const QueryFullProcessImageNameW = kernel32.func(
  'bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, uint8_t *lpExeName, _Inout_ uint32 *lpdwSize)'
)

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Decode a UTF-16LE Buffer slice to a JS string. */
function decodeUtf16(buf: Buffer, charCount: number): string {
  return buf.subarray(0, charCount * 2).toString('utf16le')
}

/** Retrieve the full exe path for the given PID via QueryFullProcessImageNameW.
 *  Returns null on access-denied or if the process has exited. */
function exePathFromPid(pid: number): string | null {
  const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
  if (!handle) return null
  try {
    const buf  = Buffer.allocUnsafe(MAX_PATH * 2) // UTF-16LE output buffer
    const size = [MAX_PATH]                       // _Inout_: initial capacity → actual length
    if (!QueryFullProcessImageNameW(handle, 0, buf, size)) return null
    return decodeUtf16(buf, size[0] as number)
  } finally {
    CloseHandle(handle)
  }
}

/** Retrieve the main window title (UTF-16) for the given HWND. Returns '' on failure. */
function getWindowTitle(hwnd: unknown): string {
  const buf = Buffer.allocUnsafe(512 * 2) // 512 UTF-16 chars
  const len = GetWindowTextW(hwnd, buf, 512)
  return len > 0 ? decodeUtf16(buf, len) : ''
}

// ── Synchronous enumeration core ───────────────────────────────────────────────

function enumerateVisibleGames(): VisibleGame[] {
  const displays = screen.getAllDisplays()
  const seen     = new Set<string>()  // deduplicate by lowercased exe path
  const results: VisibleGame[] = []

  // Transient callback — only called while EnumWindows is running, no register needed.
  EnumWindows((hwnd: unknown): boolean => {
    try {
      if (!IsWindowVisible(hwnd)) return true

      const pidOut = [null]
      if (!GetWindowThreadProcessId(hwnd, pidOut) || !pidOut[0]) return true
      const pid = pidOut[0] as number

      const exePath = exePathFromPid(pid)
      if (!exePath) return true
      if (SYS_PATH_RE.test(exePath)) return true

      const key = exePath.toLowerCase()
      if (seen.has(key)) return true
      seen.add(key)

      const rect: { left: number; top: number; right: number; bottom: number } = {} as never
      const hasRect = GetWindowRect(hwnd, rect)

      let isFullscreen = false
      let windowCX = 0
      let windowCY = 0

      if (hasRect) {
        const w = rect.right  - rect.left
        const h = rect.bottom - rect.top
        windowCX = Math.round((rect.left + rect.right)  / 2)
        windowCY = Math.round((rect.top  + rect.bottom) / 2)
        isFullscreen = displays.some(
          (d) => d.bounds.width === w && d.bounds.height === h
        )
      }

      results.push({
        processName: path.basename(exePath, '.exe'),
        exePath,
        displayName: '',
        windowTitle: getWindowTitle(hwnd),
        isFullscreen,
        windowCX,
        windowCY,
      })
    } catch {
      // Ignore per-window errors (process exited mid-enumeration, access denied, etc.)
    }
    return true
  }, 0)

  return results
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns all processes with a visible window whose exe is NOT in a Windows
 * system directory.
 *
 * Uses native Win32 APIs (user32.dll / kernel32.dll via koffi) — no PowerShell,
 * no .NET compilation (Add-Type / csc.exe), no child processes spawned.
 */
export async function getVisibleGames(): Promise<VisibleGame[]> {
  try {
    return enumerateVisibleGames()
  } catch (err) {
    console.warn('[overframe] getVisibleGames: Win32 enumeration error:', err)
    return []
  }
}
