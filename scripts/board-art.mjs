// The board as a picture: every lot's outline extruded to its height, at the map's own camera, light from the
// upper left, use colors from the tokens. The share cards (brand/share/*.svg) and the brand kit's banners
// (scripts/brand.mjs) both draw from here, from the same tiles the map serves (data/tiles/lots.pmtiles), so a
// new pull or a new color reaches every picture with no hand redraw.
import { open } from 'node:fs/promises'
import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import tokens from '../brand/tokens.json' with { type: 'json' }

const C = tokens.color
export const USE = { h: C.use.homes, b: C.use.biz, c: C.use.civic, v: C.use.vacant, o: C.use.other }

/** A side a step darker than a top color, for colors the tokens give only a top for (zoning). */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}
export const tri = (top) => [top, shade(top, 0.89), shade(top, 0.78)]

// Zoom 13 holds every lot of each Boca area in one or two tiles, about a meter to a tile unit: enough for a
// picture, with few lots cut by a tile's edge. A lot that is cut is clipped to each tile's exact square and
// drawn as its pieces, so nothing is drawn twice.
const ZOOM = 13

/** Clip a ring to the square [0, e] (Sutherland and Hodgman, one edge at a time). */
function clip(ring, e) {
  const edges = [
    [(p) => p[0] >= 0, (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])] }],
    [(p) => p[0] <= e, (a, b) => { const t = (e - a[0]) / (b[0] - a[0]); return [e, a[1] + t * (b[1] - a[1])] }],
    [(p) => p[1] >= 0, (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0] }],
    [(p) => p[1] <= e, (a, b) => { const t = (e - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), e] }],
  ]
  let out = ring
  for (const [inside, cut] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[i]
      const b = src[(i + 1) % src.length]
      if (inside(a)) {
        out.push(a)
        if (!inside(b)) out.push(cut(a, b))
      } else if (inside(b)) out.push(cut(a, b))
    }
    if (!out.length) return out
  }
  return out
}

const area = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2

/** A PMTiles reader over a local file, or over HTTP range requests when given a URL. */
async function openTiles(file) {
  if (/^https?:\/\//.test(file)) return { pm: new PMTiles(file), close: async () => {} }
  const fh = await open(file)
  const source = {
    getKey: () => file,
    getBytes: async (offset, length) => {
      const b = Buffer.alloc(length)
      await fh.read(b, 0, length, offset)
      return { data: b.buffer.slice(b.byteOffset, b.byteOffset + length) }
    },
  }
  return { pm: new PMTiles(source), close: () => fh.close() }
}

const tileX = (lon, n) => Math.floor(((lon + 180) / 360) * n)
const tileY = (lat, n) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n)

/** The lots in tiles x0..x1, y0..y1 at a zoom, each lot's pieces joined under its id. */
async function lotsFromTiles(pm, zoom, x0, x1, y0, y1) {
  const n = 2 ** zoom
  const byId = new Map()
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const t = await pm.getZxy(zoom, x, y)
      if (!t) continue
      const layer = new VectorTile(new PbfReader(new Uint8Array(t.data))).layers.lots
      if (!layer) continue
      const e = layer.extent
      const lonLat = ([px, py]) => {
        const gx = (x + px / e) / n
        const gy = (y + py / e) / n
        return [+(gx * 360 - 180).toFixed(7), +((Math.atan(Math.sinh(Math.PI * (1 - 2 * gy))) * 180) / Math.PI).toFixed(7)]
      }
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i)
        const p = f.properties
        if (typeof p.id !== 'string') continue
        // Outer rings wind clockwise in tile units (y down), which is a positive area here; holes are left out,
        // as the map's own share art always has.
        const rings = f
          .loadGeometry()
          .map((r) => clip(r.map((q) => [q.x, q.y]), e))
          .filter((r) => r.length >= 3 && area(r) > 0.5)
          .map((r) => [...r, r[0]].map(lonLat))
        if (!rings.length) continue
        const lot = byId.get(p.id) ?? { id: p.id, h: Number(p.h ?? 0), u: p.u ?? 'o', z: p.z ?? 'none', c: Number(p.c ?? 0), rings: [] }
        lot.rings.push(...rings)
        byId.set(p.id, lot)
      }
    }
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Every lot in the tiles: id, height (h), use (u), zoning family (z), added since 2023 (c), outer rings in lon/lat. */
export async function readLots(file = 'data/tiles/lots.pmtiles') {
  const { pm, close } = await openTiles(file)
  try {
    const head = await pm.getHeader()
    const n = 2 ** ZOOM
    return await lotsFromTiles(pm, ZOOM, tileX(head.minLon, n), tileX(head.maxLon, n), tileY(head.maxLat, n), tileY(head.minLat, n))
  } finally {
    await close()
  }
}

