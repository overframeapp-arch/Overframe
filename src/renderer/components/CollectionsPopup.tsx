import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { CollectionsPanel } from './CollectionsPanel'

export function CollectionsPopup({ initialLevel, initialCollectionId, prefillNewProfile }: { initialLevel?: 'profiles' | 'collections' | 'links'; initialCollectionId?: string; prefillNewProfile?: { name: string; processName: string } } = {}): JSX.Element {
  const { setProfiles, setActiveProfile, setCollections, setTabs } = useAppStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void Promise.all([
      window.aether.profiles.getAll(),
      window.aether.profiles.getCurrent(),
      window.aether.collections.getAll(),
      window.aether.tabs.getAll(),
    ]).then(([profiles, current, collections, tabsState]) => {
      setProfiles(profiles)
      setActiveProfile(current)
      setCollections(collections)
      setTabs(tabsState.tabs, tabsState.activeId)
      setReady(true)
    })
  }, [setProfiles, setActiveProfile, setCollections, setTabs])

  useEffect(() => {
    return window.aether.on.profileChanged((p) => {
      setActiveProfile(p)
      void window.aether.profiles.getAll().then(setProfiles)
      void window.aether.collections.getAll().then(setCollections)
    })
  }, [setActiveProfile, setProfiles, setCollections])

  if (!ready) {
    return (
      <div className="h-full bg-background border border-border rounded-lg flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    )
  }

  return (
    <div className="h-full bg-background border border-border rounded-lg shadow-2xl overflow-hidden">
      <CollectionsPanel initialLevel={initialLevel} initialCollectionId={initialCollectionId} prefillNewProfile={prefillNewProfile} onClose={() => window.aether.popup.close()} />
    </div>
  )
}
