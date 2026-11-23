import type { MetadataRoute } from 'next'
import { color } from '@/lib/tokens'

// Added to a phone's home screen, Truffle opens on its own, on paper, with the mark as its icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // The app's identity, so a later change to start_url doesn't install it twice.
    id: '/',
    name: 'Truffle',
    short_name: 'Truffle',
    description: 'Every lot in the city as a tile. Height is land value per acre, color is what it’s used for.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: color.paper,
    theme_color: color.paper,
    // Vectors first, sharp at any size where they're read (Chrome, Edge, Android); PNGs for the rest, like
    // Safari, which uses a PNG for the home screen. Each PNG comes as both shapes at 192 and 512, the two sizes
    // Android asks for, as Linear's manifest gives its maskable icon at each size it gives the plain one.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
