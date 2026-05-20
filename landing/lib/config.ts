/**
 * Site-wide configuration: brand info, external links and SEO metadata.
 * Centralised so swapping a URL or contact email is a one-line change.
 */
export const SITE_CONFIG = {
  name: 'Overframe',
  tagline: 'The in-game browser overlay for PC gamers',
  description:
    'Overframe is a free, open-source overlay browser for Windows. Press Alt+B to open wikis, build guides and tools on top of any borderless game — no alt-tab, no injection, no risk to your anti-cheat.',
  url: 'https://overframe.app',

  /** Latest installer URL — overridable via env at build time.
   *  GitHub redirects /releases/latest/download/{asset} to the newest release
   *  automatically, so this URL never needs updating between releases. */
  downloadUrl:
    process.env.NEXT_PUBLIC_DOWNLOAD_URL ??
    'https://github.com/overframeApp-arch/Overframe/releases/latest/download/Overframe-Setup.exe',

  links: {
    github: 'https://github.com/overframeApp-arch/Overframe',
    discord: 'https://discord.gg/A2KPZn8WNd',
    kofi: 'https://ko-fi.com/overframe',
    /** General inquiries & legal contact — bugs/features go through Discord */
    email: 'contact@overframe.app',
  },

  author: {
    name: 'Overframe',
    url: 'https://overframe.app',
  },

  /** Operating systems the desktop app supports (used in JSON-LD). */
  supportedOS: 'Windows 10, Windows 11',
} as const

export type SiteConfig = typeof SITE_CONFIG
