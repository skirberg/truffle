import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { cacheLife, cacheTag } from 'next/cache'
import postgres from 'postgres'
import type { Lot, Pull, SearchHit, Summary } from './types'
import { NEAR_M, asNeighbor, neighborsOf, settle, type CallFacts } from './call'
import { changingMarks, rulesMarks, type Mark } from './marks'

// Two stores, one shape. Postgres (Neon) once a pull has been loaded into it; until then, and with no
// DATABASE_URL at all, the committed sample of Downtown Boca Raton and West Boca (data/snapshot.json.gz). A
// database that is attached but still empty never breaks the site.
// Everything here is cached until the next pull: the pipeline calls /api/revalidate, which expires "pull".

const PLACES: SearchHit[] = [
  { kind: 'place', id: 'downtown', label: 'Downtown Boca Raton' },
  { kind: 'place', id: 'west-boca', label: 'West Boca' },
]

let sql: postgres.Sql | null = null
let ready: Promise<boolean> | null = null
async function db(): Promise<postgres.Sql | null> {
  const url = process.env.DATABASE_URL
  if (!url) return null
  sql ??= postgres(url, { max: 3, idle_timeout: 20, prepare: false, types: { bigint: postgres.BigInt } })
  // Loaded means the tables exist and a pull has recorded its sources.
  ready ??= sql`select to_regclass('public.source_pull') is not null as t`
    .then(async (r) => Boolean(r[0]?.t) && (await sql!`select exists (select 1 from source_pull) as e`)[0]?.e === true)
    .catch(() => {
      ready = null // try again on the next request
      return false
    })
  return (await ready) ? sql : null
}

type Snapshot = { pulls: Pull[]; lots: Lot[] }
let snap: Promise<Snapshot> | null = null
type Town = { n: string; k: string; c: [number, number] }
let towns: Promise<Town[]> | undefined
function townList(): Promise<Town[]> {
  towns ??= readFile(join(process.cwd(), 'data', 'places.json'), 'utf8')
    .then((t) => JSON.parse(t) as Town[])
    .catch(() => [])
  return towns
}
const TOWN_WORD: Record<string, string> = {
  city: 'City', town: 'Town', village: 'Village', hamlet: 'Village', suburb: 'Neighborhood', quarter: 'Neighborhood', neighbourhood: 'Neighborhood',
}

/** The names on the map, from the committed records of the two Boca areas (they cover both views' cameras). */
let marksOnce: Promise<Mark[]> | null = null
function marks(): Promise<Mark[]> {
  marksOnce ??= snapshot()
    .then((s) => [...rulesMarks(s.lots), ...changingMarks(s.lots)])
    .catch(() => [])
  return marksOnce
}

function snapshot(): Promise<Snapshot> {
  snap ??= readFile(join(process.cwd(), 'data', 'snapshot.json.gz')).then((b) => JSON.parse(gunzipSync(b).toString('utf8')))
  return snap
}

const NUM = ['acres', 'land', 'building', 'vpa', 'lon', 'lat'] as const
function fromRow(r: Record<string, unknown>): Lot {
  const lot = { ...r } as Record<string, unknown>
  for (const k of NUM) lot[k] = Number(lot[k] ?? 0)
  for (const k of ['km', 'typical_km', 'pct', 'peers', 'legacy'] as const) lot[k] = lot[k] === null || lot[k] === undefined ? null : Number(lot[k])
  delete lot.geom
  return lot as unknown as Lot
}

function tidy(lot: Lot): Lot {
  return { ...lot, name: lot.name ?? null, kind: lot.kind ?? null, km: lot.km ?? null, typical_km: lot.typical_km ?? null, pct: lot.pct ?? null, peers: lot.peers ?? null, legacy: lot.legacy ?? null }
}

export async function getLot(id: string): Promise<Lot | null> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const s = await db()
  if (s) {
    const rows = await s`select * from lot where id = ${id}`
    return rows[0] ? fromRow(rows[0]) : null
  }
  const found = (await snapshot()).lots.find((l) => l.id === id)
  return found ? tidy(found) : null
}

