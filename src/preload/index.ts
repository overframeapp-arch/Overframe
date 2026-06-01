import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  Collection,
  NewCollection,
  NewLink,
  NewProfile,
  OverlayState,
  Profile,
  Settings,
  TabState,
  MemorySnapshot,
  BookmarkPopupPayload,
  LinkOverflowPayload,
  MemoryPopupPayload,
  ProfilesPopupPayload,
  CollectionPickerPayload,
  CollectionsPopupPayload,
  SettingsPopupPayload,
  ManageProfilesPayload,
  GameNotificationPayload,
  GameUndetectedPayload,
  WindowBounds,
  DownloadEvent,
} from '@shared/types'

const api = {
  tabs: {
    create: (url?: string): Promise<TabState> => ipcRenderer.invoke(IPC.TabsCreate, url),
    close: (id: string) => ipcRenderer.invoke(IPC.TabsClose, id),
    navigate: (id: string, url: string) => ipcRenderer.invoke(IPC.TabsNavigate, id, url),
    goBack: (id: string) => ipcRenderer.invoke(IPC.TabsGoBack, id),
    goForward: (id: string) => ipcRenderer.invoke(IPC.TabsGoForward, id),
    reload: (id: string) => ipcRenderer.invoke(IPC.TabsReload, id),
    setActive: (id: string) => ipcRenderer.invoke(IPC.TabsSetActive, id),
    deactivate: () => ipcRenderer.invoke(IPC.TabsDeactivate),
    reorder: (ids: string[]) => ipcRenderer.invoke(IPC.TabsReorder, ids),
    getAll: (): Promise<{ tabs: TabState[]; activeId: string | null }> =>
      ipcRenderer.invoke(IPC.TabsGetAll),
    getMemoryUsage: (): Promise<MemorySnapshot> => ipcRenderer.invoke(IPC.TabsGetMemoryUsage),
    setZoom: (id: string, factor: number): Promise<void> =>
      ipcRenderer.invoke(IPC.TabsSetZoom, id, factor),
    setMuted: (id: string, muted: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.TabsSetMuted, id, muted),
  },
  overlay: {
    setOpacity: (value: number) => ipcRenderer.invoke(IPC.OverlaySetOpacity, value),
    show: (): void => ipcRenderer.send(IPC.OverlayShow),
    hide: () => ipcRenderer.invoke(IPC.OverlayHide),
    getState: (): Promise<OverlayState> => ipcRenderer.invoke(IPC.OverlayGetState),
    setMouseInteractive: (interactive: boolean) =>
      ipcRenderer.send(IPC.OverlaySetMouseInteractive, interactive),
    requestClickThrough: () => ipcRenderer.send(IPC.OverlayRequestClickThrough),
    leaveClickThrough: () => ipcRenderer.send(IPC.OverlayLeaveClickThrough),
    setPanelWidth: (w: number) => ipcRenderer.send(IPC.OverlaySetPanelWidth, w),
    setChromeHeight: (h: number) => ipcRenderer.send(IPC.OverlaySetChromeHeight, h),
    toggleMaximize: () => ipcRenderer.invoke(IPC.OverlayToggleMaximize),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.OverlayIsMaximized),
    unmaximize: (): Promise<WindowBounds | null> => ipcRenderer.invoke(IPC.OverlayUnmaximize),
    setPosition: (x: number, y: number): void => ipcRenderer.send(IPC.OverlaySetPosition, x, y),
  },
  collections: {
    getAll: (): Promise<Collection[]> => ipcRenderer.invoke(IPC.CollectionsGetAll),
    create: (input: NewCollection): Promise<Collection> =>
      ipcRenderer.invoke(IPC.CollectionsCreate, input),
    remove: (id: string) => ipcRenderer.invoke(IPC.CollectionsRemove, id),
    rename: (id: string, name: string) => ipcRenderer.invoke(IPC.CollectionsRename, id, name),
    addLink: (collectionId: string, link: NewLink) =>
      ipcRenderer.invoke(IPC.CollectionsAddLink, collectionId, link),
    removeLink: (collectionId: string, linkId: string) =>
      ipcRenderer.invoke(IPC.CollectionsRemoveLink, collectionId, linkId),
    updateLink: (collectionId: string, linkId: string, patch: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.CollectionsUpdateLink, collectionId, linkId, patch),
    togglePin: (collectionId: string, linkId: string) =>
      ipcRenderer.invoke(IPC.CollectionsTogglePin, collectionId, linkId),
    export: (id: string): Promise<string | null> => ipcRenderer.invoke(IPC.CollectionsExport, id),
    share: (id: string): Promise<string | null> => ipcRenderer.invoke(IPC.CollectionsShare, id),
    import: (base64: string, profileId: string): Promise<Collection | null> =>
      ipcRenderer.invoke(IPC.CollectionsImport, base64, profileId),
    setIconUrl: (id: string, iconUrl: string | null): Promise<Collection | null> =>
      ipcRenderer.invoke(IPC.CollectionsSetIconUrl, id, iconUrl),
    reorderLinks: (collectionId: string, linkIds: string[]): Promise<Collection | null> =>
      ipcRenderer.invoke(IPC.CollectionsReorderLinks, collectionId, linkIds),
    reorder: (collectionIds: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.CollectionsReorder, collectionIds),
  },
  profiles: {
    getAll: (): Promise<Profile[]> => ipcRenderer.invoke(IPC.ProfilesGetAll),
    getCurrent: (): Promise<Profile> => ipcRenderer.invoke(IPC.ProfilesGetCurrent),
    create: (input: NewProfile): Promise<Profile> => ipcRenderer.invoke(IPC.ProfilesCreate, input),
    remove: (id: string, mode: 'delete' | 'exclude' = 'exclude') => ipcRenderer.invoke(IPC.ProfilesRemove, id, mode),
    update: (id: string, patch: Partial<Profile>) =>
      ipcRenderer.invoke(IPC.ProfilesUpdate, id, patch),
    setActive: (id: string) => ipcRenderer.invoke(IPC.ProfilesSetActive, id),
    getExcluded: (): Promise<string[]> => ipcRenderer.invoke(IPC.ProfilesGetExcluded),
    unexclude: (name: string) => ipcRenderer.invoke(IPC.ProfilesUnexclude, name),
    exclude: (name: string) => ipcRenderer.invoke(IPC.ProfilesExclude, name),
    getCustomGamePaths: (): Promise<string[]> => ipcRenderer.invoke(IPC.ProfilesGetCustomGamePaths),
    addCustomGamePath: (path: string) => ipcRenderer.invoke(IPC.ProfilesAddCustomGamePath, path),
    removeCustomGamePath: (path: string) => ipcRenderer.invoke(IPC.ProfilesRemoveCustomGamePath, path),
    getVisibleGames: (): Promise<{ processName: string; exePath: string; displayName: string }[]> =>
      ipcRenderer.invoke(IPC.ProfilesGetVisibleGames),
    forceDetect: (): Promise<void> => ipcRenderer.invoke(IPC.ProfilesForceDetect),
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),
    set: <K extends keyof Settings>(key: K, value: Settings[K]): Promise<Settings | null> =>
      ipcRenderer.invoke(IPC.SettingsSet, key, value)
  },
  system: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC.SystemOpenExternal, url),
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.AppGetVersion),
    toggleDevTools: () => ipcRenderer.invoke(IPC.SystemToggleDevTools),
    devStoreReset: (): Promise<void> => ipcRenderer.invoke(IPC.DevStoreReset),
    reportLayoutMap: (map: Record<string, string>) => ipcRenderer.send(IPC.SystemLayoutMap, map),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.SystemPickFolder),
    uninstall: (): Promise<void> => ipcRenderer.invoke(IPC.SystemUninstall),
    openFolder: (target: 'userData' | 'app' | 'logs'): Promise<void> => ipcRenderer.invoke(IPC.SystemOpenFolder, target),
    simulateCrash: (): Promise<void> => ipcRenderer.invoke(IPC.DevSimulateCrash),
    resetData: (): Promise<void> => ipcRenderer.invoke(IPC.SystemResetData),
    checkForUpdates: (): Promise<void> => ipcRenderer.invoke(IPC.AppCheckForUpdates),
    /** Dev only — captures the overlay window to %TEMP%\overframe-dev-screenshot.png. Returns the path. */
    devScreenshot: (): Promise<string | null> => ipcRenderer.invoke(IPC.DevScreenshot),
    /** Dev only — returns the last N lines of a log file. */
    devReadLog: (source: 'renderer' | 'webview' | 'crash', lines?: number): Promise<string | null> =>
      ipcRenderer.invoke(IPC.DevReadLog, source, lines),
  },
  achievement: {
    notify: (title: string): Promise<void> => ipcRenderer.invoke(IPC.AchievementNotify, { title }),
  },
  popup: {
    open: (type: 'bookmark', data: BookmarkPopupPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, type, data),
    openMemory: (data: MemoryPopupPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'memory', data),
    openProfiles: (data: ProfilesPopupPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'profiles', data),
    openCollectionPicker: (data: CollectionPickerPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'collectionPicker', data),
    openCollections: (data: CollectionsPopupPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'collections', data),
    openSettings: (data: SettingsPopupPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'settings', data),
    openManageProfiles: (data: ManageProfilesPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpen, 'manage-profiles', data),
    openLinkOverflow: (data: LinkOverflowPayload): Promise<void> =>
      ipcRenderer.invoke(IPC.PopupOpenLinkOverflow, data),
    close: (): void => ipcRenderer.send(IPC.PopupClose),
    closeNotification: (): void => ipcRenderer.send(IPC.PopupCloseNotification),
    openPanel: (panelId: string, collectionId?: string, prefillNewProfile?: { name: string; processName: string }): Promise<void> =>
      ipcRenderer.invoke(IPC.OpenPanelFromPopup, panelId, collectionId, prefillNewProfile),
    onInit: (cb: (payload:
      | { type: 'bookmark'; data: BookmarkPopupPayload }
      | { type: 'memory'; data: MemoryPopupPayload }
      | { type: 'profiles'; data: ProfilesPopupPayload }
      | { type: 'collectionPicker'; data: CollectionPickerPayload }
      | { type: 'collections'; data: CollectionsPopupPayload }
      | { type: 'settings'; data: SettingsPopupPayload }
      | { type: 'manage-profiles'; data: ManageProfilesPayload }
      | { type: 'gameNotification'; data: GameNotificationPayload }
      | { type: 'gameUndetected'; data: GameUndetectedPayload }
      | { type: 'linkOverflow'; data: LinkOverflowPayload }
    ) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload as typeof cb extends (p: infer P) => void ? P : never)
      ipcRenderer.on(IPC.PopupInit, listener)
      return () => ipcRenderer.removeListener(IPC.PopupInit, listener)
    }
  },
  on: {
    tabUpdated: (cb: (tab: TabState) => void): (() => void) => {
      const listener = (_e: unknown, tab: TabState): void => cb(tab)
      ipcRenderer.on(IPC.EventTabUpdated, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventTabUpdated, listener) }
    },
    tabRemoved: (cb: (id: string) => void): (() => void) => {
      const listener = (_e: unknown, id: string): void => cb(id)
      ipcRenderer.on(IPC.EventTabRemoved, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventTabRemoved, listener) }
    },
    activeTabChanged: (cb: (id: string | null) => void): (() => void) => {
      const listener = (_e: unknown, id: string | null): void => cb(id)
      ipcRenderer.on(IPC.EventActiveTabChanged, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventActiveTabChanged, listener) }
    },
    profileChanged: (cb: (profile: Profile) => void): (() => void) => {
      const listener = (_e: unknown, p: Profile): void => cb(p)
      ipcRenderer.on(IPC.EventProfileChanged, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventProfileChanged, listener) }
    },
    profileAutoDetected: (cb: (payload: { profile: Profile; isNew: boolean }) => void): (() => void) => {
      const listener = (_e: unknown, p: { profile: Profile; isNew: boolean }): void => cb(p)
      ipcRenderer.on(IPC.EventProfileAutoDetected, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventProfileAutoDetected, listener) }
    },
    overlayStateChanged: (cb: (state: OverlayState) => void): (() => void) => {
      const listener = (_e: unknown, s: OverlayState): void => cb(s)
      ipcRenderer.on(IPC.EventOverlayStateChanged, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventOverlayStateChanged, listener) }
    },
    overlayUserToggled: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.EventOverlayUserToggled, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventOverlayUserToggled, listener) }
    },
    popupDone: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.PopupDone, listener)
      return (): void => { ipcRenderer.removeListener(IPC.PopupDone, listener) }
    },
    memoryUpdated: (cb: (snapshot: MemorySnapshot) => void): (() => void) => {
      const listener = (_e: unknown, s: MemorySnapshot): void => cb(s)
      ipcRenderer.on(IPC.TabsMemoryUpdated, listener)
      return (): void => { ipcRenderer.removeListener(IPC.TabsMemoryUpdated, listener) }
    },
    toggleFocusMode: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.EventToggleFocusMode, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventToggleFocusMode, listener) }
    },
    opacityChanged: (cb: (opacity: number) => void): (() => void) => {
      const listener = (_e: unknown, v: number): void => cb(v)
      ipcRenderer.on(IPC.EventOpacityChanged, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventOpacityChanged, listener) }
    },
    settingsChanged: (cb: (s: Settings) => void): (() => void) => {
      const listener = (_e: unknown, s: Settings): void => cb(s)
      ipcRenderer.on(IPC.EventSettingsChanged, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventSettingsChanged, listener) }
    },
    /** Fired in the notifWin just before it is destroyed — trigger slide-out animation. */
    notifDismiss: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.PopupNotifDismiss, listener)
      return (): void => { ipcRenderer.removeListener(IPC.PopupNotifDismiss, listener) }
    },
    downloadUpdate: (cb: (event: DownloadEvent) => void): (() => void) => {
      const listener = (_e: unknown, event: DownloadEvent): void => cb(event)
      ipcRenderer.on(IPC.EventDownload, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventDownload, listener) }
    },
    updateStatus: (cb: (payload: { status: string; version?: string; message?: string }) => void): (() => void) => {
      const listener = (_e: unknown, p: { status: string; version?: string; message?: string }): void => cb(p)
      ipcRenderer.on(IPC.EventUpdateStatus, listener)
      return (): void => { ipcRenderer.removeListener(IPC.EventUpdateStatus, listener) }
    },
  }
}

export type AetherAPI = typeof api

contextBridge.exposeInMainWorld('aether', api)
