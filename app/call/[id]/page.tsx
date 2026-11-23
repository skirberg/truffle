import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Truffle } from '@/components/truffle'
import { getLot, getSummary } from '@/lib/store'
import { inviteName } from '@/lib/challenge'
import { DAILY } from '@/lib/daily'
import { map as M } from '@/lib/tokens'

// A lot a friend sent: it opens on the front door under fog, like a GeoGuessr challenge link opens the same
// round. Their call rides in the link's ?c= and is read in the browser, so this page is the same for every
// sender, cached until the next pull, and its preview can never give the call or the answer away.
export async function generateStaticParams() {
  return [{ id: DAILY.lots[0] ?? M.hunt.first }]
}

export async function generateMetadata({ params }: PageProps<'/call/[id]'>): Promise<Metadata> {
  const { id } = await params
  const lot = await getLot(decodeURIComponent(id))
  if (!lot || !(lot.vpa > 0)) return { title: 'No record yet', robots: { index: false } }
  const title = `${inviteName(lot)}: more or less?`
  const description = 'A friend made their call on this lot. Is it worth more or less per acre than its neighbors? Make yours, then see theirs.'
  return {
    title,
    description,
    // An invitation, not a page to find by search: the lot's own page is the one to index.
    robots: { index: false, follow: true },
    openGraph: { title: `${title} · Truffle`, description, siteName: 'Truffle', type: 'website' },
    twitter: { card: 'summary_large_image', title: `${title} · Truffle`, description },
  }
}

export default async function CallPage({ params }: PageProps<'/call/[id]'>) {
  const { id } = await params
  const lot = await getLot(decodeURIComponent(id))
  // Only a lot with a value can be called.
  if (!lot || !(lot.vpa > 0)) notFound()
  return <Truffle initialMode="value" initialHunt initialChallenge={lot.id} initialLot={null} initialSharing={null} summary={await getSummary()} />
}
