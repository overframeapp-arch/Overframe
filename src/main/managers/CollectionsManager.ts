import { randomUUID } from 'node:crypto'
import { deflateSync, inflateSync } from 'node:zlib'
import { store } from '../store'
import type {
  BannerFocus,
  Collection,
  CollectionAuthor,
  CollectionExport,
  CollectionSource,
  CreatorLink,
  CreatorPlatform,
  Link,
  NewCollection,
  NewLink
} from '@shared/types'
import { MAX_PINNED_LINKS, MAX_CREATOR_LINKS, MAX_COLLECTION_SECTIONS, CREATOR_PLATFORMS } from '@shared/types'

// ── Sanitization ────────────────────────────────────────────────────────────────
// Shared by create() and decode(). Import payloads come from untrusted sources
// (Discord/Reddit/landing pages), so everything is validated and length-capped.

const MAX_HANDLE_LEN = 30
const MAX_DESCRIPTION_LEN = 280
const MAX_NOTE_LEN = 500
const MAX_NAME_LEN = 200
const MAX_TITLE_LEN = 500
const MAX_ICON_URL_LEN = 65536
const MAX_BANNER_ZOOM = 4
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Strip control chars, collapse whitespace, trim, cap length. Returns undefined when empty. */
function sanitizeText(raw: unknown, max: number): string | undefined {
  if (typeof raw !== 'string') return undefined
  let out = ''
  for (const ch of raw) {
    // Replace C0 control chars + DEL with a space (collapsed below); keep everything else.
    const code = ch.charCodeAt(0)
    out += code < 0x20 || code === 0x7f ? ' ' : ch
  }
  const cleaned = out.replace(/\s+/g, ' ').trim().slice(0, max)
  return cleaned.length > 0 ? cleaned : undefined
}

/** Accept only a #rrggbb hex colour — prevents CSS injection via the accent colour. */
function sanitizeColor(raw: unknown): string | undefined {
  return typeof raw === 'string' && HEX_COLOR_RE.test(raw) ? raw.toLowerCase() : undefined
}

const VALID_CREATOR_PLATFORMS = new Set<CreatorPlatform>(CREATOR_PLATFORMS)

function sanitizeCreatorLinks(raw: unknown): CreatorLink[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const links = (raw as unknown[])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => {
      const platform = l.platform as CreatorPlatform
      if (!VALID_CREATOR_PLATFORMS.has(platform)) return null
      const url = sanitizeHttpUrl(l.url)
      if (!url) return null
      return { platform, url } satisfies CreatorLink
    })
    .filter((l): l is CreatorLink => l !== null)
    .slice(0, MAX_CREATOR_LINKS)
  return links.length > 0 ? links : undefined
}

/** A creator signature: handle is optional (may be empty), links are the main payload. */
function sanitizeAuthor(raw: unknown): CollectionAuthor | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const rawHandle = (raw as { handle?: unknown }).handle
  const handle = typeof rawHandle === 'string' ? rawHandle.trim().slice(0, MAX_HANDLE_LEN) : ''
  const color = sanitizeColor((raw as { color?: unknown }).color)
  const links = sanitizeCreatorLinks((raw as { links?: unknown }).links)
  if (handle === '' && !color && !links) return undefined
  return {
    handle,
    ...(color ? { color } : {}),
    ...(links ? { links } : {}),
  }
}

/** Keep only http(s) URLs (used for favicons). */
function sanitizeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  try {
    const proto = new URL(raw).protocol
    return proto === 'http:' || proto === 'https:' ? raw : undefined
  } catch {
    return undefined
  }
}

/** Accept a data:image URL or an http(s) URL within the size cap; reject anything else. */
function sanitizeIconUrl(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_ICON_URL_LEN) {
    if (/^data:image\/[a-z+.-]+;base64,/.test(raw)) return raw
    try {
      const proto = new URL(raw).protocol
      if (proto === 'http:' || proto === 'https:') return raw
    } catch {
      /* ignore */
    }
  }
  return undefined
}

