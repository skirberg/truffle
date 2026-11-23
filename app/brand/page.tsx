/* eslint-disable @next/next/no-img-element -- the kit's own files, shown as they download */
import type { Metadata } from 'next'
import Link from 'next/link'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Swatch } from '@/components/swatch'
import { color, useColor } from '@/lib/tokens'
import { KIT, LOGO_PNG, logos, marks, social, swatches } from '@/lib/kit'

export const metadata: Metadata = {
  title: 'Brand',
  description: 'The Truffle brand kit: the logo, the mark, the colors, the type and the board, each file drawn from one source.',
  alternates: { canonical: '/brand' },
  openGraph: {
    siteName: 'Truffle',
    type: 'website',
    locale: 'en_US',
    images: [{ url: `${KIT}/social/og-1200x630.png`, width: 1200, height: 630, type: 'image/png', alt: 'The Truffle wordmark beside Downtown Boca Raton as tiles: height is land value per acre, color is use' }],
  },
}

// The wordmark as drawn (brand/wordmark.svg): its letters in one path and the t's cap in the other. The page
// draws the clear space and the misuses with these same two paths, never a copy.
const WORD = readFileSync(join(process.cwd(), 'brand', 'wordmark.svg'), 'utf8')
const [LETTERS, CAP] = [...WORD.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]!)
const BOX = '0 0 385.8 116'
// In the wordmark's own units: the ink runs from (8, 8) to (377.8, 108), and the cap is 29.9 tall.
const INK = { x: 8, y: 8, w: 369.8, h: 100 }
const CAP_H = 29.9

const H2 = 'text-fluid-heading font-extrabold leading-[1.08] tracking-[-0.03em] text-balance'
const LEAD = 'max-w-[56ch] text-ui-body font-medium leading-[1.5] text-soft min-[760px]:text-ui-headline'
const LINK = 'inline-flex min-h-11 items-center text-ui-small font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-truffle'
const SECTION = 'border-t border-line py-16 min-[760px]:py-24'

function Word({ letters = color.truffle, cap = letters, outline = false, className, stretch = false }: { letters?: string; cap?: string; outline?: boolean; className?: string; stretch?: boolean }) {
  const paint = (fill: string) => (outline ? { fill: 'none', stroke: fill, strokeWidth: 1.6 } : { fill })
  return (
    <svg viewBox={BOX} className={className} preserveAspectRatio={stretch ? 'none' : undefined} aria-hidden="true">
      <path d={LETTERS} fillRule="evenodd" {...paint(letters)} />
      <path d={CAP} {...paint(cap)} />
    </svg>
  )
}

const ink = (hex: string) => (hex === color.truffle || hex === color.soft ? color.paper : color.truffle)

