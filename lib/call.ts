// One answer for everyone. A call is settled against the records of the valued lots within a few blocks of
// the lot, read by the server from the same store for every visitor, so two friends calling the same lot on
// different phones get the same answer, and the day's lot can be checked ahead of time (tests/daily.test.ts).
// The map's own tiles are only the fallback, for lots outside the records (the state roll).
import type { Lot } from './types'
import { explainCall, type Ground, type Neighbor, type Typical } from './copy'
import { gapOf, metersBetween } from './call-picker'

/** "Its neighbors": the valued lots within a few blocks, as the question puts it. */
export const NEAR_M = 350

/** What settles a call on one lot. Values in dollars an acre. */
export type CallFacts = {
  id: string
  /** The middle of the valued lots within a few blocks; null when there is nothing around it. */
  median: number | null
  /** The answer: worth more per acre than them. Null when there is nothing to compare with. */
  more: boolean | null
  /** How far it sits from them: clear (1.5 times or more), close, or too far to ask about. */
  gap: 'clear' | 'close' | 'absurd' | null
  /** Why, in plain words, from the records around it. */
  why: string | null
  /** The reason in a few words, under the picture of the lot beside the typical one. */
  short: string | null
  /** The typical lot around it: its size, use, land share and year, for that picture. */
  typical: Typical | null
  grounds: Ground[]
  /** How many valued lots it was compared with. */
  near: number
}

type Located = Pick<Lot, 'id' | 'lon' | 'lat' | 'vpa'>

/** The valued lots within NEAR_M of a lot, nearest first, never the lot itself. */
export function neighborsOf<T extends Located>(lot: Located, lots: T[]): T[] {
  const at: [number, number] = [lot.lon, lot.lat]
  return lots
    .filter((l) => l.id !== lot.id && l.vpa > 0)
    .map((l) => ({ l, d: metersBetween(at, [l.lon, l.lat]) }))
    .filter((x) => x.d <= NEAR_M)
    .sort((a, b) => a.d - b.d || (a.l.id < b.l.id ? -1 : 1))
    .map((x) => x.l)
}

const middle = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}

/** The answer, how clear it is, and why, from a lot and its neighbors' records. */
export function settle(lot: Lot, neighbors: Neighbor[]): CallFacts {
  const valued = neighbors.filter((n) => n.vpa > 0)
  const median = middle(valued.map((n) => n.vpa))
  const ok = median !== null && lot.vpa > 0 && lot.vpa !== median
  const reason = ok ? explainCall(lot, valued, median) : null
  return {
    id: lot.id,
    median,
    more: ok ? lot.vpa > median! : null,
    gap: ok ? gapOf(lot.vpa, median!) : null,
    why: reason?.text ?? null,
    short: reason?.short ?? null,
    typical: reason?.typical ?? null,
    grounds: reason?.grounds ?? [],
    near: valued.length,
  }
}

/** A Neighbor is all the reason reads of a lot around the one called. */
export function asNeighbor(l: Lot): Neighbor {
  return { vpa: l.vpa, acres: l.acres, use: l.use, land: l.land, building: l.building, built: l.built ?? null }
}
