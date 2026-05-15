# Technical Specification — Overframe

**Version**: 0.1  
**Date**: May 2026  
**Status**: Draft  

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | **Electron 33+** | Native OS APIs, globalShortcut, always-on-top, WebContentsView |
| Web renderer | **Chromium via WebContentsView** | Full browser engine, replaces deprecated BrowserView |
| UI framework | **React 18** | Component model fits tab/panel architecture |
| Styling | **Tailwind CSS 3** | Rapid UI, dark-mode ready, no runtime overhead |
| Language | **TypeScript 5** | End-to-end type safety across main + renderer |
| Bundler | **Vite 5** | Fast HMR for renderer, electron-vite plugin |
| Build/Package | **electron-forge** | Squirrel installer for Windows, auto-update ready |
| Persistence (settings/profiles/collections) | **electron-store 10** | JSON file storage, schema validation, atomic writes |
| Persistence (history) | **better-sqlite3** | Local SQLite file — efficient INSERT per visit, fast full-text search, no server |
| Process detection | **ps-list** | Cross-process listing without elevated privileges |
| IPC type safety | **Custom typed IPC bridge** | Preload + contextBridge, no raw ipcRenderer exposure |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                          │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ WindowManager│  │ HotkeyManager │  │ProfileManager│  │
│  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────▼──────────────────▼──────────────────▼───────┐  │
│  │                   IPC Router                        │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │ contextBridge (preload.ts)
┌─────────────────────────┼───────────────────────────────┐
│              RENDERER PROCESS (Shell UI)                 │
│                                                          │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │                  React App                         │  │
│  │  TabBar | AddressBar | Sidebar | SettingsPanel     │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│           WEB CONTENT LAYER (WebContentsView)            │
│                                                          │
│   Tab 1: https://eldenring.wiki.fextralife.com/...       │
│   Tab 2: https://www.google.com                          │
│   Tab N: ...                                             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Process Architecture

### 3.1 Main Process (`src/main/`)

Runs in Node.js. Owns all OS-level operations.

**Responsibilities:**
- Create and manage the BrowserWindow (overlay shell)
- Register/unregister global shortcuts
- Set always-on-top level and click-through state
- Poll running processes for game detection
- Read/write settings, profiles, collections via electron-store
- Read/write history via better-sqlite3 (SQLite)
- Serve IPC requests from renderer

**Key Electron APIs used:**

```typescript
// Always-on-top at 'screen-saver' level (above most system UI)
win.setAlwaysOnTop(true, 'screen-saver')

// Transparent window
win.setBackgroundColor('#00000000')
// BrowserWindow option: transparent: true

// Click-through — forward mouse events to windows below
win.setIgnoreMouseEvents(true, { forward: true })

// Click-through OFF — user is interacting with overlay
win.setIgnoreMouseEvents(false)

// Global hotkey
globalShortcut.register('Alt+B', () => toggleOverlay())

// Window frameless
// BrowserWindow option: frame: false, transparent: true
```

### 3.2 Renderer Process (`src/renderer/`)

Runs in Chromium (sandboxed). No direct Node.js access. All Node/OS operations go through IPC.

**Responsibilities:**
- Render the browser shell UI (tab bar, address bar, bookmarks panel)
- Manage UI state (active tab, settings open/closed, etc.)
- Request data and actions from main process via IPC

### 3.3 WebContentsView (web content layer)

Each browser tab is a `WebContentsView` instance embedded in the main `BrowserWindow`.

```typescript
import { WebContentsView } from 'electron'

const view = new WebContentsView({
  webPreferences: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    // Use standard Chrome user agent
  }
})
win.contentView.addChildView(view)
view.setBounds({ x: 0, y: CHROME_HEIGHT, width: WIN_W, height: WIN_H - CHROME_HEIGHT })
view.webContents.loadURL(url)
```

**Security:** Each WebContentsView is fully sandboxed. No preload script on web content views.

---

## 4. Directory Structure

```
overframe/
├── electron.vite.config.ts       # Vite config for main + preload + renderer
├── package.json
├── tsconfig.json
├── forge.config.ts               # electron-forge packaging config
│
├── src/
│   ├── main/                     # Main process (Node.js)
│   │   ├── index.ts              # Entry point
│   │   ├── windows/
│   │   │   ├── OverlayWindow.ts  # Overlay BrowserWindow creation & management
│   │   │   └── TrayManager.ts    # System tray icon & menu
│   │   ├── managers/
│   │   │   ├── HotkeyManager.ts  # globalShortcut registration
│   │   │   ├── TabManager.ts     # WebContentsView lifecycle per tab
│   │   │   ├── ProfileManager.ts # Game profiles + process detection
│   │   │   ├── HistoryManager.ts # History CRUD
│   │   │   └── BookmarkManager.ts# Bookmarks CRUD
│   │   ├── ipc/
│   │   │   └── handlers.ts       # All IPC handler registrations
│   │   └── store/
│   │       ├── index.ts          # electron-store instance
│   │       └── schema.ts         # JSON schema + defaults
│   │
│   ├── preload/                  # Preload scripts (contextBridge)
│   │   └── index.ts              # Exposes typed API to renderer
│   │
│   └── renderer/                 # React app (Chromium)
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── TabBar/
│       │   ├── AddressBar/
│       │   ├── BookmarksBar/
│       │   ├── HistoryPanel/
│       │   ├── BookmarksPanel/
│       │   ├── SettingsPanel/
│       │   └── DonationButton/
│       ├── hooks/
│       │   ├── useTabs.ts
│       │   ├── useHistory.ts
│       │   ├── useBookmarks.ts
│       │   └── useProfile.ts
│       └── store/
│           └── uiStore.ts        # Zustand store for UI state
│
└── docs/
    ├── PRD.md
    ├── TECH_SPEC.md
    └── ROADMAP.md
```