export default function Brand() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 min-[760px]:px-12">
      <section className="flex flex-col gap-8 pt-16 pb-16 min-[760px]:pt-24 min-[760px]:pb-24">
        <h1 className="w-[min(100%,560px)]">
          <img src={`${KIT}/logo/truffle-logo-color.svg`} alt="Truffle" width={560} height={168} className="block h-auto w-full" />
        </h1>
        <p className={LEAD}>The logo, the mark, the colors, the type and the board, all drawn from one source.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`${KIT}/kit.zip`} download className="inline-flex h-12 items-center rounded-pill bg-truffle px-5 text-ui-small font-bold text-paper transition-transform duration-(--motion-tap) ease-out active:scale-[0.97]">
            Download the kit
          </a>
          <Link href="/" className="inline-flex h-12 items-center rounded-pill bg-card px-5 text-ui-small font-bold shadow-pill">
            Back to the map
          </Link>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="logo">
        <h2 id="logo" className={H2}>The logo.</h2>
        <p className={`${LEAD} mt-4`}>The t is a mushroom, because a truffle is one.</p>
        <div className="mt-10 grid gap-x-6 gap-y-10 min-[760px]:grid-cols-2">
          {logos.map((l) => (
            <figure key={l.key} className="m-0 flex flex-col gap-3">
              <div className="grid aspect-[2/1] place-items-center rounded-lg shadow-edge-faint" style={{ background: l.ground }}>
                <img src={`${KIT}/logo/truffle-logo-${l.key}.svg`} alt={`Truffle wordmark, ${l.name.toLowerCase()}`} width={386} height={116} className="h-auto w-[64%]" loading="lazy" />
              </div>
              <figcaption className="flex flex-wrap items-baseline gap-x-4">
                <span className="text-ui-body font-bold">{l.name}</span>
                <span className="text-ui-small font-medium text-soft">{l.note}</span>
                <span className="flex flex-wrap gap-x-4 min-[760px]:ml-auto">
                  <a className={LINK} href={`${KIT}/logo/truffle-logo-${l.key}.svg`} download>SVG</a>
                  {LOGO_PNG.map((w) => (
                    <a key={w} className={LINK} href={`${KIT}/logo/truffle-logo-${l.key}-${w}.png`} download>
                      PNG {w}
                    </a>
                  ))}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-ui-small font-medium text-soft">
          For an email signature, the wordmark at twice its size:{' '}
          <a className={LINK} href={`${KIT}/email/signature-logo@2x.png`} download>signature-logo@2x.png</a>
        </p>
      </section>

      <section className={SECTION} aria-labelledby="mark">
        <h2 id="mark" className={H2}>The mark.</h2>
        <p className={`${LEAD} mt-4`}>The t on its own, drawn from circles.</p>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 min-[760px]:grid-cols-5">
          {marks.map((m) => (
            <figure key={m.key} className="m-0 flex flex-col gap-2">
              <div className="grid aspect-square place-items-center rounded-lg shadow-edge-faint" style={{ background: m.ground }}>
                <img src={`${KIT}/mark/truffle-mark-${m.key}.svg`} alt={`Truffle mark, ${m.name.toLowerCase()}`} width={100} height={100} className="h-auto w-[56%]" loading="lazy" />
              </div>
              <figcaption className="flex flex-wrap items-baseline gap-x-4">
                <span className="text-ui-body font-bold">{m.name}</span>
                <a className={LINK} href={`${KIT}/mark/truffle-mark-${m.key}.svg`} download>SVG</a>
                <a className={LINK} href={`${KIT}/mark/truffle-mark-${m.key}-1024.png`} download>PNG</a>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-end gap-8">
          {[180, 120, 60, 32, 16].map((s) => (
            <img key={s} src={`${KIT}/mark/truffle-mark-tile.svg`} alt={s === 180 ? 'The app icon' : ''} width={s} height={s} className="flex-none" loading="lazy" />
          ))}
        </div>
        <p className="mt-4 text-ui-small font-medium text-soft">The app icon holds at 16 px.</p>
      </section>

      <section className={SECTION} aria-labelledby="room">
        <h2 id="room" className={H2}>Room around it.</h2>
        <div className="mt-10 grid items-center gap-10 min-[760px]:grid-cols-[3fr_2fr]">
          <figure className="m-0 rounded-lg bg-card p-6 min-[760px]:p-10">
            <svg viewBox={`${INK.x - CAP_H - 6} ${INK.y - CAP_H - 6} ${INK.w + 2 * CAP_H + 12} ${INK.h + 2 * CAP_H + 12}`} className="block h-auto w-full" role="img" aria-label="The wordmark with the height of its cap left clear on every side">
              <rect x={INK.x - CAP_H} y={INK.y - CAP_H} width={INK.w + 2 * CAP_H} height={INK.h + 2 * CAP_H} fill="none" stroke={color.truffle} strokeWidth="1" strokeDasharray="4 3" />
              {/* The unit is the cap itself: one in each margin. */}
              {[
                [INK.x - CAP_H, INK.y + INK.h / 2 - CAP_H / 2],
                [INK.x + INK.w, INK.y + INK.h / 2 - CAP_H / 2],
                [INK.x + INK.w / 2 - CAP_H / 2, INK.y - CAP_H],
                [INK.x + INK.w / 2 - CAP_H / 2, INK.y + INK.h],
              ].map(([x, y]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={CAP_H} height={CAP_H} fill={useColor.homes} opacity="0.55" />
              ))}
              <g>
                <path d={LETTERS} fillRule="evenodd" fill={color.truffle} />
                <path d={CAP} fill={color.truffle} />
              </g>
            </svg>
          </figure>
          <div className="flex flex-col gap-6">
            <p className="text-ui-headline font-bold">Clear space is the height of the cap, on every side.</p>
            <div className="flex items-end gap-6">
              <img src={`${KIT}/logo/truffle-logo-color.svg`} alt="The wordmark at 72 px wide" width={72} height={22} />
              <img src={`${KIT}/mark/truffle-mark-tile.svg`} alt="The app icon at 24 px" width={24} height={24} />
            </div>
            <p className="text-ui-headline font-bold">The wordmark is never under 72 px wide. Below that, use the mark.</p>
          </div>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="dont">
        <h2 id="dont" className={H2}>Don’t.</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 min-[760px]:grid-cols-4">
          {[
            { say: 'Stretch it', art: <Word stretch className="h-[22%] w-[84%]" /> },
            { say: 'Recolor it', art: <Word letters={useColor.civic} cap={useColor.biz} className="h-auto w-[72%]" /> },
            { say: 'Outline it', art: <Word outline className="h-auto w-[72%]" /> },
            { say: 'Set it straight on the board', art: <Word className="h-auto w-[72%]" />, board: true },
          ].map((d) => (
            <figure key={d.say} className="m-0 flex flex-col gap-3">
              <div
                className="grid aspect-[3/2] place-items-center overflow-hidden rounded-lg bg-card bg-cover bg-bottom"
                style={d.board ? { backgroundImage: `url(${KIT}/social/instagram-1080x1080.png)` } : undefined}
              >
                {d.art}
              </div>
              <figcaption className="text-ui-small font-semibold">{d.say}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={SECTION} aria-labelledby="color">
        <h2 id="color" className={H2}>Color means use. Height means value.</h2>
        <p className={`${LEAD} mt-4`}>From the Sanborn fire insurance maps. Truffle brown is only ever the lot you picked. Tap a color to copy it.</p>
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 min-[760px]:grid-cols-5">
          {swatches.map((s) => (
            <Swatch key={s.name} name={s.name} hex={s.hex} role={s.role} ink={ink(s.hex)} />
          ))}
        </div>
        <p className="mt-8 flex flex-wrap gap-x-6">
          <a className={LINK} href={`${KIT}/colors/colors.md`}>Every color, with contrast</a>
          <a className={LINK} href={`${KIT}/colors/tokens.json`} download>tokens.json</a>
          <a className={LINK} href={`${KIT}/colors/tokens.css`} download>tokens.css</a>
          <a className={LINK} href={`${KIT}/colors/truffle.tokens.json`} download>truffle.tokens.json</a>
        </p>
      </section>

      <section className={SECTION} aria-labelledby="type">
        <h2 id="type" className={H2}>One family. Gabarito.</h2>
        <div className="mt-10 flex flex-col">
          {[
            { text: 'Why is my street building?', cls: 'text-fluid-display font-extrabold tracking-[-0.035em] leading-none', spec: 'Display, ExtraBold' },
            { text: '$6.6M', cls: 'text-fluid-number font-extrabold tracking-[-0.04em] leading-none', spec: 'Number, ExtraBold, tabular' },
            { text: 'Mizner Park', cls: 'text-ui-title font-bold', spec: 'Title, Bold' },
            { text: 'The land is 92% of the value.', cls: 'text-ui-body font-medium', spec: 'Body, Medium' },
            { text: 'Values: Palm Beach County property records.', cls: 'text-source font-medium text-faint', spec: 'Source line, Medium' },
          ].map((r) => (
            <div key={r.spec} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line py-4">
              <span className={`min-w-0 ${r.cls}`}>{r.text}</span>
              <span className="text-ui-small font-medium text-soft">{r.spec}</span>
            </div>
          ))}
        </div>
        <p className={`${LEAD} mt-8`}>
          Round and solid like a toy. Free under the SIL Open Font License.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-6">
          <a className={LINK} href={`${KIT}/type/Gabarito-OFL.txt`}>The licence</a>
          <a className={LINK} href="https://fonts.google.com/specimen/Gabarito">Where it comes from</a>
        </p>
      </section>

      <section className={SECTION} aria-labelledby="voice">
        <h2 id="voice" className={H2}>The sharp local who explains things simply.</h2>
        <div className="mt-10 flex flex-col">
          <div className="hidden grid-cols-[1fr_1.4fr_1.4fr] gap-6 border-b border-line pb-3 text-ui-label font-semibold text-soft min-[760px]:grid">
            <span>When</span>
            <span>Say</span>
            <span>Not</span>
          </div>
          {[
            { when: 'Plain words', say: 'The land is 92% of the value.', not: 'This parcel exhibits a high land to improvement ratio.' },
            { when: 'Show the why', say: 'Bigger lot, value spread thin.', not: 'Below market.' },
            { when: 'Every number has a source', say: 'Values: Palm Beach County property records. Pulled Nov 4, 2026.', not: 'Estimated value: $5.9M' },
            { when: 'Never good or bad', say: 'Most lots around it are homes. This one is a place of worship.', not: 'A great neighborhood.' },
            { when: 'No noise', say: 'We have no record for this lot yet. It may be newer than our last pull.', not: 'Oops! No data found.' },
          ].map((v) => (
            <div key={v.when} className="grid gap-2 border-b border-line py-4 min-[760px]:grid-cols-[1fr_1.4fr_1.4fr] min-[760px]:gap-6">
              <span className="text-ui-body font-bold">{v.when}</span>
              <span className="text-ui-body font-medium">
                <span className="text-soft min-[760px]:hidden">Say </span>
                {v.say}
              </span>
              <span className="text-ui-body font-medium text-soft">
                <span className="min-[760px]:hidden">Not </span>
                <span className="line-through decoration-soft/60">{v.not}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={SECTION} aria-labelledby="board">
        <h2 id="board" className={H2}>The board, everywhere.</h2>
        <p className={`${LEAD} mt-4`}>The real downtown, from the map’s own tiles, cut to each network’s size.</p>
        <div className="mt-10 grid gap-x-6 gap-y-8 min-[760px]:grid-cols-2">
          {social
            .filter((s) => s.w / s.h > 1.5)
            .map((s) => (
              <Banner key={s.file} {...s} />
            ))}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 min-[760px]:grid-cols-4">
          {social
            .filter((s) => s.w / s.h <= 1.5)
            .map((s) => (
              <Banner key={s.file} {...s} />
            ))}
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-line py-16">
        <p className="max-w-[60ch] text-ui-small font-medium text-soft">
          Drawn again on every build. kit.json lists each file with its checksum. Truffle is by Sami Kirberg.
        </p>
        <p className="flex flex-wrap gap-x-6">
          <a className={LINK} href={`${KIT}/kit.zip`} download>Download the kit</a>
          <a className={LINK} href={`${KIT}/kit.json`}>kit.json</a>
          <Link className={LINK} href="/built">How it’s built</Link>
          <Link className={LINK} href="/">Back to the map</Link>
        </p>
      </footer>
    </main>
  )
}

function Banner({ file, name, w, h }: { file: string; name: string; w: number; h: number }) {
  return (
    <figure className="m-0 flex flex-col gap-2">
      <a href={`${KIT}/social/${file}`} className="block overflow-hidden rounded-md shadow-outline">
        <img src={`${KIT}/social/${file}`} alt={`${name} banner, ${w} by ${h}`} width={w} height={h} className="block h-auto w-full" loading="lazy" />
      </a>
      <figcaption className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-ui-small font-bold">{name}</span>
        <span className="text-ui-label font-medium text-soft">
          {w} by {h}
        </span>
      </figcaption>
    </figure>
  )
}