/**
 * The lots within about `radius` meters of `center` (lon, lat), read from only the tiles that cover it, so a
 * share card can be drawn for one lot on request from a county's or the state's file (a path or a URL).
 * Zoom 15 keeps every lot a person can tap; a file that stops lower is read at its own deepest zoom.
 */
export async function readLotsNear(file, center, radius, zoom = 15) {
  const { pm, close } = await openTiles(file)
  try {
    const head = await pm.getHeader()
    const z = Math.min(zoom, head.maxZoom)
    const n = 2 ** z
    const [lon, lat] = center
    const dLat = radius / 110_540
    const dLon = radius / (111_320 * Math.cos((lat * Math.PI) / 180))
    return await lotsFromTiles(pm, z, tileX(lon - dLon, n), tileX(lon + dLon, n), tileY(lat + dLat, n), tileY(lat - dLat, n))
  } finally {
    await close()
  }
}

/** The middle of a lot's first ring. */
export const middle = (lot) => {
  const r = lot.rings[0].slice(0, -1)
  return r.reduce((a, q) => [a[0] + q[0] / r.length, a[1] + q[1] / r.length], [0, 0])
}

// Gabarito Bold's question mark, read from assets/fonts/Gabarito-Bold.ttf with fontTools (units of 1000 to the
// em, y up), so the pin on the share card carries the same glyph the map sets in it.
const QUESTION =
  'M243 213 170 325 239 372Q282 401 307.0 421.5Q332 442 343.0 461.5Q354 481 354 505Q354 535 333.0 554.5Q312 574 280 574Q253 574 222.0 560.5Q191 547 149 508L117 480L28 586L50 607Q97 656 155.0 686.0Q213 716 283 716Q350 716 399.5 689.0Q449 662 476.0 615.5Q503 569 503 512Q503 464 486.5 424.0Q470 384 432.0 347.0Q394 310 331 270ZM268 -7Q229 -7 201.5 20.0Q174 47 174 86Q174 125 201.5 152.5Q229 180 268 180Q307 180 334.5 152.5Q362 125 362 86Q362 47 334.5 20.0Q307 -7 268 -7Z'
const QUESTION_WIDTH = 543

/**
 * Draws the lots around `center` (lon, lat) within `radius` meters at a pitch and bearing, styled per lot by
 * `style(lot)` ({ h, colors: [top, left, right, stroke?] } or null to leave it out). The frame is `crop`:
 * `{ scale, at: [x, y], size: [w, h] }` in ground meters (px = meters * scale), or `{ fit: [l, t, r, b] }` to
 * fit the lots marked `fit` into that box of a 1200 by 630 card. `mark` puts the front door's call on one lot:
 * its outline in truffle over everything, and the pin with a question mark over it.
 * Returns `{ svg, inner, viewBox, width, height }`: the whole file, or its parts to set inside a bigger picture.
 */
