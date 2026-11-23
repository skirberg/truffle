import type { Metadata } from 'next'
import { ViewPage } from '@/components/view-page'

export const metadata: Metadata = {
  title: 'New lots in West Boca since 2023',
  description: 'West Boca lots added to the county map since 2023.',
  alternates: { canonical: '/changing' },
}

export default function Changing() {
  return <ViewPage mode="changing" />
}
