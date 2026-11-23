'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  Map as MapLibre,
  addProtocol,
  setWorkerUrl,
  getVersion,
  type ExpressionSpecification,
  type MapLayerMouseEvent,
  type VectorSourceSpecification,
} from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import { T, color, map as M, tokenColor, useCode, useColor, useLegend, zoningColor } from '@/lib/tokens'
import type { Lot } from '@/lib/types'
import { heightM, tileMoney } from '@/lib/numbers'
import { rankCandidates, type Candidate, type TileLot } from '@/lib/call-picker'
import { lotFromTile } from '@/lib/state-lots'
import type { Mark } from '@/lib/marks'
import { isShardIndex, registerShards, shardProtocol } from '@/lib/shards'

export type Mode = 'value' | 'rules' | 'changing'

export type BoardHandle = {
  goToLot: (lot: Pick<Lot, 'lon' | 'lat'>, fromSearch?: boolean, duration?: number) => void
  focus: () => void
  /** A town from search: fly over it. */
  goToPlace: (lon: number, lat: number, zoom: number) => void
  /** A lot outside the database, read from its tile; moves in close first if its details aren't loaded. */
  readLot: (id: string, at: [number, number] | null) => Promise<Lot | null>
  /** The hunt: lift the fog off the called lot, raise it to its height, and say what it and the middle of
   * the lots within a few blocks are worth per acre (millions, from the tiles). */
  reveal: (id: string, at: [number, number] | null) => { v: number | null; median: number | null; near: number; around: string[] }
  /** The hunt's opening: hold the wide view of the lit city a moment, then fly down to the first lot. */
  arrive: (lot: Pick<Lot, 'lon' | 'lat'>) => void
  /** The hunt: lots near the last one worth calling, best first: big enough to see, in a sane value range,
   * clearly above or below their neighbors and not hidden behind them. The tiles can hold lots the records
   * don't, so the caller checks the list against the records and takes the first they bear out. */
  nextLots: (from: [number, number] | null, skip: Set<string>, prefer: 'more' | 'less' | null) => Candidate[]
  /** Resolves once the camera has stopped and the tiles under it are in (or after a few seconds at most). The
   * lots the map holds mid-flight can be none at all, so the hunt waits for this before it picks the next lot, and
   * after a pick that found nothing, waits for the next time the map comes to rest (again) and looks once more. */
  settled: (again?: boolean) => Promise<void>
}

/** After a call: the height of the typical lot around the called one, drawn as a level over its block. */
export type Level = { lon: number; lat: number; median: number; label: string; acres: number }

type Props = {
  mode: Mode
  /** The front door: every lot under fog until it's called. */
  hunt: boolean
  pickedId: string | null
  /** The hunt: the called lot's result, written over it on the map ("You called it"). While the picked lot
   * has none it is the one under fog, with a question mark over it. */
  verdict?: string | null
  /** The called lot's value per acre as the panel writes it ("$2.4M"), so the map and the panel agree. */
  verdictValue?: string | null
  tilesUrl: string
  basemapUrl: string
  westBounds: [number, number, number, number]
  reduced: boolean
  phone: boolean
  initialLot: Pick<Lot, 'lon' | 'lat'> | null
  onPick: (id: string | null, at?: [number, number]) => void
  onVisible: (ids: string[]) => void
  onFail: () => void
  /** Once, when the first lots have drawn: the front door's first frame can step aside. */
  onDrawn?: () => void
  /** After a call: the typical height around the lot, as a level the lot stands above or below. */
  level?: Level | null
  /** Names written on the map in Rules and Changing (lib/marks.ts). */
  marks?: Mark[]
}

const SRC = 'lots'
/** The longest the hunt waits for the camera and tiles to settle before it picks the next lot anyway. */
const SETTLE_MAX_MS = 10000
const BASE = 'base'
// A label point gets a tag when it has a name or a number. Lots outside Palm Beach County have a point
// each (it carries their panel), most with neither.
/** One PMTiles file, or the index of a set split into pieces (the whole state). */
async function vectorSource(name: string, raw: string): Promise<VectorSourceSpecification> {
  const url = new URL(raw, window.location.href).href
  if (!isShardIndex(url)) return { type: 'vector', url: `pmtiles://${url}` }
  try {
    const ix = await registerShards(name, url)
    return { type: 'vector', tiles: [`shards://${name}/{z}/{x}/{y}`], minzoom: ix.minzoom, maxzoom: ix.maxzoom, bounds: ix.bounds }
  } catch {
    return { type: 'vector', tiles: [`shards://${name}-missing/{z}/{x}/{y}`] }
  }
}

const TAGGED: ExpressionSpecification = ['any', ['has', 't'], ['!=', ['coalesce', ['get', 'n'], ''], '']]
const LAYERS: Record<Mode, string[]> = {
  value: ['value', 'target', 'tags', 'tag-picked'],
  rules: ['rules'],
  changing: ['changing-flat', 'changing'],
}
const PICKABLE = ['value', 'rules', 'changing']
const SEL: ExpressionSpecification = ['boolean', ['feature-state', 'sel'], false]
const H: ExpressionSpecification = ['to-number', ['get', 'h'], 1]
// The hunt: the city stands lit, every lot at its height in its use color, but one: the lot to call lies
// flat under fog until the call. Then it rises to its height (up runs 0
// to 1) in truffle brown, the color of the lot you picked.
const FOG: ExpressionSpecification = ['boolean', ['feature-state', 'fog'], false]
const UP: ExpressionSpecification = ['number', ['feature-state', 'up'], 1]
const FOG_H = 1.2
/** How far "around it" reaches: a few blocks. */
const NEAR_M = 350

/** The number on a tile, back to millions an acre. */
function tileMillions(n: unknown): number {
  const s = String(n ?? '')
  if (!s) return 0
  return s.endsWith('B') ? parseFloat(s) * 1000 : parseFloat(s)
}

