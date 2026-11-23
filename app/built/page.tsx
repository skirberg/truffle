/* eslint-disable @next/next/no-img-element -- the wordmark and the board picture, plain images as /brand sets them */
import type { Metadata } from 'next'
import Link from 'next/link'
import nextPkg from 'next/package.json'
import reactPkg from 'react/package.json'
import maplibrePkg from 'maplibre-gl/package.json'
import pmtilesPkg from 'pmtiles/package.json'
import tailwindPkg from 'tailwindcss/package.json'
import baseUiPkg from '@base-ui/react/package.json'
import typescriptPkg from 'typescript/package.json'
import { Tile, UseTiles, type Faces } from '@/components/pictures'
import { getLot, getSummary } from '@/lib/store'
import { count, day, heightM, money } from '@/lib/numbers'
import { color, useLegend, useSides } from '@/lib/tokens'
import { QA_WIDTHS, TRACE_LOT, qaHeight } from '@/lib/built'

export const metadata: Metadata = {
  title: 'How it’s built',
  description: 'How Truffle turns the county’s records into a map of tiles: the stack and why, where every number comes from, how the map is drawn, how it’s checked and what it keeps.',
  alternates: { canonical: '/built' },
}

// Set like /brand, shorter: a heading per section, then the pictures and a few labeled facts, no paragraphs.
// Every number is read from the records or the installed packages at build,
// so the page can't name a version or a date the site no longer has.

const H2 = 'text-fluid-heading font-extrabold leading-[1.08] tracking-[-0.03em] text-balance'
const LINK = 'inline-flex min-h-11 items-center text-ui-small font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-truffle'
const SECTION = 'border-t border-line py-12 min-[760px]:py-16'

/** "16.4" from "16.4.6": the line a package is on, read from what's installed. */
const v = (pkg: { version: string }) => pkg.version.split('.').slice(0, 2).join('.')

/** Chosen, then left out (struck through): one line each, the thing and why. */
const STACK: { what: string; why: string; out?: true }[] = [
  { what: `Next.js ${v(nextPkg)}`, why: 'A page for each of 480,854 lots' },
  { what: `MapLibre GL JS ${v(maplibrePkg)}`, why: 'The 3D board, no key' },
  { what: `PMTiles ${v(pmtilesPkg)} on Vercel Blob`, why: 'Every lot in one file' },
  { what: 'Postgres and PostGIS on Neon', why: 'Address search' },
  { what: 'Python 3.12 on a GitHub Action', why: 'The data pull' },
  { what: `React ${v(reactPkg)}, TypeScript ${v(typescriptPkg)}, Tailwind CSS ${v(tailwindPkg)}, Base UI ${v(baseUiPkg)}`, why: 'The interface, all tokens' },
  { what: 'next/og', why: 'Share cards' },
  { what: 'Gabarito', why: 'One font, page to map labels' },
  { what: 'A component kit', why: 'Off brand', out: true },
  { what: 'A tile server', why: 'One file instead', out: true },
  { what: 'A hosted basemap', why: 'Drawn from its own data', out: true },
  { what: 'Accounts', why: 'Nothing to sign in to', out: true },
  { what: 'A static export', why: 'Can’t hold every lot', out: true },
]

const ORDER = ['parcels', 'parcels_florida', 'zoning_boca', 'zoning_county', 'streets']
const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length)
/** What a source's rows are. */
const UNIT: Record<string, string> = { zoning_boca: 'districts', zoning_county: 'districts' }

const CHECKS: [string, string][] = [
  ['Every page', 'Accessibility, tap targets, no sideways scroll'],
  ['The map', 'Really drawn, colors counted'],
  ['Contrast', 'WCAG AA, every pair'],
  ['Numbers', 'The test lot, every run'],
  ['Brand', 'Byte for byte'],
  ['When', 'Every pull request'],
]

// The pull's own privacy test holds the second list out of the request.
const ASKED = ['Parcel number', 'Address', 'Town', 'Acres', 'Land value', 'Building value', 'Use', 'Condo', 'Year added', 'Neighborhood']
const NEVER = ['Owner names', 'Mailing addresses', 'Homestead', 'Exemptions', 'Sales']

const PICKED: Faces = [color.truffle, color.truffleSide, color.truffle]
const FOG: Faces = [color.line, color.line, color.line]
/** Where height tops out: the value per acre that stands 60 m, solved from the map's own formula. */
const TOP = 16_000_000 * ((60 - 3) / 46) ** 2