/** Lots on the Nov 3 board keep their old number: /lot/608 is Mizner Plaza. */
export async function getLotByLegacy(n: number): Promise<Lot | null> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const s = await db()
  if (s) {
    const rows = await s`select * from lot where legacy = ${n}`
    return rows[0] ? fromRow(rows[0]) : null
  }
  const found = (await snapshot()).lots.find((l) => l.legacy === n)
  return found ? tidy(found) : null
}

export async function getLots(ids: string[]): Promise<Lot[]> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const want = ids.slice(0, 60)
  const s = await db()
  if (s) return (await s`select * from lot where id = any(${want})`).map(fromRow)
  const set = new Set(want)
  return (await snapshot()).lots.filter((l) => set.has(l.id)).map(tidy)
}

/**
 * What settles a call on one lot: the middle of the valued lots within a few blocks, the answer and why, from
 * the records. The same for every visitor, so a friend who opens a shared lot gets the answer its sender got.
 */
export async function getCall(id: string): Promise<CallFacts | null> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const lot = await getLot(id)
  if (!lot) return null
  const s = await db()
  let around: Lot[]
  if (s) {
    const dLat = NEAR_M / 110_540
    const dLon = NEAR_M / (111_320 * Math.cos((lot.lat * Math.PI) / 180))
    around = (await s`select * from lot where geom && ST_MakeEnvelope(${lot.lon - dLon}, ${lot.lat - dLat}, ${lot.lon + dLon}, ${lot.lat + dLat}, 4326) and vpa > 0`).map(fromRow)
  } else {
    around = (await snapshot()).lots.map(tidy)
  }
  return settle(lot, neighborsOf(lot, around).map(asNeighbor))
}

export async function search(q: string): Promise<SearchHit[]> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const term = q.trim().toLowerCase().replace(/\s+/g, ' ')
  if (term.length < 2) return []
  const places = PLACES.filter((p) => p.label.toLowerCase().includes(term))
  // Towns that start with what was typed, biggest first; then towns that contain it.
  const all = await townList()
  const townHits = [...all.filter((t) => t.n.toLowerCase().startsWith(term)), ...all.filter((t) => !t.n.toLowerCase().startsWith(term) && t.n.toLowerCase().includes(term))]
    .slice(0, 3)
    .map((t) => ({ kind: 'town' as const, id: `${t.n}-${t.k}`, label: t.n, place: TOWN_WORD[t.k] ?? 'Place', lon: t.c[0], lat: t.c[1] }))
  const s = await db()
  let lots: { id: string; address: string | null; name: string | null; place: string }[]
  if (s) {
    lots = (await s`
      select id, address, name, place from lot
      where lower(address) like ${'%' + term + '%'} or lower(name) like ${'%' + term + '%'}
      order by (lower(coalesce(name, address)) like ${term + '%'}) desc,
        greatest(similarity(lower(coalesce(address, '')), ${term}), similarity(lower(coalesce(name, '')), ${term})) desc, address
      limit 6`) as unknown as typeof lots
  } else {
    const all = (await snapshot()).lots
    const hay = (l: Lot) => `${l.name ?? ''} ${l.address ?? ''}`.toLowerCase()
    const hits = all.filter((l) => (l.address || l.name) && hay(l).includes(term))
    const starts = (l: Lot) => Number((l.name ?? l.address ?? '').toLowerCase().startsWith(term))
    hits.sort((a, b) => starts(b) - starts(a) || (a.name ?? a.address ?? '').localeCompare(b.name ?? b.address ?? ''))
    lots = hits.slice(0, 6).map((l) => ({ id: l.id, address: l.address, name: l.name ?? null, place: l.place }))
  }
  // A named lot reads by its name, with its address where the town would go.
  return [
    ...places,
    ...townHits,
    ...lots.map((l) => ({ kind: 'lot' as const, id: l.id, label: l.name ?? l.address ?? 'A lot', place: l.name ? (l.address ?? l.place) : l.place })),
  ]
}

