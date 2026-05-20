import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Particles } from '@/components/Particles'
import { SITE_CONFIG } from '@/lib/config'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    'in-game browser overlay',
    'gaming overlay browser',
    'always on top browser',
    'overlay wiki gaming',
    'alt tab alternative',
    'build guide overlay',
    'twitch chat overlay browser',
    'transparent browser windows',
    'open source gaming overlay',
    'anti cheat safe overlay',
    'overframe',
  ],
  authors: [{ name: SITE_CONFIG.author.name, url: SITE_CONFIG.author.url }],
  creator: SITE_CONFIG.author.name,
  publisher: SITE_CONFIG.author.name,
  applicationName: SITE_CONFIG.name,
  category: 'gaming',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
  },
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

export const viewport: Viewport = {
  themeColor: '#0b0b10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

/**
 * JSON-LD structured data — declares Overframe as a SoftwareApplication.
 * Boosts rich-result eligibility on Google search and helps generative
 * engines (ChatGPT, Perplexity, Gemini) ground answers about the product.
 */
const JSON_LD_APP = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_CONFIG.name,
  description: SITE_CONFIG.description,
  url: SITE_CONFIG.url,
  applicationCategory: 'UtilitiesApplication',
  applicationSubCategory: 'Browser',
  operatingSystem: SITE_CONFIG.supportedOS,
  downloadUrl: SITE_CONFIG.downloadUrl,
  softwareVersion: '0.1.1',
  fileSize: '~130MB (installer)',
  releaseNotes: `${SITE_CONFIG.url}/changelog`,
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  featureList: [
    'Always-on-top browser overlay',
    'Per-game profiles with auto-detection',
    'Click-through mode',
    'Per-game collections with one-click sharing',
    'Customisable global hotkeys (AZERTY/QWERTY/DVORAK)',
    'Performance Mode (frees GPU and RAM when hidden)',
    'Per-tab zoom memory and live memory profiler',
    'No code injection — anti-cheat safe by design',
  ],
  author: {
    '@type': 'Organization',
    name: SITE_CONFIG.author.name,
    url: SITE_CONFIG.author.url,
  },
  sameAs: [SITE_CONFIG.links.github, SITE_CONFIG.links.discord],
}

const JSON_LD_ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  logo: `${SITE_CONFIG.url}/favicon.svg`,
  sameAs: [SITE_CONFIG.links.github, SITE_CONFIG.links.discord],
}

const JSON_LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  publisher: { '@type': 'Organization', name: SITE_CONFIG.name },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
        <Particles />
        <Navbar />
        <main className="flex-1 relative z-10">{children}</main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_ORG) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }}
        />
      </body>
    </html>
  )
}
