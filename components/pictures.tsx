// Pictures in place of sentences. Each one draws a number the way the map draws it, so the panel reads like
// the city it sits on: a lot is a tile, its height is its value per acre, its footprint is its size, its color
// is its use, and truffle brown is the lot you picked. Every picture carries its sentence for screen readers,
// and the panel keeps the sentence one tap away, the way The Pudding sets "Text description" under a graphic.
import { heightM, money } from '@/lib/numbers'
import { color, useSides, type UseKey } from '@/lib/tokens'

export type Faces = readonly [top: string, left: string, right: string]
const PICKED: Faces = [color.truffle, color.truffleSide, color.truffle]
const COS = 0.866

/** One tile as the map draws it, seen from the same side: a square footprint s px across and h px tall, its
 * front corner standing on the ground line at (cx, base). Light from the upper left shades the sides. */
export function Tile({ cx, base, s, h, faces }: { cx: number; base: number; s: number; h: number; faces: Faces }) {
  const at = (x: number, y: number, z: number) => `${(cx + (x - y) * COS).toFixed(1)},${(base - s + (x + y) / 2 - z).toFixed(1)}`
  const edge = { stroke: color.card, strokeWidth: 0.75, strokeLinejoin: 'round' as const }
  return (
    <g>
      <polygon points={[at(0, s, 0), at(s, s, 0), at(s, s, h), at(0, s, h)].join(' ')} fill={faces[1]} {...edge} />
      <polygon points={[at(s, 0, 0), at(s, s, 0), at(s, s, h), at(s, 0, h)].join(' ')} fill={faces[2]} {...edge} />
      <polygon points={[at(0, 0, h), at(s, 0, h), at(s, s, h), at(0, s, h)].join(' ')} fill={faces[0]} {...edge} />
    </g>
  )
}

const W = 320
const H = 100
const BASE = H - 4
const W_MAX = 96
const W_MIN = 16
const H_MAX = 84
/** The lid and the side are a fixed sliver, so a wide tile never looks taller than it is. */
const LID = { dx: 12, dy: 8 }

/** A tile seen from the front with a sliver of its top and side, the way a skyline is drawn: its front is w px
 * wide and h px tall, standing on the ground line at the middle cx. Its height reads straight off its front. */
function Block({ cx, base, w, h, faces }: { cx: number; base: number; w: number; h: number; faces: Faces }) {
  const x0 = cx - w / 2 - LID.dx / 2
  const x1 = x0 + w
  const top = base - h
  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const edge = { stroke: color.card, strokeWidth: 0.75, strokeLinejoin: 'round' as const }
  return (
    <g>
      <polygon points={pts([[x1, base], [x1 + LID.dx, base - LID.dy], [x1 + LID.dx, top - LID.dy], [x1, top]])} fill={faces[2]} {...edge} />
      <polygon points={pts([[x0, top], [x1, top], [x1 + LID.dx, top - LID.dy], [x0 + LID.dx, top - LID.dy]])} fill={faces[0]} {...edge} />
      <rect x={x0} y={top} width={w} height={h} fill={faces[1]} {...edge} />
    </g>
  )
}

/**
 * The answer as a picture: the lot you called beside the typical lot within a few blocks, drawn the way the map
 * draws them. Heights are value per acre (the map's own formula), widths are the side of each lot's ground to
 * scale, the typical one wears the use most lots around it have, and a dashed line runs at its height, the
 * level the map draws over the block. A big lot worth less stands wide and low; a small one worth more, narrow
 * and tall.
 */
export function Duo({ vpa, acres, median, typicalAcres, typicalUse, label }: { vpa: number; acres: number; median: number; typicalAcres: number | null; typicalUse: UseKey | null; label: string }) {
  const sized = typicalAcres !== null && typicalAcres > 0 && acres > 0
  const big = sized ? Math.max(acres, typicalAcres) : 1
  const wide = (a: number) => (sized ? Math.max(W_MIN, W_MAX * Math.sqrt(a / big)) : 56)
  const k = H_MAX / Math.max(heightM(vpa), heightM(median))
  const mine = { w: wide(acres), h: heightM(vpa) * k }
  const theirs = { w: wide(typicalAcres ?? 0), h: heightM(median) * k }
  const level = BASE - theirs.h
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
        <line x1="8" x2={W - 8} y1={BASE + 0.5} y2={BASE + 0.5} stroke={color.line} strokeWidth="1" />
        <Block cx={W / 4} base={BASE} w={mine.w} h={mine.h} faces={PICKED} />
        <Block cx={(3 * W) / 4} base={BASE} w={theirs.w} h={theirs.h} faces={useSides[typicalUse ?? 'other']} />
        {/* The level: the typical lot's height, across both. */}
        <line x1="8" x2={W - 8} y1={level} y2={level} stroke={color.soft} strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>
      <div className="grid grid-cols-2 text-center" aria-hidden="true">
        <p className="m-0 flex flex-col">
          <span className="text-ui-body font-extrabold" data-testid="lot-value">
            {money(vpa)}
            <span className="text-ui-small font-semibold text-soft"> an acre</span>
          </span>
          {sized && <span className="text-ui-small font-semibold text-soft">{acresShort(acres)}</span>}
        </p>
        <p className="m-0 flex flex-col">
          <span className="text-ui-body font-extrabold text-soft">
            {money(median)}
            <span className="text-ui-small font-semibold"> typical</span>
          </span>
          {sized && <span className="text-ui-small font-semibold text-soft">{acresShort(typicalAcres!)}</span>}
        </p>
      </div>
    </figure>
  )
}

