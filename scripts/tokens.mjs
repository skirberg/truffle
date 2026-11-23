// One source, two outputs. brand/tokens.json holds every token (the brand book's colors, the roles that use
// them, the modes, type, the grid, shadows, motion, the map's camera and the zoning and use lists). From it:
//
//   brand/tokens.css               the CSS variables the site reads (app/globals.css maps them into Tailwind)
//   public/brand/colors/truffle.tokens.json
//                                  the same tokens in the W3C Design Tokens format (DTCG 2025.10), colors in
//                                  OKLCH with their sRGB hex, for design tools and AI agents (scripts/brand.mjs
//                                  puts it in the kit)
//
// The code reads the JSON itself through lib/tokens.ts, which TypeScript types from the file. tests/tokens.test.ts
// fails when brand/tokens.css or the kit's file isn't what this writes, when a reference doesn't resolve, and when
// an OKLCH value doesn't give back its hex.
// Run: npm run tokens
import { readFileSync, writeFileSync } from 'node:fs'

export const tokens = JSON.parse(readFileSync(new URL('../brand/tokens.json', import.meta.url), 'utf8'))
const C = tokens.color

/** What each brand book color is for (DESIGN.md, Color). The kit's colors.md and the DTCG file both say it. */
export const COLOR_ROWS = [
  ['Paper', 'paper', C.paper, 'Ground of every screen, and the streets between tiles'],
  ['Card', 'card', C.card, 'Panels, the phone sheet, pills on the map'],
  ['Truffle', 'truffle', C.truffle, 'Type, and the lot you picked'],
  ['Truffle side', 'truffleSide', C.truffleSide, 'Side of the picked tile in pictures'],
  ['Soft', 'soft', C.soft, 'Secondary text'],
  ['Faint', 'faint', C.faint, 'Source lines and placeholders'],
  ['Line', 'line', C.line, 'Hairlines, and the lot under fog'],
  ['Water', 'water', C.water, 'Rivers, lakes and the sea. Not a use'],
  ['Homes', 'use.homes', C.use.homes[0], 'Sanborn yellow: single family, condos, apartments'],
  ['Shops and offices', 'use.biz', C.use.biz[0], 'Sanborn pink: stores, offices, restaurants, hotels'],
  ['Civic and parks', 'use.civic', C.use.civic[0], 'Sanborn blue: parks, schools, churches, public land'],
  ['Vacant', 'use.vacant', C.use.vacant[0], 'Empty land'],
  ['Other', 'use.other', C.use.other[0], 'Anything else'],
]

// ---- References: "{color.paper}", "{role.text.secondary}" -------------------------------------------------

const at = (path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), tokens)
const isRef = (v) => typeof v === 'string' && /^\{[\w.]+\}$/.test(v)
/** A reference followed to its final value (a hex for colors). */
export function resolve(v, seen = []) {
  if (!isRef(v)) return v
  const path = v.slice(1, -1)
  if (seen.includes(path)) throw new Error(`circular reference: ${[...seen, path].join(' -> ')}`)
  const next = at(path)
  if (next === undefined) throw new Error(`${v} points at nothing`)
  return resolve(next, [...seen, path])
}

// ---- Color: sRGB hex to OKLCH and back (Björn Ottosson's OKLab) ----------------------------------------------

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

export function oklch(hex) {
  const [r, g, b] = rgbOf(hex).map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return [+L.toFixed(4), +Math.hypot(A, B).toFixed(4), +H.toFixed(2)]
}

