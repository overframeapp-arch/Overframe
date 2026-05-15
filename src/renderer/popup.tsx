import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import type { BookmarkPopupPayload, MemoryPopupPayload, ProfilesPopupPayload, CollectionPickerPayload, CollectionsPopupPayload, LinkOverflowPayload, SettingsPopupPayload, GameNotificationPayload, GameUndetectedPayload, AchievementPayload } from '@shared/types'
import { BookmarkPopup } from './components/BookmarkPopup'
import { MemoryPopup } from './components/MemoryPopup'
import { ProfilesPopup } from './components/ProfilesPopup'
import { CollectionPickerPopup } from './components/CollectionPickerPopup'
import { CollectionsPopup } from './components/CollectionsPopup'
import { SettingsPopup } from './components/SettingsPopup'
import { GameNotificationPopup } from './components/GameNotificationPopup'
import { GameUndetectedPopup } from './components/GameUndetectedPopup'
import { LinkOverflowPopup } from './components/LinkOverflowPopup'
import { AchievementNotificationPopup } from './components/AchievementNotificationPopup'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotificationCenter } from './components/NotificationCenter'
import './styles.css'

type PopupState =
  | { type: 'bookmark'; data: BookmarkPopupPayload }
  | { type: 'memory'; data: MemoryPopupPayload }
  | { type: 'profiles'; data: ProfilesPopupPayload }
  | { type: 'collectionPicker'; data: CollectionPickerPayload }
  | { type: 'collections'; data: CollectionsPopupPayload }
  | { type: 'settings'; data: SettingsPopupPayload }
  | { type: 'gameNotification'; data: GameNotificationPayload }
  | { type: 'gameUndetected'; data: GameUndetectedPayload }
  | { type: 'linkOverflow'; data: LinkOverflowPayload }
  | { type: 'achievementNotification'; data: AchievementPayload }
  | null

function PopupRoot(): JSX.Element {
  const [popup, setPopup] = useState<PopupState>(null)

  useEffect(() => {
    const off = window.aether.popup.onInit((payload) => setPopup(payload as PopupState))
    return off
  }, [])

  if (popup?.type === 'bookmark') return <BookmarkPopup initialData={popup.data} />
  if (popup?.type === 'memory') return <MemoryPopup />
  if (popup?.type === 'profiles') return <ProfilesPopup />
  if (popup?.type === 'collectionPicker') return <CollectionPickerPopup payload={popup.data} />
  if (popup?.type === 'collections') return <CollectionsPopup initialLevel={popup.data.initialLevel} initialCollectionId={popup.data.initialCollectionId} prefillNewProfile={popup.data.prefillNewProfile} />
  if (popup?.type === 'settings') return <SettingsPopup />
  if (popup?.type === 'gameNotification') return <GameNotificationPopup data={popup.data} />
  if (popup?.type === 'gameUndetected') return <GameUndetectedPopup data={popup.data} />
  if (popup?.type === 'linkOverflow') return <LinkOverflowPopup data={popup.data} />
  if (popup?.type === 'achievementNotification') return <AchievementNotificationPopup data={popup.data} />
  return <div className="h-full bg-transparent" />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PopupRoot />
      <NotificationCenter />
    </ErrorBoundary>
  </React.StrictMode>
)
