/**
 * Overframe Collection Share Worker
 * Cloudflare Worker + KV — stores full collection JSON (including embedded images)
 * and returns an 8-character short code.
 *
 * Deploy:
 *   cd scripts/share-worker
 *   npx wrangler deploy
 *
 * Required KV namespace: COLLECTIONS (set in wrangler.toml)
 */

const TTL_SECONDS = 60 * 60 * 24 * 90 // 90 days
const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const CODE_LENGTH = 8
const MAX_PAYLOAD_BYTES = 4_000_000 // 4 MB — generous enough for any base64 image

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function generateCode(randomBytes) {
  return Array.from(randomBytes)
    .map((b) => CODE_CHARS[b % CODE_CHARS.length])
    .join('')
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // ── POST / — store payload, return short code ─────────────────────────
    if (request.method === 'POST' && url.pathname === '/') {
      const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10)
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return json({ error: 'payload_too_large' }, 413)
      }

      let body
      try {
        body = await request.text()
      } catch {
        return json({ error: 'read_error' }, 400)
      }

      if (!body || body.length > MAX_PAYLOAD_BYTES) {
        return json({ error: 'payload_too_large' }, 413)
      }

      // Validate it's a legitimate collection export
      let parsed
      try {
        parsed = JSON.parse(body)
      } catch {
        return json({ error: 'invalid_json' }, 400)
      }
      if (parsed.version !== 1 || !Array.isArray(parsed.links)) {
        return json({ error: 'invalid_payload' }, 400)
      }

      // Generate unique code (retry once on collision — astronomically unlikely)
      const bytes = new Uint8Array(CODE_LENGTH)
      crypto.getRandomValues(bytes)
      let code = generateCode(bytes)

      const existing = await env.COLLECTIONS.get(code)
      if (existing) {
        crypto.getRandomValues(bytes)
        code = generateCode(bytes)
      }

      await env.COLLECTIONS.put(code, body, { expirationTtl: TTL_SECONDS })

      return json({ code }, 201)
    }

    // ── GET /{code} — retrieve payload ────────────────────────────────────
    if (request.method === 'GET') {
      const code = url.pathname.slice(1) // strip leading /
      if (!/^[a-z0-9]{8}$/.test(code)) {
        return json({ error: 'not_found' }, 404)
      }

      const data = await env.COLLECTIONS.get(code)
      if (!data) {
        return json({ error: 'not_found' }, 404)
      }

      return new Response(data, {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return json({ error: 'not_found' }, 404)
  },
}
