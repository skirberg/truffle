import type { NextConfig } from 'next'

// Security headers, sent by `next start` as well as by Vercel, so qa and smoke run under the same policy as
// the live site and a blocked request fails them as a console error. Next's own inline scripts need
// 'unsafe-inline' (nonces would make every page render on request, and lot pages are cached until the next
// pull), so the policy's work is the rest: scripts, styles, fonts and workers from this site only; data from
// this site and the Blob store the pull writes tiles to; nothing may embed the site except itself and
// samikirberg.com, which shows it live on its page; no plugins, no other base, forms post here only.
// Vercel's analytics load from this site's own /_vercel paths. Preview deployments also allow Vercel's
// comment toolbar.
const preview = process.env.VERCEL_ENV === 'preview'
const dev = process.env.NODE_ENV === 'development'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${preview ? ' https://vercel.live' : ''}`,
  `style-src 'self' 'unsafe-inline'${preview ? ' https://vercel.live' : ''}`,
  `img-src 'self' data: blob:${preview ? ' https://vercel.live https://vercel.com' : ''}`,
  `font-src 'self'${preview ? ' https://vercel.live https://assets.vercel.com' : ''}`,
  "worker-src 'self' blob:",
  `connect-src 'self' https://*.public.blob.vercel-storage.com${preview ? ' https://vercel.live wss://ws-us3.pusher.com' : ''}`,
  `frame-src ${preview ? 'https://vercel.live' : "'none'"}`,
  "frame-ancestors 'self' https://samikirberg.com https://www.samikirberg.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

export const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Sharing (the Web Share API) and copying a link stay allowed; nothing here asks for a camera, a microphone or a location.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // This host only: includeSubDomains and preload are hard to undo.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
]

const nextConfig: NextConfig = {
  // Lot pages render on first visit and stay cached until the next data pull (cache tag "pull").
  cacheComponents: true,
  // Lot pages await their params outside any Suspense boundary, so a first visit renders the whole page
  // (address, value, reasons as text) and Next stores it per URL.
  partialPrefetching: false,
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  // The worker path carries its version and glyphs only change with the fonts, so both cache for a year.
  async headers() {
    const year = 'public, max-age=31536000, immutable'
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/maplibre/:path*', headers: [{ key: 'Cache-Control', value: year }] },
      { source: '/glyphs/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=31536000' }] },
    ]
  },
  outputFileTracingIncludes: {
    '/**': ['./data/snapshot.json.gz', './data/places.json', './assets/fonts/*.ttf', './brand/*.svg'],
    '/tiles/[file]': ['./data/tiles/*.pmtiles', './data/tiles/*.json'],
    // A lot sent to a friend draws its card from the committed tiles (lib/fog-art.ts).
    '/call/**': ['./data/tiles/lots.pmtiles'],
  },
}

export default nextConfig
