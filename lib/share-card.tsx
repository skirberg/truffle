import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { color } from '@/lib/tokens'

// The share card for a view: the real lots drawn behind (brand/share/*.svg),
// paper coming in from the left under the words, the wordmark and the address. 1200 by 630, the size every
// network and messaging app reads.
export const cardSize = { width: 1200, height: 630 }

const dataUri = (b: Buffer) => `data:image/svg+xml;base64,${b.toString('base64')}`
// Each file named in full, so the server bundle carries just these.
const files = {
  wordmark: () => readFile(join(process.cwd(), 'brand', 'wordmark.svg')),
  home: () => readFile(join(process.cwd(), 'brand', 'share', 'home.svg')),
  value: () => readFile(join(process.cwd(), 'brand', 'share', 'value.svg')),
  rules: () => readFile(join(process.cwd(), 'brand', 'share', 'rules.svg')),
  changing: () => readFile(join(process.cwd(), 'brand', 'share', 'changing.svg')),
  built: () => readFile(join(process.cwd(), 'brand', 'share', 'built.svg')),
}

type Art = 'home' | 'value' | 'rules' | 'changing' | 'built'

/** The card's files, cached, so each card is drawn once at build instead of on every crawler's visit. */
async function inputs(art: Art | null) {
  'use cache'
  const [logo, bg, ...faces] = await Promise.all([
    files.wordmark().then(dataUri),
    art ? files[art]().then(dataUri) : Promise.resolve(null),
    // next/og needs TTF, not woff2: these are cut from the same Gabarito source as the page's woff2.
    ...(['Medium', 'Bold', 'ExtraBold'] as const).map((style) => readFile(join(process.cwd(), 'assets', 'fonts', `Gabarito-${style}.ttf`)).then((b) => b.toString('base64'))),
  ])
  return { logo, bg, faces }
}

type Card = {
  /** The view's art from brand/share/, or `svg`: art drawn for this card alone (a lot under fog). */
  art?: Art
  svg?: string | null
  /** A short line over the title: the lot's name and town. */
  kicker?: string
  title: string
  /** A big number over the title's line, as the panel sets it ("1,250 new lots since 2023"). */
  number?: { n: string; unit: string }
  line?: string
  swatches?: { color: string; label: string }[]
}

export async function shareCard({ art, svg, kicker, title, number, line, swatches }: Card) {
  const { logo, bg: viewArt, faces } = await inputs(art ?? null)
  const bg = svg ? dataUri(Buffer.from(svg)) : viewArt
  const fonts = faces.map((b64, i) => ({ name: 'Gabarito', data: Buffer.from(b64, 'base64'), weight: ([500, 700, 800] as const)[i]!, style: 'normal' as const }))
  const paper = color.paper
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: paper, fontFamily: 'Gabarito', color: color.truffle }}>
        {/* next/og draws plain img elements; there is no next/image here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bg && <img src={bg} width={1200} height={630} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            backgroundImage: `linear-gradient(90deg, ${paper} 0%, ${paper} 34%, ${paper}E6 44%, ${paper}00 64%)`,
          }}
        />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 600, height: '100%', padding: '60px 0 56px 64px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={176} height={53} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {kicker && <div style={{ fontSize: 30, fontWeight: 700, color: color.soft, marginBottom: 14, maxWidth: 500 }}>{kicker}</div>}
            {number && (
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{number.n}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: color.soft, marginLeft: 14 }}>{number.unit}</div>
              </div>
            )}
            <div style={{ fontSize: number ? 48 : 60, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04 }}>{title}</div>
            {line && <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.3, color: color.soft, marginTop: 18, maxWidth: 500, textWrap: 'balance' }}>{line}</div>}
            {swatches && (
              <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 22 }}>
                {swatches.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', marginRight: 22, marginBottom: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: s.color, marginRight: 9 }} />
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: color.truffle }}>truffle.city</div>
        </div>
      </div>
    ),
    { ...cardSize, fonts },
  )
}
