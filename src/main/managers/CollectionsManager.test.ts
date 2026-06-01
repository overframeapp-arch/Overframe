import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Collection, CollectionExport } from '@shared/types'
import { MAX_PINNED_LINKS } from '@shared/types'

// In-memory replacement for the electron-store-backed `store` module.
const h = vi.hoisted(() => ({ collections: [] as Collection[] }))
vi.mock('../store', () => ({
  store: {
    get: (key: string) => (key === 'collections' ? h.collections : undefined),
    set: (key: string, val: unknown) => {
      if (key === 'collections') h.collections = val as Collection[]
    },
  },
}))

import { CollectionsManager } from './CollectionsManager'

let mgr: CollectionsManager

beforeEach(() => {
  h.collections = []
  mgr = new CollectionsManager()
})

function b64(payload: CollectionExport): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

describe('CollectionsManager — create / read', () => {
  it('creates a collection with defaults', () => {
    const c = mgr.create({ name: 'Builds', profileId: 'p1' })
    expect(c.id).toBeTruthy()
    expect(c.source).toBe('user')
    expect(c.links).toEqual([])
    expect(c.iconUrl).toBeUndefined()
    expect(mgr.getAll()).toHaveLength(1)
  })

  it('honours an explicit source and iconUrl', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1', source: 'community', iconUrl: 'https://i/x.png' })
    expect(c.source).toBe('community')
    expect(c.iconUrl).toBe('https://i/x.png')
  })

  it('getById returns the collection or undefined', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.getById(c.id)?.name).toBe('X')
    expect(mgr.getById('nope')).toBeUndefined()
  })

  it('getForProfile returns own + shared collections', () => {
    mgr.create({ name: 'own', profileId: 'p1' })
    mgr.create({ name: 'shared', profileId: 'shared' })
    mgr.create({ name: 'other', profileId: 'p2' })
    expect(mgr.getForProfile('p1').map((c) => c.name).sort()).toEqual(['own', 'shared'])
  })

  it('getPinnedForProfile collects pinned links and caps at MAX_PINNED_LINKS', () => {
    const c = mgr.create({ name: 'c', profileId: 'p1' })
    for (let i = 0; i < MAX_PINNED_LINKS + 3; i++) {
      mgr.addLink(c.id, { title: `t${i}`, url: `https://e/${i}`, pinned: true })
    }
    mgr.addLink(c.id, { title: 'unpinned', url: 'https://e/u' })
    const pinned = mgr.getPinnedForProfile('p1')
    expect(pinned).toHaveLength(MAX_PINNED_LINKS)
    expect(pinned.every((p) => p.collectionId === c.id)).toBe(true)
  })
})

