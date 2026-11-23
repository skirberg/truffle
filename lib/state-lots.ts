// Lots outside Palm Beach County come from the state's tax roll and live in the tiles only: the database
// holds Palm Beach County. Their ids lead with the county's number ("53-12384100000030"), and their label
// point carries what the panel shows.
import type { Lot } from './types'
import type { UseKey, ZoningKey } from './tokens'

export function isStateLot(id: string): boolean {
  return /^\d{2}-/.test(id)
}

const USE: Record<string, UseKey> = { h: 'homes', b: 'biz', c: 'civic', v: 'vacant', o: 'other' }

type Props = Record<string, unknown>
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null)
const str = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)

export function lotFromTile(id: string, label: Props, poly: Props, lon: number, lat: number): Lot {
  return {
    id,
    legacy: null,
    name: str(label.t),
    kind: str(label.k),
    address: str(label.a),
    place: str(label.p) ?? 'Florida',
    area: null,
    use_text: str(label.ut) ?? '',
    use: USE[String(poly.u ?? 'o')] ?? 'other',
    zoning: null,
    zfam: (str(poly.z) ?? 'none') as ZoningKey,
    acres: num(label.ac) ?? 0,
    land: num(label.l) ?? 0,
    building: num(label.b) ?? 0,
    vpa: num(label.v) ?? 0,
    km: null,
    typical_km: null,
    pct: num(label.pc),
    peers: num(label.pr),
    year_added: 0,
    built: num(label.yb),
    neighborhood: null,
    units: 1,
    lon,
    lat,
  }
}

/** /lot/53-123?at=-80.25,27.19: where a state lot is, since the server has no record of it. */
export function atOf(search: string): [number, number] | null {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(new URLSearchParams(search).get('at') ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}
