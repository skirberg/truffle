import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { css, dtcg, hexOf, oklch, resolve, tokens } from '../scripts/tokens.mjs'

// One source: brand/tokens.json. brand/tokens.css and the kit's truffle.tokens.json are drawn from it
// (scripts/tokens.mjs), and this fails when either has drifted, when a reference points at nothing, or when the
// CSS the site reads names a variable the tokens don't define. When it fails, run `npm run tokens` (and
// `npm run brand` for the kit) and commit what they write.

type Tree = { [k: string]: unknown }

describe('the tokens, from one source', () => {
  it('brand/tokens.css is what scripts/tokens.mjs writes from brand/tokens.json', () => {
    expect(readFileSync('brand/tokens.css', 'utf8')).toBe(css())
  })

  it('every role, mode and shadow reference resolves to a color', () => {
    const refs: string[] = []
    const walk = (o: unknown) => {
      if (typeof o === 'string' && o.startsWith('{')) refs.push(o)
      else if (o && typeof o === 'object') Object.values(o).forEach(walk)
    }
    walk(tokens.role)
    walk(tokens.modes)
    walk(tokens.shadow)
    expect(refs.length).toBeGreaterThan(10)
    for (const r of refs) expect(resolve(r), r).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('every variable app/globals.css reads is defined in brand/tokens.css', () => {
    const defined = new Set([...readFileSync('brand/tokens.css', 'utf8').matchAll(/(--[\w-]+):/g)].map((m) => m[1]))
    const read = [...readFileSync('app/globals.css', 'utf8').matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]!)
    // next/font sets --font-gabarito on <html>.
    const missing = read.filter((v) => !defined.has(v) && v !== '--font-gabarito')
    expect(missing).toEqual([])
  })

  it('a mode moves roles, never a brand color', () => {
    for (const mode of Object.values(tokens.modes) as { set: Record<string, string> }[]) for (const path of Object.keys(mode.set)) expect(path).toMatch(/^role\./)
  })
})

describe('the W3C Design Tokens file', () => {
  const doc = dtcg() as Tree
  const TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number', 'shadow', 'typography']

  // Every token with its path and its type, the type inherited from the nearest group that sets one.
  const leaves: { path: string; type: string; value: unknown }[] = []
  const walk = (node: Tree, path: string[], type: string | undefined) => {
    const t = (node.$type as string | undefined) ?? type
    if ('$value' in node) return leaves.push({ path: path.join('.'), type: t!, value: node.$value })
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$') && v && typeof v === 'object') walk(v as Tree, [...path, k], t)
  }
  walk(doc, [], undefined)
  const byPath = new Map(leaves.map((l) => [l.path, l]))

  it('names the 2025.10 schema and gives every token a known type', () => {
    expect(doc.$schema).toBe('https://www.designtokens.org/schemas/2025.10/format.json')
    expect(leaves.length).toBeGreaterThan(60)
    expect(leaves.filter((l) => !TYPES.includes(l.type)).map((l) => l.path)).toEqual([])
  })

  it('resolves every alias to a token of the same type', () => {
    const aliases: [string, string][] = []
    const find = (o: unknown, from: string) => {
      if (typeof o === 'string' && /^\{[\w.]+\}$/.test(o)) aliases.push([from, o.slice(1, -1)])
      else if (o && typeof o === 'object') Object.values(o).forEach((v) => find(v, from))
    }
    for (const l of leaves) find(l.value, l.path)
    expect(aliases.length).toBeGreaterThan(10)
    for (const [from, to] of aliases) {
      const target = byPath.get(to)
      expect(target, `${from} points at ${to}`).toBeDefined()
      if (from.startsWith('role.')) expect(target!.type, `${from} -> ${to}`).toBe('color')
    }
  })

  it('gives every color in OKLCH that turns back into its own hex', () => {
    const colors = leaves.filter((l) => l.type === 'color' && typeof l.value === 'object') as { path: string; value: { components: [number, number, number]; hex: string } }[]
    expect(colors.length).toBeGreaterThan(30)
    for (const c of colors) {
      expect(c.value.components, c.path).toEqual(oklch(c.value.hex))
      expect(hexOf(c.value.components), c.path).toBe(c.value.hex.toUpperCase())
    }
  })

  it('keeps every color of the brand book', () => {
    const hexes = new Set(leaves.filter((l) => l.type === 'color' && typeof l.value === 'object').map((l) => (l.value as { hex: string }).hex))
    for (const k of ['paper', 'card', 'truffle', 'truffleSide', 'soft', 'faint', 'line', 'water'] as const) expect(hexes.has(tokens.color[k])).toBe(true)
    for (const sides of Object.values(tokens.color.use) as string[][]) for (const h of sides) expect(hexes.has(h)).toBe(true)
  })
})