export function draw(lots, { center, radius, pitch, bearing, crop, style, mark = null, background = C.paper }) {
  const [lon0, lat0] = center
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110_540
  const b = (bearing * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  // Ground meters to screen: rotate by the bearing, foreshorten the ground by the pitch, lift by height.
  const ground = ([lon, lat]) => {
    const x = (lon - lon0) * kx
    const y = (lat - lat0) * ky
    return [x * Math.cos(b) - y * Math.sin(b), x * Math.sin(b) + y * Math.cos(b)]
  }
  const screen = ([r, u], z) => [r, -u * Math.cos(p) - z * Math.sin(p)]
  const prisms = []
  for (const lot of lots) {
    const s = style(lot)
    if (!s) continue
    for (const ring of lot.rings) {
      const g = ring.map(ground)
      const mid = g.reduce((a, q) => [a[0] + q[0] / g.length, a[1] + q[1] / g.length], [0, 0])
      if (Math.hypot(...mid) > radius) continue
      prisms.push({ g, mid, ...s })
    }
  }
  // Far lots first, so near ones cover them.
  prisms.sort((a, b2) => b2.mid[1] - a.mid[1])
  const pt = (q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`
  const out = []
  for (const { g, h, colors, base = 0 } of prisms) {
    // Outline winding decides which way each wall faces.
    let a = 0
    for (let i = 0; i < g.length - 1; i++) a += g[i][0] * g[i + 1][1] - g[i + 1][0] * g[i][1]
    const ccw = a > 0
    const walls = []
    for (let i = 0; i < g.length - 1; i++) {
      const [s0, s1] = [g[i], g[i + 1]]
      const [dr, du] = [s1[0] - s0[0], s1[1] - s0[1]]
      const nrm = ccw ? [du, -dr] : [-du, dr] // outward normal on the ground
      if (nrm[1] >= 0 || Math.hypot(dr, du) < 0.05) continue // faces away from the camera
      walls.push({ a: s0, c: s1, depth: (s0[1] + s1[1]) / 2, fill: nrm[0] < 0 ? colors[1] : colors[2] })
    }
    walls.sort((w1, w2) => w2.depth - w1.depth)
    if (h > 0.4)
      for (const w of walls)
        out.push(`<path d="M${pt(screen(w.a, base))}L${pt(screen(w.c, base))}L${pt(screen(w.c, base + h))}L${pt(screen(w.a, base + h))}Z" fill="${w.fill}"/>`)
    out.push(`<path d="M${g.map((q) => pt(screen(q, base + h))).join('L')}Z" fill="${colors[0]}" stroke="${colors[3] ?? C.paper}" stroke-width="SW" stroke-linejoin="round"/>`)
  }
  // A frame can fit itself to the lots marked `fit`: their extent plus a margin, at the card's shape.
  if (crop.fit) {
    const pts = prisms.filter((q) => q.fit).flatMap((q) => q.g.map((v) => screen(v, q.h)))
    const [minX, maxX] = [Math.min(...pts.map((v) => v[0])), Math.max(...pts.map((v) => v[0]))]
    const [minY, maxY] = [Math.min(...pts.map((v) => v[1])), Math.max(...pts.map((v) => v[1]))]
    const [l, t, r, b2] = crop.fit
    const scale = Math.min((r - l) / (maxX - minX), (b2 - t) / (maxY - minY))
    const at = [(minX + maxX) / 2 - ((l + r) / 2 - 600) / scale, (minY + maxY) / 2 - ((t + b2) / 2 - 315) / scale]
    crop = { size: [1200 / scale, 630 / scale], scale, at }
  }
  // The front door's call: the lot under fog outlined over everything, and the pin with its question mark.
  if (mark) {
    const lot = lots.find((l) => l.id === mark.id)
    if (lot) {
      const lw = (mark.line ?? 3) / crop.scale
      for (const ring of lot.rings)
        out.push(`<path d="M${ring.map((q) => pt(screen(ground(q), mark.h))).join('L')}Z" fill="none" stroke="${C.truffle}" stroke-width="${lw.toFixed(2)}" stroke-linejoin="round"/>`)
      const [tipX, tipY] = screen(ground(middle(lot)), mark.h + 2)
      // The map's pin at its 1x size (a 28 by 18 pill, radius 7, a 6 px tail), set to fit a 16 px question
      // mark, then grown by `mark.px` for the card.
      const k = (mark.px ?? 2) / crop.scale
      const body = 26 * k
      const w = 36 * k
      const tail = 6 * k
      const top = tipY - tail - body
      const left = tipX - w / 2
      const r = 7 * k
      const f = (v) => v.toFixed(2)
      out.push(
        `<path d="M${f(left + r)} ${f(top)}H${f(left + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(left + w)} ${f(top + r)}V${f(top + body - r)}A${f(r)} ${f(r)} 0 0 1 ${f(left + w - r)} ${f(top + body)}H${f(tipX + 4 * k)}L${f(tipX)} ${f(tipY)}L${f(tipX - 4 * k)} ${f(top + body)}H${f(left + r)}A${f(r)} ${f(r)} 0 0 1 ${f(left)} ${f(top + body - r)}V${f(top + r)}A${f(r)} ${f(r)} 0 0 1 ${f(left + r)} ${f(top)}Z" fill="${C.truffle}"/>`,
      )
      // 16 px Gabarito Bold, flipped to y down, its ink (-7 to 716 font units) centered on the pill.
      const em = (16 * k) / 1000
      const gx = tipX - (QUESTION_WIDTH * em) / 2
      const gy = top + body / 2 + ((716 - 7) / 2) * em
      out.push(`<path transform="translate(${f(gx)} ${f(gy)}) scale(${(em).toFixed(5)} ${(-em).toFixed(5)})" d="${QUESTION}" fill="${C.paper}"/>`)
    }
  }
  const [w, hgt] = crop.size
  const [x0, y0] = crop.at
  const inner = out.join('').replaceAll('stroke-width="SW"', `stroke-width="${(0.55 / crop.scale).toFixed(2)}"`)
  const viewBox = `${(x0 - w / 2).toFixed(2)} ${(y0 - hgt / 2).toFixed(2)} ${w.toFixed(2)} ${hgt.toFixed(2)}`
  const width = Math.round(w * crop.scale)
  const height = Math.round(hgt * crop.scale)
  const ground0 = background ? `<rect x="${(x0 - w / 2).toFixed(2)}" y="${(y0 - hgt / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${hgt.toFixed(2)}" fill="${background}"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${ground0}${inner}</svg>\n`
  return { svg, inner: ground0 + inner, viewBox, width, height }
}

/**
 * The board exactly as the map's camera sees it, perspective and all: MapLibre's 36.87 degree field of view,
 * 512 px tiles, the camera `zoom`, `pitch` and `bearing` over `center`, for a viewport `viewH` tall. The picture
 * is `width` by `height` CSS pixels with the camera's center in its middle, so set at 1:1 in the middle of any
 * screen it lines up with the map that draws over it a second later (the front door's first frame).
 */
export function drawView(lots, { center, zoom, pitch, bearing, width, height, viewH, style, background = C.paper }) {
  const [lon0, lat0] = center
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110_540
  const s = (512 * 2 ** zoom) / (40_075_016.686 * Math.cos((lat0 * Math.PI) / 180))
  const D = (0.5 * viewH) / Math.tan(0.6435011087932844 / 2)
  const b = (bearing * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  const [sp, cp] = [Math.sin(p), Math.cos(p)]
  const ground = ([lon, lat]) => {
    const x = (lon - lon0) * kx
    const y = (lat - lat0) * ky
    return [x * Math.cos(b) - y * Math.sin(b), x * Math.sin(b) + y * Math.cos(b)]
  }
  // A point r meters right and u meters ahead of the center, z meters up, to the screen.
  const depthOf = (u, z) => u * s * sp + D - z * s * cp
  const screen = ([r, u], z) => {
    const depth = depthOf(u, z)
    return [width / 2 + (D * r * s) / depth, height / 2 - (D * (u * s * cp + z * s * sp)) / depth]
  }
  const prisms = []
  for (const lot of lots) {
    const st = style(lot)
    if (!st) continue
    for (const ring of lot.rings) {
      const g = ring.map(ground)
      const mid = g.reduce((a, q) => [a[0] + q[0] / g.length, a[1] + q[1] / g.length], [0, 0])
      if (depthOf(mid[1], 0) < D * 0.2) continue // behind or right under the camera
      const [mx, my] = screen(mid, 0)
      if (mx < -200 || mx > width + 200 || my < -200 || my > height + 200) continue
      prisms.push({ g, mid, ...st })
    }
  }
  prisms.sort((a, b2) => b2.mid[1] - a.mid[1])
  const pt = (q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`
  const out = []
  for (const { g, h, colors } of prisms) {
    let a = 0
    for (let i = 0; i < g.length - 1; i++) a += g[i][0] * g[i + 1][1] - g[i + 1][0] * g[i][1]
    const ccw = a > 0
    if (h > 0.4)
      for (let i = 0; i < g.length - 1; i++) {
        const [s0, s1] = [g[i], g[i + 1]]
        const [dr, du] = [s1[0] - s0[0], s1[1] - s0[1]]
        const nrm = ccw ? [du, -dr] : [-du, dr]
        if (nrm[1] >= 0 || Math.hypot(dr, du) < 0.05) continue
        out.push(`<path d="M${pt(screen(s0, 0))}L${pt(screen(s1, 0))}L${pt(screen(s1, h))}L${pt(screen(s0, h))}Z" fill="${nrm[0] < 0 ? colors[1] : colors[2]}"/>`)
      }
    out.push(`<path d="M${g.map((q) => pt(screen(q, h))).join('L')}Z" fill="${colors[0]}" stroke="${colors[3] ?? C.paper}" stroke-width="0.5" stroke-linejoin="round"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${background}"/>${out.join('')}</svg>\n`
}
