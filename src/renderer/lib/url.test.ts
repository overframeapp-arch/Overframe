import { describe, it, expect } from 'vitest'
import { sanitizeIconUrl } from './url'

describe('sanitizeIconUrl', () => {
  it('returns undefined for empty or whitespace input', () => {
    expect(sanitizeIconUrl('')).toBeUndefined()
    expect(sanitizeIconUrl('   ')).toBeUndefined()
  })

  it('passes through data:image base64 URLs unchanged', () => {
    const u = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeIconUrl(u)).toBe(u)
  })

  it('rejects non-image data: URLs (scriptable)', () => {
    expect(sanitizeIconUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined()
  })

  it('normalises and allows http/https', () => {
    expect(sanitizeIconUrl('http://example.com/a.png')).toBe('http://example.com/a.png')
    // trailing slash added by the URL parser — proves we return the normalised href
    expect(sanitizeIconUrl('https://example.com')).toBe('https://example.com/')
  })

  it('allows file: and blob: protocols', () => {
    expect(sanitizeIconUrl('file:///C:/icon.png')).toBe('file:///C:/icon.png')
    expect(sanitizeIconUrl('blob:https://example.com/uuid')).toBe('blob:https://example.com/uuid')
  })

  it('rejects javascript: and other scriptable protocols', () => {
    expect(sanitizeIconUrl('javascript:alert(1)')).toBeUndefined()
    expect(sanitizeIconUrl('vbscript:msgbox')).toBeUndefined()
  })

  it('returns undefined for unparseable input', () => {
    expect(sanitizeIconUrl('not a url')).toBeUndefined()
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(sanitizeIconUrl('  https://example.com/x.png  ')).toBe('https://example.com/x.png')
  })
})
