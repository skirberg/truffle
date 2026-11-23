// The front door's lot picker: which lot comes up next to be called. Pure, so it can be tested: the map
// hands it the lots it has drawn, the records say which of its choices are real, and it prefers a lot a
// person can see and reason about over a sliver with an absurd number.

/** A lot as the tiles carry it: its middle, its number (millions an acre), its height and its shorter side in meters. */
export type TileLot = { id: string; at: [number, number]; n: number; h: number; size: number }
/** A candidate, with the middle value of the lots within a few blocks (millions an acre). */
export type Candidate = TileLot & { median: number | null }
/** What the records say about a candidate. What it is (use, the assessor's words, the kind and name from
 * OpenStreetMap) is optional: a record without it is judged on size and value alone. */
export type CallRecord = { id: string; vpa: number; acres: number; use?: string; use_text?: string; kind?: string | null; name?: string | null }
export type Camera = { bearing: number; pitch: number }

export const CALLABLE = {
  /** A tenth of an acre, about 400 square meters: under it a lot is a sliver beside its neighbors (the middle
   * downtown lot is 0.2 acres) and a small land value over a tiny area makes an absurd number per acre. */
  minAcres: 0.1,
  /** Past this it is a park, a campus or a golf course: its middle can fall outside it and it fills the screen. */
  maxAcres: 5,
  /** The shorter side of its outline, in meters: big enough to see and tap, small enough to fit the view. */
  minSpanM: 20,
  maxSpanM: 150,
  /** Under $500K an acre the land is nominal (a buffer, a retention pond). */
  minVpa: 500_000,
  /** Where the height scale tops out (60 m): above $24.6M an acre the map can't show the difference. */
  maxVpa: 16_000_000 * ((60 - 3) / 46) ** 2,
  /** Clearly above or below its neighbors, so the call isn't a coin toss, but not so far that it's a fluke. */
  minGap: 1.5,
  maxGap: 6,
  /** "Its neighbors" are the valued lots within a few blocks, and there have to be a few. */
  nearM: 350,
  minNeighbors: 6,
  /** A short walk from the last lot: not the next one over, not across town. */
  walkMinM: 120,
  walkMaxM: 900,
  /** Hidden means half or more of it lies behind taller lots, seen from the camera. */
  hidden: 0.5,
  /** How many the map hands over for the records to check. */
  shortlist: 12,
} as const

/** The lot to call lies flat under fog at this height (meters), so anything taller in front can hide it. */
const FLAT_M = 1.2

export function metersBetween(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * 111_320 * k, (b[1] - a[1]) * 110_540)
}

/**
 * The share of a flat lot that lies behind taller lots, seen from the camera: 0 in the open, 1 fully hidden.
 * A lot h meters tall hides the ground behind it for h / tan(the camera's angle above the ground) meters.
 */
export function hiddenShare(c: TileLot, lots: TileLot[], cam: Camera): number {
  const b = (cam.bearing * Math.PI) / 180
  // From the lot toward the camera, in meters east and north: the camera looks along the bearing.
  const e = -Math.sin(b), n = -Math.cos(b)
  const tan = Math.tan(((90 - cam.pitch) * Math.PI) / 180)
  if (!(tan > 0) || !(c.size > 0)) return 0
  const k = Math.cos((c.at[1] * Math.PI) / 180)
  let worst = 0
  for (const q of lots) {
    if (q.id === c.id || !(q.h > FLAT_M)) continue
    const dx = (q.at[0] - c.at[0]) * 111_320 * k, dy = (q.at[1] - c.at[1]) * 110_540
    const along = dx * e + dy * n
    if (along <= 0) continue // behind it, or beside it
    const reachOf = (q.size + c.size) / 2
    if (Math.abs(dx * n - dy * e) > reachOf) continue // off to one side
    // Open ground between the back of the taller lot and the near edge of this one.
    const open = Math.max(0, along - reachOf)
    const shadow = (q.h - FLAT_M) / tan - open
    if (shadow > 0) worst = Math.max(worst, Math.min(1, shadow / c.size))
    if (worst >= 1) break
  }
  return worst
}

const middle = (sorted: number[]) => (sorted.length % 2 ? sorted[sorted.length >> 1]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2)

/** Is a ratio between two values per acre a clear gap, and a sane one? */
export function gapOf(v: number, median: number): 'clear' | 'close' | 'absurd' {
  const r = Math.abs(Math.log(v / median))
  if (r > Math.log(CALLABLE.maxGap)) return 'absurd'
  return r >= Math.log(CALLABLE.minGap) ? 'clear' : 'close'
}

/**
 * From the lots the map has drawn, the ones worth calling next, best first: a short walk away, big enough to
 * see, in a sane value range, clearly above or below their neighbors, and in the open rather than behind a
 * taller lot. Lots that fail size or value never make the list; a lot hidden behind its neighbors or close to
 * them in value only comes after every better one.
 *
 * `prefer` keeps the game honest. The lots in the open are mostly big ones worth less per acre than the
 * houses around them, so left alone the answer would nearly always be Less. The caller asks for the other
 * answer than the last lot's, and lots on that side of their neighbors come first, in the open before hidden.
 */
