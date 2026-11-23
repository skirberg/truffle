import 'server-only'
import { join } from 'node:path'
import tokens from '@/brand/tokens.json'
import { USE, draw, middle, readLotsNear } from '@/scripts/board-art.mjs'
import type { Lot } from './types'

// The art behind a lot's "call it" card: the lots around it standing at their heights in their use colors, and
// this one lying flat under fog with its truffle outline and the pin with its question mark, at the lot
// camera: the moment before the call, as the front door's own card shows it for its first lot. Never its
// height or its value. Drawn on request from the tiles the map serves: the committed file when the lot is in
// it, else the site's tile file over HTTP when that is a single file. Null when neither has the lot, and the
// card goes out with words alone.
const FOG_H = 1.2
const C = tokens.color
const SCALE = 2.1

export async function fogArt(lot: Pick<Lot, 'id' | 'lon' | 'lat'>, tilesUrl: string): Promise<string | null> {
  const sources = [join(process.cwd(), 'data', 'tiles', 'lots.pmtiles'), ...(/^https:\/\/[^?]+\.pmtiles$/.test(tilesUrl) ? [tilesUrl] : [])]
  for (const src of sources) {
    try {
      const lots = await readLotsNear(src, [lot.lon, lot.lat], 700)
      const it = lots.find((l) => l.id === lot.id)
      if (!it) continue
      return draw(lots, {
        center: middle(it),
        radius: 650,
        pitch: tokens.map.lotJump.pitch,
        bearing: tokens.map.value.bearing,
        // The lot sits right of the middle, clear of the words that come in from the left.
        crop: { size: [1200 / SCALE, 630 / SCALE], scale: SCALE, at: [-200, -30] },
        style: (l) => (l.id === lot.id ? { h: FOG_H, colors: [C.line, C.line, C.line, C.line] } : { h: l.h, colors: USE[l.u] ?? USE.o! }),
        mark: { id: lot.id, h: FOG_H, px: 2.2, line: 4 },
      }).svg
    } catch {
      // A file that can't be read (a split set of tiles, a network error): try the next, then words alone.
    }
  }
  return null
}