---

## 5. IPC Contract

All communication between renderer and main process is typed end-to-end.

### Pattern

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('aether', {
  // Tabs
  tabs: {
    create: (url?: string) => ipcRenderer.invoke('tabs:create', url),
    close: (tabId: string) => ipcRenderer.invoke('tabs:close', tabId),
    navigate: (tabId: string, url: string) => ipcRenderer.invoke('tabs:navigate', tabId, url),
    goBack: (tabId: string) => ipcRenderer.invoke('tabs:goBack', tabId),
    goForward: (tabId: string) => ipcRenderer.invoke('tabs:goForward', tabId),
    setActive: (tabId: string) => ipcRenderer.invoke('tabs:setActive', tabId),
  },
  // Overlay
  overlay: {
    setOpacity: (value: number) => ipcRenderer.invoke('overlay:setOpacity', value),
    setClickThrough: (enabled: boolean) => ipcRenderer.invoke('overlay:setClickThrough', enabled),
  },
  // History
  history: {
    getAll: () => ipcRenderer.invoke('history:getAll'),
    clear: (range?: DateRange) => ipcRenderer.invoke('history:clear', range),
  },
  // Link Collections
  collections: {
    getAll: () => ipcRenderer.invoke('collections:getAll'),
    create: (collection: NewCollection) => ipcRenderer.invoke('collections:create', collection),
    remove: (id: string) => ipcRenderer.invoke('collections:remove', id),
    update: (id: string, data: Partial<Collection>) => ipcRenderer.invoke('collections:update', id, data),
    addLink: (collectionId: string, link: NewLink) => ipcRenderer.invoke('collections:addLink', collectionId, link),
    removeLink: (collectionId: string, linkId: string) => ipcRenderer.invoke('collections:removeLink', collectionId, linkId),
    export: (id: string) => ipcRenderer.invoke('collections:export', id),   // returns Base64 string
    import: (base64: string) => ipcRenderer.invoke('collections:import', base64),
  },
  // Profiles
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:getAll'),
    getCurrent: () => ipcRenderer.invoke('profiles:getCurrent'),
    create: (profile: NewProfile) => ipcRenderer.invoke('profiles:create', profile),
    setActive: (id: string) => ipcRenderer.invoke('profiles:setActive', id),
  },
  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  },
  // Main → Renderer events
  on: {
    tabUpdated: (cb: (tab: TabState) => void) => ipcRenderer.on('tab:updated', (_, t) => cb(t)),
    profileChanged: (cb: (profile: Profile) => void) => ipcRenderer.on('profile:changed', (_, p) => cb(p)),
  }
})
```

---

## 6. Data Models

### electron-store Schema (`store/schema.ts`)

Stores settings, profiles, and link collections. **History is stored separately in SQLite.**

```typescript
interface OverframeStore {
  settings: {
    hotkey: string            // default: 'Alt+B'
    searchEngine: string      // default: 'https://www.google.com/search?q='
    startWithWindows: boolean // default: false
    activeProfileId: string   // default: 'default'
  }
  profiles: Profile[]
  collections: Collection[]
}

interface Profile {
  id: string
  name: string
  processNames: string[]      // e.g. ['eldenring.exe']
  priority: number            // conflict resolution: higher = wins
  homepageUrl: string
  opacity: number             // 0.2 - 1.0
  windowBounds: { x: number; y: number; width: number; height: number }
}

// Link Collections — replaces simple bookmarks
interface Collection {
  id: string
  name: string                // e.g. "Elden Ring Starter Pack"
  profileId: string | 'shared' // 'shared' = visible in all profiles
  source: 'user' | 'publisher' | 'community'
  links: Link[]
  createdAt: number
  updatedAt: number
}

interface Link {
  id: string
  title: string
  url: string
  note?: string               // short description (optional)
  favicon?: string            // cached data URI
  pinned: boolean             // appears in quick-access bar
  order: number               // sort order within collection
}

