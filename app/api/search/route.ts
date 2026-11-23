import type { NextRequest } from 'next/server'
import { search } from '@/lib/store'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  return Response.json(await search(q), { headers: { 'Cache-Control': 'public, max-age=60' } })
}