describe('CollectionsManager — mutations', () => {
  it('remove deletes a collection', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.remove(c.id)
    expect(mgr.getAll()).toHaveLength(0)
  })

  it('rename updates the name, or returns null for unknown id', () => {
    const c = mgr.create({ name: 'old', profileId: 'p1' })
    expect(mgr.rename(c.id, 'new')?.name).toBe('new')
    expect(mgr.rename('nope', 'x')).toBeNull()
  })

  it('setIconUrl sets and clears the icon', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setIconUrl(c.id, 'https://i/x.png')?.iconUrl).toBe('https://i/x.png')
    expect(mgr.setIconUrl(c.id, null)?.iconUrl).toBeUndefined()
    expect(mgr.setIconUrl('nope', null)).toBeNull()
  })

  it('addLink appends with defaults and order', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    const updated = mgr.addLink(c.id, { title: 'a', url: 'https://a' })
    expect(updated?.links[0]).toMatchObject({ title: 'a', pinned: false, order: 0 })
    const updated2 = mgr.addLink(c.id, { title: 'b', url: 'https://b', pinned: true })
    expect(updated2?.links[1]).toMatchObject({ order: 1, pinned: true })
    expect(mgr.addLink('nope', { title: 'x', url: 'https://x' })).toBeNull()
  })

  it('removeLink drops a link and re-indexes order', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'a', url: 'https://a' })
    const withB = mgr.addLink(c.id, { title: 'b', url: 'https://b' })!
    const aId = withB.links[0].id
    const after = mgr.removeLink(c.id, aId)!
    expect(after.links.map((l) => l.title)).toEqual(['b'])
    expect(after.links[0].order).toBe(0)
  })

  it('updateLink patches the matching link and leaves others untouched', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'a', url: 'https://a' })
    const withTwo = mgr.addLink(c.id, { title: 'b', url: 'https://b' })!
    const aId = withTwo.links[0].id
    const after = mgr.updateLink(c.id, aId, { title: 'A!' })!
    expect(after.links[0].title).toBe('A!')
    expect(after.links[1].title).toBe('b') // untouched
  })

  it('togglePin flips only the targeted link', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'a', url: 'https://a' })
    const withTwo = mgr.addLink(c.id, { title: 'b', url: 'https://b' })!
    const aId = withTwo.links[0].id
    const t1 = mgr.togglePin(c.id, aId)!
    expect(t1.links[0].pinned).toBe(true)  // 'a' toggled on
    expect(t1.links[1].pinned).toBe(false) // 'b' untouched (else branch)
    const t2 = mgr.togglePin(c.id, aId)!
    expect(t2.links[0].pinned).toBe(false) // 'a' toggled back off
  })

  it('reorderLinks reorders by id and appends any extras', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'a', url: 'https://a' })
    mgr.addLink(c.id, { title: 'b', url: 'https://b' })
    const withThree = mgr.addLink(c.id, { title: 'c', url: 'https://c' })!
    const [a, b, cc] = withThree.links
    // Reorder providing only b and a; c is an "extra" appended at the end.
    const after = mgr.reorderLinks(c.id, [b.id, a.id])!
    expect(after.links.map((l) => l.title)).toEqual(['b', 'a', 'c'])
    expect(after.links.map((l) => l.order)).toEqual([0, 1, 2])
    // unknown id is ignored
    expect(mgr.reorderLinks(c.id, ['ghost', cc.id])!.links[0].title).toBe('c')
    expect(mgr.reorderLinks('nope', [])).toBeNull()
  })

  it('reorder sorts collections by the given id order, unknown ids last', () => {
    const a = mgr.create({ name: 'a', profileId: 'p1' })
    mgr.create({ name: 'b', profileId: 'p1' }) // exists in the store but omitted below
    const cc = mgr.create({ name: 'c', profileId: 'p1' })
    mgr.reorder([cc.id, a.id]) // b omitted → goes last (Infinity)
    expect(mgr.getAll().map((c) => c.name)).toEqual(['c', 'a', 'b'])
  })
})

describe('CollectionsManager — export', () => {
  it('exports a collection as base64 JSON, keeping only http(s) favicons', () => {
    const c = mgr.create({ name: 'Builds', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'web', url: 'https://w', favicon: 'https://w/f.ico' })
    mgr.addLink(c.id, { title: 'data', url: 'https://d', favicon: 'data:image/png;base64,AAAA' })
    mgr.addLink(c.id, { title: 'plain', url: 'https://p' }) // no favicon at all
    const out = mgr.export(c.id)!
    const decoded = JSON.parse(Buffer.from(out, 'base64').toString('utf8')) as CollectionExport
    expect(decoded.version).toBe(1)
    expect(decoded.name).toBe('Builds')
    expect(decoded.links[0].favicon).toBe('https://w/f.ico')
    expect(decoded.links[1].favicon).toBeUndefined() // data: favicon stripped
    expect(decoded.links[2].favicon).toBeUndefined() // absent favicon stays absent
  })

  it('export includes iconUrl when present and returns null for unknown id', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1', iconUrl: 'https://i/x.png' })
    const decoded = JSON.parse(Buffer.from(mgr.export(c.id)!, 'base64').toString('utf8')) as CollectionExport
    expect(decoded.iconUrl).toBe('https://i/x.png')
    expect(mgr.export('nope')).toBeNull()
  })
})

