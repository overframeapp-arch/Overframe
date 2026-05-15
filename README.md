# Overframe

> A lightweight, non-intrusive web overlay browser for gamers. Browse the internet without leaving your game.

## What is Overframe?

Overframe is an Electron-based desktop application that renders a fully functional web browser as a transparent, always-on-top overlay above any borderless windowed game. Toggle it on or off with a global hotkey — your mouse and keyboard instantly return to your game when the overlay is hidden.

No Alt+Tab. No context switch. No immersion break.

## Core Philosophy

- **Non-intrusive** — zero process injection, zero hooks into game memory
- **Lightweight** — suspend rendering when hidden, minimal resource footprint
- **Universal** — works with any game running in borderless windowed mode
- **Honest** — clear anti-cheat disclaimer, no promises we can't keep

## MVP Features (v1.0)

- Full Chromium web browser in an overlay window
- Configurable global hotkey (default: `Alt+B`)
- Click-through mode — mouse passes to the game when overlay is visible but not focused
- Freely repositionable and resizable floating window
- Adjustable opacity
- Multi-tab support
- Browsing history
- Bookmarks (favorites)
- Per-game profiles (auto-detected via process name)

## Platform

**Windows only** — MVP targets Windows 10/11, borderless windowed games only.

## Business Model

DonationWare. Free forever, with a donation button (Ko-fi / PayPal) in the app.

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron (Chromium) |
| UI | React + Tailwind CSS |
| Web Renderer | Electron WebContentsView |
| Storage | electron-store (JSON) |
| Build | Vite + electron-forge |
| Language | TypeScript |

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [Technical Specification](docs/TECH_SPEC.md)
- [Roadmap](docs/ROADMAP.md)

## Install (end users)

1. Download `Overframe-Setup.exe` from the [Releases page](#).
2. Double-click to install. **Windows SmartScreen will warn** because the
   binary is not yet code-signed (planned for v1.5). Click **More info →
   Run anyway** to proceed.
3. Overframe starts in the system tray. Press **`Alt+B`** to toggle
   the overlay over your game (must be running in **borderless windowed**
   mode).

## Usage

| Action | Shortcut |
|---|---|
| Show / hide overlay | `Alt+B` (configurable) |
| New tab | `Ctrl+T` |
| Close active tab | `Ctrl+W` |
| Focus address bar | `Ctrl+L` |
| Drag the window | Drag the 10 px strip at the very top |
| Click-through mode | Click outside the chrome — mouse passes to the game |

Configure game profiles in **Settings → Game profiles** by listing the
process names (e.g. `eldenring.exe`). When a matching process is
detected, Overframe swaps to that profile (custom homepage, opacity,
window position, link collections).

## Develop

```powershell
pnpm install        # installs deps + builds native sqlite binding
pnpm dev            # starts electron-vite dev server
pnpm build          # production bundle (out/)
pnpm make           # builds Windows installer to dist/make/
pnpm typecheck      # validates main + renderer types
```

Requires Node 20+ and pnpm 10+. Native modules (`better-sqlite3`) are
compiled at install via `node-gyp` (needs Visual Studio Build Tools on
Windows).

## Anti-Cheat Compatibility

### What Overframe does NOT do

| Action | Status |
|---|---|
| Inject DLL into game process | ❌ Never |
| Read / write game memory | ❌ Never |
| Hook Win32 APIs (`SetWindowsHookEx`, D3D, Vulkan) | ❌ Never |
| Simulate keyboard / mouse input | ❌ Never |
| Capture game screen / pixels | ❌ Never |

Overframe is architecturally identical to a browser or Discord running in always-on-top mode.
No handle is opened on the game process.

### Risk by game

| Game | Anti-Cheat | Risk level |
|---|---|---|
| Valorant | Vanguard (kernel-level) | **High** — quit before ranked |
| League of Legends / TFT | Vanguard | **High** — quit before ranked |
| R6 Siege | BattlEye (kernel-level) | **High** — quit before ranked |
| Apex Legends | EAC | Medium — use with caution |
| Fortnite | BattlEye + EAC | Medium — use with caution |
| PUBG | BattlEye | Medium — use with caution |
| Escape from Tarkov | BattlEye | Medium — use with caution |
| CS2 | VAC + optional FACEIT/ESEA | Medium — use with caution |
| Steam games (VAC only) | VAC | Low — no overlay detection |

### Competitive Mode (auto-quit)

Overframe includes a **Competitive Mode** that monitors for known AC service processes:

- `vgc.exe` (Vanguard)
- `BEService.exe` (BattlEye)
- `EasyAntiCheat.exe` / `EasyAntiCheat_EOS.exe` (EAC)
- `faceit.exe` / `faceit-anticheat.exe` (FACEIT AC)
- `esea_client.exe` (ESEA)

When any of these are detected, Overframe shows a 5-second countdown and quits automatically.
Toggle this behaviour in **Settings → System → Competitive Mode**.

### Tested AC status

| Anti-Cheat | Level | Status |
|---|---|---|
| VAC (Valve) | User-mode | ✅ No issue — does not detect external windows |
| EAC (Easy Anti-Cheat) | User-mode | ✅ No injection = not flagged |
| BattlEye | Kernel-mode | ⚠️ Not formally tested — Competitive Mode recommended |
| Vanguard (Riot) | Kernel-mode | ⚠️ Not formally tested — Competitive Mode recommended |
| FACEIT AC | Kernel-mode | ⚠️ Not formally tested — Competitive Mode recommended |
| ESEA AC | Kernel-mode | ⚠️ Not formally tested — Competitive Mode recommended |

> **The Overframe team is not responsible for account actions taken by any anti-cheat system.**
> Always verify your game's Terms of Service before using overlay software in ranked play.
