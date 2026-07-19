# Microsoft Store — Submission Kit

Everything needed to publish Overframe on the Microsoft Store via the MSIX route.
The Store signs MSIX packages itself during ingestion, so no code-signing
certificate is needed (the EXE-listing route requires one; that is why MSIX).
Store builds never self-update: `process.windowsStore` gates the Squirrel
updater (src/main/index.ts) and the manual check (handlers.ts).

## Why the Store matters

- Permanent discovery channel: people search "browser overlay" in the Store
- No SmartScreen warning: Store installs are trusted by Windows
- Free since 2025 (individual) / May 2026 (company fee removed)

## 1. Owner checklist (Partner Center, ~30 min once)

- [x] Create a Partner Center account (individual, free) — done 2026-07-19. Note: the "Publisher display name" field rejected several names (`overframeapp`, `Overframe Software`, `Overframe Studio`) with "not available" during account creation — a known Partner Center bug, not name-squatting. Resolved itself; plain `Overframe` eventually went through.
- [x] Reserve the app name: **Overframe**
- [x] Product identity values retrieved and wired into `forge.config.ts`:
  - `Package/Identity/Name`: `Overframe.Overframe`
  - `Package/Identity/Publisher`: `CN=A805C199-2F71-4C15-8CEE-70CC53BA0A3B`
  - `Package/Properties/PublisherDisplayName`: `Overframe`
- [x] Dev dependency `@electron-forge/maker-appx` approved and added
- [ ] Fill the IARC age-rating questionnaire (browser app: answers are all "no", rating comes back instantly)

## 2. Listing copy (paste into Partner Center)

**Name:** Overframe

**Short description** (Store search card):
Browser overlay for gamers. Press Alt+B to browse wikis, builds and guides on top of your game, without alt-tabbing.

**Description:**

Overframe is a free browser that floats above your game.

Press Alt+B and a full browser opens on top of any game running in borderless windowed mode. Look up a build, follow a quest guide, check the wiki or keep a video running, then press Alt+B again and it is gone. No alt-tab, no second monitor needed.

Built for gaming:

- Real browser tabs, powered by Microsoft Edge. Google sign-in and protected sites just work
- Per-game profiles: Overframe detects the game you are playing and switches to its own tabs, links and layout
- Link collections: keep builds, guides and tools organized per game, and share a collection with a short link
- Click-through mode: the overlay stays visible while your mouse and keyboard control the game
- Global hotkeys that work in game, adjustable opacity, system tray
- Light on your machine, and everything stays on your device: no account, no telemetry

Overframe does not touch the game itself. No injection, no memory reading, nothing an anti-cheat looks for. It is a regular window on top, like a second monitor would be.

**Keywords / search terms:** browser overlay, game overlay, in-game browser, wiki overlay, second screen, gaming browser, alt-tab

**Category:** Utilities & tools

**Privacy policy URL:** https://overframe.app/privacy
**Website:** https://overframe.app
**Support contact:** contact@overframe.app

## 3. Screenshots (required: at least 1, min 1366x768 PNG)

To produce before submission (larger window than the dev captures):

- [ ] Home page with quick links and collections (1600x900)
- [ ] Collections manager with a filled collection
- [ ] THE money shot: overlay visible above a real game (human task, any borderless game)

## 4. Building the package — done

`forge.config.ts` now has a `MakerAppX` entry wired with the real identity
values. Verified 2026-07-19: `pnpm exec electron-forge make --targets=@electron-forge/maker-appx`
produces `dist/make/appx/x64/overframe.appx` (~179 MB), self-signed by a dev
cert electron-forge generates automatically (`dist/make/appx/x64/default.*`) —
that cert is only for local install testing; the Store re-signs the package
during ingestion, so no purchased code-signing certificate is needed.

No custom `assets` path is set, so the package ships electron-forge's default
placeholder tile icons (Square44x44Logo, Square150x150Logo, etc.). Cosmetic
only — replace with real Overframe-branded tiles before final submission by
adding an `assets: 'public/store-assets'` folder with the sized PNGs Microsoft
documents, then re-run `pnpm make`.

To reproduce: `pnpm build && pnpm build:addon && pnpm exec electron-forge make --targets=@electron-forge/maker-appx`
(or the plain `pnpm make` runs it alongside Squirrel/ZIP). Upload the produced
`.appx` in the Partner Center submission flow. Certification takes a few
business days the first time.

## 5. After first publication

- Each new version: build the MSIX at the new version and submit an update
  (faster certification). The GitHub/Squirrel channel stays the primary one;
  the Store package can lag a version without harm.
- Consider winget next: one manifest PR to microsoft/winget-pkgs pointing at
  the GitHub Setup.exe.
