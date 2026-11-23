import type { NextRequest } from 'next/server'
import { getSpread } from '@/lib/store'

// The panel's skyline: a lot's comparison set as 48 values, lowest to highest.
export async function GET(req: NextRequest) {
  const area = req.nextUrl.searchParams.get('area') || null
  const place = req.nextUrl.searchParams.get('place') ?? ''
  if (!area && !place) return Response.json({ n: 0, values: [] })
  return Response.json(await getSpread(area, place), { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
