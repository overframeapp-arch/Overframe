// IPC channel names — single source of truth for both main and preload.

export const IPC = {
  // Tabs
  TabsCreate: 'tabs:create',
  TabsClose: 'tabs:close',
  TabsNavigate: 'tabs:navigate',
  TabsGoBack: 'tabs:goBack',
  TabsGoForward: 'tabs:goForward',
  TabsReload: 'tabs:reload',
  TabsSetActive: 'tabs:setActive',
  TabsDeactivate: 'tabs:deactivate',
  TabsReorder: 'tabs:reorder',
  TabsGetAll: 'tabs:getAll',
  TabsGetMemoryUsage: 'tabs:getMemoryUsage',
  TabsMemoryUpdated: 'tabs:memoryUpdated',

  // Overlay
  OverlaySetOpacity: 'overlay:setOpacity',
  OverlayHide: 'overlay:hide',
  OverlayShow: 'overlay:show',
  OverlayGetState: 'overlay:getState',
  OverlaySetPanelWidth: 'overlay:setPanelWidth',
  OverlaySetChromeHeight: 'overlay:setChromeHeight',
  OverlayToggleMaximize: 'overlay:toggleMaximize',
  OverlayIsMaximized: 'overlay:isMaximized',
  OverlayUnmaximize: 'overlay:unmaximize',
  OverlaySetPosition: 'overlay:setPosition',
  OverlaySetMouseInteractive: 'overlay:setMouseInteractive',
  OverlayRequestClickThrough: 'overlay:requestClickThrough',
  OverlayLeaveClickThrough: 'overlay:leaveClickThrough',

  // Collections
  CollectionsGetAll: 'collections:getAll',
  CollectionsCreate: 'collections:create',
  CollectionsRemove: 'collections:remove',
  CollectionsRename: 'collections:rename',
  CollectionsAddLink: 'collections:addLink',
  CollectionsRemoveLink: 'collections:removeLink',
  CollectionsUpdateLink: 'collections:updateLink',
  CollectionsTogglePin: 'collections:togglePin',
  CollectionsExport: 'collections:export',
  CollectionsShare: 'collections:share',
  CollectionsImport: 'collections:import',
  CollectionsSetIconUrl: 'collections:setIconUrl',
  CollectionsReorderLinks: 'collections:reorderLinks',
  CollectionsReorder: 'collections:reorder',

  // Profiles
  ProfilesGetAll: 'profiles:getAll',
  ProfilesGetCurrent: 'profiles:getCurrent',
  ProfilesCreate: 'profiles:create',
  ProfilesRemove: 'profiles:remove',
  ProfilesUpdate: 'profiles:update',
  ProfilesSetActive: 'profiles:setActive',
  ProfilesGetExcluded: 'profiles:getExcluded',
  ProfilesUnexclude: 'profiles:unexclude',
  ProfilesExclude: 'profiles:exclude',
  ProfilesGetCustomGamePaths: 'profiles:getCustomGamePaths',
  ProfilesAddCustomGamePath: 'profiles:addCustomGamePath',
  ProfilesRemoveCustomGamePath: 'profiles:removeCustomGamePath',
  ProfilesGetVisibleGames: 'profiles:getVisibleGames',
  /** Bypass the 30s throttle and run auto-detection immediately. */
  ProfilesForceDetect: 'profiles:forceDetect',

  // Settings
  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',

  // System
  SystemOpenExternal: 'system:openExternal',
  SystemToggleDevTools: 'system:toggleDevTools',
  SystemLayoutMap: 'system:layoutMap',
  /** Opens a native folder picker; returns the selected path or null. */
  SystemPickFolder: 'system:pickFolder',
  /** Launches the Squirrel uninstaller and quits the app. */
  SystemUninstall: 'system:uninstall',
  /** Renderer → Main: show an achievement notification popup window. */
  AchievementNotify: 'achievement:notify',
  AppGetVersion: 'app:getVersion',
  /** Renderer → Main: trigger an update check. */
  AppCheckForUpdates: 'app:checkForUpdates',
  /** Main → Renderer: live update-check status. */
  EventUpdateStatus: 'event:update:status',

  // Popup windows
  PopupOpen: 'popup:open',
  PopupOpenLinkOverflow: 'popup:openLinkOverflow',
  PopupClose: 'popup:close',
  PopupCloseNotification: 'popup:closeNotification',
  PopupInit: 'popup:init',
  PopupDone: 'popup:done',
  /** Main → notifWin: signal the renderer to start its slide-out animation. */
  PopupNotifDismiss: 'popup:notifDismiss',

  // Main → Renderer events
  EventTabUpdated: 'event:tab:updated',
  EventTabRemoved: 'event:tab:removed',
  EventActiveTabChanged: 'event:tab:activeChanged',
  EventProfileChanged: 'event:profile:changed',
  EventProfileAutoDetected: 'event:profile:autoDetected',
  /** Fired when a visible game was seen but could not be auto-profiled. */
  EventGameUndetected: 'event:game:undetected',
  EventOverlayStateChanged: 'event:overlay:stateChanged',
  /** Fired by main only when the user explicitly toggles the overlay via shortcut (not auto-hide). */
  EventOverlayUserToggled: 'event:overlay:userToggled',
  EventOpenPanel: 'event:openPanel',
  /** Fired by main so renderer can toggle focus mode even when in-game (uiohook WH_KEYBOARD_LL). */
  EventToggleFocusMode: 'event:toggleFocusMode',
  /** Fired by main when the overlay opacity changes via shortcut — lets the renderer sync the slider. */
  EventOpacityChanged: 'event:opacity:changed',
  /** Fired by main when settings are saved from any window — lets all renderers sync their store. */
  EventSettingsChanged: 'event:settings:changed',

  // Popup → Main (close popup and open a side panel)
  OpenPanelFromPopup: 'popup:openPanel',

  // Zoom
  TabsSetZoom: 'tabs:setZoom',

  // Audio mute
  TabsSetMuted: 'tabs:setMuted',

  // Downloads
  EventDownload: 'event:download',

  // Dev-only
  /** Clears the entire electron-store and relaunches. No-op in production builds. */
  DevStoreReset: 'dev:storeReset',
  /** Writes a synthetic crash entry to crash.log — dev only. */
  DevSimulateCrash: 'dev:simulateCrash',
  /** Captures the overlay window and saves a PNG to %TEMP%\overframe-dev-screenshot.png. Returns the path. */
  DevScreenshot: 'dev:screenshot',
  /** Returns the last N lines of a dev log file (renderer | webview | crash). */
  DevReadLog: 'dev:readLog',
  /** Opens a system folder in Windows Explorer. */
  SystemOpenFolder: 'system:openFolder',
  /** Wipes all user data (store + localStorage) and relaunches. */
  SystemResetData: 'system:resetData',
} as const
