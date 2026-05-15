# Overframe Landing

Public marketing site for the Overframe overlay browser. Built with **Next.js
15** (app router) and **Tailwind CSS**.

## Local development

```bash
# from the repo root
pnpm install
pnpm --filter overframe-landing dev
```

Then open <http://localhost:3001>.

## Production build

```bash
pnpm --filter overframe-landing build
pnpm --filter overframe-landing start
```

## Structure

```
landing/
├── app/                ← Next.js app router pages
│   ├── layout.tsx      ← Root layout (fonts, theme, metadata)
│   ├── page.tsx        ← Home (hero, features, download CTA)
│   ├── download/       ← Direct-download page (per-OS installer links)
│   ├── changelog/      ← Release notes
│   └── docs/           ← Product documentation
├── components/         ← Reusable UI primitives (Button, Section…)
├── content/            ← MDX/JSON copy: features, FAQs, changelog data
├── public/             ← Static assets (logo, screenshots, OG image)
├── styles/             ← Tailwind entrypoint
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Deployment

Designed to deploy as a static / SSR site on Vercel, Netlify or any Node host.
Set the env var `NEXT_PUBLIC_DOWNLOAD_URL` to the latest installer URL (the
download CTA reads from it).
