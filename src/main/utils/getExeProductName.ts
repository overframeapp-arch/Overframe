import * as koffi from 'koffi'

/**
 * Reads the PE version resource of an executable and returns its ProductName
 * (falling back to FileDescription) — e.g. "Subnautica 2" for an exe whose
 * window title is "Subnautica 2 - Build 115506".
 *
 * Uses version.dll via koffi (in-process FFI — no PowerShell, no child process,
 * consistent with getVisibleGames). Everything is best-effort: any failure
 * returns '' so callers cleanly fall back to the window title / exe name.
 *
 * Results are cached per exe path — a file's version info never changes, so the
 * polling loop only pays the FFI cost once per distinct executable.
 */

type FfiFn = (...args: unknown[]) => number | boolean

interface VersionApi {
  size: FfiFn
  get: FfiFn
  query: FfiFn
}

let api: VersionApi | null = null
let initAttempted = false

function ensureApi(): VersionApi | null {
  if (initAttempted) return api
  initAttempted = true
  try {
    const version = koffi.load('version.dll')
    api = {
      size: version.func(
        'uint32 __stdcall GetFileVersionInfoSizeW(str16 filename, _Out_ uint32 *handle)',
      ) as unknown as FfiFn,
      get: version.func(
        'bool __stdcall GetFileVersionInfoW(str16 filename, uint32 handle, uint32 len, void *data)',
      ) as unknown as FfiFn,
      // VerQueryValueW writes a pointer *into* `data` (lplpBuffer = void**) plus a
      // length in characters. Explicit signature avoids any double-pointer proto
      // ambiguity.
      query: version.func('VerQueryValueW', 'bool', [
        'void *',
        'str16',
        koffi.out(koffi.pointer('void *')),
        koffi.out(koffi.pointer('uint32')),
      ]) as unknown as FfiFn,
    }
  } catch {
    api = null
  }
  return api
}

const cache = new Map<string, string>()

function hex4(n: number): string {
  return (n & 0xffff).toString(16).padStart(4, '0')
}

/** Query a single \StringFileInfo\<langcp>\<field> value, or '' if absent. */
function queryField(v: VersionApi, data: Buffer, subBlock: string): string {
  const outPtr: [unknown] = [null]
  const outLen: [number] = [0]
  if (!v.query(data, subBlock, outPtr, outLen)) return ''
  if (!outPtr[0] || outLen[0] <= 0) return ''
  try {
    // Null-terminated UTF-16 string sitting inside our own `data` buffer.
    return String(koffi.decode.string16(outPtr[0])).trim()
  } catch {
    return ''
  }
}

function queryName(v: VersionApi, data: Buffer): string {
  const langCodes: string[] = []

  // Preferred: the exe's own language/codepage from its translation table.
  const tPtr: [unknown] = [null]
  const tLen: [number] = [0]
  if (v.query(data, '\\VarFileInfo\\Translation', tPtr, tLen) && tPtr[0] && tLen[0] >= 4) {
    const lang = koffi.decode(tPtr[0], 0, 'uint16') as number
    const codepage = koffi.decode(tPtr[0], 2, 'uint16') as number
    langCodes.push(hex4(lang) + hex4(codepage))
  }
  // Common fallbacks: en-US/Unicode (1200), en-US/Windows-1252 (1252),
  // language-neutral/Unicode — covers most games when the table is missing.
  langCodes.push('040904b0', '040904e4', '000004b0')

  for (const lc of langCodes) {
    for (const field of ['ProductName', 'FileDescription']) {
      const value = queryField(v, data, `\\StringFileInfo\\${lc}\\${field}`)
      if (value) return value
    }
  }
  return ''
}

/**
 * Returns the executable's ProductName / FileDescription, or '' if it has no
 * version resource or anything fails.
 */
export function getExeProductName(exePath: string): string {
  if (!exePath) return ''
  const key = exePath.toLowerCase()
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  let result = ''
  try {
    const v = ensureApi()
    if (v) {
      const handle: [number] = [0]
      const size = Number(v.size(exePath, handle))
      if (size > 0) {
        const data = Buffer.allocUnsafe(size)
        if (v.get(exePath, 0, size, data)) {
          result = queryName(v, data)
        }
      }
    }
  } catch {
    result = ''
  }
  cache.set(key, result)
  return result
}
