import { describe, it, expect, beforeEach, vi } from 'vitest'
import { inflateSync } from 'node:zlib'
import type { Collection, CollectionAuthor, CollectionExport, CreatorLink, CreatorPlatform } from '@shared/types'
import { MAX_PINNED_LINKS, MAX_CREATOR_LINKS, MAX_COLLECTION_SECTIONS } from '@shared/types'

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

  it('setBannerUrl sets and clears the banner, rejecting unsafe values', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setBannerUrl(c.id, 'https://i/banner.png')?.bannerUrl).toBe('https://i/banner.png')
    expect(mgr.setBannerUrl(c.id, 'javascript:1')?.bannerUrl).toBeUndefined()
    expect(mgr.setBannerUrl(c.id, null)?.bannerUrl).toBeUndefined()
    expect(mgr.setBannerUrl('nope', null)).toBeNull()
  })

  it('setBannerFocus clamps x/y/zoom into range and clears on null', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setBannerFocus(c.id, { x: 10, y: 20, zoom: 2 })?.bannerFocus).toEqual({ x: 10, y: 20, zoom: 2 })
    expect(mgr.setBannerFocus(c.id, { x: -5, y: 150, zoom: 99 })?.bannerFocus).toEqual({ x: 0, y: 100, zoom: 4 })
    expect(mgr.setBannerFocus(c.id, { x: 10, y: 10, zoom: 0 })?.bannerFocus).toEqual({ x: 10, y: 10, zoom: 1 })
    expect(mgr.setBannerFocus(c.id, { x: NaN, y: 10, zoom: 1 })?.bannerFocus).toBeUndefined()
    expect(mgr.setBannerFocus(c.id, null)?.bannerFocus).toBeUndefined()
    expect(mgr.setBannerFocus('nope', null)).toBeNull()
  })

  it('setIconFocus clamps x/y/zoom into range and clears on null', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setIconFocus(c.id, { x: 10, y: 20, zoom: 2 })?.iconFocus).toEqual({ x: 10, y: 20, zoom: 2 })
    expect(mgr.setIconFocus(c.id, { x: -5, y: 150, zoom: 99 })?.iconFocus).toEqual({ x: 0, y: 100, zoom: 4 })
    expect(mgr.setIconFocus(c.id, { x: 10, y: 10, zoom: 0 })?.iconFocus).toEqual({ x: 10, y: 10, zoom: 1 })
    expect(mgr.setIconFocus(c.id, { x: NaN, y: 10, zoom: 1 })?.iconFocus).toBeUndefined()
    expect(mgr.setIconFocus(c.id, null)?.iconFocus).toBeUndefined()
    expect(mgr.setIconFocus('nope', null)).toBeNull()
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

function decodeExport(base64: string): CollectionExport {
  return JSON.parse(inflateSync(Buffer.from(base64, 'base64')).toString('utf8')) as CollectionExport
}

