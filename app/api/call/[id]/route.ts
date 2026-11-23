import { getCall } from '@/lib/store'

// The answer to a call, read once the lot is under fog so it is ready the moment the call is made. It is the
// same for every visitor: the median of the valued lots within a few blocks, from the records, and why.
export async function GET(_req: Request, ctx: RouteContext<'/api/call/[id]'>) {
  const { id } = await ctx.params
  const facts = await getCall(decodeURIComponent(id))
  if (!facts) return Response.json({ error: 'We have no record for this lot yet.' }, { status: 404 })
  const { id: lotId, median, more, why, short, typical, grounds, near } = facts
  return Response.json({ id: lotId, median, more, why, short, typical, grounds, near }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' } })
}
