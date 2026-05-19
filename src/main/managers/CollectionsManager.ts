import { randomUUID } from 'node:crypto'
import { store } from '../store'
import type {
  Collection,
  CollectionExport,
  CollectionSource,
  Link,
  NewCollection,
  NewLink
} from '@shared/types'
import { MAX_PINNED_LINKS } from '@shared/types'

export class CollectionsManager {
  getAll(): Collection[] {
    return store.get('collections')
  }

  getById(id: string): Collection | undefined {
    return this.getAll().find((c) => c.id === id)
  }

  getForProfile(profileId: string): Collection[] {
    return this.getAll().filter(
      (c) => c.profileId === profileId || c.profileId === 'shared'
    )
  }

  /** All pinned links across all collections visible in the active profile. */
  getPinnedForProfile(profileId: string): Array<{ collectionId: string; link: Link }> {
    const visible = this.getForProfile(profileId)
    const out: Array<{ collectionId: string; link: Link }> = []
    for (const c of visible) {
      for (const l of c.links) {
        if (l.pinned) out.push({ collectionId: c.id, link: l })
      }
    }
    return out.slice(0, MAX_PINNED_LINKS)
  }

  create(input: NewCollection): Collection {
    const now = Date.now()
    const collection: Collection = {
      id: randomUUID(),
      name: input.name,
      profileId: input.profileId,
      source: input.source ?? 'user',
      ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
      links: [],
      createdAt: now,
      updatedAt: now
    }
    this.persist([...this.getAll(), collection])
    return collection
  }

  remove(id: string): void {
    this.persist(this.getAll().filter((c) => c.id !== id))
  }

  rename(id: string, name: string): Collection | null {
    return this.mutate(id, (c) => ({ ...c, name }))
  }

  setIconUrl(id: string, iconUrl: string | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      if (iconUrl) updated.iconUrl = iconUrl
      else delete updated.iconUrl
      return updated
    })
  }

  addLink(collectionId: string, input: NewLink): Collection | null {
    return this.mutate(collectionId, (c) => {
      const link: Link = {
        id: randomUUID(),
        title: input.title,
        url: input.url,
        note: input.note,
        favicon: input.favicon,
        pinned: input.pinned ?? false,
        order: c.links.length
      }
      return { ...c, links: [...c.links, link] }
    })
  }

  removeLink(collectionId: string, linkId: string): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      links: c.links
        .filter((l) => l.id !== linkId)
        .map((l, i) => ({ ...l, order: i }))
    }))
  }

  updateLink(
    collectionId: string,
    linkId: string,
    patch: Partial<Pick<Link, 'title' | 'url' | 'note' | 'pinned' | 'favicon' | 'order'>>
  ): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      links: c.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l))
    }))
  }

  togglePin(collectionId: string, linkId: string): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      links: c.links.map((l) => (l.id === linkId ? { ...l, pinned: !l.pinned } : l))
    }))
  }

  /** Export a collection as a Base64-encoded JSON string. */
  export(id: string): string | null {
    const c = this.getById(id)
    if (!c) return null
    const payload: CollectionExport = {
      version: 1,
      name: c.name,
      source: c.source,
      ...(c.iconUrl ? { iconUrl: c.iconUrl } : {}),
      links: c.links.map((l) => ({
        title: l.title,
        url: l.url,
        note: l.note,
        pinned: l.pinned,
        // Only export http/https favicons — data: URLs are non-portable and large
        ...(l.favicon && /^https?:\/\//.test(l.favicon) ? { favicon: l.favicon } : {})
      }))
    }
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  }

  /** Import a Base64 string into a new collection assigned to the given profile. */
  import(base64: string, profileId: string | 'shared'): Collection | null {
    let json: string
    try {
      json = Buffer.from(base64, 'base64').toString('utf8')
    } catch {
      return null
    }
    let parsed: CollectionExport
    try {
      parsed = JSON.parse(json) as CollectionExport
    } catch {
      return null
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.links)) return null

    // Whitelist source field to prevent arbitrary strings from persisting in the store
    const VALID_SOURCES: CollectionSource[] = ['user', 'publisher', 'community']
    const source: CollectionSource = VALID_SOURCES.includes(parsed.source as CollectionSource)
      ? (parsed.source as CollectionSource)
      : 'user'

    const now = Date.now()
    const collection: Collection = {
      id: randomUUID(),
      name: String(parsed.name ?? '').slice(0, 200),
      profileId,
      source,
      ...(() => {
        if (typeof parsed.iconUrl === 'string' && parsed.iconUrl.length > 0 && parsed.iconUrl.length <= 65536) {
          const isDataImage = /^data:image\/[a-z+.-]+;base64,/.test(parsed.iconUrl)
          if (isDataImage) return { iconUrl: parsed.iconUrl }
          try {
            const proto = new URL(parsed.iconUrl).protocol
            if (proto === 'http:' || proto === 'https:') return { iconUrl: parsed.iconUrl }
          } catch { /* ignore */ }
        }
        return {}
      })(),
      links: parsed.links
        .map((l, i) => {
          const url = String(l.url ?? '')
          // Reject any non-http(s) URL to prevent javascript:/file:// injection
          try {
            const proto = new URL(url).protocol
            if (proto !== 'http:' && proto !== 'https:') return null
          } catch {
            return null
          }
          return {
            id: randomUUID(),
            title: String(l.title ?? '').slice(0, 500),
            url,
            note: l.note,
            favicon: (() => {
              if (typeof l.favicon !== 'string') return undefined
              try {
                const proto = new URL(l.favicon).protocol
                return (proto === 'http:' || proto === 'https:') ? l.favicon : undefined
              } catch { return undefined }
            })(),
            pinned: Boolean(l.pinned),
            order: i
          }
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
      createdAt: now,
      updatedAt: now
    }
    this.persist([...this.getAll(), collection])
    return collection
  }

  // ─────────────────────────────────────────────────────────────────

  /** Reorder links within a collection by providing the ordered array of link IDs. */
  reorderLinks(collectionId: string, linkIds: string[]): Collection | null {
    return this.mutate(collectionId, (c) => {
      const linkMap = new Map(c.links.map((l) => [l.id, l]))
      const reordered = linkIds
        .filter((id) => linkMap.has(id))
        .map((id, i) => ({ ...linkMap.get(id)!, order: i }))
      // Preserve any links not in linkIds (shouldn't happen, but safety)
      const included = new Set(linkIds)
      const extras = c.links
        .filter((l) => !included.has(l.id))
        .map((l, i) => ({ ...l, order: reordered.length + i }))
      return { ...c, links: [...reordered, ...extras] }
    })
  }

  /** Reorder collections for a given profile by providing the ordered array of collection IDs. */
  reorder(collectionIds: string[]): void {
    const all = this.getAll()
    const idxMap = new Map(collectionIds.map((id, i) => [id, i]))
    const reordered = [...all].sort((a, b) => {
      const ia = idxMap.get(a.id) ?? Infinity
      const ib = idxMap.get(b.id) ?? Infinity
      return ia - ib
    })
    this.persist(reordered)
  }

  // ─────────────────────────────────────────────────────────────────

  private mutate(id: string, fn: (c: Collection) => Collection): Collection | null {
    const all = this.getAll()
    const idx = all.findIndex((c) => c.id === id)
    if (idx === -1) return null
    const updated = { ...fn(all[idx]), id: all[idx].id, updatedAt: Date.now() }
    all[idx] = updated
    this.persist(all)
    return updated
  }

  private persist(collections: Collection[]): void {
    store.set('collections', collections)
  }
}
