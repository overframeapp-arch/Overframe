# Overframe

Free, open-source browser overlay for PC gamers. Press `Alt+B` to open a browser on top of any borderless game — no alt-tab, no injection, no anti-cheat risk.

**[overframe.app](https://overframe.app) · [Releases](https://github.com/overframeApp-arch/Overframe/releases) · Windows 10/11**

## Features

- Always-on-top Chromium browser overlay
- Configurable global hotkey (default `Alt+B`)
- Click-through mode — mouse passes to the game when overlay is unfocused
- Per-game profiles with auto-detection (process name)
- Per-tab zoom memory and live memory profiler
- Performance Mode — frees GPU/RAM when overlay is hidden
- Keyboard layout support: AZERTY, QWERTY, DVORAK
- No code injection — safe by design

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron |
| UI | React + Tailwind CSS |
| Web renderer | Electron `WebContentsView` |
| Storage | better-sqlite3 |
| Build | electron-vite + electron-forge |
| Installer | Squirrel.Windows (`Overframe-Setup.exe`) |
| Language | TypeScript |

## Install

1. Download `Overframe-Setup.exe` from the [Releases page](https://github.com/overframeApp-arch/Overframe/releases/latest).
2. Run the installer. Windows SmartScreen will warn because the binary is not
   yet code-signed — click **More info → Run anyway**.
3. Overframe starts in the system tray. Press **`Alt+B`** over any borderless
   windowed game to toggle the overlay.

## Usage

| Action | Shortcut |
|---|---|
| Show / hide overlay | `Alt+B` (configurable) |
| New tab | `Ctrl+T` |
| Close active tab | `Ctrl+W` |
| Focus address bar | `Ctrl+L` |
| Drag the window | Drag the strip at the top |
| Click-through mode | Click outside the chrome |

Game profiles live in **Settings → Game profiles**. Add the process name
(e.g. `eldenring.exe`) and Overframe auto-switches profile when that game is
running.

## Develop

```powershell
pnpm install        # installs deps + compiles native sqlite binding
pnpm dev            # electron-vite dev server
pnpm build          # production bundle → out/
pnpm make           # build + package installer → dist/
pnpm typecheck      # type-check main + renderer
pnpm test           # vitest unit tests
```

Requires **Node 20+** and **pnpm 10+**. `better-sqlite3` compiles at install
via `node-gyp` — needs **Visual Studio Build Tools** on Windows.

