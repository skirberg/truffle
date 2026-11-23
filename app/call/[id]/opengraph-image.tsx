import { shareCard, cardSize } from '@/lib/share-card'
import { getLot, getSummary } from '@/lib/store'
import { inviteName, townWords } from '@/lib/challenge'
import { fogArt } from '@/lib/fog-art'

export const alt = 'A lot on Truffle lying flat under fog among its neighbors, each standing at its land value per acre, with a question mark over it'
export const size = cardSize
export const contentType = 'image/png'

// What a friend sees in the chat before they tap: the lot under fog among its lit neighbors and the question.
// Never the answer, never the sender's call, never the lot's value: the image has no query string, so it is
// the same picture for every link to this lot.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lot = await getLot(decodeURIComponent(id))
  // A lot with no record or no value can't be called, and its page says so (not-found.tsx); so does its card.
  if (!lot || !(lot.vpa > 0)) return shareCard({ art: 'home', title: 'We have no record of that lot', line: 'The link may be from an older pull, or the lot has no value to call.' })
  const summary = await getSummary()
  const svg = await fogArt(lot, summary.tilesUrl)
  return shareCard({
    svg,
    kicker: `${inviteName(lot)} · ${townWords(lot)}`,
    title: 'Worth more or less per acre than its neighbors?',
    line: 'A friend made their call. Make yours.',
  })
}
