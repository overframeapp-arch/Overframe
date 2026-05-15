# Overframe — Project Layout

This repository hosts the Overframe Electron application **and** its public
landing page in a single pnpm workspace.

```
overframe/
├── src/                  ← Electron app (main / preload / renderer / shared)
├── landing/              ← Public marketing site (Next.js, deployed separately)
├── public/               ← Electron app static assets (icons, etc.)
├── scripts/              ← Build & asset-generation helpers
├── pnpm-workspace.yaml   ← pnpm workspace declaration
└── package.json          ← Electron app + workspace root
```

## Workspaces

| Workspace                | Path        | Purpose                                                    |
| ------------------------ | ----------- | ---------------------------------------------------------- |
| `overframe` (root)       | `.`         | The desktop app (Electron + React + Vite).                 |
| `overframe-landing`      | `landing/`  | Public website (product page, downloads, changelog, docs). |

## Common commands

From the repo root:

```bash
# Desktop app
pnpm dev          # run Electron in dev mode
pnpm build        # build main + preload + renderer
pnpm make         # build + package an installer (electron-forge)

# Landing page
pnpm --filter overframe-landing dev      # local dev server
pnpm --filter overframe-landing build    # static export ready for hosting
pnpm --filter overframe-landing start    # serve the built site locally
```

## Adding a new workspace

1. Create the package directory.
2. Add its glob to `pnpm-workspace.yaml`.
3. Run `pnpm install` at the root.
