// Draws every brand file from two sources: the mark's construction, drawn here with true arcs, and the
// wordmark (brand/wordmark.svg), kept exactly as drawn and only recolored. Colors come from brand/tokens.json;
// the board in the banners comes from the lots the map serves (scripts/board-art.mjs). Out of it come the
// site's icons and the brand kit in public/brand/, the files /brand offers. The art behind the share cards
// (brand/share/*.svg) is committed as drawn and read from there. Change the construction, the wordmark or a
// token once and every file follows: the build runs this first (prebuild), and tests/brand.test.ts fails when
// a committed file is not what this draws.
// Run: npm run brand
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { crc32, deflateRawSync } from 'node:zlib'
import sharp from 'sharp'
import tokens from '../brand/tokens.json' with { type: 'json' }
import { USE, draw, drawView, readLots } from './board-art.mjs'
import { pairs, ratio } from './contrast.mjs'
import { COLOR_ROWS, dtcgText } from './tokens.mjs'

// The lot /built follows, which its share card stands in truffle brown (tests/brand.test.ts holds the two together).
export const MIZNER_PLAZA = '06434720280000070'

const C = tokens.color
const BROWN = C.truffle
const CREAM = C.paper
const CAP = C.use.homes[0]

// The t in construction units. The cap is a perfect semicircle on the x-height (445). The stem is as wide as
// every stroke (360 to 530) and starts one gap (24) under the cap. The foot turns on two circles around
// (595, 700), radius 235 outside and 65 inside, onto the baseline (935), and the tail ends in a half circle.
const G = { cx: 445, xh: 445, r: 215, left: 360, right: 530, top: 469, fx: 595, fy: 700, ro: 235, ri: 65, tail: 605, base: 935, rt: 85 }

/** The mark's two shapes, placed so the cap's center lands on (cx, cy) at scale s. */
export function markPaths(cx, cy, s, gap = G.top - G.xh) {
  const X = (x) => +(cx + (x - G.cx) * s).toFixed(3)
  const Y = (y) => +(cy + (y - G.xh) * s).toFixed(3)
  const R = (r) => +(r * s).toFixed(3)
  const cap = `M${X(G.cx - G.r)} ${Y(G.xh)}A${R(G.r)} ${R(G.r)} 0 0 1 ${X(G.cx + G.r)} ${Y(G.xh)}Z`
  const stem =
    `M${X(G.left)} ${+(Y(G.xh) + gap * s).toFixed(3)}H${X(G.right)}V${Y(G.fy)}` +
    `A${R(G.ri)} ${R(G.ri)} 0 0 0 ${X(G.fx)} ${Y(G.fy + G.ri)}H${X(G.tail)}` +
    `A${R(G.rt)} ${R(G.rt)} 0 0 1 ${X(G.tail)} ${Y(G.base)}H${X(G.fx)}` +
    `A${R(G.ro)} ${R(G.ro)} 0 0 1 ${X(G.left)} ${Y(G.fy)}Z`
  return { cap, stem }
}

// The icon keeps the placement the brand files have always had: cap center at (48.7, 38.3) in a 100 box,
// which leaves the cap's height clear on every side.
const ICON = { cx: 48.7, cy: 38.3, s: 18.3 / 215 }
// iOS and Android round the corners themselves; the browser icon carries its own.
const ROUND = 22.37

function iconSvg({ rx = ROUND, capColor = CAP, stemColor = CREAM, bg = BROWN, place = ICON, gap } = {}) {
  const { cap, stem } = markPaths(place.cx, place.cy, place.s, gap)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100"${rx ? ` rx="${rx}"` : ''} fill="${bg}"/><path d="${stem}" fill="${stemColor}"/><path d="${cap}" fill="${capColor}"/></svg>\n`
}

// The mark alone, filling its box the way brand/mushroom.svg always has.
function mushroomSvg(fill, capFill = fill) {
  const { cap, stem } = markPaths(47.9, 30.9, 29.9 / 215)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${stem}" fill="${fill}"/><path d="${cap}" fill="${capFill}"/></svg>\n`
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * Math.ceil(size / 100) * 4 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

/** An SVG drawn at exactly w by h pixels, no resampling: the root gets that size and renders at 1 unit a pixel. */
function raster(svg, w, h, { background } = {}) {
  const sized = svg.replace(/^<svg /, `<svg width="${w}" height="${h}" preserveAspectRatio="none" `)
  let img = sharp(Buffer.from(sized), { density: 72 })
  if (background) img = img.flatten({ background })
  return img.png({ compressionLevel: 9 }).toBuffer()
}

/** An .ico that holds PNGs, which every current browser reads. */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e)
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map((i) => i.data)])
}

