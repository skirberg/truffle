import type { Metadata } from 'next'
import { NoPage } from '@/components/no-page'

export const metadata: Metadata = { title: 'No page here' }

// Any address that isn't a page. A lot that isn't on record has its own words (app/lot/[id]/not-found.tsx).
export default function NotFound() {
  return <NoPage title="There’s no page here" line="The link may be mistyped or out of date. The map is one tap away." />
}
