export type NavLevel = 'profiles' | 'collections' | 'links'

export interface PinnedEntry {
  id: string
  collectionId: string
  collectionName: string
  title: string
  url: string
  favicon?: string
}
