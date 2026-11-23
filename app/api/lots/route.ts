import type { NextRequest } from 'next/server'
import { getLots } from '@/lib/store'

// The keyboard list of lots on screen asks for up to 40 at once. The front door asks for the lots around the
// one called (size, use, land and building) to say why it stands above or below them. No owner, no person.
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 60)
  const lots = await getLots(ids)
  return Response.json(
    lots.map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address, vpa: l.vpa, year_added: l.year_added, use_text: l.use_text, acres: l.acres, use: l.use, land: l.land, building: l.building, built: l.built ?? null })),
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