function firstPoint(g: GeoJSON.Geometry): [number, number] | null {
  if (g.type === 'Polygon') return (g.coordinates[0]?.[0] as [number, number]) ?? null
  if (g.type === 'MultiPolygon') return (g.coordinates[0]?.[0]?.[0] as [number, number]) ?? null
  if (g.type === 'Point') return g.coordinates as [number, number]
  return null
}

/** The middle of a lot's outline (its first ring), close enough to aim the camera at. */
function middle(g: GeoJSON.Geometry): [number, number] | null {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null
  if (!ring?.length) return firstPoint(g)
  let x = 0, y = 0
  for (const q of ring) [x, y] = [x + q[0]! / ring.length, y + q[1]! / ring.length]
  return [x, y]
}

/** The shorter side of a lot's bounding box, in meters: how easy it is to see and tap. */
function span(g: GeoJSON.Geometry): number {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null
  if (!ring?.length) return 0
  const xs = ring.map((q) => q[0]!), ys = ring.map((q) => q[1]!)
  const lat = ys[0]!
  return Math.min((Math.max(...xs) - Math.min(...xs)) * 111_320 * Math.cos((lat * Math.PI) / 180), (Math.max(...ys) - Math.min(...ys)) * 110_540)
}

function meters(a: [number, number], b: [number, number]) {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * 111_320 * k, (b[1] - a[1]) * 110_540)
}
/** How far the level reaches from the called lot: its block and the next, enough to see who stands above it. */
const LEVEL_M = 110
/** The level is a haze, not a wall: the lots under it still read in their colors. */
const LEVEL_OPACITY = 0.6

/** A ring on the ground, r meters around a point, as n points; clockwise for a hole. */
function ringAround([lon, lat]: [number, number], r: number, clockwise = false, n = 72): [number, number][] {
  const k = Math.cos((lat * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = ((clockwise ? -2 : 2) * Math.PI * i) / n
    ring.push([lon + (r * Math.cos(a)) / (111_320 * k), lat + (r * Math.sin(a)) / 110_540])
  }
  return ring
}

/** The level as map data: a thin disc at the typical lot's height, and its tag at the disc's near edge. */
function levelData(l: Level | null | undefined): GeoJSON.FeatureCollection {
  if (!l) return { type: 'FeatureCollection', features: [] }
  const h = heightM(l.median)
  const k = Math.cos((l.lat * Math.PI) / 180)
  // The tag sits on the rim nearest the viewer and a little to the right (the camera faces 35 degrees west of
  // north), clear of the lot's own pill over its middle.
  const az = (190 * Math.PI) / 180
  const rim: [number, number] = [l.lon + (LEVEL_M * Math.sin(az)) / (111_320 * k), l.lat + (LEVEL_M * Math.cos(az)) / 110_540]
  return {
    type: 'FeatureCollection',
    features: [
      // A hole where the called lot stands, so it keeps its truffle brown whichever side of the level it ends on.
      {
        type: 'Feature',
        properties: { h, b: Math.max(0, h - 0.5) },
        geometry: { type: 'Polygon', coordinates: [ringAround([l.lon, l.lat], LEVEL_M), ringAround([l.lon, l.lat], Math.max(16, 1.3 * Math.sqrt((l.acres * 4046.86) / Math.PI)), true)] },
      },
      { type: 'Feature', properties: { h, label: l.label }, geometry: { type: 'Point', coordinates: rim } },
    ],
  }
}

const USE: ExpressionSpecification = [
  'match',
  ['get', 'u'],
  'h', useColor.homes,
  'b', useColor.biz,
  'c', useColor.civic,
  'v', useColor.vacant,
  useColor.other,
]
// A named lot shows its name over its number: "Mizner Park" / "8.4".
const TAG_TEXT: ExpressionSpecification = [
  'case',
  ['all', ['has', 't'], ['has', 'n']], ['format', ['get', 't'], { 'font-scale': 0.95 }, '\n', {}, ['get', 'n'], { 'text-font': ['literal', ['Gabarito Bold']] }],
  ['has', 't'], ['get', 't'],
  ['get', 'n'],
]
const ZONE: ExpressionSpecification = [
  'match',
  ['get', 'z'],
  'single', zoningColor.single,
  'duplex', zoningColor.duplex,
  'apartments', zoningColor.apartments,
  'downtown', zoningColor.downtown,
  'shops', zoningColor.shops,
  'public', zoningColor.public,
  'special', zoningColor.special,
  zoningColor.none,
]

/** Just over the flat lots the county draws on water: unvalued lots sit at 1 m, every Rules tile at 3 m. */
const waterHeight = (mode: Mode) => (mode === 'rules' ? M.rulesTileHeights.normal + 0.1 : 1.1)

let protocolAdded = false

/** The places a call is made around: the ones named while a lot is under fog. */
const MAJOR_POIS = ['supermarket', 'school', 'park', 'department_store', 'hotel', 'library', 'museum', 'place_of_worship', 'college', 'hospital', 'marina', 'golf_course']
const CIVIC_KINDS = ['school', 'place_of_worship', 'park', 'library', 'fire_station', 'police', 'post_office', 'townhall', 'hospital', 'clinic', 'playground', 'golf_course', 'sports_centre', 'museum', 'kindergarten', 'college', 'community_centre', 'courthouse', 'marina', 'nature_reserve', 'garden']

function dotImage(fill: string) {
  // A 2x dot with a paper ring, so it reads on any tile color.
  const s = 18
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = color.paper
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = fill
  g.beginPath()
  g.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2)
  g.fill()
  return g.getImageData(0, 0, s, s)
}

function pillImage(fill: string, alpha: number) {
  // A 2x stretchable rounded pill for the numbers on tiles: card-colored, or truffle for the picked lot.
  const w = 40, h = 28, r = 10
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.globalAlpha = alpha
  g.fillStyle = fill
  g.beginPath()
  g.roundRect(0, 0, w, h, r)
  g.fill()
  return {
    image: g.getImageData(0, 0, w, h),
    options: { pixelRatio: 2, stretchX: [[r, w - r]] as [number, number][], stretchY: [[r, h - r]] as [number, number][], content: [r - 2, 4, w - r + 2, h - 4] as [number, number, number, number] },
  }
}