export function rankCandidates(
  lots: TileLot[],
  here: [number, number],
  skip: Set<string>,
  cam: Camera,
  random: () => number = Math.random,
  prefer: 'more' | 'less' | null = null,
): Candidate[] {
  const C = CALLABLE
  // A lot in several pieces carries "-2" and on after its id: a piece is not the lot.
  const pool = lots.filter((l) => l.n * 1e6 >= C.minVpa && l.n * 1e6 <= C.maxVpa && l.size >= C.minSpanM && l.size <= C.maxSpanM && !l.id.includes('-') && !skip.has(l.id))
  const walk = pool.filter((l) => {
    const d = metersBetween(here, l.at)
    return d > C.walkMinM && d < C.walkMaxM
  })
  const from = (walk.length ? walk : pool).map((l) => ({ l, r: random() })).sort((a, b) => a.r - b.r).slice(0, 60).map((x) => x.l)
  const valued = lots.filter((l) => l.n > 0)
  // Clear and on the side asked for (open, hidden), clear on the other side (open, hidden), close (open, hidden).
  const tiers: Candidate[][] = [[], [], [], [], [], []]
  for (const c of from) {
    const around = valued.filter((l) => l.id !== c.id && metersBetween(c.at, l.at) <= C.nearM)
    if (around.length < C.minNeighbors) continue
    const median = middle(around.map((l) => l.n).sort((a, b) => a - b))
    const gap = gapOf(c.n, median)
    if (gap === 'absurd') continue
    const seen = hiddenShare(c, around, cam) < C.hidden
    const side = c.n > median ? 'more' : 'less'
    tiers[(gap === 'close' ? 4 : prefer === null || side === prefer ? 0 : 2) + (seen ? 0 : 1)]!.push({ ...c, median })
    if (tiers[0]!.length >= C.shortlist) break
  }
  return tiers.flat().slice(0, C.shortlist)
}

const WORSHIP = /church|religio|worship|synagogue|temple|mosque|chapel|parish|cathedral|congregation/
// Schools, cemeteries, government and the rest of civic life, in the assessor's words and OpenStreetMap's kinds.
const CIVIC_TEXT = /schl|school|coll|cemetery|mort|municipal|city inc|county|state|federal|military|districts?$|leasehold|hospital|cultural|orphng|non-prof|forest|park|outdr rec|outdoor rec|river|lake|utility/
const CIVIC_KIND = /^(school|college|university|kindergarten|library|townhall|courthouse|police|fire_station|post_office|community_centre|museum|hospital|cemetery|grave_yard|park|playground|social_facility)$/
const HOME_TEXT = /single family|townhouse|condo|co-?op|multifamily|mobile home|mht|modular|residential/

/** A place of worship, by the assessor's words, OpenStreetMap's kind or its name. Never asked about: nobody
 * should be asked to price a church against its neighbors. Its lot page is unchanged. */
export function worship(r: Pick<CallRecord, 'use_text' | 'kind' | 'name'>): boolean {
  return WORSHIP.test(`${r.use_text ?? ''} ${(r.kind ?? '').replace(/_/g, ' ')} ${r.name ?? ''}`.toLowerCase())
}

/** An ordinary business lot people know from the street: shops, a restaurant, offices. Not a place of
 * worship, a school, a cemetery, government or other civic land, not empty land, and never a home. The
 * front door's first lot has to be one of these. */
export function ordinary(r: Pick<CallRecord, 'use' | 'use_text' | 'kind' | 'name'>): boolean {
  const text = (r.use_text ?? '').toLowerCase()
  if (r.use !== 'biz' || worship(r)) return false
  if (CIVIC_TEXT.test(text) || CIVIC_KIND.test(r.kind ?? '') || HOME_TEXT.test(text)) return false
  return !/vacant|pkg|parking/.test(text)
}

/** Does the record bear the map out: a real lot, big enough, in a sane range against its neighbors, and not a
 * place of worship? */
export function callable(c: Pick<Candidate, 'median'>, r: CallRecord | undefined): r is CallRecord {
  if (!r || !(r.vpa > 0)) return false
  if (worship(r)) return false
  if (r.acres < CALLABLE.minAcres || r.acres > CALLABLE.maxAcres) return false
  if (r.vpa < CALLABLE.minVpa || r.vpa > CALLABLE.maxVpa) return false
  return c.median === null || gapOf(r.vpa, c.median * 1e6) !== 'absurd'
}

/** The first candidate, in the map's order, that the records bear out. Null when none does. */
export function chooseCallable<T extends Pick<Candidate, 'id' | 'median'>>(candidates: T[], records: CallRecord[]): T | null {
  const by = new Map(records.map((r) => [r.id, r]))
  return candidates.find((c) => callable(c, by.get(c.id))) ?? null
}
