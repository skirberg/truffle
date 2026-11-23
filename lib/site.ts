/**
 * The public address. truffle.city answers by sending visitors on to www.truffle.city, so the www address is
 * the one search engines should be told about: canonical links, share images, robots and the sitemap all
 * use it. If the apex ever becomes the main domain in Vercel, set NEXT_PUBLIC_SITE_URL to match.
 */
export const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.truffle.city'