describe('CollectionsManager — import', () => {
  it('imports a valid payload into a new collection', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'Imported',
      source: 'community',
      iconUrl: 'https://i/x.png',
      links: [{ title: 'a', url: 'https://a', pinned: true, favicon: 'https://a/f.ico' }],
    }
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.name).toBe('Imported')
    expect(c.source).toBe('community')
    expect(c.profileId).toBe('p1')
    expect(c.iconUrl).toBe('https://i/x.png')
    expect(c.links).toHaveLength(1)
    expect(c.links[0]).toMatchObject({ url: 'https://a', pinned: true, order: 0, favicon: 'https://a/f.ico' })
  })

  it('returns null when base64 decoding throws', () => {
    expect(mgr.import(undefined as unknown as string, 'p1')).toBeNull()
  })

  it('returns null for non-JSON content', () => {
    expect(mgr.import(Buffer.from('not json', 'utf8').toString('base64'), 'p1')).toBeNull()
  })

  it('rejects wrong version or non-array links', () => {
    expect(mgr.import(b64({ version: 2 as unknown as 1, name: 'x', source: 'user', links: [] }), 'p1')).toBeNull()
    expect(mgr.import(b64({ version: 1, name: 'x', source: 'user', links: 'nope' as unknown as [] }), 'p1')).toBeNull()
  })

  it('falls back to source "user" for an unknown source value', () => {
    const c = mgr.import(b64({ version: 1, name: 'x', source: 'evil' as unknown as 'user', links: [] }), 'p1')!
    expect(c.source).toBe('user')
  })

  it('drops links whose url is not http(s) or is unparseable', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'x',
      source: 'user',
      links: [
        { title: 'ok', url: 'https://ok', pinned: false },
        { title: 'js', url: 'javascript:alert(1)', pinned: false },
        { title: 'bad', url: 'not a url', pinned: false },
      ],
    }
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.links.map((l) => l.url)).toEqual(['https://ok'])
  })

  it('keeps only http(s) favicons, dropping data: and unparseable ones', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'x',
      source: 'user',
      links: [
        { title: 'a', url: 'https://a', pinned: false, favicon: 'https://a/f.ico' },
        { title: 'b', url: 'https://b', pinned: false, favicon: 'data:image/png;base64,AAAA' },
        { title: 'c', url: 'https://c', pinned: false, favicon: 'http%' },
      ],
    }
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.links.map((l) => l.favicon)).toEqual(['https://a/f.ico', undefined, undefined])
  })

  it('accepts a data:image iconUrl', () => {
    const c = mgr.import(b64({ version: 1, name: 'x', source: 'user', iconUrl: 'data:image/png;base64,AAAA', links: [] }), 'p1')!
    expect(c.iconUrl).toBe('data:image/png;base64,AAAA')
  })

  it('drops an iconUrl that is non-http, too long, or unparseable', () => {
    const tooLong = 'https://x/' + 'a'.repeat(70000)
    expect(mgr.import(b64({ version: 1, name: 'x', source: 'user', iconUrl: tooLong, links: [] }), 'p1')!.iconUrl).toBeUndefined()
    expect(mgr.import(b64({ version: 1, name: 'x', source: 'user', iconUrl: 'javascript:1', links: [] }), 'p1')!.iconUrl).toBeUndefined()
    expect(mgr.import(b64({ version: 1, name: 'x', source: 'user', iconUrl: 'http%', links: [] }), 'p1')!.iconUrl).toBeUndefined()
  })

  it('clamps an overly long name to 200 chars', () => {
    const c = mgr.import(b64({ version: 1, name: 'n'.repeat(500), source: 'user', links: [] }), 'p1')!
    expect(c.name).toHaveLength(200)
  })

  it('coerces missing name / title / url fields from an untrusted payload', () => {
    const payload = {
      version: 1,
      source: 'user',
      // name omitted entirely → coerced to ''
      links: [
        { url: 'https://ok' }, // title + favicon omitted → title '', favicon undefined
        { title: 'no-url' },   // url omitted → '' → unparseable → dropped
      ],
    } as unknown as CollectionExport
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.name).toBe('')
    expect(c.links).toHaveLength(1)
    expect(c.links[0]).toMatchObject({ title: '', url: 'https://ok', favicon: undefined })
  })
})
