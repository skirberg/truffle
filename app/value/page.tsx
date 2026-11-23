import type { Metadata } from 'next'
import { ViewPage } from '@/components/view-page'

export const metadata: Metadata = {
  title: 'Land value per acre in Boca Raton',
  description: 'Every lot in Boca Raton as a tile. Height is land value per acre, color is what it’s used for. Tap a lot to see why it’s worth what it is, from Palm Beach County property records.',
  alternates: { canonical: '/value' },
}

export default function Value() {
  return <ViewPage mode="value" />
}