function pinImage(fill: string) {
  // A 2x stretchable pin for the lot to call: the pill with a short tail under it pointing at the lot, the
  // way a maps app marks the one place that matters among many shapes.
  const w = 56, body = 36, tail = 12, r = 14
  const c = document.createElement('canvas')
  c.width = w
  c.height = body + tail
  const g = c.getContext('2d')!
  g.fillStyle = fill
  g.beginPath()
  g.roundRect(0, 0, w, body, r)
  g.moveTo(w / 2 - 8, body - 1)
  g.lineTo(w / 2, body + tail)
  g.lineTo(w / 2 + 8, body - 1)
  g.fill()
  return {
    image: g.getImageData(0, 0, w, body + tail),
    options: { pixelRatio: 2, stretchX: [[r, w / 2 - 10], [w / 2 + 10, w - r]] as [number, number][], stretchY: [[r, body - r]] as [number, number][], content: [r - 4, 4, w - r + 4, body - 4] as [number, number, number, number] },
  }
}

// Read the screen directly: on the first render the props still carry the server's guess.
const onPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 759px)').matches
const wantsStill = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function cameraFor(mode: Mode, phone: boolean) {
  const c = mode === 'rules' ? M.rules : M.value
  return phone
    ? { center: M.phone.center as [number, number], zoom: M.phone.zoom, pitch: c.pitch, bearing: c.bearing }
    : { center: c.center as [number, number], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }
}

function padding(phone: boolean) {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }
  return phone ? { top: 70, bottom: Math.round(window.innerHeight * 0.5), left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 400 }
}

