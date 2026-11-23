import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

// The views and lot pages are open; the data endpoints and tile files are for the map, not for search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/tiles/'] },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
