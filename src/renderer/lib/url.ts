/**
 * Normalize and allow only safe icon URL forms to prevent scriptable URL injection.
 *
 * Allowed forms:
 * - http: / https: / file: / blob:  — returned as the parser-normalised href
 * - data:image/<mime>;base64,…       — images can never execute scripts
 *
 * Everything else (javascript:, vbscript:, data:text/html, …) returns undefined.
 */
export function sanitizeIconUrl(url: string): string | undefined {
  const value = url.trim()
  if (!value) return undefined

  if (/^data:image\/[a-z+.-]+;base64,/.test(value)) return value

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:', 'file:', 'blob:'].includes(parsed.protocol)) return undefined
    // Return the parser-normalised href, never the raw tainted input.
    return parsed.href
  } catch {
    return undefined
  }
}
