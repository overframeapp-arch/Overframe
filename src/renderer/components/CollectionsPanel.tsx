import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X as XIcon,
} from 'lucide-react'
import { DEFAULT_PROFILE_ID } from '@shared/types'
import type { Profile } from '@shared/types'
import { cn } from '../lib/cn'
import { sanitizeIconUrl } from '../lib/url'
import { useAppStore } from '../store/appStore'
import { useMissionsStore } from '../store/missionsStore'
import { useDebounce } from '../hooks/useDebounce'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Tooltip } from './ui/Tooltip'
import { ProfileIcon } from './ProfileIcon'
import { Favicon } from './collections/atoms'
import { ProfileCreateForm, ProfileEditForm } from './collections/ProfileForms'
import { LinksView } from './collections/LinksView'
import type { NavLevel } from './collections/types'

interface CollectionsPanelProps {
  initialLevel?: NavLevel
  initialCollectionId?: string
  /** When set, the create-profile form opens pre-filled on mount. */
  prefillNewProfile?: { name: string; processName: string }
  onClose?: () => void
}

export function CollectionsPanel({
  initialLevel,
  initialCollectionId,
  prefillNewProfile,
  onClose,
}: CollectionsPanelProps = {}): JSX.Element {
  const { collections, activeProfile, profiles, setCollections, setProfiles, setActiveProfile, tabs } = useAppStore()
  const { complete } = useMissionsStore()

  const [level, setLevel] = useState<NavLevel>(initialLevel ?? (prefillNewProfile ? 'profiles' : 'collections'))
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(activeProfile?.id ?? null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(initialCollectionId ?? null)

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [deleteProfileConfirmId, setDeleteProfileConfirmId] = useState<string | null>(null)
  const [showNewProfile, setShowNewProfile] = useState(!!prefillNewProfile)

  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editCollName, setEditCollName] = useState('')
  const [editCollIconUrl, setEditCollIconUrl] = useState('')

  const [showNewColl, setShowNewColl] = useState(false)
  const [newCollName, setNewCollName] = useState('')
  const [newCollIconUrl, setNewCollIconUrl] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importValue, setImportValue] = useState('')
  const [deleteCollConfirmId, setDeleteCollConfirmId] = useState<string | null>(null)
  const [exportCopiedPos, setExportCopiedPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const mousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e: MouseEvent): void => { mousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  const [draggedCollId, setDraggedCollId] = useState<string | null>(null)
  const [dragOverCollId, setDragOverCollId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 150)

  const [profileSearch, setProfileSearch] = useState('')
  const debouncedProfileSearch = useDebounce(profileSearch, 150)

  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null)

  /**
   * Sync selected profile with the active profile only on initial mount or
   * after deletion (when nothing is selected). Keeps the user on the profile
   * they were browsing if an auto-detected game switches the active profile.
   */
  useEffect(() => {
    if (selectedProfileId === null && activeProfile?.id) setSelectedProfileId(activeProfile.id)
  }, [activeProfile?.id, selectedProfileId])

  /**
   * Sync selected collection with the CollectionBar's persisted choice when
   * nothing is explicitly selected yet (initial open or after profile switch).
   */
  useEffect(() => {
    if (!selectedProfileId || selectedCollectionId !== null || initialCollectionId) return
    const stored = localStorage.getItem(`bookmarkBar:collectionId:${selectedProfileId}`)
    if (stored) setSelectedCollectionId(stored)
  }, [selectedProfileId, selectedCollectionId, initialCollectionId])

  /**
   * Drop transient confirmation/edit state when navigating between levels so it
   * doesn't reappear unexpectedly when the user returns.
   */
  useEffect(() => {
    setDeleteProfileConfirmId(null)
    setDeleteCollConfirmId(null)
    setEditingProfileId(null)
    setEditingCollectionId(null)
  }, [level])

  const refresh = useCallback(async (): Promise<void> => {
    setCollections(await window.aether.collections.getAll())
  }, [setCollections])

  const refreshProfiles = useCallback(async (): Promise<void> => {
    setProfiles(await window.aether.profiles.getAll())
    setActiveProfile(await window.aether.profiles.getCurrent())
  }, [setProfiles, setActiveProfile])

  const refreshExcluded = useCallback(async (): Promise<void> => {
    // kept for API compatibility but excluded list is managed in Settings
  }, [])

  useEffect(() => { void refreshExcluded() }, [refreshExcluded])

  // ── Profile actions ──────────────────────────────────────────────────────

  const handleSelectProfile = async (id: string): Promise<void> => {
    setSelectedProfileId(id)
    await window.aether.profiles.setActive(id)
    await refreshProfiles()
    setLevel('collections')
    setSelectedCollectionId(null)
    setSearchQuery('')
  }

  const handleCreateProfile = async (input: { name: string; processNames: string[] }): Promise<void> => {
    await window.aether.profiles.create({ name: input.name, processNames: input.processNames, priority: profiles.length })
    setShowNewProfile(false)
    await refreshProfiles()
  }

  const handleDeleteProfile = async (id: string, mode: 'delete' | 'exclude'): Promise<void> => {
    if (id === DEFAULT_PROFILE_ID || deletingProfileId) return
    setDeletingProfileId(id)
    try {
      await window.aether.profiles.remove(id, mode)
      if (selectedProfileId === id) setSelectedProfileId(null)
      setDeleteProfileConfirmId(null)
      await Promise.all([refreshProfiles(), refreshExcluded()])
    } finally {
      setDeletingProfileId(null)
    }
  }

  const handleSaveProfileEdit = async (id: string, patch: Partial<Profile>): Promise<void> => {
    await window.aether.profiles.update(id, patch)
    setEditingProfileId(null)
    await refreshProfiles()
  }

  const handleSaveCollectionEdit = async (id: string): Promise<void> => {
    const trimmed = editCollName.trim()
    if (!trimmed) return
    await window.aether.collections.rename(id, trimmed)
    await window.aether.collections.setIconUrl(id, editCollIconUrl.trim() || null)
    setEditingCollectionId(null)
    await refresh()
  }

  // ── Collection actions ───────────────────────────────────────────────────

  const handleCreateCollection = async (): Promise<void> => {
    if (!newCollName.trim() || !selectedProfileId) return
    const profileId = selectedProfileId
    await window.aether.collections.create({ name: newCollName.trim(), profileId, source: 'user', iconUrl: newCollIconUrl.trim() || undefined })
    complete('create-collection')
    setNewCollName('')
    setNewCollIconUrl('')
    setShowNewColl(false)
    await refresh()
  }

  const handleDeleteCollection = async (id: string): Promise<void> => {
    await window.aether.collections.remove(id)
    setDeleteCollConfirmId(null)
    if (selectedCollectionId === id) { setSelectedCollectionId(null); setLevel('collections') }
    await refresh()
  }

  const handleReorderCollections = async (sourceId: string, targetId: string): Promise<void> => {
    if (sourceId === targetId) return
    const ids = profileCollections.map((c) => c.id)
    const fromIdx = ids.indexOf(sourceId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, sourceId)
    await window.aether.collections.reorder(reordered)
    await refresh()
  }

  const handleReorderLinks = async (cid: string, linkIds: string[]): Promise<void> => {
    await window.aether.collections.reorderLinks(cid, linkIds)
    await refresh()
  }

  const handleExport = async (id: string): Promise<void> => {
    // Try short code first (requires network + deployed share worker)
    const code = await window.aether.collections.share(id)
    const textToCopy = code ?? (await window.aether.collections.export(id))
    if (!textToCopy) return
    complete('export-collection')
    const { x, y } = mousePos.current
    setExportCopiedPos({ id, x, y })
    setTimeout(() => setExportCopiedPos(null), 2000)
    try { await navigator.clipboard.writeText(textToCopy) } catch { /* clipboard may fail if window loses focus */ }
  }

  const handleImport = async (): Promise<void> => {
    if (!importValue.trim() || !selectedProfileId) return
    const profileId = selectedProfileId
    await window.aether.collections.import(importValue.trim(), profileId)
    complete('export-collection')
    setImportValue('')
    setShowImport(false)
    await refresh()
  }

  // ── Link actions ─────────────────────────────────────────────────────────

  const handleAddLink = async (cid: string, link: { title: string; url: string; favicon?: string }): Promise<void> => {
    await window.aether.collections.addLink(cid, link)
    await refresh()
  }

  const handleRemoveLink = async (cid: string, lid: string): Promise<void> => {
    await window.aether.collections.removeLink(cid, lid)
    await refresh()
  }

  const handleEditLink = async (cid: string, lid: string, title: string, url: string): Promise<void> => {
    await window.aether.collections.updateLink(cid, lid, { title, url })
    await refresh()
  }

  const handleOpen = (url: string): void => { void window.aether.tabs.create(url) }

  // ── Derived data ─────────────────────────────────────────────────────────

  const profileCollections = useMemo(() => {
    if (!selectedProfileId) return []
    const all = collections.filter((c) => c.profileId === selectedProfileId)
    if (!selectedCollectionId) return all
    const selected = all.find((c) => c.id === selectedCollectionId)
    if (!selected) return all
    return [selected, ...all.filter((c) => c.id !== selectedCollectionId)]
  }, [collections, selectedProfileId, selectedCollectionId])

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  )

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId),
    [profiles, selectedProfileId]
  )

  const sortedProfiles = useMemo(() => {
    const pinnedId = selectedProfileId ?? activeProfile?.id
    if (!pinnedId) return profiles
    const pinned = profiles.find((p) => p.id === pinnedId)
    if (!pinned) return profiles
    return [pinned, ...profiles.filter((p) => p.id !== pinnedId)]
  }, [profiles, selectedProfileId, activeProfile?.id])

  const filteredProfiles = useMemo(() => {
    const q = debouncedProfileSearch.toLowerCase()
    if (!q) return sortedProfiles
    return sortedProfiles.filter((p) =>
      p.name.toLowerCase().includes(q) || p.processNames.some((n) => n.toLowerCase().includes(q))
    )
  }, [sortedProfiles, debouncedProfileSearch])

  const isSearching = debouncedQuery.trim().length > 0
  const filteredCollections = useMemo(() => {
    if (!isSearching || level !== 'collections') return profileCollections
    const q = debouncedQuery.toLowerCase()
    return profileCollections.filter((c) => c.name.toLowerCase().includes(q))
  }, [isSearching, level, debouncedQuery, profileCollections])
  const searchResults = useMemo(() => {
    if (!isSearching) return []
    const q = debouncedQuery.toLowerCase()
    return profileCollections.flatMap((c) =>
      c.links
        .filter((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
        .map((l) => ({ ...l, collectionId: c.id, collectionName: c.name }))
    )
  }, [isSearching, debouncedQuery, profileCollections])

  const navBack = useCallback((): void => {
    if (level === 'links') { setLevel('collections') }
    else if (level === 'collections') { setLevel('profiles') }
  }, [level])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center gap-1 px-2 h-8 border-b border-border shrink-0">
        {level !== 'profiles' && (
          <button type="button" aria-label="Go back" onClick={navBack}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0">
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
        )}
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[11px] min-w-0 flex-1">
          {level === 'profiles' && <span className="text-muted-foreground font-medium">Profiles</span>}
          {level === 'collections' && (
            <>
              <button type="button" onClick={() => setLevel('profiles')} aria-label="Back to profiles"
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors truncate shrink-0 max-w-[80px]">Profiles</button>
              <ChevronRight size={10} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">{selectedProfile?.name ?? '—'}</span>
            </>
          )}
          {level === 'links' && (
            <>
              <button type="button" onClick={() => setLevel('profiles')} aria-label="Back to profiles"
                className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors shrink-0">Profiles</button>
              <ChevronRight size={10} className="text-muted-foreground/30 shrink-0" aria-hidden="true" />
              <button type="button" onClick={() => { setLevel('collections') }}
                aria-label={`Back to ${selectedProfile?.name ?? 'profile'} collections`}
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors truncate shrink-0 max-w-[70px]">
                {selectedProfile?.name ?? '—'}
              </button>
              <ChevronRight size={10} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />
              <span className="font-medium truncate">{selectedCollection?.name ?? '—'}</span>
            </>
          )}
        </nav>
        {onClose && (
          <button type="button" aria-label="Close" onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0">
            <XIcon size={11} aria-hidden="true" />
          </button>
        )}
      </div>

      {level !== 'profiles' && (
        <div className="px-2 pt-2 pb-1.5 border-b border-border shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              aria-label={level === 'links' ? 'Search links' : 'Search collections'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={level === 'links' ? 'Search links…' : 'Search collections…'}
              className="pl-7 h-7 text-xs"
            />
            {searchQuery && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <XIcon size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {level === 'profiles' && (
        <div className="flex flex-col flex-1 min-h-0">
          {profiles.length > 5 && (
            <div className="px-2 pt-2 pb-1.5 border-b border-border shrink-0">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input aria-label="Search profiles" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)}
                  placeholder="Search profiles…" className="pl-7 h-7 text-xs" />
                {profileSearch && (
                  <button type="button" aria-label="Clear" onClick={() => setProfileSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <XIcon size={11} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}
          <ul className="flex-1 overflow-y-auto" role="list" aria-label="Profiles">
            {filteredProfiles.length === 0 && (
              <li className="px-3 py-6 text-center text-[11px] text-muted-foreground/60">No profile matches &laquo;{profileSearch}&raquo;.</li>
            )}
            {filteredProfiles.map((p) => {
              const isActive = p.id === activeProfile?.id
              const collCount = collections.filter((c) => c.profileId === p.id).length
              const isEditing = editingProfileId === p.id
              return (
                <li key={p.id} className="border-b border-border/40">
                  {isEditing ? (
                    <ProfileEditForm
                      profile={p}
                      isDefault={p.id === DEFAULT_PROFILE_ID}
                      onSave={(patch) => void handleSaveProfileEdit(p.id, patch)}
                      onCancel={() => setEditingProfileId(null)}
                    />
                  ) : (
                    <>
                      <button type="button"
                        aria-label={`${isActive ? 'Active profile: ' : 'Switch to profile '}${p.name}${p.processNames.length > 0 ? ` (${p.processNames.join(', ')})` : ''}`}
                        aria-current={isActive ? 'true' : undefined}
                        className="group w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring text-left"
                        onClick={() => void handleSelectProfile(p.id)}>
                        <ProfileIcon iconUrl={p.iconUrl} name={p.name} size={20} profileId={p.id} />
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-[12px] truncate', isActive && 'text-primary font-medium')}>{p.name}</div>
                          <div className="text-[10px] text-muted-foreground/60 truncate">
                            {collCount} collection{collCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {isActive && <Check size={12} className="text-primary shrink-0" aria-hidden="true" />}
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {p.id !== DEFAULT_PROFILE_ID && (
                            <Tooltip label="Edit">
                              <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} className="h-6 w-6"
                                onClick={() => setEditingProfileId(p.id)}>
                                <Pencil size={11} aria-hidden="true" />
                              </Button>
                            </Tooltip>
                          )}
                          {p.id !== DEFAULT_PROFILE_ID && (
                            <Tooltip label="Delete">
                              <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`}
                                className="h-6 w-6 hover:text-destructive"
                                onClick={() => setDeleteProfileConfirmId(p.id)}>
                                <Trash2 size={11} aria-hidden="true" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                        <ChevronRight size={12} className="text-muted-foreground/30 shrink-0 -mr-0.5" aria-hidden="true" />
                      </button>
                      {deleteProfileConfirmId === p.id && (
                        <div className="px-3 py-2 bg-muted/30 border-t border-border/60" role="alert">
                          <p className="text-[11px] text-foreground mb-2">Delete &laquo;{p.name}&raquo;?</p>
                          {p.processNames.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mb-2">
                              <strong className="text-foreground">Delete</strong> erases everything permanently.
                              &nbsp;<strong className="text-foreground">Exclude</strong> saves a restorable snapshot.
                            </p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <button type="button"
                              disabled={deletingProfileId === p.id}
                              onClick={() => void handleDeleteProfile(p.id, 'delete')}
                              className="h-6 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              Delete
                            </button>
                            {p.processNames.length > 0 && (
                              <button type="button"
                                disabled={deletingProfileId === p.id}
                                onClick={() => void handleDeleteProfile(p.id, 'exclude')}
                                className="h-6 px-2 rounded text-[11px] bg-amber-500/80 text-white hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                Exclude
                              </button>
                            )}
                            <button type="button"
                              disabled={deletingProfileId === p.id}
                              onClick={() => setDeleteProfileConfirmId(null)}
                              className="h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors ml-auto disabled:opacity-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="border-t border-border/30 shrink-0">
            {showNewProfile ? (
              <ProfileCreateForm
                onSave={handleCreateProfile}
                onCancel={() => setShowNewProfile(false)}
                initialName={prefillNewProfile?.name}
                initialProcessName={prefillNewProfile?.processName}
              />
            ) : (
              <button type="button" aria-label="Create a new profile" onClick={() => setShowNewProfile(true)}
                className="w-full flex items-center gap-2 h-9 px-3 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                <Plus size={13} aria-hidden="true" /> New profile
              </button>
            )}
          </div>
        </div>
      )}

      {level === 'collections' && (
        <div className="flex flex-col flex-1 min-h-0">
          <ul className="flex-1 overflow-y-auto" role="list" aria-label="Collections">
            {filteredCollections.length === 0 && !showNewColl && (
              <li className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/50">
                {isSearching
                  ? <p className="text-[11px]">No collections match &laquo;{debouncedQuery}&raquo;.</p>
                  : <><Globe size={20} aria-hidden="true" /><p className="text-[11px]">No collections yet.</p></>
                }
              </li>
            )}
            {filteredCollections.map((c) => {
              const isSelected = c.id === selectedCollectionId
              const isDragOver = dragOverCollId === c.id && draggedCollId !== c.id
              const isEditing = editingCollectionId === c.id
              return (
                <li key={c.id}
                  draggable={!isEditing && c.source === 'user'}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedCollId(c.id) }}
                  onDragOver={(e) => { e.preventDefault(); if (draggedCollId && draggedCollId !== c.id) setDragOverCollId(c.id) }}
                  onDragLeave={() => setDragOverCollId(null)}
                  onDrop={(e) => { e.preventDefault(); if (draggedCollId && draggedCollId !== c.id) void handleReorderCollections(draggedCollId, c.id); setDraggedCollId(null); setDragOverCollId(null) }}
                  onDragEnd={() => { setDraggedCollId(null); setDragOverCollId(null) }}
                  className={cn('border-b border-border/40', isDragOver && 'border-t-2 border-primary')}>
                  {isEditing ? (
                    <div className="px-3 py-2.5 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        {sanitizeIconUrl(editCollIconUrl)
                          ? <img src={sanitizeIconUrl(editCollIconUrl)} alt="" className="h-5 w-5 shrink-0 rounded-sm object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          : <div className="h-5 w-5 shrink-0 rounded-sm bg-muted-foreground/10 flex items-center justify-center"><Globe size={10} className="text-muted-foreground/30" /></div>
                        }
                        <Input autoFocus aria-label="Collection name" value={editCollName} onChange={(e) => setEditCollName(e.target.value)}
                          placeholder="Collection name…" className="h-7 text-xs flex-1"
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCollectionEdit(c.id); if (e.key === 'Escape') setEditingCollectionId(null) }} />
                      </div>
                      <Input aria-label="Icon URL" value={editCollIconUrl} onChange={(e) => setEditCollIconUrl(e.target.value)}
                        placeholder="Icon URL (optional)" className="h-6 text-[11px]"
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCollectionEdit(c.id); if (e.key === 'Escape') setEditingCollectionId(null) }} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void handleSaveCollectionEdit(c.id)}
                          className="flex-1 h-7 rounded text-[12px] bg-primary/15 text-primary hover:bg-primary/25 transition-colors">Save</button>
                        <button type="button" onClick={() => setEditingCollectionId(null)}
                          className="flex-1 h-7 rounded text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button"
                      aria-label={`Open ${c.name} — ${c.links.length} link${c.links.length !== 1 ? 's' : ''}`}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring text-left', isSelected && 'bg-muted/20', draggedCollId === c.id && 'opacity-50')}
                      onClick={() => { setSelectedCollectionId(c.id); setLevel('links') }}>
                      {c.iconUrl
                        ? <img src={c.iconUrl} alt="" className="h-5 w-5 shrink-0 rounded-sm object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        : <div className="h-5 w-5 shrink-0 rounded-sm bg-muted-foreground/10 flex items-center justify-center"><Globe size={10} className="text-muted-foreground/30" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-[12px] truncate block', isSelected && 'text-primary font-medium')}>{c.name}</span>
                        <div className="text-[10px] text-muted-foreground/60">{c.links.length} link{c.links.length !== 1 ? 's' : ''}</div>
                      </div>
                      {isSelected && <Check size={12} className="text-primary shrink-0" aria-hidden="true" />}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {c.source === 'user' && (
                          <Tooltip label="Edit">
                            <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} className="h-6 w-6"
                              onClick={() => { setEditingCollectionId(c.id); setEditCollName(c.name); setEditCollIconUrl(c.iconUrl ?? '') }}>
                              <Pencil size={11} aria-hidden="true" />
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip label="Export">
                          <Button size="icon" variant="ghost" aria-label={`Export ${c.name}`} className="h-6 w-6"
                            onClick={() => void handleExport(c.id)}>
                            <Download size={11} aria-hidden="true" />
                          </Button>
                        </Tooltip>
                        {c.source === 'user' && (
                          <Tooltip label="Delete">
                            <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} className="h-6 w-6 hover:text-destructive"
                              onClick={() => setDeleteCollConfirmId(c.id)}>
                              <Trash2 size={11} aria-hidden="true" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                      <ChevronRight size={12} className="text-muted-foreground/30 shrink-0" aria-hidden="true" />
                    </button>
                  )}
                  {deleteCollConfirmId === c.id && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border-b border-destructive/20" role="alert">
                      <span className="text-[11px] flex-1">Delete &laquo;{c.name}&raquo;?</span>
                      <button type="button" onClick={() => void handleDeleteCollection(c.id)}
                        className="h-6 px-2 rounded text-[11px] bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors">Delete</button>
                      <button type="button" onClick={() => setDeleteCollConfirmId(null)}
                        className="h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {showNewColl && (
            <div className="flex flex-col gap-1.5 px-3 py-2 border-t border-border/40 shrink-0" role="form" aria-label="Create collection">
              <div className="flex items-center gap-1.5">
                <Input autoFocus aria-label="Collection name" value={newCollName} onChange={(e) => setNewCollName(e.target.value)}
                  placeholder="Collection name…" className="h-7 text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateCollection(); if (e.key === 'Escape') { setShowNewColl(false); setNewCollName(''); setNewCollIconUrl('') } }} />
                <Button size="icon" variant="ghost" aria-label="Create" className="h-7 w-7" onClick={() => void handleCreateCollection()}><Check size={11} /></Button>
                <Button size="icon" variant="ghost" aria-label="Cancel" className="h-7 w-7" onClick={() => { setShowNewColl(false); setNewCollName(''); setNewCollIconUrl('') }}><XIcon size={11} /></Button>
              </div>
              <Input aria-label="Icon URL (optional)" value={newCollIconUrl} onChange={(e) => setNewCollIconUrl(e.target.value)}
                placeholder="Icon URL (optional)" className="h-6 text-[11px]"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateCollection(); if (e.key === 'Escape') { setShowNewColl(false); setNewCollName(''); setNewCollIconUrl('') } }} />
            </div>
          )}

          {showImport && !showNewColl && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/40 shrink-0" role="form" aria-label="Import collection">
              <Input autoFocus aria-label="Collection Base64 code" value={importValue} onChange={(e) => setImportValue(e.target.value)}
                placeholder="Paste code…" className="h-7 text-xs flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleImport(); if (e.key === 'Escape') { setShowImport(false); setImportValue('') } }} />
              <Button size="icon" variant="ghost" aria-label="Import" className="h-7 w-7" onClick={() => void handleImport()}><Check size={11} /></Button>
              <Button size="icon" variant="ghost" aria-label="Cancel" className="h-7 w-7" onClick={() => { setShowImport(false); setImportValue('') }}><XIcon size={11} /></Button>
            </div>
          )}

          {!showNewColl && !showImport && (
            <div className="flex items-center gap-0.5 px-2 py-2 border-t border-border/30 shrink-0">
              <Button size="sm" variant="ghost" aria-label="Create a new collection" onClick={() => setShowNewColl(true)} className="text-[11px] text-muted-foreground gap-1.5">
                <Plus size={11} aria-hidden="true" /> New
              </Button>
              <Button size="sm" variant="ghost" aria-label="Import a Base64 collection" onClick={() => setShowImport(true)} className="text-[11px] text-muted-foreground gap-1.5">
                <Upload size={11} aria-hidden="true" /> Import
              </Button>
            </div>
          )}
        </div>
      )}

      {level === 'links' && selectedCollection && !isSearching && (
        <div className="flex-1 min-h-0">
          <LinksView
            collection={selectedCollection}
            tabs={tabs}
            onOpen={handleOpen}
            onAddLink={(link) => void handleAddLink(selectedCollection.id, link)}
            onEditLink={(lid, title, url) => void handleEditLink(selectedCollection.id, lid, title, url)}
            onRemoveLink={(lid) => void handleRemoveLink(selectedCollection.id, lid)}
            onReorderLinks={(ids) => void handleReorderLinks(selectedCollection.id, ids)}
          />
        </div>
      )}

      {isSearching && level === 'links' && (
        <div className="flex-1 overflow-y-auto p-1.5">
          <p className="sr-only" role="status" aria-live="polite">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{debouncedQuery}"
          </p>
          {searchResults.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-6">No results.</p>
          ) : (
            <ul className="space-y-0.5" role="list" aria-label="Search results">
              {searchResults.map((l) => (
                <li key={`${l.collectionId}-${l.id}`} className="group flex items-center gap-1 px-2 py-1.5 hover:bg-muted/40 rounded-md">
                  <button type="button" aria-label={`Open ${l.title}`} onClick={() => handleOpen(l.url)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Favicon url={l.url} favicon={l.favicon} />
                      <span className="truncate">{l.title}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{l.collectionName}</div>
                  </button>
                  <Tooltip label="Remove link">
                    <Button size="icon" variant="ghost" aria-label={`Remove ${l.title}`}
                      className="h-5 w-5 hover:text-destructive opacity-0 group-hover:opacity-60"
                      onClick={() => void handleRemoveLink(l.collectionId, l.id)}>
                      <Trash2 size={9} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {exportCopiedPos && (
        <div
          role="status"
          aria-live="polite"
          style={{ left: exportCopiedPos.x, top: exportCopiedPos.y - 36 }}
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border shadow-lg text-[11px] text-foreground whitespace-nowrap"
        >
          <Check size={11} className="text-green-500 shrink-0" aria-hidden="true" />
          Copied to clipboard
        </div>
      )}
    </div>
  )
}
