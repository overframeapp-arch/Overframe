/**
 * Strict domain matching for URL hostnames.
 *
 * `hostname.includes('example.com')` is spoofable — `example.com.evil.io` and
 * `notexample.com` both pass (CodeQL js/incomplete-url-substring-sanitization).
 * A hostname belongs to a domain only when it IS the domain or ends with
 * `.domain`.
 */
export function hostMatchesDomain(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase()
  const d = domain.toLowerCase()
  return h === d || h.endsWith('.' + d)
}
