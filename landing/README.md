# Overframe Landing

Public marketing site for [Overframe](https://overframe.app). Built with **Next.js 15** (App Router), **Tailwind CSS**, and TypeScript.

## Dev

```bash
# from the monorepo root
pnpm install
pnpm --filter overframe-landing dev
```

Opens at <http://localhost:3001>.

## Build

```bash
pnpm --filter overframe-landing build
```

## Structure

```
landing/
├── app/
│   ├── layout.tsx          ← Root layout: metadata, JSON-LD, fonts
│   ├── page.tsx            ← Home page
│   ├── download/           ← Windows download page
│   ├── changelog/          ← Auto-fetched from GitHub Releases API
│   ├── contact/            ← Contact channels
│   ├── privacy/            ← Privacy policy
│   ├── terms/              ← Terms of service
│   ├── legal/              ← Legal notice (noindex)
│   ├── opengraph-image.tsx ← OG image (Edge, auto-generated)
│   ├── apple-icon.tsx      ← Apple touch icon (Edge, auto-generated)
│   ├── sitemap.ts
│   └── robots.ts
├── components/             ← Page sections and UI
├── lib/
│   ├── config.ts           ← Central site config (URLs, links, metadata)
│   └── ...
├── public/
│   ├── favicon.svg
│   └── demo.mp4
├── styles/
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## Deployment

Deployed on **Cloudflare Pages**.

Set `NEXT_PUBLIC_DOWNLOAD_URL` to override the installer download URL at build time. Defaults to the latest `Overframe-Setup.exe` from GitHub Releases.
