import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getLot, getLotByLegacy, getSummary } from '@/lib/store'
import { lotTitle, scopePhrase, sourceLine } from '@/lib/copy'
import { heightM, money } from '@/lib/numbers'
import { color } from '@/lib/tokens'
import { isStateLot } from '@/lib/state-lots'
import { shareCard } from '@/lib/share-card'

export const alt = 'A lot on Truffle: its tile, its value per acre and why'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// next/og needs TTF, not woff2: these are cut from the same Gabarito source as the page's woff2.
const fonts = Promise.all(
  (['Medium', 'Bold', 'ExtraBold'] as const).map(async (style, i) => ({
    name: 'Gabarito',
    data: await readFile(join(process.cwd(), 'assets', 'fonts', `Gabarito-${style}.ttf`)),
    weight: ([500, 700, 800] as const)[i]!,
    style: 'normal' as const,
  })),
)
const wordmark = readFile(join(process.cwd(), 'brand', 'wordmark.svg'), 'utf8').then((s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`)

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const raw = decodeURIComponent(id)
  const lot = /^\d{1,6}$/.test(raw) ? await getLotByLegacy(Number(raw)) : await getLot(raw)
  // No record: the card says what the page says, over the front door's lot under fog, instead of a tile for a
  // lot that isn't there.
  // A lot from the state roll lives in the tiles only, so its card names the state and leaves the number to the map.
  if (!lot && isStateLot(raw)) return shareCard({ art: 'value', title: 'A lot in Florida', line: 'Its height is its land value per acre. Open it to see why.' })
  if (!lot) return shareCard({ art: 'home', title: 'We have no record of that lot', line: 'The link may be from an older pull, or the address isn’t covered yet.' })
  const [f, logo, summary] = await Promise.all([fonts, wordmark, getSummary()])
  // Every number shows its source and pull date, here too.
  const source = sourceLine(summary.pulls.filter((p) => p.key === 'parcels'))
  const h = heightM(lot.vpa)
  const tile = 120 + h * 4.2 // the tile's side grows with its height on the board
  const top = color.truffle
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: color.paper, fontFamily: 'Gabarito', color: color.truffle, padding: 64 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
          <img src={logo} width={190} height={57} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: color.soft }}>{lotTitle(lot)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 8 }}>
              <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{lot.vpa > 0 ? money(lot.vpa) : 'Not valued'}</div>
              {lot.vpa > 0 && <div style={{ fontSize: 40, fontWeight: 700, color: color.soft, marginLeft: 14 }}>an acre</div>}
            </div>
            {lot.pct !== null && (
              <div style={{ fontSize: 30, fontWeight: 500, marginTop: 18 }}>{`Worth more per acre than ${lot.pct}% of valued lots ${scopePhrase(lot)}.`}</div>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: color.faint }}>{source}</div>
        </div>
        <div style={{ width: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* The picked tile in isometric: top, left side, right side, light from the upper left. */}
          <svg width="360" height="420" viewBox="-180 -260 360 420">
            <polygon points={`0,${-tile * 0.5 - h * 4} ${tile * 0.87},${-h * 4} 0,${tile * 0.5 - h * 4} ${-tile * 0.87},${-h * 4}`} fill={top} />
            <polygon points={`${-tile * 0.87},${-h * 4} 0,${tile * 0.5 - h * 4} 0,${tile * 0.5} ${-tile * 0.87},0`} fill={color.truffleSide} />
            <polygon points={`0,${tile * 0.5 - h * 4} ${tile * 0.87},${-h * 4} ${tile * 0.87},0 0,${tile * 0.5}`} fill={color.truffle} />
          </svg>
        </div>
      </div>
    ),
    { ...size, fonts: await f },
  )
}