export function hexOf([L, Cr, H]) {
  const A = Cr * Math.cos((H * Math.PI) / 180)
  const B = Cr * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ---- CSS -----------------------------------------------------------------------------------------------------

/** The CSS variable each color token is written to. */
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const SIDES = ['', '-l', '-r']
function varOf(path) {
  const p = path.split('.')
  if (p[0] === 'color' && p.length === 2) return `--${kebab(p[1])}`
  if (p[0] === 'color' && p[1] === 'use') return `--${p[2]}${SIDES[Number(p[3] ?? 0)]}`
  if (p[0] === 'color' && p[1] === 'zoning') return `--z-${p[2]}`
  if (p[0] === 'role') return `--role-${p.slice(1).map(kebab).join('-')}`
  throw new Error(`no CSS variable for ${path}`)
}
const cssRef = (v) => (isRef(v) ? `var(${varOf(v.slice(1, -1))})` : v)
const px = (n) => (n === 0 ? '0' : `${n}px`)
const ms = (n) => `${n}ms`
const rem = (n) => `${+(n / 16).toFixed(4)}rem`

function shadowCss(s) {
  const color = `color-mix(in srgb, ${cssRef(s.color)} ${Math.round(s.alpha * 100)}%, transparent)`
  return `${s.inset ? 'inset ' : ''}0 ${px(s.y)}${s.blur || s.spread ? ` ${px(s.blur)}` : ''}${s.spread ? ` ${px(s.spread)}` : ''} ${color}`
}

/** A size that grows with the screen between two widths, in rem plus vw (Utopia's method). */
function fluid({ min, max }, [w0, w1] = tokens.type.fluid.viewport) {
  const slope = (max - min) / (w1 - w0)
  const intercept = min - slope * w0
  return `clamp(${rem(min)}, ${rem(intercept)} + ${+(slope * 100).toFixed(4)}vw, ${rem(max)})`
}

function roleLines(group, prefix = 'role') {
  const out = []
  for (const [k, v] of Object.entries(group)) {
    if (k.startsWith('$')) continue
    const path = `${prefix}.${k}`
    if (typeof v === 'object') out.push(...roleLines(v, path))
    else out.push(`  ${varOf(path)}: ${cssRef(v)};`)
  }
  return out
}

export function css() {
  const T = tokens.type
  const G = tokens.grid
  const S = T.scale
  const sec = (title, lines) => [`  /* ${title} */`, ...lines]
  const use = Object.entries(C.use).map(([k, [top, l, r]]) => `  --${k}: ${top}; --${k}-l: ${l}; --${k}-r: ${r};`)
  const lines = [
    '/* Truffle design tokens. Drawn from brand/tokens.json by scripts/tokens.mjs: edit the JSON, run `npm run tokens`.',
    '   tests/tokens.test.ts fails when this file is not what the script writes. */',
    ':root {',
    ...sec('Primitives: the brand book\'s colors. They never change with a mode.', [
      ...['paper', 'card', 'truffle', 'truffleSide', 'soft', 'faint', 'line', 'water'].map((k) => `  ${varOf(`color.${k}`)}: ${C[k]};`),
    ]),
    ...sec('Use colors, after the Sanborn fire insurance maps: top, left side, right side', use),
    ...sec('Zoning (Rules): what a lot is allowed to be', [`  ${Object.entries(C.zoning).map(([k, v]) => `--z-${k}: ${v};`).join(' ')}`]),
    ...sec('Roles: what each color does. Components and the modes below use these.', roleLines(tokens.role)),
    ...sec('Shadows: truffle ink at a low alpha', Object.entries(tokens.shadow).filter(([k]) => !k.startsWith('$')).map(([k, s]) => `  --shadow-${kebab(k)}: ${shadowCss(s)};`)),
    ...sec('Type: one family, Gabarito, with tabular figures', [
      `  --font: '${T.family}', ${T.fallback.join(', ')};`,
      `  --fs-display: ${px(T.display.size)}; --fw-display: ${T.display.weight}; --ls-display: ${T.display.letterSpacing};`,
      `  --fs-number: ${px(T.number.size)}; --fs-number-phone: ${px(T.number.sizePhone)}; --fw-number: ${T.number.weight}; --ls-number: ${T.number.letterSpacing};`,
      `  --fs-title: ${px(T.title.size)}; --fs-title-phone: ${px(T.title.sizePhone)}; --fw-title: ${T.title.weight}; --ls-title: ${T.title.letterSpacing};`,
      `  --fs-body: ${px(T.body.size)}; --fw-body: ${T.body.weight}; --lh-body: ${T.body.lineHeight};`,
      `  --fs-source: ${px(T.source.size)}; --fw-source: ${T.source.weight};`,
    ]),
    ...sec('The type scale on the 4 px grid: each size with a line height that keeps baselines on it', [
      `  --ts-number: ${px(S.number.size)}; --lh-number: ${px(S.number.line)};`,
      `  --ts-title: ${px(S.title.size)}; --lh-title: ${px(S.title.line)}; --ts-title-phone: ${px(S.title.sizePhone)}; --lh-title-phone: ${px(S.title.linePhone)};`,
      ...['headline', 'body', 'small', 'label', 'credit', 'tag'].map((k) => `  --ts-${k}: ${px(S[k].size)}; --lh-${k === 'body' ? 'body-px' : k}: ${px(S[k].line)};`),
    ]),
    ...sec(`Fluid steps for the brand page, ${T.fluid.viewport[0]} to ${T.fluid.viewport[1]} px`, ['display', 'heading', 'number'].map((k) => `  --fluid-${k}: ${fluid(T.fluid[k])};`)),
    ...sec('The grid: a 4 px unit; spacing, sizes and radii on it', [
      `  --grid: ${px(G.unit)};`,
      `  --margin-phone: ${px(G.margin.phone)}; --margin-desktop: ${px(G.margin.desktop)};`,
      `  --panel-width: ${px(G.panel.width)}; --panel-pad: ${px(G.panel.padding)}; --gutter: ${px(G.panel.gutter)}; --sheet-pad: ${px(G.sheet.padding)}; --sheet-peek: ${px(G.sheet.peek)};`,
      `  --tap: ${px(G.tap.min)}; --button: ${px(G.tap.button)};`,
      `  --radius-sm: ${px(G.radius.sm)}; --radius-md: ${px(G.radius.md)}; --radius-lg: ${px(G.radius.lg)}; --radius-pill: ${px(G.radius.pill)};`,
    ]),
    ...sec('Motion. prefers-reduced-motion turns all of it off (app/globals.css)', [
      `  ${Object.entries(tokens.motion.duration).map(([k, v]) => `--motion-${k}: ${ms(v)};`).join(' ')}`,
      `  --motion-camera: ${ms(tokens.motion.cameraMs)};`,
      `  --easing-out: cubic-bezier(${tokens.motion.easing.out.join(', ')});`,
    ]),
    '}',
  ]
  for (const [name, mode] of Object.entries(tokens.modes)) {
    lines.push(`/* ${name}: ${mode.$description} */`, `@media ${mode.media} {`, '  :root {')
    for (const [path, v] of Object.entries(mode.set)) lines.push(`    ${varOf(path)}: ${cssRef(v)};`)
    lines.push('  }', '}')
  }
  return lines.join('\n') + '\n'
}

// ---- DTCG 2025.10 --------------------------------------------------------------------------------------------

const SCHEMA = 'https://www.designtokens.org/schemas/2025.10/format.json'
const dim = (value, unit = 'px') => ({ value, unit })
const colorValue = (hex, alpha) => ({ colorSpace: 'oklch', components: oklch(hex), ...(alpha === undefined ? {} : { alpha }), hex })
const describe = Object.fromEntries(COLOR_ROWS.map(([, token, , role]) => [token, role]))

function dtcgRoles(group, prefix) {
  const out = {}
  for (const [k, v] of Object.entries(group)) {
    if (k.startsWith('$')) continue
    const path = `${prefix}.${k}`
    if (typeof v === 'object') out[k] = dtcgRoles(v, path)
    else {
      const modes = Object.fromEntries(Object.entries(tokens.modes).filter(([, m]) => m.set[path]).map(([n, m]) => [n, m.set[path]]))
      out[k] = { $value: v, ...(Object.keys(modes).length ? { $extensions: { 'city.truffle.modes': modes } } : {}) }
    }
  }
  return out
}

export function dtcg() {
  const T = tokens.type
  const S = T.scale
  const G = tokens.grid
  const prim = Object.fromEntries(
    ['paper', 'card', 'truffle', 'truffleSide', 'soft', 'faint', 'line', 'water'].map((k) => [k, { $value: colorValue(C[k]), $description: describe[k] }]),
  )
  const use = Object.fromEntries(
    Object.entries(C.use).map(([k, [top, l, r]]) => [
      k,
      { $description: describe[`use.${k}`], top: { $value: colorValue(top) }, left: { $value: colorValue(l), $description: 'The side the light reaches.' }, right: { $value: colorValue(r), $description: 'The side in shade.' } },
    ]),
  )
  const zoning = Object.fromEntries(
    Object.entries(C.zoning).map(([k, v]) => [k, { $value: colorValue(v), $description: tokens.mappings.zoningFamilies.find((f) => f.key === k)?.name ?? k }]),
  )
  const typo = (size, line, weight, ls) => ({
    $value: {
      fontFamily: '{font.family}',
      fontSize: dim(size),
      fontWeight: weight,
      letterSpacing: dim(ls ? +(parseFloat(ls) * size).toFixed(2) : 0),
      lineHeight: +(line / size).toFixed(4),
    },
  })
  const shadow = (s) => ({
    $value: { color: colorValue(resolve(s.color), s.alpha), offsetX: dim(0), offsetY: dim(s.y), blur: dim(s.blur), spread: dim(s.spread), ...(s.inset ? { inset: true } : {}) },
  })
  return {
    $schema: SCHEMA,
    $description:
      'Truffle design tokens, drawn from brand/tokens.json by scripts/tokens.mjs. Color means use, height means value, truffle brown means the lot you picked. The map draws in sRGB, so every color keeps its hex; OKLCH gives the same color in a perceptual space. Roles say what a color does; city.truffle.modes on a role gives its value in a mode (contrastMore: prefers-contrast: more).',
    color: { $type: 'color', ...prim, use, zoning },
    role: { $type: 'color', $description: tokens.role.$description.replace(/ Values are references.*$/, ''), ...dtcgRoles(tokens.role, 'role') },
    font: {
      family: { $type: 'fontFamily', $value: [T.family, ...T.fallback] },
      weight: { $type: 'fontWeight', medium: { $value: 500 }, semibold: { $value: 600 }, bold: { $value: 700 }, extrabold: { $value: 800 } },
    },
    type: {
      $type: 'typography',
      $description: 'The scale on the 4 px grid: every line height is a multiple of 4. Figures are tabular (tnum) everywhere.',
      number: typo(S.number.size, S.number.line, T.number.weight, T.number.letterSpacing),
      title: typo(S.title.size, S.title.line, T.title.weight, T.title.letterSpacing),
      titlePhone: typo(S.title.sizePhone, S.title.linePhone, T.title.weight, T.title.letterSpacing),
      headline: typo(S.headline.size, S.headline.line, 700),
      body: typo(S.body.size, S.body.line, T.body.weight),
      small: typo(S.small.size, S.small.line, T.body.weight),
      label: typo(S.label.size, S.label.line, 600),
      credit: typo(S.credit.size, S.credit.line, 500),
      tag: typo(S.tag.size, S.tag.line, 700),
    },
    space: { $type: 'dimension', ...Object.fromEntries(Object.entries(G.space).map(([k, v]) => [k, { $value: dim(v) }])) },
    radius: { $type: 'dimension', ...Object.fromEntries(Object.entries(G.radius).map(([k, v]) => [k, { $value: dim(v) }])) },
    size: {
      $type: 'dimension',
      tap: { $value: dim(G.tap.min), $description: 'The least a control answers to.' },
      button: { $value: dim(G.tap.button) },
      panelWidth: { $value: dim(G.panel.width) },
      marginPhone: { $value: dim(G.margin.phone) },
      marginDesktop: { $value: dim(G.margin.desktop) },
    },
    shadow: { $type: 'shadow', ...Object.fromEntries(Object.entries(tokens.shadow).filter(([k]) => !k.startsWith('$')).map(([k, s]) => [k, shadow(s)])) },
    duration: {
      $type: 'duration',
      $description: tokens.motion.durationNote,
      ...Object.fromEntries(Object.entries(tokens.motion.duration).map(([k, v]) => [k, { $value: { value: v, unit: 'ms' } }])),
      camera: { $value: { value: tokens.motion.cameraMs, unit: 'ms' } },
    },
    easing: { $type: 'cubicBezier', out: { $value: tokens.motion.easing.out } },
  }
}

export const dtcgText = () => JSON.stringify(dtcg(), null, 2) + '\n'

if (import.meta.main) {
  writeFileSync('brand/tokens.css', css())
  console.log('tokens: brand/tokens.css written from brand/tokens.json')
}
