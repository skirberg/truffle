// Names written on the map itself, where the thing they name is, the way a zoning map writes each district's
// code on the district and a chart labels its lines at their ends instead of keeping a legend: Rules names
// each big zoning family on its densest block downtown, and Changing names the land the new lots stand on,
// with how many there are. Drawn from the same records as everything else, so they move when a pull does.
import { color, familyOf, zoningColor, type ZoningKey } from './tokens'
import type { Lot } from './types'

export type Mark = {
  /** The view that shows it. */
  mode: 'rules' | 'changing'
  lon: number
  lat: number
  /** The name, on the first line. */
  text: string
  /** A second, smaller line: a count. */
  sub: string | null
  /** The pill's color: the zoning family's own color in Rules, the card in Changing. */
  fill: string
  /** Which side of the point the name sits on: over it, or beside it so the lots it names stay in view. */
  side: 'center' | 'left' | 'right'
}

const meters = (a: Pick<Lot, 'lon' | 'lat'>, b: Pick<Lot, 'lon' | 'lat'>) =>
  Math.hypot((b.lon - a.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180), (b.lat - a.lat) * 110_540)

/** A family is named on the map when it covers at least this many lots downtown. */
export const RULES_MIN = 20
/** How far "its densest block" reaches. */
const BLOCK_M = 150

/** Rules: each big zoning family's name on the downtown lot with the most lots of that family around it. */
export function rulesMarks(lots: Pick<Lot, 'lon' | 'lat' | 'zfam' | 'area'>[]): Mark[] {
  const down = lots.filter((l) => l.area === 'downtown' && l.zfam && l.zfam !== 'none' && l.zfam !== 'special')
  const by = new Map<string, typeof down>()
  for (const l of down) by.set(l.zfam, [...(by.get(l.zfam) ?? []), l])
  const out: Mark[] = []
  for (const [key, group] of by) {
    const fam = familyOf(key)
    if (!fam || group.length < RULES_MIN) continue
    let best = group[0]!
    let most = -1
    for (const l of group) {
      let n = 0
      for (const o of group) if (meters(l, o) <= BLOCK_M) n++
      if (n > most) [best, most] = [l, n]
    }
    out.push({ mode: 'rules', lon: best.lon, lat: best.lat, text: fam.name, sub: null, fill: zoningColor[key as ZoningKey], side: 'center' })
  }
  return out.sort((a, b) => a.text.localeCompare(b.text))
}

/** The plat names the county files new lots under, in the words a local would use. */
const PLACE_WORDS: Record<string, string> = { 'Boca Raton Golf Course': 'The old municipal golf course' }
/** A place is named on the map when this many new lots stand on it. */
export const CHANGING_MIN = 50

/** "Johns Pud West Plat Four" and "Johns West Pud Plat One" are both Johns West. */
export function placeOf(neighborhood: string | null): string | null {
  if (!neighborhood) return null
  const words = neighborhood
    .split(/\s+/)
    .filter((w) => !/^(pud|plat|mxpd|mupd|pcd|replat|one|two|three|four|five|six|seven|eight|nine|ten|\d+|[ivx]+)$/i.test(w))
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim()
  return name ? (PLACE_WORDS[name] ?? name) : null
}

/** Changing: each place with many new lots named where they stand, with how many. */
export function changingMarks(lots: Pick<Lot, 'lon' | 'lat' | 'area' | 'year_added' | 'neighborhood'>[]): Mark[] {
  const fresh = lots.filter((l) => l.area === 'west-boca' && l.year_added >= 2023)
  const by = new Map<string, typeof fresh>()
  for (const l of fresh) {
    const p = placeOf(l.neighborhood)
    if (p) by.set(p, [...(by.get(p) ?? []), l])
  }
  const out: Mark[] = []
  for (const [name, group] of by) {
    if (group.length < CHANGING_MIN) continue
    const mid = { lon: group.reduce((s, l) => s + l.lon, 0) / group.length, lat: group.reduce((s, l) => s + l.lat, 0) / group.length }
    // On a lot of the place, the one nearest its middle: a place shaped like an L has its middle off its land.
    const at = group.reduce((a, b) => (meters(mid, a) <= meters(mid, b) ? a : b))
    out.push({ mode: 'changing', lon: at.lon, lat: at.lat, text: name, sub: `${group.length.toLocaleString('en-US')} new lots`, fill: color.card, side: 'center' })
  }
  // Seen from far out the places sit close together, and a name over each hides the lots it names: the
  // westernmost takes its name on its west side, the rest on their east, so the lots stand between the names.
  if (out.length > 1) {
    const west = Math.min(...out.map((m) => m.lon))
    for (const m of out) m.side = m.lon === west ? 'left' : 'right'
  }
  return out.sort((a, b) => a.text.localeCompare(b.text))
}
