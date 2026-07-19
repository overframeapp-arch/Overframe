import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X as XIcon,
} from 'lucide-react'
import { DEFAULT_PROFILE_ID } from '@shared/types'
import type { BannerFocus, Collection, CollectionAuthor, Profile } from '@shared/types'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'
import { useMissionsStore } from '../store/missionsStore'
import { useShareCollection, useImportCollection } from '../hooks/useCollectionShare'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Tooltip } from './ui/Tooltip'
import { ProfileIcon } from './ProfileIcon'
import { ProfileCreateForm, ProfileEditForm } from './collections/ProfileForms'
import { CollectionEditor } from './collections/CollectionEditor'
import { CreatorCollectionView } from './collections/CreatorCollectionView'
import { CopiedTooltip } from './collections/atoms'
import { bannerImageStyle } from '../lib/bannerFocusStyle'

// ── Drag state ────────────────────────────────────────────────────────────────
interface DragState { draggedId: string | null; overId: string | null }
const DRAG_NONE: DragState = { draggedId: null, overId: null }

// ── Helpers ───────────────────────────────────────────────────────────────────
function collStorageKey(profileId: string): string {
  return `bookmarkBar:collectionId:${profileId}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ManagePanel(): JSX.Element {
  const { collections, activeProfile, profiles, setCollections, setProfiles, setActiveProfile, tabs } = useAppStore()
  const { complete } = useMissionsStore()

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [leftSearch, setLeftSearch] = useState('')
  const initializedRef = useRef(false)

  // ── Profile CRUD ────────────────────────────────────────────────────────────
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [deleteProfileConfirmId, setDeleteProfileConfirmId] = useState<string | null>(null)
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null)
  const [showNewProfile, setShowNewProfile] = useState(false)

  // ── Collection CRUD ─────────────────────────────────────────────────────────
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editCollName, setEditCollName] = useState('')
  const [editCollIconUrl, setEditCollIconUrl] = useState('')
  const [deleteCollConfirmId, setDeleteCollConfirmId] = useState<string | null>(null)
  const [showNewCollForm, setShowNewCollForm] = useState(false)
  const [newCollProfileId, setNewCollProfileId] = useState<string | null>(null)
  const [newCollName, setNewCollName] = useState('')
  const [newCollIconUrl, setNewCollIconUrl] = useState('')
  const [drag, setDrag] = useState<DragState>(DRAG_NONE)

  // ── Left sidebar collapse ────────────────────────────────────────────────────
  const [leftCollapsed, setLeftCollapsed] = useState(false)

  // ── Right panel mode ────────────────────────────────────────────────────────
  // 'showcase' = creator view (imported collections), 'manage' = CRUD LinksView
  const [rightMode, setRightMode] = useState<'showcase' | 'manage'>('showcase')

  // Reset mode when the selected collection changes
  useEffect(() => {
    const coll = collections.find((c) => c.id === selectedCollectionId)
    if (!coll) return
    setRightMode(coll.source === 'user' ? 'manage' : 'showcase')
  }, [selectedCollectionId, collections])

  // ── Import (state machine shared with CollectionsPanel) ─────────────────────
  const [showImportForm, setShowImportForm] = useState(false)
  const [importProfileId, setImportProfileId] = useState<string | null>(null)

  // ── Init: expand active profile + restore last-used collection ──────────────
  useEffect(() => {
    if (initializedRef.current || !activeProfile) return
    initializedRef.current = true
    const pid = activeProfile.id
    setExpandedProfileId(pid)
    const stored = localStorage.getItem(collStorageKey(pid))
    if (stored && collections.some((c) => c.id === stored)) setSelectedCollectionId(stored)
  // collections intentionally omitted: we only need this once, on first activeProfile load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile])

  // ── Data refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(async (): Promise<void> => {
    setCollections(await window.aether.collections.getAll())
  }, [setCollections])

  // ── Share/import flows (shared with CollectionsPanel) ───────────────────────
  const { copiedPos, shareToClipboard } = useShareCollection()
  const {
    importValue, setImportValue, importPreview, importError, importing,
    importAddRef, previewImport, confirmImport, reset: resetImportState,
  } = useImportCollection(refresh)

  const refreshProfiles = useCallback(async (): Promise<void> => {
    setProfiles(await window.aether.profiles.getAll())
    setActiveProfile(await window.aether.profiles.getCurrent())
  }, [setProfiles, setActiveProfile])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const sortedProfiles = useMemo(() => {
    const pinId = activeProfile?.id
    if (!pinId) return profiles
    const pin = profiles.find((p) => p.id === pinId)
    if (!pin) return profiles
    return [pin, ...profiles.filter((p) => p.id !== pinId)]
  }, [profiles, activeProfile?.id])

  const q = leftSearch.trim().toLowerCase()

  const filteredProfiles = useMemo(() => {
    if (!q) return sortedProfiles
    return sortedProfiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        collections.some((c) => c.profileId === p.id && c.name.toLowerCase().includes(q)),
    )
  }, [sortedProfiles, collections, q])

  const getProfileCollections = useCallback(
    (profileId: string): Collection[] => {
      const all = collections.filter((c) => c.profileId === profileId)
      if (!q) return all
      const profile = profiles.find((p) => p.id === profileId)
      // If the profile itself matched by name, show all its collections
      if (profile?.name.toLowerCase().includes(q)) return all
      return all.filter((c) => c.name.toLowerCase().includes(q))
    },
    [collections, profiles, q],
  )

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  )

  // In search mode, auto-expand any profile that has matching collections.
  // In normal mode, respect the accordion (single-expand).
  const isProfileExpanded = (profileId: string): boolean => {
    if (q) return getProfileCollections(profileId).length > 0
    return expandedProfileId === profileId
  }

  // ── Profile actions ──────────────────────────────────────────────────────────
  const handleToggleProfile = (profileId: string): void => {
    const next = expandedProfileId === profileId ? null : profileId
    setExpandedProfileId(next)
    // Reset transient inline state
    setEditingCollectionId(null)
    setDeleteCollConfirmId(null)
    // Restore last-used collection for the newly expanded profile
    if (next) {
      const stored = localStorage.getItem(collStorageKey(next))
      const exists = stored !== null && collections.some((c) => c.id === stored && c.profileId === next)
      setSelectedCollectionId(exists ? stored : null)
    } else {
      setSelectedCollectionId(null)
    }
  }

  const handleCreateProfile = async (input: { name: string; processNames: string[]; iconUrl?: string; exePath?: string; gameDisplayName?: string }): Promise<void> => {
    await window.aether.profiles.create({
      name: input.name,
      processNames: input.processNames,
      priority: profiles.length,
      ...(input.iconUrl ? { iconUrl: input.iconUrl } : {}),
      ...(input.exePath ? { exePaths: [input.exePath] } : {}),
      ...(input.gameDisplayName ? { gameDisplayName: input.gameDisplayName } : {}),
    })
    setShowNewProfile(false)
    await refreshProfiles()
  }

  const handleDeleteProfile = async (id: string, mode: 'delete' | 'exclude'): Promise<void> => {
    if (id === DEFAULT_PROFILE_ID || deletingProfileId) return
    setDeletingProfileId(id)
    try {
      await window.aether.profiles.remove(id, mode)
      if (expandedProfileId === id) setExpandedProfileId(null)
      if (selectedCollectionId && collections.some((c) => c.id === selectedCollectionId && c.profileId === id)) {
        setSelectedCollectionId(null)
      }
      setDeleteProfileConfirmId(null)
      await refreshProfiles()
      await refresh()
    } finally {
      setDeletingProfileId(null)
    }
  }

  const handleSaveProfileEdit = async (id: string, patch: Partial<Profile>): Promise<void> => {
    await window.aether.profiles.update(id, patch)
    setEditingProfileId(null)
    await refreshProfiles()
  }

  // ── Collection actions ───────────────────────────────────────────────────────
  const handleCreateCollection = async (profileId: string): Promise<void> => {
    const name = newCollName.trim()
    if (!name) return
    await window.aether.collections.create({ name, profileId, source: 'user', iconUrl: newCollIconUrl.trim() || undefined })
    complete('create-collection')
    setNewCollName('')
    setNewCollIconUrl('')
    setShowNewCollForm(false)
    setExpandedProfileId(profileId)
    await refresh()
  }

  const handleSaveCollectionEdit = async (id: string): Promise<void> => {
    const name = editCollName.trim()
    if (!name) return
    await window.aether.collections.rename(id, name)
    await window.aether.collections.setIconUrl(id, editCollIconUrl.trim() || null)
    setEditingCollectionId(null)
    await refresh()
  }

  const handleDeleteCollection = async (id: string): Promise<void> => {
    await window.aether.collections.remove(id)
    setDeleteCollConfirmId(null)
    if (selectedCollectionId === id) setSelectedCollectionId(null)
    await refresh()
  }

  const handleReorderCollections = async (profileId: string, sourceId: string, targetId: string): Promise<void> => {
    if (sourceId === targetId) return
    const ids = getProfileCollections(profileId).map((c) => c.id)
    const from = ids.indexOf(sourceId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    const reordered = [...ids]
    reordered.splice(from, 1)
    reordered.splice(to, 0, sourceId)
    await window.aether.collections.reorder(reordered)
    await refresh()
  }

  // ── Link actions ─────────────────────────────────────────────────────────────
  const handleAddLink = async (cid: string, link: { title: string; url: string; favicon?: string; section?: string }): Promise<void> => {
    await window.aether.collections.addLink(cid, link)
    await refresh()
  }

  const handleRemoveLink = async (cid: string, lid: string): Promise<void> => {
    await window.aether.collections.removeLink(cid, lid)
    await refresh()
  }

  const handleEditLink = async (cid: string, lid: string, title: string, url: string, note: string): Promise<void> => {
    await window.aether.collections.updateLink(cid, lid, { title, url, ...(note ? { note } : { note: undefined }) })
    await refresh()
  }

  const handleReorderLinks = async (cid: string, linkIds: string[]): Promise<void> => {
    await window.aether.collections.reorderLinks(cid, linkIds)
    await refresh()
  }

  const handleSetSections = async (cid: string, sections: string[]): Promise<void> => {
    await window.aether.collections.setSections(cid, sections)
    await refresh()
  }

  const handleRenameSection = async (cid: string, oldName: string, newName: string): Promise<void> => {
    await window.aether.collections.renameSection(cid, oldName, newName)
    await refresh()
  }

  const handleDeleteSection = async (cid: string, name: string): Promise<void> => {
    await window.aether.collections.deleteSection(cid, name)
    await refresh()
  }

  const handleMoveLink = async (cid: string, lid: string, targetSection: string | null, insertBeforeLinkId: string | null): Promise<void> => {
    await window.aether.collections.moveLink(cid, lid, targetSection, insertBeforeLinkId)
    await refresh()
  }

  const handleSetDescription = async (cid: string, desc: string | null): Promise<void> => {
    await window.aether.collections.setDescription(cid, desc ?? null)
    await refresh()
  }

  const handleSetName = async (cid: string, name: string): Promise<void> => {
    await window.aether.collections.rename(cid, name)
    await refresh()
  }

  const handleSetIconUrl = async (cid: string, url: string | null): Promise<void> => {
    await window.aether.collections.setIconUrl(cid, url)
    await refresh()
  }

  const handleSetBannerUrl = async (cid: string, url: string | null): Promise<void> => {
    await window.aether.collections.setBannerUrl(cid, url)
    await refresh()
  }

  const handleSetBannerFocus = async (cid: string, focus: BannerFocus | null): Promise<void> => {
    await window.aether.collections.setBannerFocus(cid, focus)
    await refresh()
  }

  const handleSetIconFocus = async (cid: string, focus: BannerFocus | null): Promise<void> => {
    await window.aether.collections.setIconFocus(cid, focus)
    await refresh()
  }

  const handleSetAuthor = async (cid: string, author: CollectionAuthor | null): Promise<void> => {
    await window.aether.collections.setAuthor(cid, author)
    await refresh()
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExport = (id: string): Promise<void> => shareToClipboard(id)

  // ── Import ───────────────────────────────────────────────────────────────────
  const resetImport = (): void => {
    setShowImportForm(false)
    resetImportState()
  }

  const handlePreviewImport = (): Promise<void> => previewImport()

  const handleConfirmImport = async (profileId: string): Promise<void> => {
    await confirmImport(profileId)
    setShowImportForm(false)
    setExpandedProfileId(profileId)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">

      {/* ── Left column: profiles + collections tree ─────────────────────────── */}
      <div className={cn('shrink-0 flex flex-col border-r overflow-hidden transition-[width,border-color] duration-200', leftCollapsed ? 'w-0 border-transparent' : 'w-[180px] border-border')}>

        {/* Search */}
        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              aria-label="Search profiles and collections"
              value={leftSearch}
              onChange={(e) => setLeftSearch(e.target.value)}
              placeholder="Search…"
              className="pl-6 h-6 text-[11px]"
            />
            {leftSearch && (
              <button type="button" aria-label="Clear search" onClick={() => setLeftSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <XIcon size={10} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* New collection / Import — a single entry point that asks which profile,
            instead of hiding "+ New" inside whichever profile happens to be expanded. */}
        <div className="px-2 py-1.5 border-b border-border shrink-0">
          {!showNewCollForm && !showImportForm && (
            <div className="flex gap-1">
              <button type="button" onClick={() => {
                setNewCollProfileId(expandedProfileId ?? activeProfile?.id ?? sortedProfiles[0]?.id ?? null)
                setShowNewCollForm(true)
              }}
                className="flex flex-1 items-center justify-center gap-1 h-6 rounded border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <Plus size={10} aria-hidden="true" /> New
              </button>
              <button type="button" onClick={() => {
                setImportProfileId(expandedProfileId ?? activeProfile?.id ?? sortedProfiles[0]?.id ?? null)
                setShowImportForm(true)
              }}
                className="flex flex-1 items-center justify-center gap-1 h-6 rounded border border-border/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <Upload size={10} aria-hidden="true" /> Import
              </button>
            </div>
          )}

          {showNewCollForm && (
            <div className="flex flex-col gap-1" role="form" aria-label="Create collection">
              <Input autoFocus aria-label="New collection name" value={newCollName}
                onChange={(e) => setNewCollName(e.target.value)}
                placeholder="Collection name…" className="h-6 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCollProfileId) void handleCreateCollection(newCollProfileId)
                  if (e.key === 'Escape') { setShowNewCollForm(false); setNewCollName(''); setNewCollIconUrl('') }
                }} />
              <Input aria-label="Icon URL (optional)" value={newCollIconUrl}
                onChange={(e) => setNewCollIconUrl(e.target.value)}
                placeholder="Icon URL (optional)" className="h-6 text-[11px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCollProfileId) void handleCreateCollection(newCollProfileId)
                  if (e.key === 'Escape') { setShowNewCollForm(false); setNewCollName(''); setNewCollIconUrl('') }
                }} />
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">Profile</span>
                <select
                  aria-label="Profile to create this collection in"
                  value={newCollProfileId ?? ''}
                  onChange={(e) => setNewCollProfileId(e.target.value)}
                  className="h-6 rounded border border-border bg-input px-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary/60"
                >
                  {sortedProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="flex gap-1">
                <button type="button" onClick={() => newCollProfileId && void handleCreateCollection(newCollProfileId)}
                  disabled={!newCollName.trim() || !newCollProfileId}
                  className="flex-1 h-6 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors">Create</button>
                <button type="button" onClick={() => { setShowNewCollForm(false); setNewCollName(''); setNewCollIconUrl('') }}
                  className="flex-1 h-6 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {showImportForm && (
            <div className="flex flex-col gap-1" role="form" aria-label="Import collection"
              onKeyDown={(e) => { if (e.key === 'Escape') resetImport() }}>
              {!importPreview ? (
                <>
                  <div className="flex gap-1">
                    <Input autoFocus aria-label="Collection share code" value={importValue}
                      onChange={(e) => setImportValue(e.target.value)}
                      placeholder="Paste share code…" className="h-6 text-[11px] flex-1"
                      onKeyDown={(e) => { if (e.key === 'Enter') void handlePreviewImport() }} />
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label="Preview import" onClick={() => void handlePreviewImport()}>
                      <Search size={9} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label="Cancel import" onClick={resetImport}>
                      <XIcon size={9} aria-hidden="true" />
                    </Button>
                  </div>
                  {importError && (
                    <p className="text-[11px] text-destructive" role="alert">Invalid or unreadable code.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    {importPreview.iconUrl
                      ? <img src={importPreview.iconUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      : <Globe size={10} className="text-muted-foreground shrink-0" aria-hidden="true" />
                    }
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium truncate">{importPreview.name || 'Untitled collection'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {importPreview.author?.handle ? `@${importPreview.author.handle} · ` : ''}
                        {importPreview.links.length} link{importPreview.links.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Add to profile</span>
                    <select
                      aria-label="Profile to add this collection to"
                      value={importProfileId ?? ''}
                      onChange={(e) => setImportProfileId(e.target.value)}
                      className="h-6 rounded border border-border bg-input px-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary/60"
                    >
                      {sortedProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <div className="flex gap-1">
                    <button ref={importAddRef} type="button" disabled={importing || !importProfileId}
                      onClick={() => importProfileId && void handleConfirmImport(importProfileId)}
                      className="flex-1 h-6 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50 transition-colors">
                      {importing ? 'Adding…' : 'Add to profile'}
                    </button>
                    <button type="button" onClick={resetImport}
                      className="flex-1 h-6 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Profile + collection tree */}
        <ul className="flex-1 overflow-y-auto" role="tree" aria-label="Profiles and collections">
          {filteredProfiles.length === 0 && (
            <li className="px-3 py-8 text-center text-[11px] text-muted-foreground">
              No matches for &laquo;{leftSearch}&raquo;
            </li>
          )}

          {filteredProfiles.map((profile) => {
            const isActive = profile.id === activeProfile?.id
            const expanded = isProfileExpanded(profile.id)
            const profileColls = getProfileCollections(profile.id)
            const isEditing = editingProfileId === profile.id

            return (
              <li key={profile.id} role="treeitem" aria-expanded={expanded}>

                {/* Profile row */}
                {isEditing ? (
                  <ProfileEditForm
                    profile={profile}
                    isDefault={profile.id === DEFAULT_PROFILE_ID}
                    onSave={(patch) => void handleSaveProfileEdit(profile.id, patch)}
                    onCancel={() => setEditingProfileId(null)}
                  />
                ) : (
                  <div className={cn(
                    'group flex items-center gap-1 px-2 py-1.5 hover:bg-muted/40 transition-colors',
                    expanded && !q && 'bg-muted/20',
                  )}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${profile.name}`}
                      onClick={() => { if (!q) handleToggleProfile(profile.id) }}
                    >
                      <ProfileIcon iconUrl={profile.iconUrl} name={profile.name} size={14} profileId={profile.id} />
                      <span className={cn('text-[11px] font-medium truncate flex-1', isActive && 'text-primary')}>
                        {profile.name}
                      </span>
                      {!q && (
                        expanded
                          ? <ChevronDown size={10} className="text-muted-foreground shrink-0" aria-hidden="true" />
                          : <ChevronRight size={10} className="text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                    </button>
                    {/* Hover actions */}
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip label="Edit profile">
                        <Button size="icon" variant="ghost" className="h-5 w-5" aria-label={`Edit ${profile.name}`}
                          onClick={() => setEditingProfileId(profile.id)}>
                          <Pencil size={9} aria-hidden="true" />
                        </Button>
                      </Tooltip>
                      {profile.id !== DEFAULT_PROFILE_ID && (
                        <Tooltip label="Delete profile">
                          <Button size="icon" variant="ghost" className="h-5 w-5 hover:text-destructive" aria-label={`Delete ${profile.name}`}
                            onClick={() => setDeleteProfileConfirmId(profile.id)}>
                            <Trash2 size={9} aria-hidden="true" />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                )}

                {/* Delete profile confirmation */}
                {deleteProfileConfirmId === profile.id && (
                  <div className="mx-2 mb-1 p-2 rounded bg-destructive/10 border border-destructive/20" role="alert">
                    <p className="text-[11px] text-foreground mb-1.5">Delete «{profile.name}»?</p>
                    {profile.processNames.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mb-1.5">
                        <strong className="text-foreground">Delete</strong> is permanent.{' '}
                        <strong className="text-foreground">Exclude</strong> keeps a restorable snapshot.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <button type="button" disabled={deletingProfileId === profile.id}
                        onClick={() => void handleDeleteProfile(profile.id, 'delete')}
                        className="h-6 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors disabled:opacity-50">
                        Delete
                      </button>
                      {profile.processNames.length > 0 && (
                        <button type="button" disabled={deletingProfileId === profile.id}
                          onClick={() => void handleDeleteProfile(profile.id, 'exclude')}
                          className="h-6 px-2 rounded text-[11px] bg-amber-500/80 text-white hover:bg-amber-500 transition-colors disabled:opacity-50">
                          Exclude
                        </button>
                      )}
                      <button type="button" disabled={deletingProfileId === profile.id}
                        onClick={() => setDeleteProfileConfirmId(null)}
                        className="h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors ml-auto disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Collections (expanded) */}
                {expanded && (
                  <ul role="group" className="border-b border-border/30">
                    {profileColls.length === 0 && (
                      <li className="pl-6 pr-2 py-2 text-[11px] text-muted-foreground italic">No collections yet.</li>
                    )}

                    {profileColls.map((coll) => {
                      const isSelected = coll.id === selectedCollectionId
                      const isEditingColl = editingCollectionId === coll.id
                      const isDragOver = drag.overId === coll.id && drag.draggedId !== coll.id

                      return (
                        <li key={coll.id} role="treeitem"
                          draggable={!isEditingColl && coll.source === 'user'}
                          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ draggedId: coll.id, overId: null }) }}
                          onDragOver={(e) => { e.preventDefault(); if (drag.draggedId && drag.draggedId !== coll.id) setDrag((d) => ({ ...d, overId: coll.id })) }}
                          onDragLeave={() => setDrag((d) => ({ ...d, overId: null }))}
                          onDrop={(e) => { e.preventDefault(); if (drag.draggedId && drag.draggedId !== coll.id) void handleReorderCollections(profile.id, drag.draggedId, coll.id); setDrag(DRAG_NONE) }}
                          onDragEnd={() => setDrag(DRAG_NONE)}
                          className={cn(isDragOver && 'border-t-2 border-primary')}
                        >
                          {isEditingColl ? (
                            <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-b border-border/20">
                              <Input autoFocus aria-label="Collection name" value={editCollName}
                                onChange={(e) => setEditCollName(e.target.value)}
                                placeholder="Name…" className="h-6 text-[11px]"
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCollectionEdit(coll.id); if (e.key === 'Escape') setEditingCollectionId(null) }} />
                              <Input aria-label="Icon URL" value={editCollIconUrl}
                                onChange={(e) => setEditCollIconUrl(e.target.value)}
                                placeholder="Icon URL (optional)" className="h-6 text-[11px]"
                                onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCollectionEdit(coll.id); if (e.key === 'Escape') setEditingCollectionId(null) }} />
                              <div className="flex gap-1">
                                <button type="button" onClick={() => void handleSaveCollectionEdit(coll.id)}
                                  className="flex-1 h-6 rounded text-[11px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
                                <button type="button" onClick={() => setEditingCollectionId(null)}
                                  className="flex-1 h-6 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={cn(
                                'group/coll flex items-center gap-1 pl-5 pr-2 py-1.5 hover:bg-muted/30 transition-colors',
                                isSelected && 'bg-primary/10',
                                drag.draggedId === coll.id && 'opacity-40',
                              )}>
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                  onClick={() => setSelectedCollectionId(coll.id)}
                                  aria-pressed={isSelected}
                                  aria-label={`${coll.name}, ${coll.links.length} link${coll.links.length !== 1 ? 's' : ''}`}
                                >
                                  {coll.iconUrl
                                    ? <span className="h-3.5 w-3.5 shrink-0 rounded-sm overflow-hidden">
                                        <img src={coll.iconUrl} alt="" className="h-full w-full object-cover" style={bannerImageStyle(coll.iconFocus)} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                      </span>
                                    : <Globe size={9} className="text-muted-foreground shrink-0" aria-hidden="true" />
                                  }
                                  <span className={cn('text-[11px] truncate flex-1', isSelected && 'text-primary font-medium')}>
                                    {coll.name}
                                  </span>
                                  {coll.source !== 'user' && (
                                    <span className="text-[9px] px-1 py-px rounded font-medium shrink-0 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 leading-none">
                                      {coll.source}
                                    </span>
                                  )}
                                  {coll.links.length > 0 && coll.source === 'user' && (
                                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{coll.links.length}</span>
                                  )}
                                </button>
                                <div
                                  className="flex items-center gap-0.5 opacity-0 group-hover/coll:opacity-100 transition-opacity shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {coll.source === 'user' && (
                                    <Tooltip label="Edit collection">
                                      <Button size="icon" variant="ghost" className="h-5 w-5" aria-label={`Edit ${coll.name}`}
                                        onClick={() => { setEditingCollectionId(coll.id); setEditCollName(coll.name); setEditCollIconUrl(coll.iconUrl ?? '') }}>
                                        <Pencil size={9} aria-hidden="true" />
                                      </Button>
                                    </Tooltip>
                                  )}
                                  {coll.source === 'user' && (
                                    <Tooltip label="Delete collection">
                                      <Button size="icon" variant="ghost" className="h-5 w-5 hover:text-destructive" aria-label={`Delete ${coll.name}`}
                                        onClick={() => setDeleteCollConfirmId(coll.id)}>
                                        <Trash2 size={9} aria-hidden="true" />
                                      </Button>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>

                              {/* Delete collection confirmation */}
                              {deleteCollConfirmId === coll.id && (
                                <div className="ml-5 mr-2 mb-1 p-1.5 rounded bg-destructive/10 border border-destructive/20" role="alert">
                                  <p className="text-[11px] text-foreground mb-1">Delete «{coll.name}»?</p>
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => void handleDeleteCollection(coll.id)}
                                      className="h-5 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">Delete</button>
                                    <button type="button" onClick={() => setDeleteCollConfirmId(null)}
                                      className="h-5 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        {/* New profile — footer */}
        <div
          className={cn('shrink-0 border-t', leftCollapsed ? 'border-transparent' : 'border-border')}
          style={{ transition: `border-color 20ms ease ${leftCollapsed ? '0ms' : '185ms'}` }}
        >
          {showNewProfile ? (
            <ProfileCreateForm
              onSave={handleCreateProfile}
              onCancel={() => setShowNewProfile(false)}
            />
          ) : (
            <button type="button" aria-label="Create a new profile"
              onClick={() => setShowNewProfile(true)}
              className="w-full flex items-center gap-2 h-8 px-3 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              <Plus size={11} aria-hidden="true" /> New profile
            </button>
          )}
        </div>
      </div>

      {/* ── Right column: showcase or management ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Sidebar toggle tab — always fully inside right column, never clips */}
        <button
          type="button"
          onClick={() => setLeftCollapsed((v) => !v)}
          aria-label={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-2.5 h-10 rounded-r-md bg-muted/50 border-y border-r border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border transition-all"
        >
          {leftCollapsed ? <ChevronRight size={9} /> : <ChevronLeft size={9} />}
        </button>
        {selectedCollection ? (
          rightMode === 'showcase' ? (
            /* Creator collection showcase */
            <CreatorCollectionView
              collection={selectedCollection}
              onEdit={() => setRightMode('manage')}
              onExport={(id) => void handleExport(id)}
            />
          ) : (
            /* Management mode (user collections + edit mode for imported) */
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="w-full max-w-[1200px] mx-auto px-5 py-4">
              {selectedCollection.source !== 'user' && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/20">
                  <button type="button" onClick={() => setRightMode('showcase')}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Back to collection overview">
                    ← Overview
                  </button>
                </div>
              )}
              <CollectionEditor
                collection={selectedCollection}
                tabs={tabs}
                onAddLink={(link) => void handleAddLink(selectedCollection.id, link)}
                onEditLink={(lid, title, url, note) => void handleEditLink(selectedCollection.id, lid, title, url, note)}
                onRemoveLink={(lid) => void handleRemoveLink(selectedCollection.id, lid)}
                onReorderLinks={(ids) => void handleReorderLinks(selectedCollection.id, ids)}
                onSetSections={(sections) => void handleSetSections(selectedCollection.id, sections)}
                onRenameSection={(old, next) => void handleRenameSection(selectedCollection.id, old, next)}
                onDeleteSection={(name) => void handleDeleteSection(selectedCollection.id, name)}
                onMoveLink={(lid, s, before) => void handleMoveLink(selectedCollection.id, lid, s, before)}
                onSetName={(name) => void handleSetName(selectedCollection.id, name)}
                onSetDescription={(desc) => void handleSetDescription(selectedCollection.id, desc)}
                onSetIconUrl={(url) => void handleSetIconUrl(selectedCollection.id, url)}
                onSetIconFocus={(focus) => void handleSetIconFocus(selectedCollection.id, focus)}
                onSetBannerUrl={(url) => void handleSetBannerUrl(selectedCollection.id, url)}
                onSetBannerFocus={(focus) => void handleSetBannerFocus(selectedCollection.id, focus)}
                onSetAuthor={(author) => void handleSetAuthor(selectedCollection.id, author)}
                onExport={() => void handleExport(selectedCollection.id)}
              />
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
            <Globe size={22} aria-hidden="true" />
            <p className="text-[11px]">Select a collection to manage its links</p>
          </div>
        )}
      </div>

      <CopiedTooltip pos={copiedPos} />
    </div>
  )
}