/** Clamp a focal point + zoom (banner or icon) to sane, tiny numeric ranges — never an image blob. */
function sanitizeFocus(raw: unknown): BannerFocus | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { x, y, zoom } = raw as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number' || typeof zoom !== 'number') return undefined
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return undefined
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    zoom: Math.min(MAX_BANNER_ZOOM, Math.max(1, zoom)),
  }
}

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
    const description = sanitizeText(input.description, MAX_DESCRIPTION_LEN)
    const author = sanitizeAuthor(input.author)
    const collection: Collection = {
      id: randomUUID(),
      name: input.name,
      profileId: input.profileId,
      source: input.source ?? 'user',
      ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
      ...(description ? { description } : {}),
      ...(author ? { author } : {}),
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

  setDescription(id: string, description: string | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      const clean = description ? sanitizeText(description, MAX_DESCRIPTION_LEN) : undefined
      if (clean) updated.description = clean
      else delete updated.description
      return updated
    })
  }

  /** Stamp (or clear) the creator signature that travels with the collection when shared. */
  setAuthor(id: string, author: CollectionAuthor | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      const clean = author ? sanitizeAuthor(author) : undefined
      if (clean) updated.author = clean
      else delete updated.author
      return updated
    })
  }

  setIconUrl(id: string, iconUrl: string | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      if (iconUrl) updated.iconUrl = iconUrl
      else delete updated.iconUrl
      return updated
    })
  }

  /** Pan/zoom applied to iconUrl at render time — plain numbers, never a re-encoded image. */
  setIconFocus(id: string, focus: BannerFocus | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      const clean = focus ? sanitizeFocus(focus) : undefined
      if (clean) updated.iconFocus = clean
      else delete updated.iconFocus
      return updated
    })
  }

  setBannerUrl(id: string, bannerUrl: string | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      const clean = bannerUrl ? sanitizeIconUrl(bannerUrl) : undefined
      if (clean) updated.bannerUrl = clean
      else delete updated.bannerUrl
      return updated
    })
  }

  /** Pan/zoom applied to bannerUrl at render time — plain numbers, never a re-encoded image. */
  setBannerFocus(id: string, focus: BannerFocus | null): Collection | null {
    return this.mutate(id, (c) => {
      const updated = { ...c }
      const clean = focus ? sanitizeFocus(focus) : undefined
      if (clean) updated.bannerFocus = clean
      else delete updated.bannerFocus
      return updated
    })
  }

  addLink(collectionId: string, input: NewLink): Collection | null {
    return this.mutate(collectionId, (c) => {
      const section = sanitizeText(input.section, MAX_NAME_LEN)
      const link: Link = {
        id: randomUUID(),
        title: input.title,
        url: input.url,
        note: input.note,
        favicon: input.favicon,
        pinned: input.pinned ?? false,
        order: c.links.length,
        ...(section ? { section } : {})
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
    patch: Partial<Pick<Link, 'title' | 'url' | 'note' | 'pinned' | 'favicon' | 'order'>> & { section?: string | null }
  ): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      links: c.links.map((l) => {
        if (l.id !== linkId) return l
        // `section` is handled separately: `null` means "clear", so it must not
        // reach the spread where it would violate Link's `section?: string`.
        const { section: rawSection, ...rest } = patch
        const updated = { ...l, ...rest, id: l.id }
        if ('section' in patch) {
          const section = sanitizeText(rawSection, MAX_NAME_LEN)
          if (section) updated.section = section
          else delete updated.section
        }
        return updated
      })
    }))
  }

  togglePin(collectionId: string, linkId: string): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      links: c.links.map((l) => (l.id === linkId ? { ...l, pinned: !l.pinned } : l))
    }))
  }

  /**
   * The plain JSON share payload for a collection — the single place that knows
   * its shape. export() wraps it in the wire encoding (deflate+base64); the share
   * handler POSTs it as-is. Keep all format knowledge inside this class.
   */
  exportJson(id: string): string | null {
    const c = this.getById(id)
    if (!c) return null
    const payload: CollectionExport = {
      version: 1,
      name: c.name,
      source: c.source,
      ...(c.description ? { description: c.description } : {}),
      ...(c.author ? { author: c.author } : {}),
      ...(c.iconUrl ? { iconUrl: c.iconUrl } : {}),
      ...(c.iconFocus ? { iconFocus: c.iconFocus } : {}),
      ...(c.bannerUrl ? { bannerUrl: c.bannerUrl } : {}),
      ...(c.bannerFocus ? { bannerFocus: c.bannerFocus } : {}),
      ...(c.sections ? { sections: c.sections } : {}),
      links: c.links.map((l) => ({
        title: l.title,
        url: l.url,
        note: l.note,
        pinned: l.pinned,
        // Only export http/https favicons — data: URLs are non-portable and large
        ...(l.favicon && /^https?:\/\//.test(l.favicon) ? { favicon: l.favicon } : {}),
        ...(l.section ? { section: l.section } : {})
      }))
    }
    return JSON.stringify(payload)
  }

  /** Export a collection as a deflate-compressed Base64 string (the share-code wire format). */
  export(id: string): string | null {
    const json = this.exportJson(id)
    if (!json) return null
    return deflateSync(json, { level: 9 }).toString('base64')
  }

  /**
   * Decode + validate + sanitize a Base64 export payload, WITHOUT persisting.
   * Returns the cleaned CollectionExport, or null when the payload is invalid.
   * Shared by previewImport() (preview UI) and import() (persist).
   */
  private decode(base64: string): CollectionExport | null {
    let json: string
    try {
      const buf = Buffer.from(base64, 'base64')
      try {
        // New format: deflate-compressed JSON
        json = inflateSync(buf).toString('utf8')
      } catch {
        // Legacy format: raw JSON (backward compat with old share codes)
        json = buf.toString('utf8')
      }
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

    const iconUrl = sanitizeIconUrl(parsed.iconUrl)
    const iconFocus = sanitizeFocus(parsed.iconFocus)
    const bannerUrl = sanitizeIconUrl(parsed.bannerUrl)
    const bannerFocus = sanitizeFocus(parsed.bannerFocus)
    const description = sanitizeText(parsed.description, MAX_DESCRIPTION_LEN)
    const author = sanitizeAuthor(parsed.author)

    const sections = Array.isArray(parsed.sections)
      ? (parsed.sections as unknown[])
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim().slice(0, MAX_NAME_LEN))
          .slice(0, MAX_COLLECTION_SECTIONS)
      : undefined

    const links = parsed.links
      .map((l) => {
        const url = String(l.url ?? '')
        // Reject any non-http(s) URL to prevent javascript:/file:// injection
        try {
          const proto = new URL(url).protocol
          if (proto !== 'http:' && proto !== 'https:') return null
        } catch {
          return null
        }
        const favicon = sanitizeHttpUrl(l.favicon)
        const section = sanitizeText(l.section, MAX_NAME_LEN)
        const link: Pick<Link, 'title' | 'url' | 'note' | 'pinned' | 'favicon' | 'section'> = {
          title: String(l.title ?? '').slice(0, MAX_TITLE_LEN),
          url,
          note: sanitizeText(l.note, MAX_NOTE_LEN),
          pinned: Boolean(l.pinned),
          ...(favicon ? { favicon } : {}),
          ...(section ? { section } : {})
        }
        return link
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)

    return {
      version: 1,
      name: String(parsed.name ?? '').slice(0, MAX_NAME_LEN),
      source,
      ...(description ? { description } : {}),
      ...(author ? { author } : {}),
      ...(iconUrl ? { iconUrl } : {}),
      ...(iconFocus ? { iconFocus } : {}),
      ...(bannerUrl ? { bannerUrl } : {}),
      ...(bannerFocus ? { bannerFocus } : {}),
      ...(sections ? { sections } : {}),
      links
    }
  }

  /** Decode + sanitize a shared payload for preview, WITHOUT importing it. */
  previewImport(base64: string): CollectionExport | null {
    return this.decode(base64)
  }

  /** Import a Base64 string into a new collection assigned to the given profile. */
  import(base64: string, profileId: string | 'shared'): Collection | null {
    const parsed = this.decode(base64)
    if (!parsed) return null

    const now = Date.now()
    const collection: Collection = {
      id: randomUUID(),
      name: parsed.name,
      profileId,
      source: parsed.source,
      ...(parsed.description ? { description: parsed.description } : {}),
      ...(parsed.author ? { author: parsed.author } : {}),
      ...(parsed.iconUrl ? { iconUrl: parsed.iconUrl } : {}),
      ...(parsed.iconFocus ? { iconFocus: parsed.iconFocus } : {}),
      ...(parsed.bannerUrl ? { bannerUrl: parsed.bannerUrl } : {}),
      ...(parsed.bannerFocus ? { bannerFocus: parsed.bannerFocus } : {}),
      ...(parsed.sections ? { sections: parsed.sections } : {}),
      links: parsed.links.map((l, i) => ({
        id: randomUUID(),
        title: l.title,
        url: l.url,
        note: l.note,
        favicon: l.favicon,
        pinned: l.pinned,
        order: i,
        ...(l.section ? { section: l.section } : {})
      })),
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

  /**
   * Move a link to a section and insert it before `insertBeforeLinkId`.
   * Pass `insertBeforeLinkId = null` to append to the end of the target section.
   * Pass `targetSection = null` to move to unsorted.
   */
  moveLink(
    collectionId: string,
    linkId: string,
    targetSection: string | null,
    insertBeforeLinkId: string | null
  ): Collection | null {
    return this.mutate(collectionId, (c) => {
      const sorted = [...c.links].sort((a, b) => a.order - b.order)
      const movedLink = sorted.find((l) => l.id === linkId)
      if (!movedLink) return c

      const withoutMoved = sorted.filter((l) => l.id !== linkId)

      const cleanSection = targetSection !== null ? sanitizeText(targetSection, MAX_NAME_LEN) : undefined
      const updatedLink: Link = { ...movedLink }
      if (cleanSection) {
        updatedLink.section = cleanSection
      } else {
        delete updatedLink.section
      }

      let insertIdx: number
      if (insertBeforeLinkId) {
        insertIdx = withoutMoved.findIndex((l) => l.id === insertBeforeLinkId)
        if (insertIdx === -1) insertIdx = withoutMoved.length
      } else {
        // Append after the last link that belongs to the (sanitized) target section
        let lastIdx = -1
        for (let i = 0; i < withoutMoved.length; i++) {
          const lSection = withoutMoved[i].section ?? null
          if (lSection === (cleanSection ?? null)) lastIdx = i
        }
        insertIdx = lastIdx === -1 ? withoutMoved.length : lastIdx + 1
      }

      const newLinks = [
        ...withoutMoved.slice(0, insertIdx),
        updatedLink,
        ...withoutMoved.slice(insertIdx),
      ]
      return { ...c, links: newLinks.map((l, i) => ({ ...l, order: i })) }
    })
  }

  /** Set (or replace) the full sections list for a collection. Same caps as the import path. */
  setSections(collectionId: string, sections: string[]): Collection | null {
    const clean = sections
      .map((s) => s.trim().slice(0, MAX_NAME_LEN))
      .filter((s) => s.length > 0)
      .slice(0, MAX_COLLECTION_SECTIONS)
    return this.mutate(collectionId, (c) => ({ ...c, sections: clean }))
  }

  /** Rename a section — also updates all links referencing the old name. */
  renameSection(collectionId: string, oldName: string, newName: string): Collection | null {
    const clean = newName.trim().slice(0, MAX_NAME_LEN)
    if (!clean) return null
    return this.mutate(collectionId, (c) => ({
      ...c,
      sections: (c.sections ?? []).map((s) => (s === oldName ? clean : s)),
      links: c.links.map((l) => (l.section === oldName ? { ...l, section: clean } : l))
    }))
  }

  /** Delete a section — links assigned to it become unsectioned. */
  deleteSection(collectionId: string, name: string): Collection | null {
    return this.mutate(collectionId, (c) => ({
      ...c,
      sections: (c.sections ?? []).filter((s) => s !== name),
      links: c.links.map((l) => {
        if (l.section !== name) return l
        const updated = { ...l }
        delete updated.section
        return updated
      })
    }))
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