// Tab icons at 16 and 32 px get their own hinting: the mark a quarter larger, the cap's flat edge and the
// stem's left edge on whole pixels, and at least one pixel of gap under the cap so it doesn't blur shut.
function hinted(px) {
  const unit = 100 / px
  const k = 1.25
  const s = ICON.s * k
  const snap = (v) => Math.round(v / unit) * unit
  const cy = snap(50 + (ICON.cy - 50) * k)
  const cx = snap(50 + (ICON.cx - 50) * k + (G.left - G.cx) * s) - (G.left - G.cx) * s
  const gap = Math.max(G.top - G.xh, unit / s)
  return iconSvg({ place: { cx, cy, s }, gap })
}

// The wordmark: its letters in one path and the t's cap in another, recolored and never redrawn.
const WORD = await readFile('brand/wordmark.svg', 'utf8')
const WORD_BOX = WORD.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number)
function wordmarkSvg(letters, cap = letters) {
  let i = 0
  const out = WORD.replace(/fill="#[0-9A-Fa-f]{6}"/g, () => `fill="${i++ === 0 ? letters : cap}"`)
  if (i !== 2) throw new Error('brand/wordmark.svg should have two filled paths: the letters, then the cap')
  return out
}
/** The wordmark's paths, to set inside a bigger picture at (x, y), w wide. */
const wordmarkAt = (x, y, w, letters = BROWN, cap = letters) =>
  `<svg x="${x}" y="${y}" width="${w}" height="${+((w * WORD_BOX[1]) / WORD_BOX[0]).toFixed(2)}" viewBox="0 0 ${WORD_BOX.join(' ')}">${wordmarkSvg(letters, cap).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`

// The variants. Color is the wordmark as drawn, truffle brown for light grounds; reversed is the brand book's
// version for dark grounds, paper with the cap in homes yellow; black and white are for one-color use.
const LOGO = { color: [BROWN, BROWN], reversed: [CREAM, CAP], black: ['#000000', '#000000'], white: ['#FFFFFF', '#FFFFFF'] }
const MARK = { color: [BROWN, BROWN], reversed: [CREAM, CAP], black: ['#000000', '#000000'], white: ['#FFFFFF', '#FFFFFF'] }

// The board for the banners: every lot downtown at its height in its use color, and the front door's first lot
// in truffle brown, the one lot you picked. Never a home: it is an ordinary business lot.
const boardStyle = (l) => (l.id === tokens.map.hunt.first ? { h: l.h, colors: [C.truffle, C.truffleSide, C.truffle, C.truffle] } : { h: l.h, colors: USE[l.u] ?? USE.o })

/**
 * A banner: the board across the whole frame at the map's camera, paper coming in from one side under the
 * wordmark, as the share cards do. `at` is where the frame's middle sits on the board (ground meters after the
 * camera turns, y up the screen), `scale` pixels a meter; `fade` runs paper from `solid` to clear at `clear`,
 * as fractions of the width (x) or height (y); `logo` is the wordmark's place and width in pixels.
 */
function banner(lots, { W, H, scale, at, fade, logo }) {
  const v = tokens.map.value
  const board = draw(lots, { center: v.center, radius: 3000, pitch: v.pitch, bearing: v.bearing, crop: { scale, at, size: [W / scale, H / scale] }, style: boardStyle })
  const [x2, y2] = fade.dir === 'y' ? [0, H] : [W, 0]
  const stop = (o, a) => `<stop offset="${o}" stop-color="${C.paper}" stop-opacity="${a}"/>`
  const m = fade.solid + (fade.clear - fade.solid) / 3
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
    `<svg x="0" y="0" width="${W}" height="${H}" viewBox="${board.viewBox}" preserveAspectRatio="none">${board.inner}</svg>` +
    `<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${x2}" y2="${y2}">${stop(0, 1)}${stop(fade.solid, 1)}${stop(+m.toFixed(3), 0.9)}${stop(fade.clear, 0)}</linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#fade)"/>` +
    wordmarkAt(logo.x, logo.y, logo.w) +
    `</svg>\n`
  )
}