// Export/Import payload (Base64-encoded JSON)
interface CollectionExport {
  version: 1
  name: string
  source: string
  links: Omit<Link, 'id' | 'favicon' | 'order'>[]
}
```

### SQLite Schema (history)

```sql
CREATE TABLE history (
  id        TEXT PRIMARY KEY,
  url       TEXT NOT NULL,
  title     TEXT,
  favicon   TEXT,          -- data URI or null
  visited_at INTEGER NOT NULL  -- Unix timestamp ms
);
CREATE INDEX idx_history_visited_at ON history(visited_at DESC);
CREATE INDEX idx_history_url ON history(url);
```

All reads/writes via `better-sqlite3` (synchronous, no async overhead, local file only).

interface TabState {
  id: string
  url: string
  title: string
  favicon: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}
```

---

## 7. Overlay Window Behavior

### State Machine

```
              hotkey pressed
HIDDEN ────────────────────► FOCUSED
  ▲                              │
  │  hotkey pressed             │  click outside overlay bounds
  │◄───────────────────────────┤
  │                              │
  │                              ▼
  ▲   hotkey pressed         CLICK-THROUGH
  └─────────────────────▲  │
                           │  │
                           click inside overlay bounds
```

**Drag zone exception:** A 10px strip at the top of the window is excluded from `setIgnoreMouseEvents` in all states. It always intercepts mouse events for drag repositioning, regardless of the current overlay state.

### Always-on-Top Level

Windows Z-order levels (low to high):
1. Normal windows
2. Topmost windows (`setAlwaysOnTop(true)`)
3. `'pop-up-menu'` level
4. **`'screen-saver'`** level ← Overframe uses this

This ensures the overlay renders above most game windows in borderless windowed mode.

### Window Transparency

```typescript
new BrowserWindow({
  transparent: true,
  frame: false,
  backgroundColor: '#00000000',
  hasShadow: false,
  // ...
})
```

The entire BrowserWindow opacity is controlled via `win.setOpacity(value)`. This affects both the shell UI and the web content uniformly. Below 20% opacity the window is considered unusable and the slider is hard-floored at 0.2. This is the intentional design: the overlay fades as a whole, allowing the user to tune game visibility vs content readability according to their preference.

---

## 8. Game Detection

```typescript
// ProfileManager.ts
import psList from 'ps-list'

class ProfileManager {
  private pollInterval: NodeJS.Timeout | null = null

  startPolling(intervalMs = 5000) {
    this.pollInterval = setInterval(async () => {
      const processes = await psList()
      const names = processes.map(p => p.name.toLowerCase())
      const matched = this.profiles.find(profile =>
        profile.processNames.some(pn => names.includes(pn.toLowerCase()))
      )
      const next = matched ?? this.defaultProfile
      if (next.id !== this.activeProfile.id) {
        this.setActiveProfile(next)
      }
    }, intervalMs)
  }
}
```

**No elevated privileges required.** `tasklist`/`ps-list` work in user context on Windows.

---

## 9. Security Model

| Concern | Mitigation |
|---|---|
| Renderer XSS | `contextIsolation: true`, no direct Node access |
| Web content privilege escalation | `sandbox: true` on WebContentsView, no preload on web views |
| Navigation to `file://` | Block `will-navigate` to non-http(s) protocols in WebContentsView |
| New window popups | Handle `setWindowOpenHandler` — open in new tab, not new process |
| Data exfiltration | No network calls from main process, local storage only |
| IPC parameter injection | Validate all IPC inputs in handlers before processing |

```typescript
// Block dangerous navigation in web views
view.webContents.on('will-navigate', (event, url) => {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    event.preventDefault()
  }
})

// Handle new window requests
view.webContents.setWindowOpenHandler(({ url }) => {
  // Open in a new tab within Overframe
  tabManager.createTab(url)
  return { action: 'deny' }
})
```

---

## 10. Performance Considerations

### Render Suspension

When the overlay is hidden, throttle the renderer:

```typescript
win.webContents.setBackgroundThrottling(true)
// Suspend all WebContentsViews when hidden
tabs.forEach(tab => tab.view.webContents.setAudioMuted(true))
```

### Memory Budget

| Component | Target |
|---|---|
| Main process | ~30MB |
| Shell renderer | ~50MB |
| Per web tab | ~60MB |
| Total (1 tab, hidden) | < 150MB |
| Total (3 tabs, active) | < 330MB |

### Startup Optimization

- Lazy-load settings panel and history panel (not rendered until opened)
- Preload homepage in background tab after window ready (not blocking startup)

---

## 11. Build & Packaging

```typescript
// forge.config.ts
{
  packagerConfig: {
    name: 'Overframe',
    executableName: 'overframe',
    icon: 'public/icons/icon',
    win32metadata: {
      ProductName: 'Overframe',
      CompanyName: 'Overframe',
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel', // Windows installer
      config: { name: 'overframe' }
    }
  ]
}
```

**Output**: A standard Windows `.exe` installer via Squirrel. No admin rights required for installation (user-space install).

---

## 12. Auto-Update

Using `update-electron-app` (wraps Electron's built-in autoUpdater):
- Checks GitHub Releases on startup
- Silent download + install on next launch
- User notified via tray notification

```typescript
import { updateElectronApp } from 'update-electron-app'
updateElectronApp({ updateInterval: '1 hour' })
```
