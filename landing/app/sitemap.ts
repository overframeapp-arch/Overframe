import type { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/config'

const ROUTES = ['', '/download', '/changelog', '/privacy', '/terms', '/contact'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ROUTES.map((route) => ({
    url: `${SITE_CONFIG.url}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }))
}
