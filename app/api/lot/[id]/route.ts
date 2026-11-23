import { getLot, getSharing } from '@/lib/store'

export async function GET(_req: Request, ctx: RouteContext<'/api/lot/[id]'>) {
  const { id } = await ctx.params
  const lot = await getLot(decodeURIComponent(id))
  if (!lot) return Response.json({ error: 'We have no record for this lot yet.' }, { status: 404 })
  const sharing = lot.zoning ? await getSharing(lot.zoning, lot.area, lot.place) : null
  return Response.json({ lot, sharing }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' } })
}
