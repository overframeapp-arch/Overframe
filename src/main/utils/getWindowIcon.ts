import * as koffi from 'koffi'
import { nativeImage } from 'electron'

/**
 * Launcher-agnostic game icon retrieval.
 *
 * Reads the icon **of the running window** — the exact icon Windows shows in the
 * taskbar / Alt-Tab — directly from its HWND. This works for ANY application
 * model (Win32 *and* UWP/MSIX like Xbox app / Microsoft Store games) and any
 * launcher, with no per-store logic, no PowerShell, and no access to the
 * ACL-locked WindowsApps folder (we ask the window, not the file).
 *
 * HICON → BGRA pixels via GDI (GetIconInfo + GetDIBits), then
 * nativeImage.createFromBitmap → PNG data URL. Everything is best-effort: any
 * failure returns '' so callers fall back to the exe's embedded icon.
 *
 * Results are cached per exe path — a given app's window icon is stable, so the
 * polling loop only pays the GDI cost once per distinct executable.
 */

// ── Win32 / GDI constants ───────────────────────────────────────────────────
const WM_GETICON = 0x007f
const ICON_SMALL = 0
const ICON_BIG = 1
const ICON_SMALL2 = 2
const GCLP_HICON = -14
const GCLP_HICONSM = -34
const SMTO_ABORTIFHUNG = 0x0002
const DIB_RGB_COLORS = 0

// ── Structs (registered by name; referenced from the koffi prototype strings) ─
koffi.struct('ICONINFO', {
  fIcon: 'int32',
  xHotspot: 'uint32',
  yHotspot: 'uint32',
  hbmMask: 'void *',
  hbmColor: 'void *',
})
koffi.struct('BITMAPINFOHEADER', {
  biSize: 'uint32',
  biWidth: 'int32',
  biHeight: 'int32',
  biPlanes: 'uint16',
  biBitCount: 'uint16',
  biCompression: 'uint32',
  biSizeImage: 'uint32',
  biXPelsPerMeter: 'int32',
  biYPelsPerMeter: 'int32',
  biClrUsed: 'uint32',
  biClrImportant: 'uint32',
})
// Kept as a value — used by koffi.sizeof(BITMAP) below.
const BITMAP = koffi.struct('BITMAP', {
  bmType: 'int32',
  bmWidth: 'int32',
  bmHeight: 'int32',
  bmWidthBytes: 'int32',
  bmPlanes: 'uint16',
  bmBitsPixel: 'uint16',
  bmBits: 'void *',
})

// ── DLL bindings (lazy + guarded so a load failure never crashes startup) ─────
type Fn = (...args: unknown[]) => unknown

interface IconApi {
  sendMessageTimeout: Fn
  getClassLongPtr: Fn
  getIconInfo: Fn
  getObject: Fn
  getDIBits: Fn
  getDC: Fn
  releaseDC: Fn
  deleteObject: Fn
}

let api: IconApi | null = null
let initAttempted = false

function ensureApi(): IconApi | null {
  if (initAttempted) return api
  initAttempted = true
  try {
    const user32 = koffi.load('user32.dll')
    const gdi32 = koffi.load('gdi32.dll')
    api = {
      // void** out for the result so we get the HICON back as a usable pointer.
      sendMessageTimeout: user32.func('SendMessageTimeoutW', 'intptr', [
        'void *', 'uint32', 'uintptr', 'intptr', 'uint32', 'uint32',
        koffi.out(koffi.pointer('void *')),
      ]) as unknown as Fn,
      getClassLongPtr: user32.func(
        'void * __stdcall GetClassLongPtrW(void *hWnd, int32 nIndex)',
      ) as unknown as Fn,
      getIconInfo: user32.func(
        'bool __stdcall GetIconInfo(void *hIcon, _Out_ ICONINFO *piconinfo)',
      ) as unknown as Fn,
      getObject: gdi32.func(
        'int32 __stdcall GetObjectW(void *h, int32 c, _Out_ BITMAP *pv)',
      ) as unknown as Fn,
      getDIBits: gdi32.func(
        'int32 __stdcall GetDIBits(void *hdc, void *hbm, uint32 start, uint32 cLines, void *lpvBits, BITMAPINFOHEADER *lpbmi, uint32 usage)',
      ) as unknown as Fn,
      getDC: user32.func('void * __stdcall GetDC(void *hWnd)') as unknown as Fn,
      releaseDC: user32.func('int32 __stdcall ReleaseDC(void *hWnd, void *hDC)') as unknown as Fn,
      deleteObject: gdi32.func('bool __stdcall DeleteObject(void *ho)') as unknown as Fn,
    }
  } catch {
    api = null
  }
  return api
}

// ── Icon resolution ───────────────────────────────────────────────────────────

/** Returns a usable HICON for the window (taskbar icon), or null. */
function resolveWindowIcon(v: IconApi, hwnd: unknown): unknown {
  const out: [unknown] = [null]
  for (const which of [ICON_BIG, ICON_SMALL2, ICON_SMALL]) {
    const ok = v.sendMessageTimeout(hwnd, WM_GETICON, which, 0, SMTO_ABORTIFHUNG, 200, out)
    if (ok && out[0]) return out[0]
  }
  for (const idx of [GCLP_HICON, GCLP_HICONSM]) {
    const h = v.getClassLongPtr(hwnd, idx)
    if (h) return h
  }
  return null
}