describe('CollectionsManager — export', () => {
  it('exports a deflate-compressed payload, keeping only http(s) favicons', () => {
    const c = mgr.create({ name: 'Builds', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'web', url: 'https://w', favicon: 'https://w/f.ico' })
    mgr.addLink(c.id, { title: 'data', url: 'https://d', favicon: 'data:image/png;base64,AAAA' })
    mgr.addLink(c.id, { title: 'plain', url: 'https://p' }) // no favicon at all
    const out = mgr.export(c.id)!
    const decoded = decodeExport(out)
    expect(decoded.version).toBe(1)
    expect(decoded.name).toBe('Builds')
    expect(decoded.links[0].favicon).toBe('https://w/f.ico')
    expect(decoded.links[1].favicon).toBeUndefined() // data: favicon stripped
    expect(decoded.links[2].favicon).toBeUndefined() // absent favicon stays absent
  })

  it('export includes iconUrl when present and returns null for unknown id', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1', iconUrl: 'https://i/x.png' })
    const decoded = decodeExport(mgr.export(c.id)!)
    expect(decoded.iconUrl).toBe('https://i/x.png')
    expect(mgr.export('nope')).toBeNull()
  })

  it('export carries banner + icon/banner focus, and omits them when absent', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1', iconUrl: 'https://i/x.png' })
    mgr.setBannerUrl(c.id, 'https://i/banner.png')
    mgr.setBannerFocus(c.id, { x: 30, y: 60, zoom: 2 })
    mgr.setIconFocus(c.id, { x: 10, y: 20, zoom: 1.5 })
    const decoded = decodeExport(mgr.export(c.id)!)
    expect(decoded.bannerUrl).toBe('https://i/banner.png')
    expect(decoded.bannerFocus).toEqual({ x: 30, y: 60, zoom: 2 })
    expect(decoded.iconFocus).toEqual({ x: 10, y: 20, zoom: 1.5 })

    const plain = mgr.create({ name: 'Y', profileId: 'p1' })
    const d2 = decodeExport(mgr.export(plain.id)!)
    expect(d2.bannerUrl).toBeUndefined()
    expect(d2.bannerFocus).toBeUndefined()
    expect(d2.iconFocus).toBeUndefined()
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

  it('imports banner + focus data, sanitizing hostile values', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'Styled',
      source: 'community',
      bannerUrl: 'https://i/banner.png',
      bannerFocus: { x: 30, y: 60, zoom: 2 },
      iconFocus: { x: -5, y: 150, zoom: 99 }, // out of range → clamped
      links: [],
    }
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.bannerUrl).toBe('https://i/banner.png')
    expect(c.bannerFocus).toEqual({ x: 30, y: 60, zoom: 2 })
    expect(c.iconFocus).toEqual({ x: 0, y: 100, zoom: 4 })

    const hostile = mgr.import(b64({
      version: 1, name: 'x', source: 'user',
      bannerUrl: 'javascript:1',
      bannerFocus: { x: NaN, y: 1, zoom: 1 },
      iconFocus: 'evil' as unknown as { x: number; y: number; zoom: number },
      links: [],
    }), 'p1')!
    expect(hostile.bannerUrl).toBeUndefined()
    expect(hostile.bannerFocus).toBeUndefined()
    expect(hostile.iconFocus).toBeUndefined()
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

describe('CollectionsManager — author & description', () => {
  it('create stores a sanitized description and author', () => {
    const c = mgr.create({
      name: 'X',
      profileId: 'p1',
      description: '  My league-start setup  ',
      author: { handle: ' roirr ', color: '#AABBCC' },
    })
    expect(c.description).toBe('My league-start setup')
    expect(c.author).toEqual({ handle: 'roirr', color: '#aabbcc' })
  })

  it('create strips control characters (incl. DEL) from text fields', () => {
    const description = 'a' + String.fromCharCode(1) + 'b' + String.fromCharCode(127) + 'c'
    const c = mgr.create({ name: 'X', profileId: 'p1', description })
    expect(c.description).toBe('a b c')
  })

  it('create drops an empty handle / invalid colour, and accepts a handle without colour', () => {
    expect(mgr.create({ name: 'X', profileId: 'p1', author: { handle: '   ' } as CollectionAuthor }).author).toBeUndefined()
    expect(mgr.create({ name: 'X', profileId: 'p1', author: { handle: 'h', color: 'red' } as CollectionAuthor }).author).toEqual({ handle: 'h' })
    expect(mgr.create({ name: 'X', profileId: 'p1', author: { handle: 'solo' } }).author).toEqual({ handle: 'solo' })
  })

  it('create leaves description and author absent when not provided', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(c.description).toBeUndefined()
    expect(c.author).toBeUndefined()
  })

  it('export includes description and author when present, omits them otherwise', () => {
    const c = mgr.create({ name: 'B', profileId: 'p1', description: 'desc', author: { handle: 'roirr', color: '#aabbcc' } })
    const decoded = decodeExport(mgr.export(c.id)!)
    expect(decoded.description).toBe('desc')
    expect(decoded.author).toEqual({ handle: 'roirr', color: '#aabbcc' })

    const plain = mgr.create({ name: 'P', profileId: 'p1' })
    const d2 = decodeExport(mgr.export(plain.id)!)
    expect(d2.description).toBeUndefined()
    expect(d2.author).toBeUndefined()
  })

  it('import clamps the description and sanitizes the author', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'x',
      source: 'community',
      description: 'd'.repeat(500),
      author: { handle: 'a'.repeat(50), color: '#abcdef' },
      links: [],
    }
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.description).toHaveLength(280)
    expect(c.author!.handle).toHaveLength(30)
    expect(c.author!.color).toBe('#abcdef')
  })

  it('import drops an invalid author (bad colour, non-object, empty handle) and missing fields', () => {
    const badColor = mgr.import(b64({ version: 1, name: 'x', source: 'user', author: { handle: 'h', color: 'nope' } as CollectionAuthor, links: [] }), 'p1')!
    expect(badColor.author).toEqual({ handle: 'h' })

    const notObject = mgr.import(b64({ version: 1, name: 'x', source: 'user', author: 'evil' as unknown as CollectionAuthor, links: [] }), 'p1')!
    expect(notObject.author).toBeUndefined()

    const emptyHandle = mgr.import(b64({ version: 1, name: 'x', source: 'user', author: { handle: '  ' } as CollectionAuthor, links: [] }), 'p1')!
    expect(emptyHandle.author).toBeUndefined()

    const missing = mgr.import(b64({ version: 1, name: 'x', source: 'user', links: [] }), 'p1')!
    expect(missing.description).toBeUndefined()
    expect(missing.author).toBeUndefined()
  })
})

