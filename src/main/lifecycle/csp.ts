import { BrowserWindow, session } from 'electron'

/**
 * Strict CSP applied to chrome surfaces only (overlay + popup BrowserWindows).
 * WebContentsView tabs are intentionally excluded — they load arbitrary user
 * sites that would break under any non-trivial CSP.
 *
 * Distinction relies on the fact that `BrowserWindow.fromWebContents()` returns
 * the owning window for our chrome WCs and `null` for WebContentsView WCs.
 */
const CHROME_CSP =
  "default-src 'self' 'unsafe-inline' data: blob:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' http://localhost:* ws://localhost:* https:; " +
  "frame-ancestors 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self';"

let installed = false

export function installChromeCsp(): void {
  if (installed) return
  installed = true
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const wc = details.webContents
    const isChrome = wc != null && BrowserWindow.fromWebContents(wc) != null
    if (!isChrome) {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    const responseHeaders = { ...(details.responseHeaders ?? {}) }
    // Strip any incoming CSP so ours is authoritative.
    for (const k of Object.keys(responseHeaders)) {
      if (k.toLowerCase() === 'content-security-policy') delete responseHeaders[k]
    }
    responseHeaders['Content-Security-Policy'] = [CHROME_CSP]
    callback({ responseHeaders })
  })
}
