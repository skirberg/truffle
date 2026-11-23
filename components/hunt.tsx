'use client'

import { money } from '@/lib/numbers'
import { lotTitle, reasons, whatItIs, type Typical } from '@/lib/copy'
import { compareLine, townWords } from '@/lib/challenge'
import type { Lot } from '@/lib/types'
import type { PanelState } from './panel'
import { ShareIcon } from './card'
import { Duo, RecordTiles, acresShort } from './pictures'

/** What the footer says once the line and the link are on the clipboard (the button itself says "Copied"). */
export const COPIED = 'Copied. Paste it to a friend.'

/** What the lot is, as a label: "Place of worship", not "A place of worship". */
function kindOf(lot: Lot) {
  const w = whatItIs(lot)
  if (!w) return null
  const bare = w.replace(/^(a|an) /i, '')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

/** Up or down, drawn on the answers: more stands taller on the map, less lower. */
const Arrow = ({ up }: { up: boolean }) => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? 'M7 12V2M2.5 6.5L7 2l4.5 4.5' : 'M7 2v10M2.5 7.5L7 12l4.5-4.5'} />
  </svg>
)

// The front door: "Call it, then see why." The city stands lit, every lot at its height, and one lot lies
// under fog. You make your call on it on gut, before doing the math; then it rises to its height and the
// panel says why. Laid out on the 4 px grid: a 13/16 label over a 28/32 title, sections 24 apart, 56 px
// answers in two columns 12 apart, a footer under a hairline.

export type Call = {
  /** The call: worth more per acre than the lots around it. */
  more: boolean
  /** null when there was nothing around it to compare with. */
  right: boolean | null
  /** Middle of the lots within a few blocks, dollars an acre. */
  median: number | null
  /** Why it stands above or below them, from the records around it: undefined while they load, null when
   * there was nothing to compare. */
  why?: string | null
  /** The same reason in a few words, under the picture. */
  short?: string | null
  /** The typical lot around it, drawn beside this one. */
  typical?: Typical | null
}

type Props = {
  state: PanelState
  call: Call | null
  record: { called: number; right: number; recent: boolean[] }
  /** The day's number when this is a day's lot: "Lot No. 12". */
  number: number | null
  /** The first call of the visit, where the name says what it means. */
  first: boolean
  /** A friend's call on this lot, from the link they sent; shown only once yours is made. */
  theirs: boolean | null
  /** Send the lot to a friend: the share sheet, or the link and result line copied. Null for a lot with no
   * record (the state roll), which a link can't open. */
  onShare: (() => void) | null
  /** What the share did, said once ("Copied. Paste it to a friend."). */
  shared: string | null
  /** Address search, after a call: your own street is the next place to look. */
  search: React.ReactNode
  /** The source line for the answer's numbers: who they come from and the day they were pulled. */
  source: string
  onCall: (more: boolean) => void
  onNext: () => void
}

const LABEL = 'text-ui-label font-semibold text-soft'
const TITLE = 'text-ui-title font-extrabold tracking-[-0.02em] text-balance max-[759px]:text-ui-title-phone'

function Heading({ label, title, onClose, action, testId }: { label: string | null; title: string; onClose?: () => void; action?: React.ReactNode; testId?: string }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        {label && <p className={LABEL}>{label}</p>}
        <h1 className={TITLE} data-testid={testId}>
          {title}
        </h1>
      </div>
      {action}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="relative h-9 shrink-0 rounded-pill bg-paper px-4 text-ui-small font-bold text-soft after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] transition-[transform,color] duration-(--motion-tap) ease-out hover:text-truffle active:scale-[0.97]"
        >
          Skip
        </button>
      )}
    </header>
  )
}

