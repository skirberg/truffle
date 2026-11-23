import { revalidateTag } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'

// The GitHub Action calls this after it loads a pull, so lot pages pick up the new numbers.
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const ok = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  if (!ok) return Response.json({ error: 'Not allowed.' }, { status: 401 })
  revalidateTag('pull', 'max')
  return Response.json({ revalidated: 'pull', at: new Date().toISOString() })
}