export const Board = forwardRef<BoardHandle, Props>(function Board(props, ref) {
  const el = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const ready = useRef(false)
  const live = useRef(props)
  live.current = props
  const picked = useRef<string | null>(null)
  const padRef = useRef(40)
  const fogged = useRef<string | null>(null)
  const fogAnim = useRef(0)

  function fly(lot: Pick<Lot, 'lon' | 'lat'>, duration = T.motion.duration.fly, fromSearch = false) {
    const map = mapRef.current
    if (!map) return
    const phone = onPhone()
    const opts = {
      center: [lot.lon, lot.lat] as [number, number],
      // On a phone the hunt stands back a little, so the lot to call sits among enough neighbors to judge it by.
      zoom: live.current.hunt && phone ? M.hunt.zoom : fromSearch ? M.lotJump.zoomFromSearch : M.lotJump.zoom,
      pitch: M.lotJump.pitch,
      bearing: M.lotJump.bearing,
      padding: phone ? { top: 70, bottom: Math.round(window.innerHeight * 0.5), left: 0, right: 0 } : padding(false),
    }
    if (wantsStill()) map.jumpTo(opts)
    else map.flyTo({ ...opts, duration, essential: false })
  }

  useImperativeHandle(ref, (): BoardHandle => ({
    goToLot(lot, fromSearch, duration) {
      fly(lot, duration, fromSearch)
    },
    focus() {
      mapRef.current?.getCanvas().focus()
    },
    goToPlace(lon, lat, zoom) {
      const map = mapRef.current
      if (!map) return
      const opts = { center: [lon, lat] as [number, number], zoom, pitch: M.lotJump.pitch, bearing: M.lotJump.bearing }
      if (wantsStill()) map.jumpTo(opts)
      else map.flyTo({ ...opts, duration: 1800, essential: false })
    },
    reveal(id, at) {
      const map = mapRef.current
      if (!map) return { v: null, median: null, near: 0, around: [] }
      const byId = new Map<string, { at: [number, number] | null; n: number }>()
      for (const f of map.querySourceFeatures(SRC, { sourceLayer: 'lots' })) {
        const fid = String(f.id ?? f.properties?.id)
        if (!byId.has(fid)) byId.set(fid, { at: firstPoint(f.geometry), n: tileMillions(f.properties?.n) })
      }
      const center = at ?? byId.get(id)?.at ?? null
      const v = byId.get(id)?.n ?? null
      const around: { id: string; d: number }[] = []
      const values: number[] = []
      if (center) {
        for (const [fid, f] of byId) {
          if (fid === id || !f.at) continue
          const d = meters(center, f.at)
          if (d > NEAR_M) continue
          if (!(f.n > 0)) continue
          around.push({ id: fid, d })
          values.push(f.n)
        }
      }
      values.sort((a, b) => a - b)
      const median = values.length ? (values.length % 2 ? values[values.length >> 1]! : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2) : null
      riseFromFog(map, id)
      // The valued lots around it, nearest first: the panel reads their records to say why.
      return { v: v && v > 0 ? v : null, median, near: values.length, around: around.sort((a, b) => a.d - b.d).map((a) => a.id) }
    },
    arrive(lot) {
      const map = mapRef.current
      if (!map) return
      const go = () => fly(lot, M.hunt.introMs)
      if (wantsStill()) return go()
      // Wait for the city to draw, hold it a moment, then go down.
      const start = () => window.setTimeout(go, M.hunt.pauseMs)
      if (map.loaded() && map.areTilesLoaded()) start()
      else map.once('idle', start)
    },
    settled(again = false) {
      const map = mapRef.current
      if (!map || (!again && map.loaded() && !map.isMoving())) return Promise.resolve()
      return new Promise<void>((resolve) => {
        const done = () => (window.clearTimeout(t), map.off('idle', done), resolve())
        const t = window.setTimeout(done, SETTLE_MAX_MS)
        map.on('idle', done)
        // Asked again after a miss: draw once more, so a map that is already still says so at once.
        if (again) map.triggerRepaint()
      })
    },
    nextLots(from, skip, prefer) {
      const map = mapRef.current
      if (!map) return []
      const lots: TileLot[] = []
      const ids = new Set<string>()
      for (const f of map.querySourceFeatures(SRC, { sourceLayer: 'lots' })) {
        const id = String(f.id ?? f.properties?.id)
        if (ids.has(id)) continue
        ids.add(id)
        const at = middle(f.geometry)
        if (at) lots.push({ id, at, n: tileMillions(f.properties?.n), h: Number(f.properties?.h ?? 1), size: span(f.geometry) })
      }
      const here = from ?? (map.getCenter().toArray() as [number, number])
      // Which of them is worth calling is decided in lib/call-picker.ts, where it can be tested.
      return rankCandidates(lots, here, skip, { bearing: M.lotJump.bearing, pitch: M.lotJump.pitch }, Math.random, prefer)
    },
    async readLot(id, at) {
      const map = mapRef.current
      if (!map) return null
      if (!map.getSource(SRC)) await new Promise((r) => map.once('idle', r))
      const find = () => map.querySourceFeatures(SRC, { sourceLayer: 'labels', filter: ['==', ['get', 'id'], id] })[0]
      // Wait for the tiles under the lot, checking as each one arrives, for up to eight seconds.
      const settle = () =>
        new Promise<ReturnType<typeof find>>((resolve) => {
          const check = () => {
            const hit = find()
            if (hit) finish(hit)
          }
          const finish = (hit: ReturnType<typeof find>) => {
            clearTimeout(timer)
            map.off('sourcedata', check)
            map.off('idle', check)
            resolve(hit)
          }
          const timer = setTimeout(() => finish(find()), 8000)
          map.on('sourcedata', check)
          map.on('idle', check)
          check()
        })
      let f = find()
      if (!f && at) {
        // Details ride on the label points, which are in the tiles from zoom 15.
        if (map.getZoom() < 16) fly({ lon: at[0], lat: at[1] })
        f = await settle()
      }
      if (!f) return null
      const poly = map.querySourceFeatures(SRC, { sourceLayer: 'lots', filter: ['==', ['get', 'id'], id] })[0]
      const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
      return lotFromTile(id, f.properties ?? {}, poly?.properties ?? {}, lon, lat)
    },
  }))

  // Build the map once.
  useEffect(() => {
    if (!el.current) return
    if (!protocolAdded) {
      setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`)
      addProtocol('pmtiles', new Protocol({ metadata: true }).tile)
      addProtocol('shards', shardProtocol)
      protocolAdded = true
    }
    const p = live.current
    const start = p.initialLot
      ? { center: [p.initialLot.lon, p.initialLot.lat] as [number, number], zoom: M.lotJump.zoom, pitch: M.lotJump.pitch, bearing: M.lotJump.bearing }
      : p.hunt
        ? { center: M.value.center as [number, number], ...M.hunt.wide }
        : cameraFor(p.mode === 'changing' ? 'value' : p.mode, onPhone())
    let map: MapLibre
    try {
      map = new MapLibre({
        container: el.current,
        attributionControl: false,
        maxPitch: 70,
        // Tags snap in and out instead of ghosting through a slow fade.
        fadeDuration: 90,
        // Far enough out to see the whole state.
        minZoom: 5.5,
        maxZoom: 19.5,
        style: {
          version: 8,
          glyphs: '/glyphs/{fontstack}/{range}.pbf',
          sources: {},
          layers: [{ id: 'bg', type: 'background', paint: { 'background-color': color.paper } }],
          light: { anchor: 'viewport', color: M.light.color, intensity: M.light.intensity, position: M.light.position as [number, number, number] },
          // Haze in the paper color toward the horizon, so the city recedes instead of stopping at an edge.
          sky: { 'sky-color': color.card, 'horizon-color': color.paper, 'fog-color': color.paper, 'fog-ground-blend': 0.55, 'horizon-fog-blend': 0.6, 'sky-horizon-blend': 0.7, 'atmosphere-blend': 0 },
        },
        ...start,
      })
    } catch {
      p.onFail()
      return
    }
    if (p.initialLot) map.setPadding(onPhone() ? { top: 70, bottom: Math.round(window.innerHeight * 0.5), left: 0, right: 0 } : padding(false))
    mapRef.current = map
    // The smoke test reads the live map from here (rendered lots, the picked lot, the camera).
    ;(window as unknown as { __truffleMap?: MapLibre }).__truffleMap = map
    map.getCanvas().setAttribute('aria-label', 'Map of lots. Taller tiles are worth more per acre. Use the list of lots on screen to pick one with the keyboard.')
    map.keyboard.enable()

    // The map has failed when its lots can't load and nothing has drawn: say so, and keep search working.
    let failed = false
    let sourceErrors = 0
    const fail = () => {
      if (failed) return
      failed = true
      live.current.onFail()
    }
    map.on('error', (e) => {
      const err = e as unknown as { sourceId?: string; error?: { message?: string } }
      if (process.env.NODE_ENV !== 'production') console.warn('map:', err.error?.message)
      // The map around the lots is extra: if it fails the lots still stand, so only the lots count.
      if (err.sourceId !== BASE && (err.sourceId === SRC || /pmtiles|fetch|network/i.test(String(err.error?.message ?? '')))) sourceErrors++
      if (sourceErrors > 0 && ready.current && !map.queryRenderedFeatures({ layers: PICKABLE.filter((l) => map.getLayer(l)) }).length) fail()
    })
    map.on('webglcontextlost', fail)

    map.on('load', async () => {
      // The map around the lots, from OpenStreetMap: water and roads sit under the tiles (the streets
      // are the gaps between them), road and town names sit on top.
      const [lots, base] = await Promise.all([vectorSource('lots', live.current.tilesUrl), vectorSource('base', live.current.basemapUrl)])
      map.addSource(SRC, { ...lots, promoteId: { lots: 'id', labels: 'id' } })
      map.addSource(BASE, base)
      // Water in its own quiet tint, never the civic blue. The county draws rivers and lakes as lots too, and
      // files them under a civic use, so the water lies just over those flat lots (they sit at 1 m, or 3 m in
      // Rules) and the Intracoastal reads as water, not as one giant park.
      map.addLayer({
        id: 'water',
        type: 'fill-extrusion',
        source: BASE,
        'source-layer': 'water',
        paint: { 'fill-extrusion-color': color.water, 'fill-extrusion-height': waterHeight(live.current.mode), 'fill-extrusion-vertical-gradient': false },
      })
      map.addLayer({
        id: 'roads',
        type: 'line',
        source: BASE,
        'source-layer': 'roads',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'class'], ['highway', 'major'], tokenColor.vacantLeft, color.line],
          'line-width': [
            'interpolate', ['exponential', 1.6], ['zoom'],
            11, ['match', ['get', 'class'], 'highway', 1.6, 'major', 1, 0.4],
            18, ['match', ['get', 'class'], 'highway', 22, 'major', 16, 'minor', 10, 'service', 5, 2],
          ],
        },
      })
      for (const [name, opts] of [['pill', pillImage(color.card, 0.92)], ['pill-ink', pillImage(color.truffle, 1)], ['pin-ink', pinImage(color.truffle)]] as const) {
        map.addImage(name, opts.image, opts.options)
      }
      map.addLayer({
        id: 'value',
        type: 'fill-extrusion',
        source: SRC,
        'source-layer': 'lots',
        paint: {
          'fill-extrusion-color': valueColor(live.current.hunt),
          'fill-extrusion-height': valueHeight(live.current.hunt),
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'rules',
        type: 'fill-extrusion',
        source: SRC,
        'source-layer': 'lots',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['case', SEL, color.truffle, ZONE],
          'fill-extrusion-height': ['case', SEL, live.current.reduced ? M.rulesTileHeights.normal : M.rulesTileHeights.picked, M.rulesTileHeights.normal],
          'fill-extrusion-vertical-gradient': true,
        },
      })
      map.addLayer({
        id: 'changing-flat',
        type: 'fill',
        source: SRC,
        'source-layer': 'lots',
        layout: { visibility: 'none' },
        filter: ['==', ['get', 'c'], 0],
        paint: { 'fill-color': useColor.vacant, 'fill-outline-color': color.paper },
      })
      map.addLayer({
        id: 'changing',
        type: 'fill-extrusion',
        source: SRC,
        'source-layer': 'lots',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['case', SEL, color.truffle, ['==', ['get', 'c'], 1], USE, useColor.vacant],
          'fill-extrusion-height': [
            'case',
            SEL, live.current.reduced ? M.westBocaHeights.added2023on : M.westBocaHeights.picked,
            ['==', ['get', 'c'], 1], M.westBocaHeights.added2023on,
            M.westBocaHeights.older,
          ],
          'fill-extrusion-vertical-gradient': true,
        },
      })
      // After a call: the typical lot's height around it, as a pale level over its block, the way a stock chart
      // draws the last close as a dotted line. Lots that stand through it are worth more per acre than the
      // typical one around the called lot; lots under it, less. The called lot shows the answer by itself.
      map.addSource('level', { type: 'geojson', data: levelData(live.current.level) })
      map.addLayer({
        id: 'level',
        type: 'fill-extrusion',
        source: 'level',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-extrusion-color': color.paper,
          'fill-extrusion-opacity': live.current.level ? LEVEL_OPACITY : 0,
          'fill-extrusion-opacity-transition': { duration: T.motion.duration.label, delay: 0 },
          'fill-extrusion-height': ['get', 'h'],
          'fill-extrusion-base': ['get', 'b'],
          'fill-extrusion-vertical-gradient': false,
        },
      })
      // The hunt: the lot to call, outlined in truffle brown over everything around it, the way a game
      // outlines the unit you've selected even behind a wall.
      map.addLayer({
        id: 'target',
        type: 'line',
        source: SRC,
        'source-layer': 'lots',
        filter: ['==', ['get', 'id'], ''],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': color.truffle, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.5, 18, 3.5] },
      })
      // Road names follow the road; town and neighborhood names show from far out and give way close in.
      map.addLayer({
        id: 'road-names',
        type: 'symbol',
        source: BASE,
        'source-layer': 'roads',
        minzoom: 14,
        filter: ['has', 'name'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Gabarito SemiBold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11.5, 18, 14],
          'text-max-angle': 30,
          'symbol-spacing': 320,
          'text-padding': 6,
        },
        paint: { 'text-color': color.soft, 'text-halo-color': color.paper, 'text-halo-width': 1.6 },
      })
      map.addLayer({
        id: 'places',
        type: 'symbol',
        source: BASE,
        'source-layer': 'places',
        maxzoom: 15.5,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Gabarito Bold'],
          'text-size': ['match', ['get', 'kind'], 'city', 18, 'town', 16, 'village', 14, 13],
          'text-max-width': 8,
          'text-padding': 8,
        },
        paint: { 'text-color': color.truffle, 'text-halo-color': color.card, 'text-halo-width': 2 },
      })
      // What things are, on the map itself, the way a maps app or SimCity labels them: a dot in the use
      // color and the name. Shops and food in shop pink, schools, churches, parks and services in civic blue.
      map.addImage('dot-biz', dotImage(useColor.biz), { pixelRatio: 2 })
      map.addImage('dot-civic', dotImage(useColor.civic), { pixelRatio: 2 })
      map.addLayer({
        id: 'pois',
        type: 'symbol',
        source: BASE,
        'source-layer': 'pois',
        minzoom: 15.4,
        filter: ['match', ['get', 'kind'], ['parking', 'artwork', 'apartment', 'retail', 'company', 'university', 'pitch', 'bench', 'parking_entrance'], false, true],
        layout: {
          'icon-image': ['match', ['get', 'kind'], CIVIC_KINDS, 'dot-civic', 'dot-biz'],
          'text-field': ['get', 'name'],
          'text-font': ['Gabarito SemiBold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15.4, 11, 18, 13],
          'text-anchor': 'left',
          'text-offset': [0.7, 0],
          'text-max-width': 9,
          'text-padding': 4,
          'symbol-sort-key': ['match', ['get', 'kind'], MAJOR_POIS, 0, 1],
        },
        paint: { 'text-color': color.truffle, 'text-halo-color': color.paper, 'text-halo-width': 1.6 },
      })
      const tagLayout = {
        'text-field': TAG_TEXT,
        'text-max-width': 9,
        'text-line-height': 1.15,
        'text-font': ['Gabarito SemiBold'],
        'text-size': 11,
        'icon-image': 'pill',
        'icon-text-fit': 'both' as const,
        'icon-text-fit-padding': [1, 4, 1, 4] as [number, number, number, number],
        'text-anchor': 'bottom' as const,
        'icon-anchor': 'bottom' as const,
        'symbol-height-offset': H,
        'symbol-sort-key': ['-', 0, H] as ExpressionSpecification,
        'text-padding': padRef.current,
      }
      map.addLayer({
        id: 'tags',
        type: 'symbol',
        source: SRC,
        'source-layer': 'labels',
        minzoom: M.tagsFromZoom,
        filter: ['all', ['!=', ['get', 'id'], ''], TAGGED],
        layout: tagLayout,
        paint: { 'text-color': color.truffle },
      })
      map.addLayer({
        id: 'tag-picked',
        type: 'symbol',
        source: SRC,
        'source-layer': 'labels',
        minzoom: M.tagsFromZoom,
        filter: ['==', ['get', 'id'], ''],
        layout: { ...tagLayout, 'icon-image': 'pill-ink', 'text-allow-overlap': true, 'icon-allow-overlap': true },
        paint: { 'text-color': color.paper },
      })

      // Names on the map where the things they name are: each big zoning family on its own block in its own
      // color (Rules), and the land the new lots stand on with how many (Changing).
      const marks = live.current.marks ?? []
      for (const fill of new Set(marks.map((m) => m.fill))) {
        const img = pillImage(fill, fill === color.card ? 0.94 : 1)
        map.addImage(`mark-${fill}`, img.image, img.options)
      }
      map.addSource('marks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: marks.map((m) => ({ type: 'Feature', properties: { mode: m.mode, text: m.text, sub: m.sub ?? '', fill: m.fill, side: m.side }, geometry: { type: 'Point', coordinates: [m.lon, m.lat] } })) },
      })
      map.addLayer({
        id: 'marks',
        type: 'symbol',
        source: 'marks',
        filter: ['==', ['get', 'mode'], live.current.hunt ? '' : live.current.mode],
        layout: {
          'text-field': ['case', ['!=', ['get', 'sub'], ''], ['format', ['get', 'text'], {}, '\n', {}, ['get', 'sub'], { 'font-scale': 0.85, 'text-font': ['literal', ['Gabarito SemiBold']] }], ['get', 'text']],
          'text-font': ['Gabarito Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 17, 14],
          'text-line-height': 1.2,
          'text-max-width': ['match', ['get', 'side'], 'center', 12, 8],
          // A name beside its place sits off it by a little more than a letter, so the lots it names show.
          'text-anchor': ['match', ['get', 'side'], 'left', 'right', 'right', 'left', 'center'],
          'text-offset': ['match', ['get', 'side'], 'left', ['literal', [-1.4, 0]], 'right', ['literal', [1.4, 0]], ['literal', [0, 0]]],
          'icon-image': ['concat', 'mark-', ['get', 'fill']],
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [4, 8, 4, 8],
          'symbol-height-offset': ['match', ['get', 'mode'], 'changing', M.westBocaHeights.added2023on, M.rulesTileHeights.normal],
          // A handful per view, each the point of the view: they always show, and the map's other names make room.
          'text-allow-overlap': true,
          'icon-allow-overlap': true,
        },
        paint: { 'text-color': color.truffle },
      })

      // The level's tag, on its rim at its height: what the typical lot around is worth an acre.
      map.addLayer({
        id: 'level-tag',
        type: 'symbol',
        source: 'level',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Gabarito Bold'],
          'text-size': 12,
          'icon-image': 'pill',
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [3, 6, 3, 6],
          'text-anchor': 'center',
          'symbol-height-offset': ['get', 'h'],
          'text-allow-overlap': true,
          'icon-allow-overlap': true,
        },
        paint: { 'text-color': color.truffle, 'text-opacity-transition': { duration: T.motion.duration.label, delay: 0 }, 'icon-opacity-transition': { duration: T.motion.duration.label, delay: 0 } },
      })

      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
      for (const id of PICKABLE) {
        map.on('click', id, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0]
          if (!f) return
          e.preventDefault()
          live.current.onPick(String(f.id ?? f.properties?.id), [e.lngLat.lng, e.lngLat.lat])
        })
        // Only with a real mouse: on a phone, Safari sends a tap's hover events first, and a style change
        // while it does (the map hearing the pointer leave a lot) makes it drop the tap on a button.
        map.on('mouseenter', id, () => fine && (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', id, () => fine && (map.getCanvas().style.cursor = ''))
      }
      map.on('click', (e) => {
        if (!e.defaultPrevented) live.current.onPick(null)
      })
      // Point at a lot on the open map and read its value where you point, like a city builder's land value
      // cursor. Not in the fog (that would give the call away) and not on touch, where a tap picks.
      map.on('mousemove', 'value', (e: MapLayerMouseEvent) => {
        const t = tip.current
        const f = e.features?.[0]
        if (!t || !fine || live.current.hunt || !f) return
        const n = String(f.properties?.n ?? '')
        const use = useLegend.find((u) => u.key === useCode[String(f.properties?.u)])?.label ?? 'Other'
        const b = document.createElement('b')
        b.textContent = n ? `${tileMoney(n)} an acre` : 'Not valued'
        const line = document.createElement('span')
        line.textContent = use
        t.replaceChildren(b, line)
        t.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`
        t.style.opacity = '1'
      })
      const hide = () => {
        if (fine && tip.current && tip.current.style.opacity !== '0') tip.current.style.opacity = '0'
      }
      map.on('mouseleave', 'value', hide)
      map.on('movestart', hide)
      let drawn = false
      map.on('idle', () => {
        tidyTags(map)
        reportVisible(map)
        if (!drawn && map.queryRenderedFeatures({ layers: PICKABLE.filter((l) => map.getLayer(l)) }).length) {
          drawn = true
          live.current.onDrawn?.()
        }
      })
      ready.current = true
      applyMotion(map, wantsStill())
      applyMode(map, live.current.mode, true)
      applyPick(map, live.current.pickedId)
      applyHunt(map)
    })

    return () => {
      ready.current = false
      map.remove()
      mapRef.current = null
    }
    // The map is built once; everything after reads the latest props through live.current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function tidyTags(map: MapLibre) {
    // Keep about 40 numbers on screen: widen the gap between labels when more fit, narrow it when few do.
    if (live.current.mode !== 'value' || map.getZoom() < M.tagsFromZoom) return
    const n = new Set(map.queryRenderedFeatures({ layers: ['tags'] }).map((f) => f.id)).size
    const target = M.tagsMax
    const cap = 80
    let pad = padRef.current
    if (n > target + 4 && pad < cap) pad = Math.min(cap, pad + Math.max(6, Math.round((n - target) / 4)))
    else if (n < target * 0.6 && pad > 4) pad = Math.max(4, pad - 8)
    if (pad !== padRef.current) {
      padRef.current = pad
      map.setLayoutProperty('tags', 'text-padding', pad)
    }
  }

  function reportVisible(map: MapLibre) {
    const layer = live.current.mode
    const seen = new Set<string>()
    const out: { id: string; x: number; y: number }[] = []
    const fs = map.queryRenderedFeatures({ layers: [layer] })
    for (const f of fs) {
      const id = String(f.id ?? f.properties?.id)
      if (seen.has(id)) continue
      seen.add(id)
      if (layer === 'changing' && f.properties?.c !== 1) continue
      out.push({ id, x: 0, y: 0 })
      if (out.length >= M.tagsMax) break
    }
    live.current.onVisible(out.map((o) => o.id))
  }


  function valueColor(hunt: boolean): ExpressionSpecification {
    return hunt ? ['case', FOG, color.line, SEL, color.truffle, USE] : ['case', SEL, color.truffle, USE]
  }

  /** Height is land value per acre, for the picked lot too: it is never raised above what it's worth. The one
   * exception is no statement about value: a picked lot lying flat (unvalued, 1 m) comes up to the fog's
   * 1.2 m, so a lake or a canal you tapped shows truffle brown through the water drawn over it. */
  function valueHeight(hunt: boolean): ExpressionSpecification {
    const own: ExpressionSpecification = ['case', SEL, ['max', H, FOG_H], H]
    if (!hunt) return own
    return ['case', FOG, FOG_H, ['max', FOG_H, ['*', H, UP]]]
  }

  /** The hunt on or off: the lot to call under fog, the rest of the city lit. */
  function applyHunt(map: MapLibre) {
    const hunt = live.current.hunt
    map.setFilter('marks', ['==', ['get', 'mode'], hunt ? '' : live.current.mode])
    map.setPaintProperty('value', 'fill-extrusion-color', valueColor(hunt))
    map.setPaintProperty('value', 'fill-extrusion-height', valueHeight(hunt))
    if (!hunt) fogLot(map, null)
    applyTags(map)
    applyVerdict(map)
  }

  /** In the hunt the called block shows its numbers from the camera's own zoom, so the lot can be read
   * against its neighbors; elsewhere numbers wait until close in. The called lot carries its result. */
  function applyVerdict(map: MapLibre) {
    const hunt = live.current.hunt
    const from = hunt ? 14.5 : M.tagsFromZoom
    map.setLayerZoomRange('tags', from, 24)
    map.setLayerZoomRange('tag-picked', from, 24)
    const v = hunt ? live.current.verdict : null
    const asking = hunt && picked.current !== null && !v
    const said = live.current.verdictValue
    map.setLayoutProperty(
      'tag-picked',
      'text-field',
      asking
        ? ['format', '?', { 'text-font': ['literal', ['Gabarito Bold']] }]
        : v
          ? // The value comes from the record through the panel's own formatter, not from the tile's rounded label.
            ['format', v, { 'font-scale': 0.92 }, '\n', {}, said ? `${said} an acre` : ['concat', ['get', 'n'], 'M an acre'], { 'text-font': ['literal', ['Gabarito Bold']] }]
          : TAG_TEXT,
    )
    // The question mark floats just over the flat lot, big enough to find from across the block; the
    // answer rides on top of the risen one.
    map.setLayoutProperty('tag-picked', 'symbol-height-offset', asking ? FOG_H + 2 : H)
    map.setLayoutProperty('tag-picked', 'text-size', asking ? 16 : 11)
    map.setLayoutProperty('tag-picked', 'icon-image', asking ? 'pin-ink' : 'pill-ink')
    map.setLayoutProperty('tag-picked', 'icon-text-fit-padding', asking ? [5, 10, 5, 10] : [1, 4, 1, 4])
    map.setFilter('target', ['==', ['get', 'id'], asking ? picked.current! : ''])
    // Before the call the map shows heights and colors only, no numbers: the numbers are part of the answer,
    // as a map game shows the distance only after the guess.
    // Opacity, not visibility or spacing: those are layout, and changing layout makes the map re-read every
    // tile, which on a phone at the moment of the answer spent enough memory for Safari to drop the page.
    const shown = asking ? 0 : 1
    for (const prop of ['text-opacity', 'icon-opacity'] as const) {
      map.setPaintProperty('tags', prop, shown)
      // And fewer places named around it while you call: the big ones (a school, a park, a supermarket)
      // still show, so the call has its context without a wall of shop names.
      map.setPaintProperty('pois', prop, asking ? ['match', ['get', 'kind'], MAJOR_POIS, 1, 0] : 1)
    }
  }

  function applyTags(map: MapLibre) {
    const id = picked.current ?? ''
    map.setFilter('tag-picked', ['==', ['get', 'id'], id])
    map.setFilter('tags', ['all', ['!=', ['get', 'id'], id], TAGGED])
  }

  /** The hunt: put a lot under fog, and take it off the last one if that was never called. */
  function fogLot(map: MapLibre, id: string | null) {
    if (fogged.current !== null && fogged.current !== id) map.setFeatureState({ source: SRC, sourceLayer: 'lots', id: fogged.current }, { fog: false, up: 1 })
    fogged.current = id
    if (id === null) return
    const f = { source: SRC, sourceLayer: 'lots', id }
    // It lies still: the pin and the outline mark it. A breathing lot meant a feature-state update every frame,
    // which redraws the whole tile and kept Safari busy enough to drop a tap on the answers.
    map.setFeatureState(f, { fog: true, up: 0 })
  }

  /** The reveal: the fog comes off and the lot grows to its height, easing out. */
  function riseFromFog(map: MapLibre, id: string) {
    cancelAnimationFrame(fogAnim.current)
    if (fogged.current === id) fogged.current = null
    const f = { source: SRC, sourceLayer: 'lots', id }
    const still = wantsStill()
    map.setFeatureState(f, { fog: false, up: still ? 1 : 0 })
    if (still) return
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / M.hunt.riseMs)
      map.setFeatureState(f, { up: 1 - (1 - k) ** 3 })
      if (k < 1) fogAnim.current = requestAnimationFrame(step)
    }
    fogAnim.current = requestAnimationFrame(step)
  }

  /** Everything reduced motion changes: the picked heights in Rules and Changing, and drag momentum. */
  function applyMotion(map: MapLibre, reduced: boolean) {
    map.setPaintProperty('rules', 'fill-extrusion-height', ['case', SEL, reduced ? M.rulesTileHeights.normal : M.rulesTileHeights.picked, M.rulesTileHeights.normal])
    map.setPaintProperty('changing', 'fill-extrusion-height', [
      'case',
      SEL, reduced ? M.westBocaHeights.added2023on : M.westBocaHeights.picked,
      ['==', ['get', 'c'], 1], M.westBocaHeights.added2023on,
      M.westBocaHeights.older,
    ])
    applyVerdict(map)
    map.dragPan.enable(reduced ? { maxSpeed: 0, deceleration: 1e9, linearity: 0 } : {})
  }

  function applyMode(map: MapLibre, mode: Mode, first: boolean) {
    for (const [m, ids] of Object.entries(LAYERS)) for (const id of ids) map.setLayoutProperty(id, 'visibility', m === mode ? 'visible' : 'none')
    map.setFilter('marks', ['==', ['get', 'mode'], live.current.hunt ? '' : mode])
    map.setPaintProperty('water', 'fill-extrusion-height', waterHeight(mode))
    const p = live.current
    const phone = onPhone()
    const duration = first || wantsStill() ? 0 : T.motion.cameraMs
    if (first && (p.initialLot || p.hunt)) return
    if (mode === 'changing') {
      // The bounds are label points; widen them a quarter so whole lots and their streets show.
      const [w0, s0, e0, n0] = p.westBounds
      const dx = (e0 - w0) * 0.25, dy = (n0 - s0) * 0.25
      const [w, s, e, n] = [w0 - dx, s0 - dy, e0 + dx, n0 + dy]
      const pad = phone ? { top: 70, bottom: Math.round(window.innerHeight * 0.5), left: 20, right: 20 } : { top: 90, bottom: 60, left: 60, right: 460 }
      map.fitBounds([[w, s], [e, n]], { padding: pad, pitch: M.changing.pitch, bearing: M.changing.bearing, duration })
    } else {
      map.easeTo({ ...cameraFor(mode, phone), padding: padding(phone), duration })
    }
  }

  function applyPick(map: MapLibre, id: string | null) {
    if (picked.current !== null) map.setFeatureState({ source: SRC, sourceLayer: 'lots', id: picked.current }, { sel: false })
    picked.current = id
    if (live.current.hunt) fogLot(map, id !== null && !live.current.verdict ? id : null)
    // Truffle brown marks it; its height stays its value per acre.
    if (id !== null) map.setFeatureState({ source: SRC, sourceLayer: 'lots', id }, { sel: true })
    applyTags(map)
    applyVerdict(map)
  }

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyMode(map, props.mode, false)
    // The apply functions read the map and props through refs, so only the prop that changed matters.
     
  }, [props.mode])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyPick(map, props.pickedId)
    // The apply functions read the map and props through refs, so only the prop that changed matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pickedId])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyVerdict(map)
    // The apply functions read the map and props through refs, so only the prop that changed matters.
     
  }, [props.verdict, props.verdictValue])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const src = map.getSource('level') as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined
    src?.setData?.(levelData(props.level))
    // The level fades in once the lot has risen, so the rise is seen first, then what it's measured against.
    // It starts from nothing each time (cleared with the last lot), so the fade never shows the old one.
    const show = (on: boolean) => {
      map.setPaintProperty('level', 'fill-extrusion-opacity', on ? LEVEL_OPACITY : 0)
      for (const prop of ['text-opacity', 'icon-opacity'] as const) map.setPaintProperty('level-tag', prop, on ? 1 : 0)
    }
    if (!props.level || wantsStill()) return show(!!props.level)
    const t = window.setTimeout(() => show(true), M.hunt.riseMs)
    return () => window.clearTimeout(t)
  }, [props.level])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyHunt(map)
    // The apply functions read the map and props through refs, so only the prop that changed matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.hunt])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyMotion(map, props.reduced)
    // The apply functions read the map and props through refs, so only the prop that changed matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.reduced])

  return (
    <div className="fixed inset-0" data-testid="board">
      <div ref={el} className="h-full w-full" />
      <div
        ref={tip}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-[4] flex flex-col rounded-sm bg-truffle px-3 py-2 text-ui-label font-semibold text-paper/75 opacity-0 shadow-pill transition-opacity duration-(--motion-tap) [&>b]:text-ui-small [&>b]:font-extrabold [&>b]:text-paper"
      />
    </div>
  )
})