/** 0.41 ac, 2.5 ac, 12 ac. */
export function acresShort(a: number): string {
  const n = a >= 10 ? String(Math.round(a)) : a >= 1 ? a.toFixed(1).replace(/\.0$/, '') : a.toFixed(2).replace(/0$/, '')
  return `${n} ac`
}

/** The record as a row of tiles, one per call, latest last: truffle when you called it, an empty outline when
 * you didn't, the way Wordle's share is a row of squares. The count sits beside it. */
export function RecordTiles({ called, right, recent }: { called: number; right: number; recent: boolean[] }) {
  return (
    <p className="m-0 flex items-center gap-2 text-ui-small font-semibold text-soft" data-testid="record">
      <span className="flex gap-1" aria-hidden="true" data-marks>
        {recent.map((ok, i) => (
          <i key={i} className={`block size-3 rounded-[4px] ${ok ? 'bg-truffle' : 'shadow-[inset_0_0_0_1.5px_var(--role-state-missed)]'}`} />
        ))}
      </span>
      <span>
        <span className="font-extrabold text-truffle">
          {right} of {called}
        </span>
        <span className="sr-only"> called right</span>
      </span>
    </p>
  )
}

/** Land against building as one bar: how much of the value is the ground itself. */
export function SplitBar({ land, building, thing, label }: { land: number; building: number; thing: string; label: string }) {
  const pct = land + building > 0 ? (100 * land) / (land + Math.max(0, building)) : 0
  const share = pct >= 99.5 && building > 0 ? 'Nearly all' : `${Math.round(pct)}%`
  return (
    <div className="flex flex-col gap-2" role="img" aria-label={label}>
      <div className="flex items-baseline justify-between gap-3 text-ui-small font-semibold" aria-hidden="true">
        <span>
          Land <b className="font-extrabold">{share}</b>
        </span>
        <span className="text-soft">
          {thing} <b className="font-extrabold">{money(building)}</b>
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true" data-marks>
        <span className="h-3 bg-truffle" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  )
}

/** How far a 10-minute walk reaches, on a track against the typical lot's reach: a dot and a tick. */
export function Reach({ km, typical, label }: { km: number; typical: number; label: string }) {
  const top = Math.max(km, typical) * 1.15
  const at = (v: number) => `${(100 * v) / top}%`
  return (
    <div className="flex flex-col gap-2" role="img" aria-label={label}>
      <div className="flex items-baseline justify-between gap-3 text-ui-small font-semibold" aria-hidden="true">
        <span>
          <WalkIcon /> <b className="font-extrabold">{km.toFixed(1)} km</b> in 10 min
        </span>
        <span className="text-soft">
          typical <b className="font-extrabold">{Math.round(typical)}</b>
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-paper" aria-hidden="true" data-marks>
        <span className="absolute inset-y-0 left-0 rounded-full bg-line" style={{ width: at(typical) }} />
        <span className="absolute top-0 size-3 -translate-x-1/2 rounded-full bg-truffle shadow-[0_0_0_2px_var(--role-surface-raised)]" style={{ left: at(km) }} />
      </div>
    </div>
  )
}

const WalkIcon = () => (
  <svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" className="-mt-1 inline-block align-middle" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="2.2" r="1.6" fill="currentColor" stroke="none" />
    <path d="M6.5 5.5 5 10l-2.5 5M6.5 5.5l2 3.5 2.5 1M5 10l3 2 1 3.5M6.5 5.5 3.5 7 2.5 9.5" />
  </svg>
)

/** The colors as tiles: one small tile per use with its one word, the key to the board. */
export function UseTiles({ items, flat }: { items: { key: UseKey; label: string }[]; flat?: { label: string } }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-2 text-ui-small font-semibold">
          <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden="true">
            <Tile cx={14} base={26} s={13} h={8} faces={useSides[it.key]} />
          </svg>
          {it.label}
        </li>
      ))}
      {flat && (
        <li className="flex items-center gap-2 text-ui-small font-semibold text-soft">
          <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden="true">
            <Tile cx={14} base={26} s={13} h={1.5} faces={useSides.vacant} />
          </svg>
          {flat.label}
        </li>
      )}
    </ul>
  )
}

/** Height means value: a row of tiles rising from a low value to a high one, labeled at the ends. */
export function HeightKey({ low, high }: { low: number; high: number }) {
  const steps = [low, (2 * low + high) / 3, (low + 2 * high) / 3, high]
  const k = 40 / heightM(high)
  return (
    <figure className="m-0 flex items-end gap-3" role="img" aria-label={`Taller means worth more per acre: ${money(low)} an acre stands low, ${money(high)} an acre stands tall.`}>
      <span className="text-ui-small font-semibold text-soft" aria-hidden="true">
        {money(low)}
      </span>
      <svg viewBox="0 0 120 56" width="120" height="56" aria-hidden="true">
        {steps.map((v, i) => (
          <Tile key={i} cx={16 + i * 29} base={54} s={13} h={heightM(v) * k} faces={useSides.other} />
        ))}
      </svg>
      <span className="text-ui-small font-semibold" aria-hidden="true">
        {money(high)} <span className="text-soft">an acre</span>
      </span>
    </figure>
  )
}

/** A count as a bar beside its name: the bars carry the proportions the numbers would otherwise have to. */
export function CountBar({ n, max, fill }: { n: number; max: number; fill: string }) {
  return (
    <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-paper" aria-hidden="true" data-marks>
      <span className="h-2 rounded-full" style={{ width: `${n > 0 ? Math.max(3, (100 * n) / max) : 0}%`, background: fill }} />
    </span>
  )
}