describe('CollectionsManager — previewImport', () => {
  it('returns the sanitized payload without persisting it', () => {
    const payload: CollectionExport = {
      version: 1,
      name: 'Preview',
      source: 'community',
      description: 'd',
      author: { handle: 'roirr' },
      links: [{ title: 'a', url: 'https://a', pinned: false }],
    }
    const preview = mgr.previewImport(b64(payload))!
    expect(preview.name).toBe('Preview')
    expect(preview.source).toBe('community')
    expect(preview.description).toBe('d')
    expect(preview.author).toEqual({ handle: 'roirr' })
    expect(preview.links).toHaveLength(1)
    expect(mgr.getAll()).toHaveLength(0) // preview never persists
  })

  it('returns null for an invalid payload', () => {
    expect(mgr.previewImport(Buffer.from('not json', 'utf8').toString('base64'))).toBeNull()
  })
})

describe('CollectionsManager — creator links', () => {
  const twitch: CreatorLink = { platform: 'twitch', url: 'https://twitch.tv/roirr' }

  it('create keeps valid creator links, dropping unknown platforms, bad urls and non-objects', () => {
    const c = mgr.create({
      name: 'X',
      profileId: 'p1',
      author: {
        handle: 'roirr',
        links: [
          twitch,
          { platform: 'myspace' as CreatorPlatform, url: 'https://myspace.com/x' }, // unknown platform
          { platform: 'youtube', url: 'javascript:alert(1)' },                      // non-http url
          'evil' as unknown as CreatorLink,                                          // non-object entry
        ],
      },
    })
    expect(c.author?.links).toEqual([twitch])
  })

  it('create caps creator links at MAX_CREATOR_LINKS', () => {
    const links: CreatorLink[] = Array.from({ length: MAX_CREATOR_LINKS + 2 }, (_, i) => ({
      platform: 'website',
      url: `https://site${i}.tld`,
    }))
    const c = mgr.create({ name: 'X', profileId: 'p1', author: { handle: 'h', links } })
    expect(c.author?.links).toHaveLength(MAX_CREATOR_LINKS)
  })

  it('create drops the author entirely when links are all invalid and the handle is empty', () => {
    const c = mgr.create({
      name: 'X',
      profileId: 'p1',
      author: { handle: '', links: [{ platform: 'youtube', url: 'not a url' }] },
    })
    expect(c.author).toBeUndefined()
  })

  it('create accepts an author whose handle field is missing, defaulting it to an empty string', () => {
    const c = mgr.create({
      name: 'X',
      profileId: 'p1',
      author: { links: [twitch] } as unknown as CollectionAuthor,
    })
    expect(c.author).toEqual({ handle: '', links: [twitch] })
  })
})

