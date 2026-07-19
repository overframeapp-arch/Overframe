# Changelog

All notable user-facing changes to Overframe. The newest release is on top.
This file is also the source for the release notes shown in the app's News tab.

## v0.2.0

The first big update since launch. Two months of work with one goal: make Overframe feel like a real browser that happens to float over your game.

### Real Edge under the hood

Tabs are now rendered by Microsoft Edge WebView2, a full browser engine running in its own process for each tab.

- Google sign-in works
- Cloudflare-protected sites (wikis, trade sites, build planners) load normally
- Websites see a real, up-to-date Edge browser, so no more "unsupported browser" walls
- Websites can follow the overlay's dark theme (toggle in Settings)

### Smarter game detection

- Running games are recognized by their real name and icon, not just a process name
- Create a profile for a detected game in one click
- Games started through a launcher are matched better, and you can point Overframe at any exe yourself

### Collections, rebuilt

- New editor: organize links into sections, reorder them, pin your favorites
- Give a collection a banner and an icon, then reposition and zoom the image until it looks right
- Add a description and an author signature
- Share a collection with a short link, and preview exactly what is inside before importing someone else's

### A better home

- The home page now has tabs: Home, Missions, News, Manage and Settings
- Quick access links you can add, rename and reorder
- Missions that help you discover what the app can do
- The News tab shows these release notes

### Comfort

- Fullscreen video hides the app chrome for a clean player view
- Audio and video pause when a tab goes to sleep and resume when it wakes up
- Protected tabs (Discord, Google Meet, and any domain you add) stay open when you switch profiles or hide the overlay
- Sharper text and better contrast across every panel
- Faster startup: tab sessions restore only when you actually need them
- Smoother window resizing, with a visible resize ring
- Overframe now tells you when an update is ready: a Windows notification plus a "Restart to update" button on the home page. Nothing restarts on its own, especially not during a game

### Supporting Overframe (always optional)

Overframe partners with Instant Gaming. If you activate it, a small percentage of what you spend there goes to development, at the same price for you. Deal cards can be turned off entirely in Settings.

### Known limitation: ad blocking is off for now

We shipped an ad blocker, then a Microsoft Edge update removed support for that kind of extension (Manifest V2) in every Edge-based app, not just Overframe. The Settings toggle is disabled with an explanation until we ship a replacement. Edge's built-in tracker protection still runs.

### Under the hood

- Every message between the interface and the app core is now strictly validated
- Address checks can no longer be fooled by lookalike domains
- Fixed a crash on corrupted settings and a startup crash tied to floating popups
- 100% test coverage on the app's logic, enforced by CI on every change

## v0.1.0

First public release: the overlay itself. Alt+B over any borderless windowed game, tabs, per-game profiles, link collections, global hotkeys, system tray, auto-update.
