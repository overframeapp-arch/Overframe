import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

/** PWA-ish manifest — also serves as the source of truth for icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Overframe',
    short_name: 'Overframe',
    description: 'The transparent in-game browser overlay for Windows.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b10',
    theme_color: '#0b0b10',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
