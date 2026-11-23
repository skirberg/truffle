import { shareCard, cardSize } from '@/lib/share-card'

export const alt = 'Truffle: Downtown Boca Raton as tiles, each standing at its land value per acre in the color of its use, and one lot lying flat under fog with a question mark over it'
export const size = cardSize
export const contentType = 'image/png'

// The front door is the call: the city lit, and one lot under fog to say if it beats its neighbors.
export default function Image() {
  return shareCard({ art: 'home', title: 'Is this lot worth more or less per acre than the lots around it?', line: 'Go with your gut. The numbers come after.' })
}