// data-peek marks what the phone sheet's lowest stop must show in full: it ends 16 px under that block.
export function HuntBody({ state, call, record, number, first, theirs, onShare, shared, search, source, onCall, onNext }: Props) {
  if (state.kind === 'overview')
    return (
      <div className="flex flex-col gap-6" data-peek="">
        <div className="flex flex-col gap-4">
          <Heading label="Call it, then see why" title="Tap any lot to call it." />
        </div>
        {search}
        {record.called > 0 && <RecordTiles {...record} />}
      </div>
    )
  if (state.kind === 'loading') return <Heading label={null} title="Looking up this lot…" />
  if (state.kind === 'missing')
    return (
      <div className="flex flex-col gap-4" data-peek="">
        <Heading label={null} title="No record yet" onClose={onNext} />
        <p className="text-ui-body font-medium">We have no record for this lot yet. Try another one.</p>
      </div>
    )

  const lot = state.lot
  // "Lot No. 12 · Car dealer · Boca": the day's number first, then what it is and where, the way a local says it.
  const where = [number ? `Lot No. ${number}` : null, kindOf(lot), number ? townWords(lot) : lot.place].filter(Boolean).join(' · ')
  if (!(lot.vpa > 0))
    return (
      <div className="flex flex-col gap-4" data-peek="">
        <Heading label={where} title={lotTitle(lot)} onClose={onNext} />
        <p className="text-ui-body font-medium">The county puts no land value on this one, so there’s nothing to call. Try a lot next to it.</p>
      </div>
    )

  if (!call)
    return (
      <div className="flex flex-col gap-4" data-peek="">
        <Heading label={theirs === null ? where : `A friend called this one${number ? ` · Lot No. ${number}` : ''}`} title={lotTitle(lot)} onClose={onNext} />
        <div className="flex flex-col gap-4">
          <p className="text-ui-body font-semibold text-balance">Worth more or less per acre than its neighbors?</p>
          <div className="grid grid-cols-2 gap-3" data-testid="call">
            {([false, true] as const).map((more) => (
              <button
                key={String(more)}
                type="button"
                onClick={() => onCall(more)}
                aria-label={`${more ? 'More' : 'Less'} per acre than the lots around it`}
                className="flex h-14 items-center justify-center gap-2 rounded-md bg-truffle text-ui-body font-extrabold text-paper transition-transform duration-(--motion-tap) ease-out active:scale-[0.97]"
              >
                <Arrow up={more} />
                {more ? 'More' : 'Less'}
              </button>
            ))}
          </div>
          {/* The name, said once, where the first call is made. */}
          {first && (
            <p className="text-ui-label font-medium text-soft" data-testid="truffle-line">
              A truffle is value hidden underground. You find it by searching.
            </p>
          )}
        </div>
      </div>
    )

  const verdict = call.right === null ? 'Nothing around it to compare.' : call.right ? 'You called it.' : 'Not this one.'
  const copied = shared === COPIED
  const t = call.typical ?? null
  return (
    <div className="flex flex-col gap-6">
      {/* Next lot sits by the verdict, so it's in reach with the sheet at half and the lot still in view. */}
      <Heading
        // A friend's lot leads with the two calls side by side; the day's lot with its number.
        label={theirs !== null ? compareLine(call.more, theirs) : number ? `Lot No. ${number} · ${lotTitle(lot)}` : lotTitle(lot)}
        title={verdict}
        testId="verdict"
        action={
          <button
            type="button"
            onClick={onNext}
            className="h-12 shrink-0 rounded-md bg-truffle px-4 text-ui-small font-extrabold text-paper transition-transform duration-(--motion-tap) ease-out active:scale-[0.97]"
          >
            Next lot
          </button>
        }
      />
      {/* The answer as a picture: this lot beside the typical one around it, drawn as the map draws them. */}
      {call.median !== null ? (
        <Duo
          vpa={lot.vpa}
          acres={lot.acres}
          median={call.median}
          typicalAcres={t?.acres ?? null}
          typicalUse={t?.use ?? null}
          label={`This lot: ${money(lot.vpa)} an acre${t?.acres ? ` on ${acresShort(lot.acres).replace('ac', 'acres')}` : ''}. The typical lot around it: ${money(call.median)} an acre${t?.acres ? ` on ${acresShort(t.acres).replace('ac', 'acres')}` : ''}.`}
        />
      ) : (
        <p className="text-ui-title font-extrabold tracking-[-0.02em]" data-testid="lot-value">
          {money(lot.vpa)}
          <span className="text-ui-small font-semibold tracking-normal text-soft"> an acre</span>
        </p>
      )}
      <Why short={call.short ?? null} full={call.why === undefined ? undefined : (call.why ?? reasons(lot)[0] ?? null)} />
      <footer className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <RecordTiles {...record} />
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            data-testid="send"
            className="flex h-12 shrink-0 items-center gap-2 rounded-pill bg-paper px-4 text-ui-small font-bold text-truffle transition-transform duration-(--motion-tap) ease-out active:scale-[0.97]"
          >
            {copied ? <CheckIcon /> : <ShareIcon />}
            {copied ? 'Copied' : 'Send to a friend'}
          </button>
        )}
      </footer>
      {/* What went to the clipboard, read out once; shown only when it has to be copied by hand. */}
      <p role="status" className={shared && !copied ? '-mt-4 text-ui-small font-semibold text-soft' : 'sr-only'} data-testid="shared">
        {shared ?? ''}
      </p>
      {search}
      {/* Every panel ends with its source line (DESIGN.md, rule 2), the answer included. */}
      {source && (
        <p className="text-source font-medium leading-[1.35] text-faint" data-testid="source">
          {source}
        </p>
      )}
    </div>
  )
}

/** The reason: a few words under the picture, and the whole sentence a tap away. */
function Why({ short, full }: { short: string | null; full: string | null | undefined }) {
  // Held while the neighbors' records load, so the footer doesn't jump.
  if (full === undefined) return <p className="min-h-6" data-testid="reasons" />
  if (!short || !full) return <p className="text-ui-body font-medium" data-testid="reasons">{full ?? short}</p>
  return (
    <details className="group -my-1">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 py-1 text-ui-body font-semibold [&::-webkit-details-marker]:hidden">
        {short}
        <Chevron />
      </summary>
      <p className="mt-2 text-ui-body font-medium text-soft" data-testid="reasons">
        {full}
      </p>
    </details>
  )
}

/** Down, and up once open: the sentence is under it. */
export const Chevron = () => (
  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-soft">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-(--motion-settle) group-open:rotate-180">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  </span>
)

const CheckIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
)
