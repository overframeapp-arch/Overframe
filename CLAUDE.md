# Overframe — Claude Code Guide

## What This Project Is

Overframe is a **Windows-only Electron desktop app** — a lightweight transparent browser overlay for gamers. Press `Alt+B` (configurable) to toggle a Chromium browser window on top of any borderless windowed game without Alt+Tabbing. It supports per-game profiles, tab sessions, link collections, global hotkeys, and system tray integration.

---

## Starting the App

```bash
# Install deps (compiles native modules — requires VS Build Tools 2022)
pnpm install

# Dev mode with hot reload
pnpm dev

# Type-check both processes
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build

# Package as Windows installer → dist/
pnpm make
```

**To launch and observe the running app**, use the `/run` skill — it starts `pnpm dev`, opens the Electron window, and can take screenshots. Use `/verify` to confirm a specific feature works after a change.

The landing page (Next.js, separate workspace) runs with `pnpm landing`.

---

## Architecture — Three Processes

```
Main Process (Node.js)
  ├─ Managers: TabManager, ProfileManager, CollectionsManager, SessionManager, ShortcutManager
  ├─ electron-store (persistent JSON: profiles, collections, settings)
  ├─ better-sqlite3 (tab history)
  └─ IPC handlers (src/main/ipc/)
           ↕ contextBridge (src/preload/index.ts)
Renderer Process (React + Zustand)
  ├─ window.aether.* — the entire IPC API surface
  └─ src/renderer/store/ — Zustand stores (appStore, missionsStore)
           ↕ WebContentsView (per tab)
Web Content Layer
  └─ Sandboxed Chromium per tab, no preload, no Node access
```

**Rule:** The renderer has zero Node.js access. Every OS operation goes through `window.aether.*` → preload → IPC handler → main process manager.

---

## Key Files — Read These First

| File | What it does |
|---|---|
| [src/main/index.ts](src/main/index.ts) | App lifecycle, manager initialization, event wiring |
| [src/preload/index.ts](src/preload/index.ts) | Full IPC API surface exposed to renderer (`window.aether`) |
| [src/renderer/App.tsx](src/renderer/App.tsx) | React root, IPC subscriptions, event listeners |
| [src/renderer/store/appStore.ts](src/renderer/store/appStore.ts) | Central Zustand store (tabs, profiles, collections, UI state) |
| [src/main/managers/TabManager.ts](src/main/managers/TabManager.ts) | WebContentsView lifecycle, navigation, zoom, mute |
| [src/main/managers/ProfileManager.ts](src/main/managers/ProfileManager.ts) | Game process detection (polls every 5s), profile switching |
| [src/main/store/index.ts](src/main/store/index.ts) | electron-store schema + defaults |
| [src/shared/types.ts](src/shared/types.ts) | All shared TypeScript types (TabState, Profile, Collection, etc.) |
| [src/shared/ipc.ts](src/shared/ipc.ts) | IPC channel name constants |

---

## IPC Pattern

All IPC calls are typed end-to-end. Never use raw `ipcRenderer` in the renderer — always go through `window.aether`.

```typescript
// In renderer:
const tabs = await window.aether.tabs.getAll()
await window.aether.tabs.create('https://google.com')

// In main (src/main/ipc/):
ipcMain.handle('tabs:create', (_, url) => tabManager.createTab(url))

// Renderer-side event subscriptions:
window.aether.on.tabUpdated((tab) => setTabs(...))
```

The full API surface is in [src/preload/index.ts](src/preload/index.ts) — check this file to know what's available before adding new IPC channels.

---

## Data Models

