import { open, stat } from 'node:fs/promises'
import { join } from 'node:path'

// Local and preview tiles: serves data/tiles/<file>.pmtiles with HTTP range requests, the way the Blob
// store does in production (NEXT_PUBLIC_TILES_URL). PMTiles reads a few kilobytes at a time.
export async function GET(req: Request, ctx: RouteContext<'/tiles/[file]'>) {
  const { file } = await ctx.params
  // .json is the index of a tile set split into pieces (the whole state).
  if (!/^[\w-]+\.(pmtiles|json)$/.test(file)) return new Response('Not found', { status: 404 })
  const path = join(process.cwd(), 'data', 'tiles', file)
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') ?? '')
  const start = range ? Number(range[1]) : 0
  const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(end - start + 1)
    await fh.read(buf, 0, buf.length, start)
    return new Response(buf, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        'Content-Length': String(buf.length),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } finally {
    await fh.close()
  }
}
