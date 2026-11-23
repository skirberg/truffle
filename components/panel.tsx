'use client'

import { useState } from 'react'
import Link from 'next/link'
import { familyOf, useLegend, zoningColor, zoningFamilies, type ZoningKey } from '@/lib/tokens'
import { count, money } from '@/lib/numbers'
import { lotTitle, pulledWhen, reasons, sourceLine, sourcesFor, usedToday, whatItIs } from '@/lib/copy'
import type { Lot, Pull, Summary } from '@/lib/types'
import type { Mode } from './board'
import { Skyline } from './skyline'
import { CardHeader, CloseIcon, Group, RoundButton, Rows, ShareIcon } from './card'
import { Chevron } from './hunt'
import { CountBar, HeightKey, Reach, SplitBar, UseTiles } from './pictures'

export type PanelState =
  | { kind: 'overview' }
  | { kind: 'loading'; id: string }
  | { kind: 'lot'; lot: Lot; sharing: number | null }
  | { kind: 'missing'; id: string }

type Props = {
  mode: Mode
  state: PanelState
  summary: Summary
  mapFailed: boolean
  onBack: () => void
  /** A town picked from search: the overview and the way back name it instead of downtown. */
  where?: string | null
}

const back: Record<Mode, string> = { value: 'Downtown Boca Raton', rules: 'All rules', changing: 'West Boca' }
const closeLabel = (mode: Mode, where: string | null) => `Close, back to ${mode === 'value' && where ? where : back[mode]}`

export function PanelBody({ mode, state, summary, mapFailed, onBack, where = null }: Props) {
  return (
    <>
      {mapFailed && (
        <p className="rounded-2xl bg-paper px-4 py-3 text-ui-small font-medium">
          The map didn’t load on this device. The numbers still work: search an address above.
        </p>
      )}
      {state.kind === 'overview' ? (
        <Overview mode={mode} summary={summary} where={where} />
      ) : (
        <>
          {state.kind === 'loading' && (
            <CardHeader title="Looking up this lot…" lines={[]} actions={<RoundButton label={closeLabel(mode, where)} onClick={onBack}><CloseIcon /></RoundButton>} />
          )}
          {state.kind === 'missing' && (
            <>
              <CardHeader
                title="No record yet"
                lines={['We have no record for this lot yet. It may be newer than our last pull.']}
                actions={<RoundButton label={closeLabel(mode, where)} onClick={onBack}><CloseIcon /></RoundButton>}
              />
              <Source pulls={sourcesFor(null, summary.pulls).filter((p) => p.key === 'parcels')} />
            </>
          )}
          {state.kind === 'lot' && (
            <LotView mode={mode} lot={state.lot} sharing={state.sharing} summary={summary} close={<RoundButton label={closeLabel(mode, where)} onClick={onBack}><CloseIcon /></RoundButton>} />
          )}
        </>
      )}
    </>
  )
}

function Overview({ mode, summary, where }: { mode: Mode; summary: Summary; where: string | null }) {
  const src = (
    <>
      <Source pulls={sourcesFor(null, summary.pulls)} />
      <BrandLink />
    </>
  )
  // The key, drawn: tiles in the use colors, and tiles rising with value. The map itself says the rest.
  if (mode === 'value')
    return (
      <>
        <CardHeader title={where ?? 'Downtown Boca Raton'} lines={['Tap a lot to see why.']} />
        <HeightKey low={1_000_000} high={15_000_000} />
        <UseTiles items={useLegend} />
        {src}
      </>
    )
  if (mode === 'rules') {
    const fams = zoningFamilies.filter((f) => f.key !== 'none' && (summary.downtownFamilies[f.key] ?? 0) > 0)
    const rows = [...fams.map((f) => ({ key: f.key, name: f.name, n: summary.downtownFamilies[f.key] ?? 0 })), { key: 'none' as const, name: 'No zoning on record', n: summary.downtownFamilies.none ?? 0 }]
    const max = Math.max(1, ...rows.map((r) => r.n))
    // The families are named on the map where they are; here each one is its color, its name and a bar of how
    // many lots downtown it covers, the bars doing what a column of numbers would.
    return (
      <>
        <CardHeader title="What each lot may become" lines={[]} />
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Lots downtown by rule">
          {rows.map((r) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_96px_32px] items-center gap-3 py-2 text-ui-small font-semibold">
              <span className="flex min-w-0 items-center gap-2">
                <i aria-hidden="true" data-marks className="size-3 flex-none rounded-[4px] shadow-edge" style={{ background: zoningColor[r.key as ZoningKey] }} />
                {r.name}
              </span>
              <CountBar n={r.n} max={max} fill={zoningColor[r.key as ZoningKey]} />
              <b className="text-right font-semibold text-soft">{count(r.n)}</b>
            </li>
          ))}
        </ul>
        {src}
      </>
    )
  }
  // Changing: the count, and the key to the board: raised and colored since 2023, flat before. The map names
  // the land the new lots stand on.
  return (
    <>
      <CardHeader title="West Boca" lines={[]} />
      <p className="text-number font-extrabold leading-none tracking-number max-[759px]:text-number-phone">
        {count(summary.westNew)}
        <span className="text-ui-headline font-semibold tracking-normal text-soft"> new lots since 2023</span>
      </p>
      <UseTiles items={useLegend} flat={{ label: 'Before 2023' }} />
      <Source pulls={summary.pulls.filter((p) => p.key === 'parcels')} />
      <BrandLink />
    </>
  )
}

