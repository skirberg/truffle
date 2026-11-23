// WCAG contrast for every text and color pair the product uses, in the default look and in each mode
// (brand/tokens.json, modes). Fails the check under the line. APCA's lightness contrast (Lc) is printed beside
// each text pair as a second look: it is not a WCAG rule yet, so it informs and never fails.
import { readFileSync } from 'node:fs'
const tokens = JSON.parse(readFileSync('brand/tokens.json', 'utf8'))
const t = tokens.color

export const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** APCA-W3 0.0.98G lightness contrast of text on a background, as a signed Lc (negative is light text on dark). */
export function apca(text, bg) {
  const Y = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.4)
    const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
    return y > 0.022 ? y : y + (0.022 - y) ** 1.414
  }
  const [yt, yb] = [Y(text), Y(bg)]
  if (Math.abs(yb - yt) < 0.0005) return 0
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14
    return s < 0.1 ? 0 : (s - 0.027) * 100
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14
  return s > -0.1 ? 0 : (s + 0.027) * 100
}

// Flatten a translucent card pill onto what's under it.
const over = (fg, alpha, bg) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('')

/** The pairs for a set of text colors: soft and faint are the roles a mode can move (text.secondary and text.source). */
function pairsFor({ soft, faint }, text = 4.5) {
  const p = [
    // [what, text, background, minimum]
    ['Body and titles on the panel', t.truffle, t.card, text],
    ['Body on paper', t.truffle, t.paper, text],
    ['Secondary text on the panel', soft, t.card, text],
    ['Secondary text on paper', soft, t.paper, text],
    ['Source line on the panel', faint, t.card, text],
    ['Search placeholder on the search field', faint, t.paper, text],
    ['Active tab', t.paper, t.truffle, text],
    ['Inactive tab', soft, t.card, text],
    ['Picked lot number on its pill', t.paper, t.truffle, text],
  ]
  // Tile numbers sit on a 92% card pill over any use color.
  for (const [name, c] of Object.entries(t.use)) p.push([`Tile number on its pill over ${name}`, t.truffle, over(t.card, 0.92, c[0]), text])
  p.push(['Tile number on its pill over water', t.truffle, over(t.card, 0.92, t.water), text])
  p.push(['Map credit over water', soft, over(t.card, 0.9, t.water), text])
  // Rules writes each zoning family's name on the map in a pill of the family's own color.
  for (const [name, c] of Object.entries(t.zoning)) if (name !== 'none') p.push([`Zoning family name on its own color, ${name}`, t.truffle, c, text])
  // The credit sits on a 90% card pill over the map.
  for (const [name, c] of Object.entries(t.use)) p.push([`Map credit over ${name}`, soft, over(t.card, 0.9, c[0]), text])
  return p
}

const nonText = [
  ['Focus ring against paper (non-text)', t.truffle, t.paper, 3],
  ['Focus ring against the panel (non-text)', t.truffle, t.card, 3],
  ['Picked lot against homes yellow (non-text)', t.truffle, t.use.homes[0], 3],
  ['Picked lot against shops pink (non-text)', t.truffle, t.use.biz[0], 3],
  ['Picked lot against civic blue (non-text)', t.truffle, t.use.civic[0], 3],
  ['Picked lot against vacant gray (non-text)', t.truffle, t.use.vacant[0], 3],
  ['Picked lot against water (non-text)', t.truffle, t.water, 3],
]

export const pairs = [...pairsFor({ soft: t.soft, faint: t.faint }), ...nonText]

// A mode moves roles to other primitives; follow its references to the colors it ends on.
const at = (path) => path.split('.').reduce((o, k) => o?.[k], tokens)
const follow = (v) => (typeof v === 'string' && v.startsWith('{') ? follow(at(v.slice(1, -1))) : v)
/** Each mode's pairs. More contrast asks for AAA (7:1) on text, and its hairlines must reach 3:1 as edges. */
export const modePairs = Object.entries(tokens.modes).map(([name, mode]) => {
  const role = (path) => follow(mode.set[path] ?? at(path))
  const text = name === 'contrastMore' ? 7 : 4.5
  return {
    name,
    media: mode.media,
    pairs: [
      ...pairsFor({ soft: role('role.text.secondary'), faint: role('role.text.source') }, text).filter(([, fg]) => fg !== t.truffle && fg !== t.paper),
      ['Hairline on the panel (non-text)', role('role.border.hairline'), t.card, name === 'contrastMore' ? 3 : 1],
    ],
  }
})

// Run alone (npm run contrast) it prints every pair and fails under the line; scripts/brand.mjs reads the
// same pairs for the kit's colors/colors.md.
if (import.meta.main) {
  let bad = 0
  const show = (list) => {
    for (const [what, fg, bg, min] of list) {
      const r = ratio(fg, bg)
      const ok = r >= min
      if (!ok) bad++
      const lc = what.includes('non-text') ? '' : `  APCA Lc ${Math.abs(apca(fg, bg)).toFixed(0).padStart(3)}`
      console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (needs ${min})${lc}  ${what}  ${fg} on ${bg}`)
    }
  }
  show(pairs)
  for (const m of modePairs) {
    console.log(`\n${m.name}, ${m.media}:`)
    show(m.pairs)
  }
  const n = pairs.length + modePairs.reduce((s, m) => s + m.pairs.length, 0)
  console.log(bad ? `\n${bad} pair(s) under the line.` : `\nAll ${n} pairs pass.`)
  process.exit(bad ? 1 : 0)
}
