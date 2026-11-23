import { shareCard, cardSize } from '@/lib/share-card'

export const alt = 'Downtown Boca Raton read the way Truffle builds it: lots lying flat as the county’s outlines, then standing as tiles at their land value per acre in the colors of their use, with Mizner Plaza in truffle brown where they turn'
export const size = cardSize
export const contentType = 'image/png'

// How it's built: the county's outlines on one side, the tiles they become on the other (brand/share/built.svg).
export default function Image() {
  return shareCard({ art: 'built', title: 'How it’s built', line: 'From the county’s records to a tile you can tap.' })
}