**electron-store** (JSON, at `%LOCALAPPDATA%\Overframe\`):
- `profiles` — game profiles with process names, opacity, window bounds, homepage
- `collections` — named link collections scoped to a profile (or `shared`)
- `sessions` — per-profile tab session (URLs, active tab, zoom)
- `settings` — hotkey, search engine, startup preference

**SQLite** (better-sqlite3, same data dir):
- `history` table: `id, url, title, favicon, visited_at`

**Key shared types** (see [src/shared/types.ts](src/shared/types.ts)):
- `TabState` — id, url, title, favicon, isLoading, canGoBack, canGoForward
- `Profile` — id, name, processNames[], opacity, windowBounds, homepageUrl
- `Collection` — id, name, profileId | 'shared', source, links[]
- `Link` — id, title, url, note?, favicon?, pinned, order

---

## Overlay Behavior

Three states toggled by `Alt+B` and mouse interaction:
- `HIDDEN` — window invisible
- `FOCUSED` — browser receives input, game does not
- `CLICK-THROUGH` — overlay visible but `setIgnoreMouseEvents(true, {forward:true})` — game receives all input

The 10px drag strip at the top is always clickable regardless of click-through state.

Window is always-on-top at `'screen-saver'` level to appear above borderless windowed games.

---

## Global Hotkeys

Registered via `uiohook-napi` (WH_KEYBOARD_LL), not Electron `globalShortcut`, so they work even when a game has keyboard focus:
- `Alt+B` — toggle overlay (default, configurable)
- `Ctrl+T` / `Ctrl+W` — new/close tab
- `Alt+[` / `Alt+]` — opacity down/up

See [src/main/managers/ShortcutManager.ts](src/main/managers/ShortcutManager.ts) and [src/main/managers/uiohook.ts](src/main/managers/uiohook.ts).

---

## Conventions

- **TypeScript strict** — no `any`, no raw `ipcRenderer`
- **IPC channels** — always defined as constants in [src/shared/ipc.ts](src/shared/ipc.ts)
- **Zustand** in renderer for UI state; **electron-store** in main for persistence
- **React components** in `src/renderer/components/`, flat or single-folder per component
- **No analytics, no telemetry** — all data stays local
- **Tailwind** for all styling — no inline styles, no CSS modules
- Lint: `pnpm lint` | Type-check: `pnpm typecheck` | Tests: `pnpm test`

---

## Guides domaine

Lire le guide correspondant avant toute modification dans ce domaine :

| Domaine | Guide | Lire quand |
|---|---|---|
| Sécurité | [.claude/guides/SECURITY.md](.claude/guides/SECURITY.md) | IPC handlers, navigation, dépendances |
| Accessibilité | [.claude/guides/ACCESSIBILITY.md](.claude/guides/ACCESSIBILITY.md) | Composants React, interactions, UI |
| Design / UX-UI | [.claude/guides/DESIGN.md](.claude/guides/DESIGN.md) | Tout composant visuel, tokens, layout |
| Performance | [.claude/guides/PERFORMANCE.md](.claude/guides/PERFORMANCE.md) | Tabs, mémoire, polling, animations |
| Testing / QA | [.claude/guides/TESTING.md](.claude/guides/TESTING.md) | Avant tout `[FIX]`, `[FEAT]`, `[TEST]` |
| Coordination H/IA | [WORKFLOW.md](WORKFLOW.md) | Début de session, ouverture de PR |
| Backlog | [TASKS.md](TASKS.md) | Début et fin de chaque session |

---

## Monorepo Structure

```
overframe/                  ← root (Electron app)
├── src/
│   ├── main/               ← Node.js main process
│   │   ├── index.ts
│   │   ├── ipc/            ← IPC handlers
│   │   ├── managers/       ← core business logic
│   │   ├── windows/        ← BrowserWindow + TrayManager
│   │   ├── lifecycle/      ← squirrel hooks, CSP, shortcut actions
│   │   └── store/          ← electron-store instance + schema
│   ├── preload/            ← contextBridge API (window.aether)
│   ├── renderer/           ← React app
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── store/          ← Zustand stores
│   │   └── hooks/
│   └── shared/             ← types, IPC channels, constants
├── landing/                ← Next.js marketing site (separate workspace)
├── docs/                   ← PRD.md, TECH_SPEC.md, ROADMAP.md
├── scripts/                ← asset generation, dep auditing
└── public/                 ← Electron app icons/assets
```

---

## Security Model

| Concern | Mitigation |
|---|---|
| Renderer XSS | `contextIsolation: true`, no Node access in renderer |
| Web content privilege escalation | `sandbox: true` on WebContentsView, no preload on web views |
| Dangerous navigation | Block non-http(s) protocols in `will-navigate` |
| New window popups | Open in new Overframe tab via `setWindowOpenHandler` |
| Data exfiltration | Local storage only, no network calls from main process |

---

## Hot Reload Rules

| What changed | What to do |
|---|---|
| Renderer (`src/renderer/**`) | Nothing — Vite HMR reloads instantly |
| Preload (`src/preload/**`) | Reload the window (Ctrl+R in DevTools, or restart) |
| Main process (`src/main/**`) | **Full restart** — kill `pnpm dev` and relaunch |
| Shared types (`src/shared/**`) | Full restart (consumed by both sides) |

---

## Observer HTTP Server (Dev Mode)

Quand l'app tourne (`pnpm dev`), un serveur HTTP démarre sur `http://127.0.0.1:9119`.
Il expose screenshots, logs et état structuré — utilisable directement depuis bash, sans ouvrir les DevTools.

```bash
# Santé — confirme que l'app est prête
curl http://127.0.0.1:9119/ping

# Screenshot PNG → lire avec le Read tool
curl http://127.0.0.1:9119/screenshot --output C:\tmp\screen.png

# État structuré JSON (overlay state, onglets ouverts, profil actif)
curl http://127.0.0.1:9119/state

# Logs console (300 lignes par défaut)
curl http://127.0.0.1:9119/log/renderer
curl http://127.0.0.1:9119/log/webview
curl http://127.0.0.1:9119/log/crash

# Nombre de lignes personnalisé
curl "http://127.0.0.1:9119/log/renderer?lines=50"
```

**Logs écrits automatiquement en dev :**

| Source | Fichier |
|---|---|
| Shell React (renderer) | `%LOCALAPPDATA%\Overframe\logs\renderer.log` |
| Onglets navigateur (WebContentsView) | `%LOCALAPPDATA%\Overframe\logs\webview.log` |
| Crashes / erreurs fatales | `%LOCALAPPDATA%\Overframe\logs\crash.log` |

**DevTools & utilitaires :**
```js
window.aether.system.toggleDevTools()   // ouvre DevTools détachés
window.aether.system.devStoreReset()    // efface le store et relance
window.aether.system.simulateCrash()    // écrit une entrée crash.log de test
```

**Données persistées :**
```powershell
ls "$env:LOCALAPPDATA\Overframe\"   # store JSON + SQLite history
```

---

## Git Workflow

```
main          ← stable releases only
dev           ← integration branch — all features merge here
  └── feat/<name>      feature branches
  └── fix/<name>       bug fixes
  └── chore/<name>     tooling, config, docs
```

**Rules:**
- Always branch off `dev`
- Commit style: `feat: ...` / `fix: ...` / `chore: ...` (conventional commits)
- Merge back to `dev` via PR — never push directly to `main`
- Run `pnpm check` (typecheck + lint) before any commit

---

## Environment Variables

File: `.env` at root (gitignored).

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth — not required for core functionality in dev |
| `GOOGLE_CLIENT_SECRET` | OAuth — not required for core functionality in dev |

The app runs fully offline without these. They're only needed for any future Google-linked features.

---

## Workflow Autonome Complet

### Démarrer une session
1. Lire [TASKS.md](TASKS.md) → choisir la tâche prioritaire, la déplacer dans "En cours"
2. Lire [.claude/DEVLOG.md](.claude/DEVLOG.md) → reprendre le contexte de la dernière session
3. `pnpm dev` → attendre `[dev] Observer → http://127.0.0.1:9119`
4. `curl http://127.0.0.1:9119/ping` → confirmer que l'app répond

### Observer l'UI
```bash
# Montrer l'overlay (il est caché au démarrage) — simuler Alt+B depuis le terminal :
# (ou l'appuyer manuellement une fois)

# Screenshot
curl http://127.0.0.1:9119/screenshot --output C:\tmp\screen.png
# → Read tool sur C:\tmp\screen.png pour voir le résultat visuellement

# État de l'app
curl http://127.0.0.1:9119/state
```

### Après chaque modification
- Le hook `PostToolUse` lance ESLint automatiquement sur le fichier édité — corriger les erreurs remontées
- Pour une vérification complète : `pnpm typecheck && pnpm lint && pnpm test`
- Si modification main/preload : redémarrer `pnpm dev` (hot reload ne couvre pas le main process)

### Ajouter un canal IPC
1. Déclarer la constante dans [src/shared/ipc.ts](src/shared/ipc.ts)
2. Ajouter le handler dans [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts)
3. Exposer dans [src/preload/index.ts](src/preload/index.ts) sous `window.aether.*`

### Clore une session
1. `pnpm typecheck && pnpm lint && pnpm test` — doit passer au vert
2. Mettre à jour [TASKS.md](TASKS.md) — déplacer les tâches terminées dans "Done"
3. Mettre à jour [.claude/DEVLOG.md](.claude/DEVLOG.md) — nouvelle entrée avec contexte, décisions, prochaine étape
4. `git add` + `git commit` sur la branche feature

### Hooks automatiques
| Hook | Déclencheur | Action |
|---|---|---|
| `PostToolUse` | Après chaque Edit/Write sur `.ts`/`.tsx` | ESLint sur le fichier → erreurs remontées à Claude |
| `Stop` | Fin de réponse Claude | `git status` + rappel DEVLOG si changements TypeScript |
