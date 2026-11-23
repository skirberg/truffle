import type { Mark } from './marks'
import type { UseKey, ZoningKey } from './tokens'

export type Lot = {
  id: string
  legacy: number | null
  /** What it is, from OpenStreetMap: "Mizner Park", "Publix". */
  name: string | null
  kind: string | null
  address: string | null
  place: string
  area: string | null
  use_text: string
  use: UseKey
  zoning: string | null
  zfam: ZoningKey
  acres: number
  land: number
  building: number
  vpa: number
  km: number | null
  typical_km: number | null
  pct: number | null
  peers: number | null
  year_added: number
  /** Year built, where the state roll gives it (lots outside Palm Beach County). */
  built?: number | null
  neighborhood: string | null
  units: number
  lon: number
  lat: number
}

export type Pull = { key: string; name: string; url: string; pulled: string; rows: number | null }

export type SearchHit =
  | { kind: 'place'; id: 'west-boca' | 'downtown'; label: string }
  | { kind: 'lot'; id: string; label: string; place: string }
  /** A town or neighborhood anywhere on the map, from OpenStreetMap. */
  | { kind: 'town'; id: string; label: string; place: string; lon: number; lat: number }

/** What the views need before any lot is picked. */
export type Summary = {
  pulls: Pull[]
  /** Rules legend: lots downtown per zoning family. */
  downtownFamilies: Record<string, number>
  /** Lots downtown sharing each zoning code. */
  downtownCodes: Record<string, number>
  westNew: number
  /** [west, south, east, north] of West Boca lots added since 2023. */
  westNewBounds: [number, number, number, number]
  tilesUrl: string
  /** Roads, water, town names and named places from OpenStreetMap. */
  basemapUrl: string
  /** What search can find: the whole county with the database, the two Boca areas without it. */
  coverage: 'county' | 'boca'
  /** The map covers every county in Florida (lots outside Palm Beach County are in the tiles only). */
  statewide: boolean
  /** Names written on the map where the things they name are (lib/marks.ts). */
  marks: Mark[]
}