function dibHeader(width: number, height: number): Record<string, number> {
  return {
    biSize: 40,
    biWidth: width,
    biHeight: -height, // negative → top-down rows (matches createFromBitmap)
    biPlanes: 1,
    biBitCount: 32,
    biCompression: 0,
    biSizeImage: 0,
    biXPelsPerMeter: 0,
    biYPelsPerMeter: 0,
    biClrUsed: 0,
    biClrImportant: 0,
  }
}

/**
 * Legacy icons (no per-pixel alpha) store transparency in a separate AND mask.
 * If the colour bitmap came back fully opaque-but-transparent (all alpha 0),
 * rebuild the alpha channel from the mask: black mask pixel = opaque.
 */
function applyMaskIfNeeded(v: IconApi, data: Buffer, hbmMask: unknown, width: number, height: number): void {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return // already has alpha — nothing to do
  }
  if (!hbmMask) {
    data.fill(255, 0) // no mask either → assume fully opaque
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    return
  }
  const mask = Buffer.alloc(width * height * 4)
  const hdc = v.getDC(null)
  try {
    v.getDIBits(hdc, hbmMask, 0, height, mask, dibHeader(width, height), DIB_RGB_COLORS)
  } finally {
    v.releaseDC(null, hdc)
  }
  for (let p = 0; p < width * height; p++) {
    data[p * 4 + 3] = mask[p * 4] === 0 ? 255 : 0
  }
}

/** Core HICON → top-down BGRA conversion. Pure GDI/koffi (no Electron) so it is
 *  unit-testable against a system icon. */
export function iconHandleToBitmap(
  hicon: unknown,
): { data: Buffer; width: number; height: number } | null {
  const v = ensureApi()
  if (!v || !hicon) return null

  const ii: Record<string, unknown> = {}
  if (!v.getIconInfo(hicon, ii)) return null
  const hbmColor = ii.hbmColor
  const hbmMask = ii.hbmMask
  try {
    const bmp: Record<string, number> = {}
    if (!v.getObject(hbmColor, koffi.sizeof(BITMAP), bmp)) return null
    const width = bmp.bmWidth
    const height = bmp.bmHeight
    if (!width || !height || width > 1024 || height > 1024) return null

    const data = Buffer.alloc(width * height * 4)
    const hdc = v.getDC(null)
    let lines = 0
    try {
      lines = v.getDIBits(hdc, hbmColor, 0, height, data, dibHeader(width, height), DIB_RGB_COLORS) as number
    } finally {
      v.releaseDC(null, hdc)
    }
    if (!lines) return null
    applyMaskIfNeeded(v, data, hbmMask, width, height)
    return { data, width, height }
  } finally {
    // GetIconInfo allocates fresh bitmaps the caller owns — always free them.
    // The HICON itself is owned by the window, so it is NOT destroyed here.
    if (hbmColor) v.deleteObject(hbmColor)
    if (hbmMask) v.deleteObject(hbmMask)
  }
}

// ── Cache + public API ──────────────────────────────────────────────────────
const iconCache = new Map<string, string>() // exePath (lowercased) → PNG data URL
const iconFailedAt = new Map<string, number>() // exePath (lowercased) → last failed attempt
/** Failure back-off — a window with no extractable icon (up to ~600 ms of blocking
 *  SendMessageTimeoutW per attempt) is not retried more often than this. Still
 *  covers the just-launched case: the icon appears within one back-off window. */
const ICON_RETRY_MS = 30_000

/** Cache-only lookup (no HWND needed) — used to backfill closed games. */
export function getCachedWindowIcon(exePath: string): string {
  return iconCache.get(exePath.toLowerCase()) ?? ''
}

/**
 * Returns a PNG data URL of the window's icon, or '' on failure. Successes are
 * cached per exe path; failures are negative-cached for ICON_RETRY_MS so a
 * permanently icon-less window doesn't pay the blocking extraction on every poll.
 */
export function getWindowIconDataUrl(hwnd: unknown, exePath: string): string {
  const key = exePath.toLowerCase()
  const cached = iconCache.get(key)
  if (cached) return cached
  const failedAt = iconFailedAt.get(key)
  if (failedAt !== undefined && Date.now() - failedAt < ICON_RETRY_MS) return ''

  let url = ''
  try {
    const v = ensureApi()
    if (v) {
      const hicon = resolveWindowIcon(v, hwnd)
      const bmp = iconHandleToBitmap(hicon)
      if (bmp && bmp.width > 0) {
        url = nativeImage
          .createFromBitmap(bmp.data, { width: bmp.width, height: bmp.height })
          .toDataURL()
      }
    }
  } catch {
    url = ''
  }
  if (url) {
    iconCache.set(key, url)
    iconFailedAt.delete(key)
  } else {
    iconFailedAt.set(key, Date.now())
  }
  return url
}
