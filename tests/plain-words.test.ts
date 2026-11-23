import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { lotTitle, plainUse, reasons, ruleLines, usedToday, whatItIs } from '@/lib/copy'
import { landShareWords } from '@/lib/numbers'
import type { Lot } from '@/lib/types'

// DESIGN.md: what a lot is comes "rewritten from assessor's words". No raw assessor text reaches the page.
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }
const lots = snap.lots.map((l) => ({ ...l, name: l.name ?? null, kind: l.kind ?? null }))
const rawUses = [...new Set(lots.map((l) => l.use_text).filter(Boolean))]
// Marks of assessor shorthand: slashes, clipped words, size classes.
const ASSESSOR = /\/|<|\bbldg\b|\bmht\b|\bschl\b|cmmity|\bthtr\b|\bwareh\b|\bpkg\b|orphng|\bprv\b|nonmuni|\bint\b|\bmfg\b|\boff\b|\bcty\b|classification|\bhx\b|\bmh\b|\bpk\b|\bterm\b|\boutdr\b|\binc\b/i

describe('plain words for what a lot is', () => {
  it('has plain words for every use the county wrote in the committed data', () => {
    for (const u of rawUses) expect(plainUse(u), u).not.toBeNull()
  })
  it('never shows a raw assessor kind for any committed lot: title, what it is, used today', () => {
    // Every use as the county wrote it, where the writing is assessor shorthand.
    const raw = rawUses.map((u) => u.toLowerCase()).filter((u) => ASSESSOR.test(u))
    // One lot for each distinct pair of kind and use: the words depend on nothing else.
    const kinds = new Map(lots.map((l) => [`${l.kind}|${l.use_text}|${l.use}`, l]))
    for (const lot of kinds.values()) {
      const said = [lotTitle({ ...lot, address: null, name: null }), whatItIs(lot) ?? '', usedToday(lot), ruleLines(lot, null).at(-1)!]
      for (const text of said) {
        expect(text, `${lot.id}: ${lot.use_text}`).not.toMatch(ASSESSOR)
        for (const r of raw) expect(text.toLowerCase(), `${lot.id}: ${r}`).not.toContain(r)
      }
    }
  })
  it('reads the ones the review found', () => {
    const say = (use_text: string) => whatItIs({ kind: null, use_text, use: 'other' })
    expect(say('residential common area/element')).toBe('Shared land in a neighborhood')
    expect(say('mht/modular coop')).toBe('Manufactured homes')
    expect(say('golf course')).toBe('A golf course')
    expect(say('vacant townhouse')).toBe('Empty land')
    expect(say('medic offic- bldg up to 4 stories condo')).toBe('Medical offices')
    expect(say('thtr/aud/clbhs')).toBe('A theater, hall or clubhouse')
    expect(say('pkg lt / mh pk')).toBe('A parking lot or mobile home park')
  })
  it('names a use it has no words for by its color on the map, not by the raw text', () => {
    expect(whatItIs({ kind: null, use_text: 'xyz/abc cls 4', use: 'biz' })).toBe('A business')
  })
  it('titles a lot with no address by what it is, once', () => {
    const golf = lots.find((l) => l.use_text === 'golf course' && !l.address && !l.name)!
    expect(lotTitle(golf)).toBe('A golf course')
  })
})

describe('land share beside a building value', () => {
  it('never says 100% when the building is worth something', () => {
    for (const lot of lots) {
      const first = reasons(lot)[0]!
      if (/The (house|building) is worth \$/.test(first)) expect(first, lot.id).not.toContain('100%')
    }
    expect(landShareWords(7_000_000, 158_000)).toBe('98%')
    expect(landShareWords(1_239_816, 5_160)).toBe('nearly all')
    const lot = lots.find((l) => l.id === '06434720280000440')!
    expect(reasons(lot)[0]).toBe('The land is nearly all of the value. The building is worth $5K.')
  })
})
