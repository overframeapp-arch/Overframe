import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TARGET = 'https://pathofexile2.com/ancients'
const ORIGIN = 'https://pathofexile2.com'

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

/**
 * Smart mirror for pathofexile2.com/ancients.
 *
 * Strategy:
 *  1. Fetch the page server-side (no CORS issues).
 *  2. Check GGG's response for X-Frame-Options / CSP frame-ancestors.
 *     — If embedding is NOT restricted → 302 redirect to the real URL
 *       so the iframe loads GGG directly (truly live, zero proxy overhead).
 *     — If embedding IS restricted   → strip blocking headers, inject a
 *       <base href> so assets still load from GGG, and serve the HTML
 *       from our origin (which the browser trusts).
 */
export async function GET() {
  let res: Response

  try {
    res = await fetch(TARGET, { headers: FETCH_HEADERS, cache: 'no-store' })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new NextResponse(
      `<html><body style="background:#080808;color:#555;font-family:sans-serif;padding:2rem;font-size:13px">
        Could not reach pathofexile2.com — ${msg}
      </body></html>`,
      { status: 502, headers: { 'Content-Type': 'text/html' } },
    )
  }

  // ── Embedding check ────────────────────────────────────────────────────────
  const xfo = res.headers.get('x-frame-options') ?? ''
  const csp = res.headers.get('content-security-policy') ?? ''
  // frame-ancestors with any value other than '*' restricts embedding
  const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i)?.[1]?.trim() ?? ''
  const blocksEmbed = xfo !== '' || (faMatch !== '' && faMatch !== '*')

  if (!blocksEmbed) {
    // GGG allows direct embedding → redirect the iframe to the live URL.
    // The browser loads GGG straight, no proxy overhead, fully live.
    return NextResponse.redirect(TARGET, { status: 302 })
  }

  // ── Proxy path ─────────────────────────────────────────────────────────────
  // GGG restricts embedding; serve the HTML from our origin without
  // X-Frame-Options so the iframe can load it. Inject <base href> so all
  // relative asset URLs (scripts, images, CSS) still resolve against GGG.
  const html = await res.text()
  const patched = html.replace(/(<head[^>]*>)/i, `$1<base href="${ORIGIN}/">`)

  return new NextResponse(patched, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // No X-Frame-Options — intentionally embeddable
    },
  })
}
