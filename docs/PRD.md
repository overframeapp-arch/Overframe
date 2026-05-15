# Product Requirements Document — Overframe

**Version**: 1.0  
**Date**: May 2026  
**Status**: Draft  

---

## 1. Executive Summary

Overframe is a desktop overlay browser for Windows gamers. It renders a fully functional Chromium-based web browser as a transparent, always-on-top window above any borderless windowed game. The user toggles the overlay with a global hotkey, instantly switching between game focus and browser focus without Alt+Tabbing.

---

## 2. Problem Statement

### The Pain

Every gaming session generates information needs: finding a build, checking a quest guide, looking up a crafting recipe, watching a mechanic tutorial. The current universal solution is **Alt+Tab** — a context switch that breaks immersion, minimizes the game, and reloads assets on some engines.

### Why Existing Solutions Fail

| Solution | Failure Mode |
|---|---|
| Alt+Tab | Breaks immersion, slow on some games, minimizes everything |
| Steam Overlay Browser | Limited, no real navigation, Steam-exclusive |
| Overwolf | Heavy (500MB+), intrusive SDK, process injection, poor reputation |
| Second monitor | Hardware requirement, not accessible |
| Phone | Separate device, small screen, attention split |
| Discord mini-browser | Not designed for gaming contexts, no favorites |

### The Gap

No lightweight, universal, non-intrusive overlay browser exists for PC gaming. Overframe fills this gap.

---

## 3. Target Users

### Primary — The Active Gamer

- Age: 16–35
- Plays 2h+ per session
- Regularly consults wikis, tier lists, guides during play
- Does not have a second monitor
- Technically comfortable but not a developer

### Secondary — The Competitive Player

- Consults lineups, callouts, settings between rounds
- Needs speed: overlay opens/closes in under 100ms
- Concerned about anti-cheat — needs clear disclosure

### Non-target

- Casual mobile gamers
- Console players
- Users wanting to embed browser in a specific game (requires SDK/plugin approach)

---

## 4. User Stories

### Core Flow

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | gamer | press a hotkey to open the browser overlay | I don't need to Alt+Tab out of my game |
| US-02 | gamer | press the same hotkey to hide the overlay | the browser disappears and my game regains focus |
| US-03 | gamer | type a URL or search term in the address bar | I can navigate to any page |
| US-04 | gamer | move and resize the overlay window freely | I can position it where it doesn't block critical game UI |
| US-05 | gamer | click outside the overlay | my mouse and keyboard return to the game (click-through) |

### Browsing

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-06 | gamer | open multiple tabs | I can keep a guide and a wiki open simultaneously |
| US-07 | gamer | see my browsing history | I can quickly return to a page I visited earlier |
| US-08 | gamer | save bookmarks | I can instantly access my most-used gaming resources |
| US-09 | gamer | name and organize bookmarks | I can find them quickly |

### Personalization

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-10 | gamer | adjust overlay opacity | it blends better with my game visual |
| US-11 | gamer | configure the global hotkey | it doesn't conflict with my game bindings |
| US-12 | gamer | create profiles per game | my Elden Ring bookmarks don't mix with my Minecraft bookmarks |
| US-13 | gamer | have the app auto-detect my running game | the right profile loads automatically |

### System

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-14 | gamer | have Overframe start with Windows | it's always ready without manual launch |
| US-15 | gamer | see a tray icon | I can access settings without disrupting my game |
| US-16 | gamer | click a donation button | I can support the developer if I enjoy the tool |

---

## 5. Feature Specifications

### 5.1 Overlay Window

**Behavior:**
- Always-on-top, floating window (not attached to any game process)
- Default size: 900×600px, default position: right side of screen
- Freely draggable by a thin title bar / drag handle
- Freely resizable from any edge/corner
- Persists position and size between sessions

**Toggle states:**
- `HIDDEN` — window invisible, game has full control
- `VISIBLE+FOCUSED` — browser focused, user interacts with it, game receives no input
- `VISIBLE+CLICK-THROUGH` — overlay visible as a transparent layer, `setIgnoreMouseEvents(true, {forward: true})`, game receives all mouse/keyboard input

**Transitions:**
- `HIDDEN → VISIBLE+FOCUSED` : press global hotkey
- `VISIBLE+FOCUSED → VISIBLE+CLICK-THROUGH` : click outside the overlay panel bounds
- `VISIBLE+CLICK-THROUGH → VISIBLE+FOCUSED` : click inside the overlay panel bounds
- `VISIBLE+* → HIDDEN` : press global hotkey

**Drag zone exception:** A permanent 10px strip at the top of the overlay window remains always-clickable regardless of click-through state. This allows repositioning the overlay without toggling focus first.

### 5.2 Global Hotkey

- Default: `Alt+B`
- Configurable via settings panel
- Registered via Electron `globalShortcut` — works even when game is fullscreen-borderless and has focus
- Conflict detection: warn user if chosen hotkey is already registered

### 5.3 Web Renderer

