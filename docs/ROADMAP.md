# Roadmap — Overframe

**Model**: DonationWare — free forever, donation-supported  
**Platform**: Windows 10/11  

---

## Version Philosophy

```
v0.1 → v0.2 → v0.3   Alpha: core mechanics working
v0.5 → v0.6           Beta: feature-complete, UX polish
v1.0                  Public release: stable, documented
v1.x                  Post-launch: community-driven
```

---

## v0.1 — Alpha Core (Week 1–2)

**Goal**: Prove the overlay works. Nothing else matters until this is solid.

### Deliverables
- [ ] Electron project scaffold (electron-vite + React + Tailwind + TypeScript)
- [ ] Transparent, frameless, always-on-top BrowserWindow
- [ ] One `WebContentsView` loading a URL
- [ ] Global hotkey `Alt+B` toggles window show/hide
- [ ] State machine: HIDDEN → FOCUSED → CLICK-THROUGH → HIDDEN
- [ ] Click-through mode via `setIgnoreMouseEvents(true, { forward: true })`
- [ ] Permanent 10px drag zone at top (always-clickable, ignores click-through state)
- [ ] Window resizable

### Definition of Done
> I can press `Alt+B` while playing a borderless windowed game, see a browser appear on top, interact with it, click outside to enter click-through mode (overlay stays visible but mouse passes to game), press `Alt+B` again to hide it. I can drag the overlay from its top strip while in click-through mode. No crash. No flicker.

---

## v0.2 — Alpha Browser (Week 3–4)

**Goal**: Make it a real browser, not just a WebContentsView wrapper.

### Deliverables
- [ ] Address bar (URL input + search fallback)
- [ ] Back / Forward / Refresh buttons
- [ ] Favicon + page title in tab
- [ ] Multi-tab support (TabManager + TabBar UI)
- [ ] New tab button
- [ ] Close tab button
- [ ] Tab switching
- [ ] Basic navigation events wired to UI (loading indicator, URL updates)

### Definition of Done
> I can open multiple tabs, navigate between them, type URLs, and use browser navigation buttons.

---

## v0.3 — Alpha Persistence (Week 5–6)

**Goal**: Data survives across sessions.

### Deliverables
- [ ] `electron-store` integration with typed schema (settings, profiles, collections)
- [ ] `better-sqlite3` integration for history (local SQLite file, no server)
- [ ] History: record every page visit (URL, title, favicon, timestamp) via SQLite INSERT
- [ ] History panel UI (list + search)
- [ ] **Link Collections**: create a collection, add/remove links, rename
- [ ] Collections panel UI (list of collections + links within)
- [ ] Pinned links quick-access bar (max 8, one-click access)
- [ ] Window position/size persisted on close
- [ ] Collection export as Base64 string
- [ ] Collection import from Base64 string

### Definition of Done
> My history and collections survive app restarts. I can create an "Elden Ring" collection, add links, export it as a Base64 string, clear it, and re-import it.

---

## v0.5 — Beta Personalization (Week 7–9)

**Goal**: Make the experience feel personal and polished.

### Deliverables
- [ ] Opacity slider (20–100%) — keyboard shortcut + settings UI
- [ ] Global hotkey configurator (UI + conflict detection)
- [ ] System tray icon (show/hide, settings, quit)
- [ ] Settings panel (all preferences)
- [ ] Start with Windows toggle
- [ ] Per-game profiles: create, name, link to process names, set priority order
- [ ] Process polling (game detection, profile auto-switch)
- [ ] Conflict rule: highest-priority profile wins when multiple games detected
- [ ] Tray tooltip shows active profile name
- [ ] Default profile fallback
- [ ] Donation button (Ko-fi link) in UI

### Definition of Done
> I can create an "Elden Ring" profile, launch Elden Ring, and Overframe automatically switches to that profile's collections.

---

## v0.6 — Beta Polish (Week 10–11)

**Goal**: Zero obvious bugs. Real-world testing.

### Deliverables
- [ ] Anti-cheat disclaimer modal (first launch only)
- [ ] Onboarding tooltip flow (first launch, 3 steps max)
- [ ] Error handling: failed page load, network offline state
- [ ] Context menu in WebContentsView (right-click: copy, paste, open in new tab)
- [ ] Keyboard shortcuts (Ctrl+T new tab, Ctrl+W close tab, Ctrl+L focus address bar)
- [ ] Multi-monitor support (remember which monitor the window was on)
- [ ] Performance audit: idle CPU < 2%, hidden RAM < 150MB
- [ ] Update check on launch (GitHub Releases)
- [ ] App icon (all required sizes for Windows)

### Definition of Done
> Tested by 5 external users. No P0/P1 bugs. All core flows work without assistance.

---

## v1.0 — Public Release (Week 12)

**Goal**: Ship it.

### Deliverables
- [ ] Windows installer (`.exe` via electron-forge Squirrel, **unsigned**)
- [ ] GitHub repository public (MIT license)
- [ ] README with screenshots and GIF demo
- [ ] README FAQ: SmartScreen workaround ("More info → Run anyway"), anti-cheat disclaimer, supported game modes
- [ ] Ko-fi / PayPal donation page live
- [ ] Release announcement (Reddit r/pcgaming, r/gaming, Discord gaming communities)

### Definition of Done
> Anyone can download, install, and use Overframe without reading any documentation.

---

## Post-Launch (v1.x) — Community-Driven

Priorities ordered by expected user demand:

| Version | Feature |
|---|---|
| v1.1 | Collection sharing via shareable link (server-side, opt-in) |
| v1.1 | Publisher starter collections (official Base64 bundles embeddable in game wikis) |
| v1.1 | Built-in ad blocker (uBlock-style filter lists) |
| v1.2 | Picture-in-Picture mode (mini compact view) |
| v1.2 | Search within current page (`Ctrl+F`) |
| v1.3 | Cloud sync (collections + profiles) — optional paid tier, privacy-first |
| v1.3 | Community collection directory (browse & install community-curated packs) |
| v1.4 | Custom CSS per site (gaming wiki cleanup profiles) |
| v1.4 | Hotkey presets per game (disable conflicting alt-key combos) |
| v1.5 | Code signing certificate (if donation revenue justifies the ~300€/year cost) |
| v2.0 | macOS support |
| v2.0 | Plugin system (community widgets) |

---

## Known Hard Limits (Never Supported)

| Limitation | Reason |
|---|---|
| Fullscreen exclusive games | D3D exclusive mode bypasses desktop compositor — impossible without injection |
| Anti-cheat bypass | Out of scope, against ToS, ethical line |
| In-game process injection | Architectural decision: zero injection policy |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Anti-cheat false positive reports | Medium | High | Clear disclaimer, user education, "competitive mode" (disable entirely) |
| Z-order issues with specific game engines | Medium | Medium | Per-game workaround list in docs |
| Memory pressure on low-end machines | Low | High | Background throttling, suspend hidden tabs |
| Electron major version breaking change | Low | Medium | Pin minor Electron version, test before upgrade |
| Low donation conversion | High | Low | DonationWare is sustainable at 1–2% if install base grows |