/** The panel's last line on the open map, where a site keeps its footer: the logo, colors and type to take away,
 * and how the site is made. */
function BrandLink() {
  const link = 'py-1 text-source leading-4 font-medium text-faint underline decoration-line underline-offset-2 hover:text-truffle'
  return (
    <p className="-mt-2 flex gap-4 self-start">
      <Link href="/brand" className={link}>
        Brand kit
      </Link>
      <Link href="/built" className={link}>
        How it’s built
      </Link>
    </p>
  )
}

function LotView({ mode, lot, sharing, summary, close }: { mode: Mode; lot: Lot; sharing: number | null; summary: Summary; close: React.ReactNode }) {
  const src = <Source pulls={sourcesFor(lot, summary.pulls)} />
  const actions = (
    <>
      <Share title={lotTitle(lot)} />
      {close}
    </>
  )
  if (mode === 'rules') {
    const fam = familyOf(lot.zfam)
    const named = fam && lot.zfam !== 'none'
    const code = lot.zoning?.replace('(city)', '').trim() ?? null
    const where = lot.area === 'downtown' ? 'downtown' : lot.area === 'west-boca' ? 'in West Boca' : `in ${lot.place}`
    return (
      <>
        <LotHeading lot={lot} actions={actions} />
        {/* The rule in its own color, then what it allows in a line: the heading already says what is there today. */}
        <div className="flex flex-col gap-2" data-testid="rule">
          <p className="flex items-center gap-3 text-title font-extrabold leading-[1.02] tracking-title text-balance max-[759px]:text-title-phone">
            <i aria-hidden="true" data-marks className="size-6 flex-none rounded-[8px] shadow-edge" style={{ background: zoningColor[(named ? lot.zfam : 'none') as ZoningKey] }} />
            {named ? fam.name : 'No zoning on record'}
          </p>
          {named && <p className="text-ui-body font-medium">{fam.line}</p>}
          {named && code && (
            <p className="text-ui-small font-semibold text-soft">
              Zone {code}
              {sharing !== null ? ` · ${count(sharing)} other lots ${where}` : ''}
            </p>
          )}
          {!whatItIs(lot) && <p className="text-ui-small font-semibold text-soft">{usedToday(lot)}</p>}
        </div>
        {src}
      </>
    )
  }
  if (mode === 'changing') {
    return (
      <>
        <CardHeader title={lot.address ?? 'No street address on record yet'} lines={[lot.neighborhood ?? 'No neighborhood on record']} actions={actions} />
        <p className="text-number font-extrabold leading-none tracking-number max-[759px]:text-number-phone">
          {lot.year_added || 'Unknown'}
          <span className="text-ui-headline font-semibold tracking-normal text-soft">
            {lot.year_added ? ' added to the county map' : ' year not on record'}
          </span>
        </p>
        <p className="text-ui-body font-medium">{usedToday(lot)}</p>
        <Source pulls={summary.pulls.filter((p) => p.key === 'parcels')} />
      </>
    )
  }
  const said = reasons(lot)
  return (
    <>
      <LotHeading lot={lot} actions={actions} />
      {lot.vpa > 0 ? (
        <p className="text-number font-extrabold leading-none tracking-number max-[759px]:text-number-phone" data-testid="lot-value">
          {money(lot.vpa)}
          <span className="text-ui-headline font-semibold tracking-normal text-soft"> an acre</span>
        </p>
      ) : (
        <p className="text-title font-extrabold leading-[1.02] tracking-title max-[759px]:text-title-phone">Not valued</p>
      )}
      {lot.vpa > 0 ? (
        <>
          {/* Why it's worth this, as pictures: where it stands among its set, how much is ground, how far a walk
              reaches, and its rule. Each carries its sentence for a screen reader; all four are a tap away below. */}
          <div className="flex flex-col divide-y divide-line">
            <Skyline lot={lot} label={said.find((r) => r.startsWith('Worth more per acre')) ?? null} />
            {(lot.land > 0 && lot.building > 0) || (lot.land > 0 && lot.building === 0) ? (
              <div className="py-4">
                <SplitBar land={lot.land} building={lot.building} thing={thingOf(lot)} label={said[0]!} />
              </div>
            ) : null}
            {lot.km !== null && lot.typical_km !== null && (
              <div className="py-4">
                <Reach km={lot.km} typical={lot.typical_km} label={said.find((r) => r.startsWith('A 10-minute walk')) ?? ''} />
              </div>
            )}
            <ZoneRow lot={lot} />
          </div>
          <details className="group">
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-ui-small font-bold text-soft [&::-webkit-details-marker]:hidden">
              In words
              <Chevron />
            </summary>
            <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-ui-body font-medium" data-testid="reasons">
              {said.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        // An unvalued lot has no worth to explain: its heading says what the rows are.
        <Group title="What the records say">
          <Rows items={said} testId="reasons" />
        </Group>
      )}
      {src}
    </>
  )
}

/** "house" only for a house: apartments, condos and townhouses count as homes but are buildings. */
function thingOf(lot: Lot) {
  return lot.use === 'homes' && /single|house|home/i.test(lot.use_text) && !/townhouse|condo|apartment|aged|nursing|retirement|boarding|multifamily/i.test(lot.use_text) ? 'House' : 'Building'
}

/** The lot's rule as its color and its name, the way Rules colors it on the map. */
function ZoneRow({ lot }: { lot: Lot }) {
  const fam = familyOf(lot.zfam)
  const named = fam && lot.zfam !== 'none'
  return (
    <p className="flex items-center gap-2 py-4 text-ui-small font-semibold">
      <i aria-hidden="true" data-marks className="size-3 flex-none rounded-[4px] shadow-edge" style={{ background: zoningColor[(named ? lot.zfam : 'none') as ZoningKey] }} />
      <span>
        <span className="text-soft">Zoned </span>
        {named ? fam.name : 'none on record'}
      </span>
    </p>
  )
}

/** The phone's own share sheet where there is one; elsewhere the link goes to the clipboard. */
function Share({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · Truffle`, url })
      } catch {
        // Closing the share sheet is not an error.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // No clipboard access: the address bar still has the link.
    }
  }
  return (
    <RoundButton label={copied ? 'Link copied' : 'Share this lot'} onClick={share}>
      {copied ? <span className="text-ui-tag font-bold text-truffle">Copied</span> : <ShareIcon />}
    </RoundButton>
  )
}

/** The lot's name when it has one, then its address and what it is: "Publix" / "1451 N Federal Hwy · A supermarket". */
function LotHeading({ lot, actions }: { lot: Lot; actions: React.ReactNode }) {
  const what = [whatItIs(lot), lot.built ? `built ${lot.built}` : null].filter(Boolean).join(', ') || null
  // Outside a town's limits the place line names the county, so a lot in Stuart or Bristol says where it is.
  const where = lot.area ? null : lot.place
  if (lot.name) return <CardHeader title={lot.name} lines={[[lot.address, what].filter(Boolean).join(' · '), where]} actions={actions} />
  // With no address the title already says what it is, so the line under it says the address is missing.
  if (!lot.address) return <CardHeader title={lotTitle(lot)} lines={[[lot.built ? `Built ${lot.built}` : null, 'No street address on record', where].filter(Boolean).join(' · ')]} actions={actions} />
  return <CardHeader title={lotTitle(lot)} lines={[[what, where].filter(Boolean).join(' · ')]} actions={actions} />
}

/** Every panel's sources and the day each was pulled (rule 2). One source reads as a line; several fold under
 * one line with the days they were pulled, the way a chart names its source in a line and keeps the detail a
 * tap away. */
function Source({ pulls }: { pulls: Pull[] }) {
  const text = sourceLine(pulls)
  if (!text) return null
  if (pulls.length <= 1)
    return (
      <p className="text-source font-medium leading-[1.35] text-faint" data-testid="source">
        {text}
      </p>
    )
  return (
    <details className="group text-source font-medium leading-[1.35] text-faint">
      <summary className="flex min-h-6 w-fit cursor-pointer list-none items-center gap-2 underline decoration-line underline-offset-2 hover:text-truffle [&::-webkit-details-marker]:hidden">
        Sources, pulled {pulledWhen(pulls)}
      </summary>
      <p className="mt-1" data-testid="source">
        {text}
      </p>
    </details>
  )
}