// Each network's banner at its own size, with what each one crops or covers kept clear (KIT-SPEC.md). The
// board's middle is downtown's core (Federal Highway and Mizner Park, about 100 m west and 200 m up the screen
// from the map's own center), set in the middle of what the paper leaves showing (`show`, in pixels).
const CORE = [-100, -200]
const frameAt = (W, scale, show, dy = 0) => [+(CORE[0] - (show - W / 2) / scale).toFixed(1), CORE[1] + dy]
const SOCIAL = [
  // Link previews: X trims the sides, so the wordmark sits well in from the left edge.
  { file: 'og-1200x630.png', W: 1200, H: 630, scale: 1.55, at: frameAt(1200, 1.55, 900), fade: { solid: 0.34, clear: 0.6 }, logo: { x: 88, y: 252, w: 400 } },
  { file: 'github-social-1280x640.png', W: 1280, H: 640, scale: 1.55, at: frameAt(1280, 1.55, 960), fade: { solid: 0.34, clear: 0.6 }, logo: { x: 96, y: 256, w: 420 } },
  // X: up to 60 px cut top and bottom, the profile photo over the lower left. The wordmark rides the middle band.
  { file: 'x-header-1500x500.png', W: 1500, H: 500, scale: 1.5, at: frameAt(1500, 1.5, 1120), fade: { solid: 0.36, clear: 0.58 }, logo: { x: 150, y: 168, w: 380 } },
  // LinkedIn: the company logo sits over the lower left of the cover, the profile photo over the personal one.
  { file: 'linkedin-cover-1512x256.png', W: 1512, H: 256, scale: 1.4, at: frameAt(1512, 1.4, 1180), fade: { solid: 0.42, clear: 0.6 }, logo: { x: 300, y: 80, w: 320 } },
  { file: 'linkedin-banner-1584x396.png', W: 1584, H: 396, scale: 1.5, at: frameAt(1584, 1.5, 1250), fade: { solid: 0.44, clear: 0.64 }, logo: { x: 380, y: 132, w: 380 } },
  // YouTube: only the middle 1546 by 423 shows everywhere, so the wordmark and the core sit inside it.
  { file: 'youtube-banner-2560x1440.png', W: 2560, H: 1440, scale: 2.1, at: frameAt(2560, 2.1, 1640), fade: { solid: 0.4, clear: 0.56 }, logo: { x: 560, y: 636, w: 520 } },
  // Instagram and stories: paper from the top. A story keeps its top 250 px and bottom 340 px clear.
  { file: 'instagram-1080x1080.png', W: 1080, H: 1080, scale: 1.7, at: frameAt(1080, 1.7, 540, -30), fade: { dir: 'y', solid: 0.22, clear: 0.46 }, logo: { x: 88, y: 96, w: 440 } },
  { file: 'instagram-1080x1350.png', W: 1080, H: 1350, scale: 1.7, at: frameAt(1080, 1.7, 540, -60), fade: { dir: 'y', solid: 0.2, clear: 0.42 }, logo: { x: 88, y: 112, w: 440 } },
  { file: 'story-1080x1920.png', W: 1080, H: 1920, scale: 1.9, at: frameAt(1080, 1.9, 540, -80), fade: { dir: 'y', solid: 0.26, clear: 0.42 }, logo: { x: 240, y: 300, w: 600 } },
]

// The kit's README, in plain words: what each folder is for, the two rules, and the type's licence.
const readme = (version) => `Truffle brand kit
Version ${version.sha}, ${version.date}. The latest is always at https://www.truffle.city/brand

logo/    The wordmark, whose t is a mushroom. color is for light grounds, reversed for dark ones,
         black and white for one-color use. The SVGs are the masters; the PNGs are 512, 1024 and
         2048 px wide, on a transparent ground.
mark/    The t on its own: color, reversed, black, white, and tile (the app icon). SVG, and PNG
         from 64 to 1024 px.
app/     The icons the site serves, byte for byte: the tab icon, the iPhone icon, the install icons.
social/  Avatars and banners at each network's own size, drawn from the board: the real lots of
         Downtown Boca Raton, height is land value per acre, color is what each lot is used for.
email/   The wordmark for an email signature: 400 px wide, to show at 200. On white, and clear.
colors/  The color tokens as JSON and CSS, and colors.md: each color's role, HEX, RGB, an
         approximate CMYK, and the contrast pairs the product is held to.
type/    Gabarito, the one family, and its licence.

Clear space: the height of the t's cap, on every side.
Smallest size: the wordmark is never under 72 px wide. Below that, use the mark or the tile.
Never stretch it, recolor it, outline it, or set it straight on a busy picture.

Type: Gabarito, under the SIL Open Font License 1.1 (type/Gabarito-OFL.txt).
Source: https://fonts.google.com/specimen/Gabarito

Every file here is drawn from the mark's construction and the color tokens, never traced by hand,
and is redrawn on every build of the site.
Truffle is by Sami Kirberg. https://www.truffle.city
`