describe('CollectionsManager — sections', () => {
  it('addLink stores a sanitized section and omits a blank one', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    const withSection = mgr.addLink(c.id, { title: 'a', url: 'https://a', section: '  Guides  ' })!
    expect(withSection.links[0].section).toBe('Guides')
    const withBlank = mgr.addLink(c.id, { title: 'b', url: 'https://b', section: '   ' })!
    expect(withBlank.links[1].section).toBeUndefined()
  })

  it('updateLink sets, sanitizes, and clears the section', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    const withLink = mgr.addLink(c.id, { title: 'a', url: 'https://a' })!
    const id = withLink.links[0].id
    expect(mgr.updateLink(c.id, id, { section: '  S  ' })!.links[0].section).toBe('S')
    expect(mgr.updateLink(c.id, id, { section: null })!.links[0].section).toBeUndefined()
    expect(mgr.updateLink(c.id, id, { section: '   ' })!.links[0].section).toBeUndefined()
  })

  it('setSections trims, drops empties, and caps at MAX_COLLECTION_SECTIONS', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setSections(c.id, ['  A  ', '', '   ', 'B'])!.sections).toEqual(['A', 'B'])
    const many = Array.from({ length: MAX_COLLECTION_SECTIONS + 5 }, (_, i) => `s${i}`)
    expect(mgr.setSections(c.id, many)!.sections).toHaveLength(MAX_COLLECTION_SECTIONS)
    expect(mgr.setSections('nope', [])).toBeNull()
  })

  it('renameSection renames the section and relabels only its links', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.setSections(c.id, ['A', 'B'])
    mgr.addLink(c.id, { title: 'a', url: 'https://a', section: 'A' })
    mgr.addLink(c.id, { title: 'b', url: 'https://b', section: 'B' })
    const after = mgr.renameSection(c.id, 'A', '  New  ')!
    expect(after.sections).toEqual(['New', 'B'])
    expect(after.links.map((l) => l.section)).toEqual(['New', 'B'])
  })

  it('renameSection rejects a blank new name and tolerates a collection without sections', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.renameSection(c.id, 'A', '   ')).toBeNull()
    expect(mgr.renameSection(c.id, 'ghost', 'New')!.sections).toEqual([])
    expect(mgr.renameSection('nope', 'A', 'B')).toBeNull()
  })

  it('deleteSection removes the section and unsections only its links', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.setSections(c.id, ['A', 'B'])
    mgr.addLink(c.id, { title: 'a', url: 'https://a', section: 'A' })
    mgr.addLink(c.id, { title: 'b', url: 'https://b', section: 'B' })
    const after = mgr.deleteSection(c.id, 'A')!
    expect(after.sections).toEqual(['B'])
    expect(after.links[0].section).toBeUndefined()
    expect(after.links[1].section).toBe('B')
  })

  it('deleteSection tolerates a collection without sections', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.deleteSection(c.id, 'ghost')!.sections).toEqual([])
    expect(mgr.deleteSection('nope', 'A')).toBeNull()
  })

  it('export carries the sections list and per-link sections', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.setSections(c.id, ['A'])
    mgr.addLink(c.id, { title: 'a', url: 'https://a', section: 'A' })
    const decoded = decodeExport(mgr.export(c.id)!)
    expect(decoded.sections).toEqual(['A'])
    expect(decoded.links[0].section).toBe('A')
  })

  it('import sanitizes sections (non-strings and blanks dropped, trimmed, capped) and keeps link sections', () => {
    const payload = {
      version: 1,
      name: 'x',
      source: 'user',
      sections: ['  A  ', '', 123, 'B'],
      links: [
        { title: 'a', url: 'https://a', pinned: false, section: '  A  ' },
        { title: 'b', url: 'https://b', pinned: false, section: '   ' },
      ],
    } as unknown as CollectionExport
    const c = mgr.import(b64(payload), 'p1')!
    expect(c.sections).toEqual(['A', 'B'])
    expect(c.links[0].section).toBe('A')
    expect(c.links[1].section).toBeUndefined()

    const many = Array.from({ length: MAX_COLLECTION_SECTIONS + 5 }, (_, i) => `s${i}`)
    const capped = mgr.import(b64({ version: 1, name: 'x', source: 'user', sections: many, links: [] }), 'p1')!
    expect(capped.sections).toHaveLength(MAX_COLLECTION_SECTIONS)
  })
})

