import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/site'

// The four views, the brand kit and how it's built. Lot pages are left out on purpose: most lots are someone's
// home, and a list of home addresses with their values is not something Truffle hands to search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/value', '/rules', '/changing', '/brand', '/built'].map((path) => ({ url: `${SITE}${path}` }))
}