/** HEX to RGB, and an approximate CMYK with no print profile behind it. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
function cmyk(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const k = 1 - Math.max(r, g, b)
  if (k >= 1) return [0, 0, 0, 100]
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100))
}

function colorsMd() {
  const line = ([name, token, hex, role]) => `| ${name} | \`${token}\` | ${role} | ${hex} | ${rgb(hex).join(', ')} | ${cmyk(hex).join(', ')} |`
  const contrast = pairs.map(([what, fg, bg, min]) => `| ${what} | ${fg} on ${bg} | ${ratio(fg, bg).toFixed(2)}:1 | ${min}:1 |`)
  return [
    '# Truffle colors',
    '',
    'Color means use. Height means value. Truffle brown means the lot you picked, and nothing else on the map is that color. The use colors come from the Sanborn fire insurance maps; each has a left and a right side a step darker (`brand/tokens.json`), which the light makes on the map.',
    '',
    'CMYK is an approximation from RGB with no print profile behind it. Proof it before anything is printed.',
    '',
    '| Name | Token | Role | HEX | RGB | CMYK (approximate) |',
    '|---|---|---|---|---|---|',
    ...COLOR_ROWS.map(line),
    '',
    '## Contrast',
    '',
    'Every text and color pair the product uses, with its WCAG ratio and the least it must reach (`npm run contrast`).',
    '',
    '| Pair | Colors | Ratio | Needs |',
    '|---|---|---|---|',
    ...contrast,
    '',
  ].join('\n')
}

/** The pixel size of a file in the kit, read from the file itself. */
async function sizeOf(path, data) {
  if (path.endsWith('.png')) {
    const m = await sharp(data).metadata()
    return { width: m.width, height: m.height }
  }
  if (path.endsWith('.svg')) {
    const m = data.toString('utf8').match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/)
    return m ? { width: Number(m[1]), height: Number(m[2]) } : {}
  }
  if (path.endsWith('.ico')) return { sizes: Array.from({ length: data.readUInt16LE(4) }, (_, i) => data.readUInt8(6 + 16 * i) || 256) }
  return {}
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex')

/** Which commit the kit was drawn from: the deploy's on Vercel, the checkout's anywhere else. */
function version() {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  let sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null
  let date = null
  try {
    sha ??= git('rev-parse', '--short=7', 'HEAD')
    date = git('log', '-1', '--format=%cs')
  } catch {
    // No git history here: the build still gets a kit, named by today.
  }
  return { sha: sha ?? 'unknown', date: date ?? new Date().toISOString().slice(0, 10) }
}

/** A zip with each file deflated where that helps, dated `date` so the same files make the same zip. */
function zip(entries, date) {
  const [y, mo, d] = date.split('-').map(Number)
  const dosDate = ((y - 1980) << 9) | (mo << 5) | d
  const locals = []
  const central = []
  let offset = 0
  for (const { name, data } of entries) {
    const packed = deflateRawSync(data, { level: 9 })
    const stored = packed.length >= data.length
    const body = stored ? data : packed
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(stored ? 0 : 8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, body)
    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4)
    cen.writeUInt16LE(20, 6)
    cen.writeUInt16LE(0x0800, 8)
    cen.writeUInt16LE(stored ? 0 : 8, 10)
    cen.writeUInt16LE(0, 12)
    cen.writeUInt16LE(dosDate, 14)
    cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(body.length, 20)
    cen.writeUInt32LE(data.length, 24)
    cen.writeUInt16LE(nameBuf.length, 28)
    cen.writeUInt32LE(offset, 42)
    central.push(cen, nameBuf)
    offset += 30 + nameBuf.length + body.length
  }
  const dir = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, dir, end])
}

/**
 * The front door's first frame: the lit city at the map's opening camera (map.hunt.wide over the Value center),
 * drawn in perspective at the map's own scale, so it paints with the page and the map lands on it a second
 * later instead of on empty paper. One for phones (480 by 1000, at twice the pixels) and one for everything
 * wider (2560 by 1600). components/first-frame.tsx sets them at 1:1 in the middle of the screen.
 */
