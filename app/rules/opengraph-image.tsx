import { shareCard, cardSize } from '@/lib/share-card'

export const alt = 'Every lot in Downtown Boca Raton colored by what its zoning allows it to be'
export const size = cardSize
export const contentType = 'image/png'

export default function Image() {
  return shareCard({ art: 'rules', title: 'What each lot is allowed to be', line: 'The rules decide what a lot can become.' })
}
