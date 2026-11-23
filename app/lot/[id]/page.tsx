import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { Truffle } from '@/components/truffle'
import { getLot, getLotByLegacy, getSharing, getSummary } from '@/lib/store'
import { lotTitle, shareDescription } from '@/lib/copy'
import { isStateLot } from '@/lib/state-lots'

// 600,000 lots can't be built ahead of time. Mizner Plaza (lot 608 on the first board) is prerendered; every
// other lot renders on its first visit and stays cached until the next pull expires the "pull" tag.
export async function generateStaticParams() {
  const lot = await getLotByLegacy(608)
  return [{ id: lot?.id ?? '608' }]
}

async function resolve(raw: string) {
  const id = decodeURIComponent(raw)
  if (/^\d{1,6}$/.test(id)) {
    const legacy = await getLotByLegacy(Number(id))
    if (legacy) permanentRedirect(`/lot/${legacy.id}`)
  }
  return getLot(id)
}

export async function generateMetadata({ params }: PageProps<'/lot/[id]'>): Promise<Metadata> {
  const { id } = await params
  const lot = await resolve(id)
  if (!lot && isStateLot(decodeURIComponent(id))) return { title: 'A lot in Florida' }
  if (!lot) return { title: 'No record yet' }
  return {
    title: lotTitle(lot),
    description: shareDescription(lot),
    alternates: { canonical: `/lot/${lot.id}` },
    openGraph: { title: `${lotTitle(lot)} · Truffle`, description: shareDescription(lot), siteName: 'Truffle', type: 'website' },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function LotPage({ params }: PageProps<'/lot/[id]'>) {
  const { id } = await params
  const lot = await resolve(id)
  if (!lot && isStateLot(decodeURIComponent(id))) {
    // Outside Palm Beach County the lot lives in the tiles; the page opens the map and the map reads it.
    return <Truffle initialMode="value" initialLot={null} initialStateLot={decodeURIComponent(id)} initialSharing={null} summary={await getSummary()} />
  }
  if (!lot) notFound()
  const [summary, sharing] = await Promise.all([getSummary(), lot.zoning ? getSharing(lot.zoning, lot.area, lot.place) : null])
  return <Truffle initialMode="value" initialLot={lot} initialSharing={sharing} summary={summary} />
}
