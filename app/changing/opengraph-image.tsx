import { shareCard, cardSize } from '@/lib/share-card'
import { getSummary } from '@/lib/store'
import { count } from '@/lib/numbers'

export const alt = 'West Boca: the lots added to the county map since 2023 standing up, older lots flat'
export const size = cardSize
export const contentType = 'image/png'

export default async function Image() {
  const summary = await getSummary()
  return shareCard({ art: 'changing', title: 'West Boca', number: { n: count(summary.westNew), unit: 'new lots since 2023' }, line: 'Nearly all are on the old Boca municipal golf course and the Johns West land next to it.' })
}