- Uses Electron `WebContentsView` (Chromium, not a webview)
- Full web compatibility: JavaScript, cookies, localStorage, WebGL
- User agent: standard Chrome UA (avoid bot detection)
- No forced tracking/ad injection
- CSP headers respected as-is (no bypass of site security)

### 5.4 Navigation UI

Elements in the browser chrome:
- Back / Forward buttons
- Refresh button
- Address bar (URL input + search fallback to configurable engine, default: Google)
- Favicon display
- Loading indicator
- Tab bar (multi-tab)
- Settings button
- Donation shortcut button

### 5.5 History

- Stores: URL, title, favicon, timestamp
- Searchable via text input
- No hard entry limit (managed by SQLite efficiently)
- Clearable (full clear or by date range)
- Persisted locally via **SQLite** (`better-sqlite3`) — local file only, never transmitted, no server
- Rationale: SQLite handles frequent INSERT operations efficiently; JSON-based storage rewrites the entire file on every visit

### 5.6 Link Collections

> **Renamed from "Bookmarks"** — the concept is more powerful than simple favorites.

A **Link Collection** is a curated, named list of URLs associated with a game profile. Think of it as a "starter pack" for a specific game.

**Structure:**
- Collection has: `name`, `gameProfileId`, `source` (`user` | `publisher` | `community`), ordered list of links
- Each link has: `title`, `url`, `note` (optional), `favicon`

**v1.0 — User collections:**
- Create, rename, delete collections
- Add/remove/reorder links within a collection
- Pin up to 8 links in a quick-access bar (one-click access)
- Collections are scoped to a game profile by default; a `shared` flag makes a link visible in all profiles

**v1.0 — Export/Import:**
- Export a collection as a **Base64-encoded JSON string** (shareable as a short text snippet)
- Import from a Base64 string — works offline, no server needed
- Intended for community sharing (paste on Reddit, Discord, wikis)

**Future (v1.x):**
- Game publishers can ship an **official starter collection** (distributed as a Base64 string embedded in their wiki/website)
- Community collection directory (opt-in, server-side)
- Per-collection update mechanism (publisher pushes a new version via updated Base64)

### 5.7 Per-Game Profiles

- A profile contains: link collections, default homepage, opacity preference, window position/size
- Profile linked to one or more **process names** (e.g., `eldenring.exe`, `Minecraft.Windows.exe`)
- Detection: poll running processes every 5 seconds — no elevated privileges needed
- Manual profile switching available as fallback
- Default profile applies when no game is detected
- **Conflict rule:** if multiple game processes are detected simultaneously, the profile with the highest `priority` (user-defined order) wins — user is notified via tray tooltip

### 5.8 Opacity Control

- Controls the **entire window** opacity (shell + web content) via `win.setOpacity()`
- Slider: 20% → 100% (below 20% is considered unusable, hard floor)
- Persisted per profile
- Quick-access: keyboard shortcut `Alt+[` (decrease) / `Alt+]` (increase) while overlay is focused
- Note: web content becomes semi-transparent along with the shell — this is the intended behavior for a game overlay context where full readability is traded for game visibility

### 5.9 System Tray

- Tray icon shows Overframe state (active/hidden)
- Right-click menu: Show/Hide, Settings, Quit
- Double-click: toggle overlay

### 5.10 Settings Panel

Accessible via tray or settings button in browser chrome:
- Hotkey configuration
- Startup with Windows toggle
- Default search engine
- History retention limit
- Profile management
- Donation link
- Version info + update check

---

## 6. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| Hotkey response time | < 100ms |
| Cold start time | < 3 seconds |
| Idle RAM (hidden) | < 150MB |
| Active RAM | < 300MB |
| CPU idle | < 2% |

### Compatibility

- Windows 10 (21H2+) and Windows 11
- Games in **borderless windowed** mode only (documented limitation)
- Screen resolutions: 1080p minimum, 4K supported

### Security

- `contextIsolation: true` on all renderers
- `nodeIntegration: false` in renderer and WebContentsView
- `sandbox: true` for web content
- Preload scripts only for explicit IPC bridges
- No external telemetry, no analytics
- Stored data is local only, never transmitted

### Reliability

- App must not crash on game launch/close detection failure
- Overlay must restore correct position after monitor configuration changes
- Settings writes are atomic (no data loss on crash)

---

## 7. Out of Scope (v1.0)

- macOS / Linux support
- Full-screen exclusive game support (technically impossible without injection)
- Built-in ad blocker (considered for v1.1)
- Cloud sync of collections/profiles (all data is local; cloud = future paid tier)
- Screenshot/clip capture
- Extensions/plugin system
- Streaming media controls
- Mobile companion app
- Code signing certificate (MVP ships unsigned; README documents the SmartScreen workaround)
- Publisher/community collection directory (v1.x — requires server infrastructure)

---

## 8. Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| GitHub stars | 500+ |
| Active installs | 1,000+ |
| Donation conversion | 2-5% of active users |
| Crash-free sessions | 98%+ |
| Avg. session with overlay | 15+ min |