export async function getSummary(): Promise<Summary> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const s = await db()
  const tilesEnv = process.env.NEXT_PUBLIC_TILES_URL || '/tiles/lots.pmtiles'
  const baseEnv = process.env.NEXT_PUBLIC_BASEMAP_URL || '/tiles/basemap.pmtiles'
  if (s) {
    const [pulls, fams, codes, west, tiles, basemap] = await Promise.all([
      s`select key, name, url, to_char(pulled, 'YYYY-MM-DD') as pulled, rows from source_pull order by key`,
      s`select zfam, count(*)::int as n from lot where area = 'downtown' group by zfam`,
      s`select zoning, count(*)::int as n from lot where area = 'downtown' and zoning is not null group by zoning`,
      s`select count(*)::int as n, min(lon) w, min(lat) s, max(lon) e, max(lat) n2 from lot where area = 'west-boca' and year_added >= 2023`,
      s`select value from setting where key = 'tiles_url'`,
      s`select value from setting where key = 'basemap_url'`,
    ])
    const w = west[0]!
    return {
      pulls: pulls as unknown as Pull[],
      downtownFamilies: Object.fromEntries(fams.map((r) => [r.zfam, r.n])),
      downtownCodes: Object.fromEntries(codes.map((r) => [r.zoning, r.n])),
      westNew: w.n,
      westNewBounds: [Number(w.w), Number(w.s), Number(w.e), Number(w.n2)],
      tilesUrl: (tiles[0]?.value as string | undefined) || tilesEnv,
      basemapUrl: (basemap[0]?.value as string | undefined) || baseEnv,
      coverage: 'county',
      statewide: (pulls as unknown as Pull[]).some((p) => p.key === 'parcels_florida'),
      marks: await marks(),
    }
  }
  const { pulls, lots } = await snapshot()
  const fam: Record<string, number> = {}
  const codes: Record<string, number> = {}
  const b: [number, number, number, number] = [180, 90, -180, -90]
  let westNew = 0
  for (const l of lots) {
    if (l.area === 'downtown') {
      fam[l.zfam] = (fam[l.zfam] ?? 0) + 1
      if (l.zoning) codes[l.zoning] = (codes[l.zoning] ?? 0) + 1
    }
    if (l.area === 'west-boca' && l.year_added >= 2023) {
      westNew++
      b[0] = Math.min(b[0], l.lon); b[1] = Math.min(b[1], l.lat); b[2] = Math.max(b[2], l.lon); b[3] = Math.max(b[3], l.lat)
    }
  }
  return { pulls, downtownFamilies: fam, downtownCodes: codes, westNew, westNewBounds: b, tilesUrl: tilesEnv, basemapUrl: baseEnv, coverage: 'boca', statewide: pulls.some((p) => p.key === 'parcels_florida'), marks: await marks() }
}

/** How many other lots in the same set share a zoning code (Rules view). */
export async function getSharing(zoning: string, area: string | null, place: string): Promise<number> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const s = await db()
  if (s) {
    const rows = area
      ? await s`select count(*)::int as n from lot where zoning = ${zoning} and area = ${area}`
      : await s`select count(*)::int as n from lot where zoning = ${zoning} and place = ${place}`
    return Math.max(0, (rows[0]?.n ?? 1) - 1)
  }
  const lots = (await snapshot()).lots
  const n = lots.filter((l) => l.zoning === zoning && (area ? l.area === area : l.place === place)).length
  return Math.max(0, n - 1)
}

/** The lot's comparison set (its area, else its town) as 48 values per acre, lowest to highest: the panel's skyline. */
export async function getSpread(area: string | null, place: string): Promise<{ n: number; values: number[] }> {
  'use cache'
  cacheTag('pull')
  cacheLife('max')
  const s = await db()
  let vals: number[]
  if (s) {
    const rows = area
      ? await s`select vpa from lot where area = ${area} and vpa > 0 order by vpa`
      : await s`select vpa from lot where place = ${place} and vpa > 0 order by vpa`
    vals = rows.map((r) => Number(r.vpa))
  } else {
    vals = (await snapshot()).lots
      .filter((l) => l.vpa > 0 && (area ? l.area === area : l.place === place))
      .map((l) => Number(l.vpa))
      .sort((a, b) => a - b)
  }
  const k = Math.min(48, vals.length)
  const values = Array.from({ length: k }, (_, i) => vals[Math.floor(((i + 0.5) / k) * vals.length)]!)
  return { n: vals.length, values }
}
