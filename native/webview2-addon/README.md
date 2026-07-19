# webview2-addon

A small Node-API (N-API) native addon that embeds **Microsoft Edge WebView2**
controls as child windows of Overframe's overlay `BrowserWindow`. It replaces
Electron's bundled Chromium (`WebContentsView`) for browser tabs so that Google
sign-in and Cloudflare see a genuine, up-to-date Edge — no user-agent spoofing
or fingerprint patching required.

One `ICoreWebView2Environment` (one Edge process) is shared across all tabs;
each tab gets its own `ICoreWebView2Controller`. The typed JS wrapper lives in
[`src/main/managers/tabs/WebView2View.ts`](../../src/main/managers/tabs/WebView2View.ts).

## Layout

```
native/webview2-addon/
├── binding.gyp            node-gyp build definition
├── src/webview2_addon.cpp the addon implementation  (tracked)
├── include/WebView2.h     vendored WebView2 SDK header (tracked)
├── lib/WebView2LoaderStatic.lib  vendored static loader import lib (tracked)
└── build/                 node-gyp output — webview2_addon.node  (gitignored)
```

## Vendored WebView2 SDK

`include/WebView2.h` and `lib/WebView2LoaderStatic.lib` are taken verbatim from
the official **[`Microsoft.Web.WebView2`](https://www.nuget.org/packages/Microsoft.Web.WebView2)**
NuGet package (the `ICoreWebView2_27` / `ICoreWebView2Environment14` generation).
They are vendored — rather than fetched at build time — so the build is
**hermetic and offline**: no NuGet/network access is needed to compile.

The static loader is linked in, so the produced `.node` has no runtime
dependency on `WebView2Loader.dll`. The only runtime requirement is the
**WebView2 Runtime**, which ships with Windows 10/11 (Edge).

These files are redistributed under the
[Microsoft Software License Terms for the Microsoft Edge WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2/license),
which permit redistribution as part of an application.

**To update the SDK:** download the desired `Microsoft.Web.WebView2` `.nupkg`
(a zip), then copy `build/native/include/WebView2.h` → `include/` and
`build/native/x64/WebView2LoaderStatic.lib` → `lib/`, and rebuild.

## Building

Requires **Visual Studio Build Tools 2022** (C++ workload) and **Python 3**,
which `node-gyp` locates automatically.

```bash
pnpm build:addon     # → node scripts/build-addon.mjs → node-gyp rebuild
```

This runs automatically after `pnpm install` (via `postinstall`) on Windows,
and is re-run by `pnpm package` / `pnpm make` before packaging. On non-Windows
platforms the build is a no-op (the addon is Windows-only).

## Packaging

`forge.config.ts` ships `build/Release/webview2_addon.node` as an
`extraResource`, so in a packaged build it lands at
`process.resourcesPath/webview2_addon.node` — exactly where `WebView2View.ts`
looks for it. The rest of this directory is excluded from the app bundle.