describe('CollectionsManager — moveLink', () => {
  /** Collection with links a (section 'S'), b (unsorted), c (unsorted). */
  function seed(): { id: string; a: Collection['links'][0]; b: Collection['links'][0]; cc: Collection['links'][0] } {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    mgr.addLink(c.id, { title: 'a', url: 'https://a', section: 'S' })
    mgr.addLink(c.id, { title: 'b', url: 'https://b' })
    const full = mgr.addLink(c.id, { title: 'c', url: 'https://c' })!
    const [a, b, cc] = full.links
    return { id: c.id, a, b, cc }
  }

  it('moves a link into a section before the given link and re-indexes order', () => {
    const { id, a, cc } = seed()
    const after = mgr.moveLink(id, cc.id, 'S', a.id)!
    expect(after.links.map((l) => l.title)).toEqual(['c', 'a', 'b'])
    expect(after.links[0].section).toBe('S')
    expect(after.links.map((l) => l.order)).toEqual([0, 1, 2])
  })

  it('appends to the end of the (sanitized) target section when insertBeforeLinkId is null', () => {
    const { id, cc } = seed()
    const after = mgr.moveLink(id, cc.id, '  S  ', null)!
    expect(after.links.map((l) => l.title)).toEqual(['a', 'c', 'b'])
    expect(after.links[1].section).toBe('S')
  })

  it('moves a link to unsorted when targetSection is null, appending after the last unsorted link', () => {
    const { id, a } = seed()
    const after = mgr.moveLink(id, a.id, null, null)!
    expect(after.links.map((l) => l.title)).toEqual(['b', 'c', 'a'])
    expect(after.links[2].section).toBeUndefined()
  })

  it('treats a blank targetSection as unsorted', () => {
    const { id, a } = seed()
    const after = mgr.moveLink(id, a.id, '   ', null)!
    expect(after.links[2].title).toBe('a')
    expect(after.links[2].section).toBeUndefined()
  })

  it('appends at the very end when insertBeforeLinkId is unknown', () => {
    const { id, a } = seed()
    const after = mgr.moveLink(id, a.id, 'S', 'ghost')!
    expect(after.links.map((l) => l.title)).toEqual(['b', 'c', 'a'])
  })

  it('appends at the very end when the target section has no links yet', () => {
    const { id, cc } = seed()
    const after = mgr.moveLink(id, cc.id, 'Empty', null)!
    expect(after.links.map((l) => l.title)).toEqual(['a', 'b', 'c'])
    expect(after.links[2].section).toBe('Empty')
  })

  it('returns the collection unchanged for an unknown link id, and null for an unknown collection', () => {
    const { id } = seed()
    const after = mgr.moveLink(id, 'ghost', 'S', null)!
    expect(after.links.map((l) => l.title)).toEqual(['a', 'b', 'c'])
    expect(mgr.moveLink('nope', 'x', null, null)).toBeNull()
  })
})

describe('CollectionsManager — setDescription / setAuthor', () => {
  it('setDescription sets, sanitizes, clears, and returns null for an unknown id', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setDescription(c.id, '  hi  ')?.description).toBe('hi')
    expect(mgr.setDescription(c.id, '   ')?.description).toBeUndefined() // empty after sanitize → cleared
    expect(mgr.setDescription(c.id, null)?.description).toBeUndefined()
    expect(mgr.setDescription('nope', 'x')).toBeNull()
  })

  it('setAuthor sets, sanitizes, clears, and returns null for an unknown id', () => {
    const c = mgr.create({ name: 'X', profileId: 'p1' })
    expect(mgr.setAuthor(c.id, { handle: 'roirr', color: '#aabbcc' })?.author).toEqual({ handle: 'roirr', color: '#aabbcc' })
    expect(mgr.setAuthor(c.id, { handle: '  ' } as CollectionAuthor)?.author).toBeUndefined() // invalid → cleared
    expect(mgr.setAuthor(c.id, null)?.author).toBeUndefined()
    expect(mgr.setAuthor('nope', null)).toBeNull()
  })
})
