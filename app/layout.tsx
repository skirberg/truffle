import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { SITE } from '@/lib/site'
import { color } from '@/lib/tokens'

const gabarito = localFont({
  src: './fonts/Gabarito-Variable.woff2',
  weight: '400 900',
  display: 'swap',
  variable: '--font-gabarito',
  fallback: ['Arial', 'sans-serif'],
})


export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Truffle', template: '%s · Truffle' },
  description: 'Every lot in the city as a tile. Height is land value per acre, color is what it’s used for, and tapping it says why it’s worth what it is.',
  authors: [{ name: 'Sami Kirberg' }],
  creator: 'Sami Kirberg',
  // Icons come from app/favicon.ico, app/icon.svg and app/apple-icon.png (scripts/brand.mjs draws them).
  openGraph: { siteName: 'Truffle', type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { title: 'Truffle', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // On Android the keyboard shrinks the page like it does on iPhone, so the sheet stays above it.
  interactiveWidget: 'resizes-content',
  themeColor: color.paper,
  // One theme, light: the browser draws its own parts (scrollbars, form controls) light from the first paint.
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={gabarito.variable}>
      <body>
        {children}
        {/* Real visits on Vercel measure the 3-second phone budget; off Vercel these scripts don't exist. */}
        {process.env.VERCEL && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  )
}
