import { shareCard, cardSize } from '@/lib/share-card'
import { useColor, useLegend } from '@/lib/tokens'

export const alt = 'Every lot in Downtown Boca Raton as a tile: taller where its land is worth more per acre, colored by use'
export const size = cardSize
export const contentType = 'image/png'

export default function Image() {
  return shareCard({
    art: 'value',
    title: 'Downtown Boca Raton',
    line: 'Taller means worth more per acre.',
    swatches: useLegend.filter((u) => u.key !== 'vacant').map((u) => ({ color: useColor[u.key], label: u.label })),
  })
}
