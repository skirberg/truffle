// The grid and token check. In the components, every hand-set spacing, size, position or radius sits on the
// 4 px grid (brand/tokens.json, grid); breakpoints and shadows are not spacing. In the components and the pages,
// no font size, color or duration is set by hand: each comes from brand/tokens.json through brand/tokens.css
// and app/globals.css (text-ui-*, the color names, shadow-*, duration-(--motion-*)). Share images draw at their
// own 1200 by 630 scale with colors from lib/tokens.ts, so they are left to it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SPACING = /\b(?:-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|top|bottom|left|right|inset|w|h|min-h|min-w|max-h|max-w|size|rounded|space-x|space-y|translate-x|translate-y))-\[(\d+(?:\.\d+)?)px\]/g
const HALF = /(?<![\w[-])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|top|bottom|left|right|w|h|size|space-x|space-y)-(\d+\.5)\b/g
const TOKENS = [
  [/(?<![\w-])text-\[(?:\d|clamp|calc|var)[^\]]*\]/g, 'a font size set by hand: use a step of the type scale (text-ui-*)'],
  [/['"`\s(:]#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?\b/g, 'a color set by hand: use a color token'],
  [/(?<![A-Za-z-])(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g, 'a color set by hand: use a color token'],
  [/(?<![\w-])duration-(?:[1-9]\d*|\[[^\]]+\])/g, 'a duration set by hand: use duration-(--motion-*)'],
]

const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : []
  })

const bad = []
for (const f of files('components')) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(SPACING)) {
        const v = Number(m[1])
        if (v % 4 !== 0) bad.push(`${f}:${i + 1}  ${m[0]}  (${v} is off the 4 px grid)`)
      }
      // Tailwind's half steps (2.5 is 10 px, 1.5 is 6 px, 0.5 is 2 px) fall between grid lines too.
      for (const m of line.matchAll(HALF)) bad.push(`${f}:${i + 1}  ${m[0]}  (${Number(m[1]) * 4} px is off the 4 px grid)`)
    })
}
for (const f of [...files('components'), ...files('app').filter((f) => !f.endsWith('opengraph-image.tsx'))]) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const [re, why] of TOKENS) for (const m of line.matchAll(re)) bad.push(`${f}:${i + 1}  ${m[0].trim()}  (${why})`)
    })
}
if (bad.length) {
  console.error(`Off the grid or off the tokens:\n${bad.join('\n')}`)
  process.exit(1)
}
console.log('grid: every hand-set spacing, size and radius is on the 4 px grid; every font size, color and duration is a token')