export const FIRST_FRAMES = [
  { file: 'public/first-frame-phone.webp', width: 480, height: 1000, viewH: 844, dpr: 2 },
  { file: 'public/first-frame-wide.webp', width: 2560, height: 1600, viewH: 900, dpr: 1 },
]
export async function firstFrame(lots, f) {
  const wide = tokens.map.hunt.wide
  const svg = drawView(lots, {
    center: tokens.map.value.center, zoom: wide.zoom, pitch: wide.pitch, bearing: wide.bearing,
    width: f.width, height: f.height, viewH: f.viewH,
    style: (l) => ({ h: l.h, colors: USE[l.u] ?? USE.o }),
  })
  return sharp(Buffer.from(svg), { density: 72 * f.dpr }).webp({ quality: 82, effort: 6 }).toBuffer()
}

export const KIT = 'public/brand'

// What the site serves at each address, and the kit file that must match it byte for byte.
export const SERVED = {
  '/favicon.ico': 'app/favicon.ico',
  '/icon.svg': 'app/favicon.svg',
  '/apple-icon.png': 'app/apple-touch-icon.png',
  '/icon-192.png': 'app/icon-192.png',
  '/icon-512.png': 'app/icon-512.png',
  '/icon-maskable-192.png': 'app/icon-maskable-192.png',
  '/icon-maskable-512.png': 'app/icon-maskable-512.png',
  '/icon-maskable.svg': 'app/icon-maskable.svg',
  '/wordmark.svg': 'logo/truffle-logo-color.svg',
}
// The share cards the site draws from brand/share/ behind its words, at 1200 by 630.
export const SHARE_CARDS = ['/opengraph-image', '/value/opengraph-image', '/rules/opengraph-image', '/changing/opengraph-image', '/built/opengraph-image']

/**
 * Every file, drawn in memory: path to bytes. `bundle` adds kit.json and kit.zip, which carry the commit they
 * were drawn from and so are made by the build, not committed.
 */
