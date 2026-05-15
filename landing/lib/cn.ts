import type { ClassValue } from './types'

/**
 * Tiny classnames helper — concatenates truthy strings.
 * No dependency on `clsx` to keep the bundle minimal.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v) continue
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) out.push(cn(...v))
    else if (typeof v === 'object') {
      for (const [k, ok] of Object.entries(v)) if (ok) out.push(k)
    }
  }
  return out.join(' ')
}