export default async function Built() {
  const [lot, summary] = await Promise.all([getLot(TRACE_LOT), getSummary()])
  // Every source the last pull recorded, in the order a panel's source line names them.
  const pulls = [...summary.pulls].sort((a, b) => rank(a.key) - rank(b.key))
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 min-[760px]:px-12">
      <section className="flex flex-col gap-6 pt-12 pb-12 min-[760px]:gap-8 min-[760px]:pt-16 min-[760px]:pb-16">
        <Link href="/" className="self-start" aria-label="Truffle, back to the map">
          <img src="/wordmark.svg" alt="" width={120} height={36} className="block h-9 w-auto" />
        </Link>
        <h1 className="text-fluid-display font-extrabold leading-none tracking-[-0.035em]">How it’s built.</h1>
        <img
          src="/built-board.webp"
          alt="Downtown Boca Raton: on the left the lots lie flat, outlines from the county’s records; on the right they stand as tiles at their land value per acre in the colors of their use, with Mizner Plaza in truffle brown where they turn."
          width={1200}
          height={630}
          fetchPriority="high"
          className="block h-auto w-full rounded-lg shadow-edge-faint"
        />
      </section>

      {lot && lot.vpa > 0 && (
        <section className={SECTION} aria-labelledby="trace">
          <h2 id="trace" className={H2}>
            One lot, start to finish.
          </h2>
          <ol className="mt-8 grid list-none grid-cols-4 gap-3 p-0 min-[760px]:gap-6" aria-label={lot.name ?? lot.address ?? 'The lot'}>
            <Step faces={FOG} h={1} n={money(lot.land)} label={`land, ${lot.acres} acres`} />
            <Step faces={FOG} h={1} n={money(lot.vpa)} label="an acre" />
            <Step faces={useSides[lot.use]} h={heightM(lot.vpa)} n={`${heightM(lot.vpa).toFixed(1)} m`} label="tall" />
            <Step faces={PICKED} h={heightM(lot.vpa)} n="Tap it" label={lot.name ?? 'the lot'} href={`/lot/${lot.id}`} />
          </ol>
        </section>
      )}

      <section className={SECTION} aria-labelledby="board">
        <h2 id="board" className={H2}>
          Every lot is a tile.
        </h2>
        <HeightScale />
        <Facts>
          <Fact k="Height">Land value per acre, by its square root, up to 60 m</Fact>
          <Fact k="Color">
            <UseTiles items={useLegend} />
          </Fact>
          <Fact k="Streets">The gaps between lots</Fact>
        </Facts>
      </section>

      <section className={SECTION} aria-labelledby="stack">
        <h2 id="stack" className={H2}>
          Chosen for this product.
        </h2>
        <dl className="m-0 mt-8">
          {STACK.map((s) => (
            <div key={s.what} className="grid grid-cols-2 gap-x-4 border-b border-line py-3 min-[760px]:grid-cols-[2fr_3fr]">
              <dt className={`text-ui-small font-bold min-[760px]:text-ui-body ${s.out ? 'text-soft line-through decoration-soft/60' : ''}`}>{s.what}</dt>
              <dd className="m-0 text-ui-small font-medium text-soft min-[760px]:text-ui-body">{s.why}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={SECTION} aria-labelledby="sources">
        <h2 id="sources" className={H2}>
          Every number has a source.
        </h2>
        <dl className="m-0 mt-8">
          {pulls.map((p) => (
            <div key={p.key} className="grid grid-cols-[3fr_2fr] items-center gap-x-4 border-b border-line py-2 min-[760px]:grid-cols-[2fr_1fr_1fr]">
              <dt className="text-ui-small font-bold min-[760px]:text-ui-body">
                <a className="inline-block py-1 underline decoration-line decoration-2 underline-offset-4 hover:decoration-truffle" href={p.url}>
                  {p.name}
                </a>
              </dt>
              <dd className="m-0 hidden text-ui-small font-medium text-soft min-[760px]:block">{p.rows ? `${count(p.rows)} ${UNIT[p.key] ?? 'records'}` : ''}</dd>
              <dd className="m-0 text-ui-small font-semibold">Pulled {day(p.pulled)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={SECTION} aria-labelledby="checks">
        <h2 id="checks" className={H2}>
          Checked before it ships.
        </h2>
        <Widths />
        <Facts>
          {CHECKS.map(([k, what]) => (
            <Fact key={k} k={k}>
              {what}
            </Fact>
          ))}
        </Facts>
      </section>

      <section className={SECTION} aria-labelledby="keeps">
        <h2 id="keeps" className={H2}>
          What it keeps.
        </h2>
        <p className="mt-4 text-ui-body font-medium text-soft">No accounts, no cookies, and your calls stay in your browser.</p>
        <div className="mt-8 grid gap-8 min-[760px]:grid-cols-2">
          <FieldList title="Asked of the county" fields={ASKED} />
          <FieldList title="Never asked" fields={NEVER} struck />
        </div>
      </section>

      <footer className="flex flex-col gap-2 border-t border-line py-12">
        <p className="text-ui-small font-medium text-soft">Truffle is by Sami Kirberg.</p>
        <p className="flex flex-wrap gap-x-6">
          <Link className={LINK} href="/brand">
            Brand kit
          </Link>
          <Link className={LINK} href="/">
            Back to the map
          </Link>
        </p>
      </footer>
    </main>
  )
}

/** Labeled facts: a short label, then the fact, one hairline row each. */
function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="m-0 mt-8">{children}</dl>
}
function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-4 border-b border-line py-3 min-[760px]:grid-cols-[2fr_3fr]">
      <dt className="text-ui-small font-semibold text-soft">{k}</dt>
      <dd className="m-0 text-ui-small font-semibold min-[760px]:text-ui-body">{children}</dd>
    </div>
  )
}

function FieldList({ title, fields, struck = false }: { title: string; fields: string[]; struck?: boolean }) {
  return (
    <div>
      <h3 className="text-ui-small font-semibold text-soft">{title}</h3>
      <ul className="mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {fields.map((f) => (
          <li key={f} className={`text-ui-body font-semibold ${struck ? 'text-soft line-through decoration-soft/60' : ''}`}>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One step of the lot's way to the map: its tile as it stands at that step, its number and a word or two. */
function Step({ faces, h, n, label, href }: { faces: Faces; h: number; n: string; label: string; href?: string }) {
  const body = (
    <>
      <svg viewBox="0 0 120 112" className="block h-auto w-full max-w-[160px]" aria-hidden="true" data-marks>
        <line x1="4" x2="116" y1="108.5" y2="108.5" stroke={color.line} strokeWidth="1" />
        <Tile cx={60} base={108} s={34} h={h * 1.2} faces={faces} />
      </svg>
      <span className="mt-2 text-ui-body font-extrabold min-[760px]:text-ui-title min-[760px]:tracking-title">{n}</span>
      <span className="text-ui-label font-medium text-soft min-[760px]:text-ui-small">{label}</span>
    </>
  )
  return (
    <li className="min-w-0">
      {href ? (
        <Link href={href} className="flex flex-col underline-offset-4 hover:underline">
          {body}
        </Link>
      ) : (
        <div className="flex flex-col">{body}</div>
      )}
    </li>
  )
}

/** Height means value: the map's own formula, a tile at each doubling and one at the top of the scale. */
function HeightScale() {
  const steps = [1e6, 2e6, 4e6, 8e6, 16e6, TOP]
  return (
    <div className="mt-8 grid grid-cols-6 gap-2 min-[760px]:max-w-[640px]" role="img" aria-label={`How tall a tile stands: ${steps.map((s) => `${money(s)} an acre, ${heightM(s).toFixed(0)} m`).join('; ')}. It stops at 60 m.`}>
      {steps.map((s) => (
        <div key={s} className="flex flex-col items-center" aria-hidden="true">
          <svg viewBox="0 0 48 112" className="block h-auto w-full max-w-[64px]" data-marks>
            <line x1="0" x2="48" y1="108.5" y2="108.5" stroke={color.line} strokeWidth="1" />
            <Tile cx={24} base={108} s={14} h={heightM(s) * 1.4} faces={useSides.other} />
          </svg>
          <span className="mt-2 text-ui-small font-bold">{money(s)}</span>
          <span className="text-ui-label font-medium text-soft">{heightM(s).toFixed(0)} m</span>
        </div>
      ))}
    </div>
  )
}

/** The widths every page is opened at, drawn to scale side by side: a phone with its sheet, a desktop with its card. */
function Widths() {
  return (
    <div className="mt-8 flex items-end gap-2 [--k:0.055] min-[760px]:gap-6 min-[760px]:[--k:0.16]" role="img" aria-label={`Every page is opened at ${QA_WIDTHS.join(', ')} px wide.`}>
      {QA_WIDTHS.map((w) => {
        const h = qaHeight(w)
        const phone = w < 760
        return (
          <div key={w} className="flex min-w-8 flex-col items-center gap-2" aria-hidden="true">
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: `calc(${w}px * var(--k))` }} className="block h-auto overflow-visible" data-marks>
              <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={phone ? 40 : 16} fill={color.card} stroke={color.soft} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {phone ? <rect x="0" y={h / 2} width={w} height={h / 2} rx="24" fill={color.line} /> : <rect x={w - 24 - 384} y="24" width="384" height={h * 0.6} rx="24" fill={color.line} />}
            </svg>
            <span className="text-ui-label font-semibold">{w}</span>
          </div>
        )
      })}
    </div>
  )
}