export async function build({ bundle = false } = {}) {
  const files = new Map()
  const put = (path, data) => files.set(path, Buffer.isBuffer(data) ? data : Buffer.from(data))
  const lots = await readLots()

  const rounded = iconSvg()
  const square = iconSvg({ rx: 0 })
  const favicon = ico([
    { size: 16, data: await png(hinted(16), 16) },
    { size: 32, data: await png(hinted(32), 32) },
    { size: 48, data: await png(rounded, 48) },
  ])
  const apple = await png(square, 180)
  const icon192 = await png(rounded, 192)
  const icon512 = await png(rounded, 512)
  // Maskable: full bleed. The mark sits inside the 80% safe circle already (its farthest point is 32.4 from center).
  const maskable192 = await png(square, 192)
  const maskable512 = await png(square, 512)
  const square1024 = await png(square, 1024)

  // Brand files, same shapes and names as ever, drawn with arcs.
  put('brand/icon.svg', rounded)
  put('brand/icon-square.svg', square)
  put('brand/mushroom.svg', mushroomSvg(BROWN))
  put('brand/mushroom-on-dark.svg', mushroomSvg(CREAM))
  put('brand/wordmark-on-dark.svg', wordmarkSvg(...LOGO.reversed))
  put('brand/icon-180.png', apple)
  put('brand/icon-512.png', await png(square, 512))
  put('brand/icon-1024.png', square1024)
  put('brand/favicon.ico', favicon)
  // The site's icons, picked up by app/ file conventions and app/manifest.ts.
  put('app/icon.svg', rounded)
  put('app/apple-icon.png', apple)
  put('app/favicon.ico', favicon)
  put('public/icon-192.png', icon192)
  put('public/icon-512.png', icon512)
  put('public/icon-maskable-192.png', maskable192)
  put('public/icon-maskable-512.png', maskable512)
  // The same two as vectors, which Chromium installs at any size; the PNGs stay for everything else.
  put('public/icon-maskable.svg', square)
  put('public/wordmark.svg', WORD)
  // /built opens on its card's art without the card's words: the county's outlines turning into tiles, at twice
  // the card's pixels for sharp screens.
  put('public/built-board.webp', await sharp(await readFile('brand/share/built.svg'), { density: 144 }).webp({ quality: 82, effort: 6 }).toBuffer())
  // The front door's first frame, under the map until it draws.
  for (const f of FIRST_FRAMES) put(f.file, await firstFrame(lots, f))

  // The kit.
  const kit = (path, data) => put(`${KIT}/${path}`, data)
  const wordH = (w) => Math.round((w * WORD_BOX[1]) / WORD_BOX[0])
  for (const [name, [letters, cap]] of Object.entries(LOGO)) {
    const svg = wordmarkSvg(letters, cap)
    kit(`logo/truffle-logo-${name}.svg`, svg)
    for (const w of [512, 1024, 2048]) kit(`logo/truffle-logo-${name}-${w}.png`, await raster(svg, w, wordH(w)))
  }
  const marks = { ...Object.fromEntries(Object.entries(MARK).map(([name, [stem, cap]]) => [name, mushroomSvg(stem, cap)])), tile: rounded }
  for (const [name, svg] of Object.entries(marks)) {
    kit(`mark/truffle-mark-${name}.svg`, svg)
    for (const s of [64, 128, 256, 512, 1024]) kit(`mark/truffle-mark-${name}-${s}.png`, await png(svg, s))
  }
  kit('app/favicon.svg', rounded)
  kit('app/favicon.ico', favicon)
  kit('app/apple-touch-icon.png', apple)
  kit('app/icon-192.png', icon192)
  kit('app/icon-512.png', icon512)
  kit('app/icon-maskable-192.png', maskable192)
  kit('app/icon-maskable-512.png', maskable512)
  kit('app/icon-maskable.svg', square)
  kit('app/icon-1024.png', square1024)
  // Avatars: the tile full bleed, the mark well inside the circle a network crops it to.
  kit('social/avatar-400.png', await png(square, 400))
  kit('social/avatar-800.png', await png(square, 800))
  for (const b of SOCIAL) kit(`social/${b.file}`, await raster(banner(lots, b), b.W, b.H))
  const sig = wordmarkSvg(...LOGO.color)
  kit('email/signature-logo@2x.png', await raster(sig, 400, wordH(400), { background: '#FFFFFF' }))
  kit('email/signature-logo@2x-transparent.png', await raster(sig, 400, wordH(400)))
  kit('colors/tokens.json', await readFile('brand/tokens.json'))
  kit('colors/tokens.css', await readFile('brand/tokens.css'))
  // The same tokens in the W3C Design Tokens format, for design tools and agents (scripts/tokens.mjs).
  kit('colors/truffle.tokens.json', dtcgText())
  kit('colors/colors.md', colorsMd())
  for (const f of ['Gabarito-Medium.ttf', 'Gabarito-SemiBold.ttf', 'Gabarito-Bold.ttf', 'Gabarito-ExtraBold.ttf', 'Gabarito-OFL.txt']) kit(`type/${f}`, await readFile(`assets/fonts/${f}`))

  if (!bundle) return { files }

  const v = version()
  kit('README.txt', readme(v))
  const inKit = [...files.keys()].filter((p) => p.startsWith(`${KIT}/`)).sort()
  const manifest = {
    name: 'Truffle',
    site: 'https://www.truffle.city',
    page: 'https://www.truffle.city/brand',
    version: v,
    rules: { clearSpace: 'the height of the t’s cap on every side', smallestWordmarkPx: 72 },
    served: SERVED,
    shareCards: SHARE_CARDS,
    files: await Promise.all(
      inKit.map(async (p) => {
        const data = files.get(p)
        return { path: p.slice(KIT.length + 1), ...(await sizeOf(p, data)), bytes: data.length, sha256: sha256(data) }
      }),
    ),
  }
  const json = JSON.stringify(manifest, null, 2) + '\n'
  const entries = [...inKit.map((p) => ({ name: `truffle-brand-kit/${p.slice(KIT.length + 1)}`, data: files.get(p) })), { name: 'truffle-brand-kit/kit.json', data: Buffer.from(json) }]
  put(`${KIT}/kit.json`, json)
  put(`${KIT}/kit.zip`, zip(entries, v.date))
  return { files, manifest }
}

if (import.meta.main) {
  const t0 = Date.now()
  const { files } = await build({ bundle: true })
  await Promise.all(
    [...files].map(async ([path, data]) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, data)
    }),
  )
  console.log(`Brand: ${files.size} files drawn in ${((Date.now() - t0) / 1000).toFixed(1)} s.`)
}
