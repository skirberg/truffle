import type { Metadata } from 'next'
import { ViewPage } from '@/components/view-page'

export const metadata: Metadata = {
  title: 'Zoning in Downtown Boca Raton, lot by lot',
  description: 'What each lot in Downtown Boca Raton is allowed to be, from the city’s zoning.',
  alternates: { canonical: '/rules' },
}

export default function Rules() {
  return <ViewPage mode="rules" />
}
