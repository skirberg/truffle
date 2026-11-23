import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { CALLABLE, callable, chooseCallable, gapOf, hiddenShare, metersBetween, ordinary, rankCandidates, worship, type CallRecord, type TileLot } from '@/lib/call-picker'
import type { Lot } from '@/lib/types'

// The front door's picker: a lot a person can see and reason about, never a sliver with an absurd number.
// tests/fixtures/downtown-tile-lots.json is what the map had drawn over downtown on Nov 11 (id, middle,
// millions an acre, height, shorter side), kept to the lots that aren't homes; the records are the committed
// sample.
const tiles = JSON.parse(readFileSync('tests/fixtures/downtown-tile-lots.json', 'utf8')) as TileLot[]
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }
const records: CallRecord[] = snap.lots.map((l) => ({ id: l.id, vpa: l.vpa, acres: l.acres, use: l.use, use_text: l.use_text, kind: l.kind, name: l.name }))
const tokens = JSON.parse(readFileSync('brand/tokens.json', 'utf8')) as { map: { hunt: { first: string } } }
const byId = new Map(records.map((r) => [r.id, r]))
const cam = { bearing: -35, pitch: 58 }
const stGregorys: [number, number] = [-80.083026, 26.351912]
const ST_GREGORYS = '06434720240030080'
const miznerPark: [number, number] = [-80.0845, 26.3555]
const SLIVER = '06434729060090011' // 200 S Federal Hwy: 0.038 acres at $104M an acre

/** The same shuffle every run. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

// A lot 30 m across at a point in meters east and north of the corner of the block.
const at = (east: number, north: number): [number, number] => [-80.08 + east / (111_320 * Math.cos((26.35 * Math.PI) / 180)), 26.35 + north / 110_540]
const lot = (id: string, east: number, north: number, over: Partial<TileLot> = {}): TileLot => ({ id, at: at(east, north), n: 6, h: 30, size: 30, ...over })

describe('what hides a flat lot', () => {
  const flat = lot('flat', 0, 0, { h: 1.2 })
  // At bearing -35 the camera stands to the south-east of what it looks at.
  it('is hidden by a tall lot between it and the camera', () => {
    expect(hiddenShare(flat, [lot('tall', 17, -25)], cam)).toBe(1)
  })
  it('is not hidden by a tall lot behind it or beside it', () => {
    expect(hiddenShare(flat, [lot('behind', -17, 25)], cam)).toBe(0)
    expect(hiddenShare(flat, [lot('beside', 60, 42)], cam)).toBe(0)
  })
  it('is not hidden by a low lot in front, or a tall one far enough off', () => {
    expect(hiddenShare(flat, [lot('low', 17, -25, { h: 3 })], cam)).toBeLessThan(CALLABLE.hidden)
    expect(hiddenShare(flat, [lot('far', 86, -123)], cam)).toBe(0)
  })
  it('is partly hidden when the shadow only reaches its near edge', () => {
    const share = hiddenShare(flat, [lot('mid', 40, -57, { h: 30 })], cam)
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
  })
})

describe('what the records have to say', () => {
  it('turns down a sliver, however sane its number', () => {
    expect(callable({ median: 6 }, { id: 'a', vpa: 6_000_000, acres: 0.04 })).toBe(false)
  })
  it('turns down the review’s lot: 200 S Federal Hwy, 0.04 acres at $104M an acre', () => {
    const r = byId.get(SLIVER)!
    expect(r.acres).toBeLessThan(CALLABLE.minAcres)
    expect(r.vpa).toBeGreaterThan(CALLABLE.maxVpa)
    expect(callable({ median: null }, r)).toBe(false)
  })
  it('turns down a value past the top of the height scale, nominal land, a park-sized lot and a lot with no record', () => {
    expect(callable({ median: null }, { id: 'a', vpa: 30_000_000, acres: 0.3 })).toBe(false)
    expect(callable({ median: null }, { id: 'a', vpa: 80_000, acres: 0.3 })).toBe(false)
    expect(callable({ median: null }, { id: 'a', vpa: 3_000_000, acres: 40 })).toBe(false)
    expect(callable({ median: null }, undefined)).toBe(false)
    expect(callable({ median: null }, { id: 'a', vpa: 0, acres: 0.3 })).toBe(false)
  })
  it('turns down a record more than six times off its neighbors, and takes an ordinary lot', () => {
    expect(callable({ median: 2 }, { id: 'a', vpa: 20_000_000, acres: 0.3 })).toBe(false)
    expect(callable({ median: 6.6 }, { id: 'a', vpa: 2_400_918, acres: 2.543 })).toBe(true)
  })
  it('takes the first candidate the records bear out, in the map’s order', () => {
    const c = [{ id: 'none', median: 5 }, { id: 'sliver', median: 5 }, { id: 'good', median: 5 }, { id: 'also', median: 5 }]
    const r = [{ id: 'sliver', vpa: 6e6, acres: 0.03 }, { id: 'good', vpa: 3e6, acres: 0.2 }, { id: 'also', vpa: 3e6, acres: 0.2 }]
    expect(chooseCallable(c, r)?.id).toBe('good')
    expect(chooseCallable(c, [])).toBeNull()
  })
})

describe('the picker over downtown', () => {
  it('knows a clear gap from a coin toss and from a fluke', () => {
    expect(gapOf(2.4, 6.6)).toBe('clear')
    expect(gapOf(6, 6.6)).toBe('close')
    expect(gapOf(104, 8)).toBe('absurd')
  })
  it('only lists lots big enough to see, in a sane range, whole, not called before', () => {
    const skip = new Set(['06434720240030080'])
    for (let seed = 1; seed <= 40; seed++) {
      const list = rankCandidates(tiles, stGregorys, skip, cam, seeded(seed))
      expect(list.length).toBeGreaterThan(0)
      expect(list.length).toBeLessThanOrEqual(CALLABLE.shortlist)
      for (const c of list) {
        expect(c.size).toBeGreaterThanOrEqual(CALLABLE.minSpanM)
        expect(c.size).toBeLessThanOrEqual(CALLABLE.maxSpanM)
        expect(c.n * 1e6).toBeGreaterThanOrEqual(CALLABLE.minVpa)
        expect(c.n * 1e6).toBeLessThanOrEqual(CALLABLE.maxVpa)
        expect(c.id).not.toContain('-')
        expect(skip.has(c.id)).toBe(false)
        expect(c.id).not.toBe(SLIVER)
        expect(gapOf(c.n, c.median!)).not.toBe('absurd')
      }
    }
  })
  it('puts lots with a clear gap first, and among those the ones in the open', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const list = rankCandidates(tiles, stGregorys, new Set(), cam, seeded(seed))
      const tier = list.map((c) => (gapOf(c.n, c.median!) === 'clear' ? 0 : 2) + (hiddenShare(c, tiles, cam) < CALLABLE.hidden ? 0 : 1))
      // Hidden is judged against the lots within a few blocks, so allow the whole-city answer to differ by a tier.
      expect([...tier].sort((a, b) => (a >> 1) - (b >> 1))).toEqual(tier)
    }
  })
  it('in the open comes before hidden, all else equal', () => {
    // Two lots a block apart, both at half their neighbors' value; one has a tall lot between it and the camera.
    const open = lot('open', 0, 0, { n: 3, h: 20 })
    const hidden = lot('hidden', 200, 0, { n: 3, h: 20 })
    const wall = lot('wall', 217, -25, { n: 6, h: 40 })
    const block = Array.from({ length: 8 }, (_, i) => lot(`n${i}`, -40 - i * 5, 60 + i * 30))
    for (let seed = 1; seed <= 20; seed++) {
      const list = rankCandidates([open, hidden, wall, ...block], at(100, -200), new Set(['wall', ...block.map((b) => b.id)]), cam, seeded(seed))
      expect(list.map((c) => c.id)).toEqual(['open', 'hidden'])
    }
  })
  it('asks for the other answer than last time, so the right call is not always Less', () => {
    let more = 0, less = 0
    for (let seed = 1; seed <= 60; seed++) {
      const here = tiles[(seed * 37) % tiles.length]!.at
      const first = (prefer: 'more' | 'less') => rankCandidates(tiles, here, new Set(), cam, seeded(seed), prefer)[0]
      const m = first('more'), l = first('less')
      if (m && m.n > m.median!) more++
      if (l && l.n < l.median!) less++
    }
    // Wherever there is a lot clearly on that side within a walk, it comes first.
    expect(more).toBeGreaterThan(50)
    expect(less).toBeGreaterThan(50)
  })
  it('never ends on a sliver or an absurd value once the records are read, over 300 rounds', () => {
    let rounds = 0
    for (let seed = 1; seed <= 300; seed++) {
      const here = tiles[(seed * 37) % tiles.length]!.at
      const list = rankCandidates(tiles, here, new Set(), cam, seeded(seed))
      const pick = chooseCallable(list, records)
      if (!pick) continue
      rounds++
      const r = byId.get(pick.id)!
      expect(r.acres, pick.id).toBeGreaterThanOrEqual(CALLABLE.minAcres)
      expect(r.acres, pick.id).toBeLessThanOrEqual(CALLABLE.maxAcres)
      expect(r.vpa, pick.id).toBeLessThanOrEqual(CALLABLE.maxVpa)
      expect(r.vpa, pick.id).toBeGreaterThanOrEqual(CALLABLE.minVpa)
      expect(worship(r), pick.id).toBe(false)
    }
    // And it nearly always finds one.
    expect(rounds).toBeGreaterThan(270)
  })
})

describe('what the front door asks about', () => {
  it('opens on an ordinary business lot near Mizner Park that the picker itself would take', () => {
    const first = byId.get(tokens.map.hunt.first)!
    expect(first, 'the first lot has a record').toBeDefined()
    expect(first.use).toBe('biz')
    expect(ordinary(first)).toBe(true)
    expect(worship(first)).toBe(false)
    // People know it from the street: it has a name, and it is a restaurant, shops or offices.
    expect(first.name).toBeTruthy()
    expect(first.use_text).toMatch(/restaurant|store|shopping|office|financial/)
    // The picker's own rules: whole, big enough to see, a sane value, in the open, and the records agree.
    const tile = tiles.find((t) => t.id === first.id)!
    expect(tile.id).not.toContain('-')
    expect(tile.size).toBeGreaterThanOrEqual(CALLABLE.minSpanM)
    expect(tile.size).toBeLessThanOrEqual(CALLABLE.maxSpanM)
    const around = tiles.filter((t) => t.n > 0 && t.id !== tile.id && metersBetween(tile.at, t.at) <= CALLABLE.nearM)
    expect(around.length).toBeGreaterThanOrEqual(CALLABLE.minNeighbors)
    const mid = around.map((t) => t.n).sort((a, b) => a - b)[around.length >> 1]!
    expect(gapOf(tile.n, mid)).not.toBe('absurd')
    expect(callable({ median: mid }, first)).toBe(true)
    expect(hiddenShare(tile, around, cam)).toBeLessThan(CALLABLE.hidden)
    expect(metersBetween(miznerPark, tile.at)).toBeLessThan(600)
  })
  it('knows a place of worship by the assessor, by OpenStreetMap or by its name', () => {
    expect(worship({ use_text: 'religious', kind: null, name: null })).toBe(true)
    expect(worship({ use_text: 'stores', kind: 'place_of_worship', name: null })).toBe(true)
    expect(worship({ use_text: 'stores', kind: null, name: 'First Baptist Church' })).toBe(true)
    expect(worship({ use_text: 'stores', kind: 'restaurant', name: 'Casa D\u2019Angelo' })).toBe(false)
    expect(worship(byId.get(ST_GREGORYS)!)).toBe(true)
  })
  it('never calls a place of worship ordinary, nor a school, a cemetery, government, civic land, empty land or a home', () => {
    const no: Pick<CallRecord, 'use' | 'use_text' | 'kind' | 'name'>[] = [
      { use: 'civic', use_text: 'religious', kind: 'place_of_worship', name: 'A church' },
      { use: 'biz', use_text: 'stores', kind: 'place_of_worship', name: null },
      { use: 'civic', use_text: 'prv schl/coll', kind: 'school', name: null },
      { use: 'biz', use_text: 'office bldg-non medical 1 to 3 stories', kind: 'school', name: null },
      { use: 'other', use_text: 'mort/cemetery', kind: null, name: null },
      { use: 'civic', use_text: 'municipal', kind: 'townhall', name: null },
      { use: 'biz', use_text: 'office bldg-non medical 1 to 3 stories', kind: 'post_office', name: null },
      { use: 'biz', use_text: 'leasehold int', kind: 'museum', name: null },
      { use: 'biz', use_text: 'vacant commercial land', kind: null, name: null },
      { use: 'homes', use_text: 'single family', kind: null, name: null },
      { use: 'biz', use_text: 'store/office/residential', kind: null, name: null },
    ]
    for (const r of no) expect(ordinary(r), JSON.stringify(r)).toBe(false)
    expect(ordinary({ use: 'biz', use_text: 'restaurant, drive in', kind: 'fast_food', name: 'Burger King' })).toBe(true)
    expect(ordinary({ use: 'biz', use_text: 'stores', kind: 'retail', name: 'Mizner Plaza' })).toBe(true)
  })
  it('turns down a place of worship on any round, whatever its size and value', () => {
    const church = byId.get(ST_GREGORYS)!
    // By size and value alone it passes, which is how it came to be asked about.
    expect(callable({ median: 6.6 }, { id: church.id, vpa: church.vpa, acres: church.acres })).toBe(true)
    expect(callable({ median: 6.6 }, church)).toBe(false)
    expect(chooseCallable([{ id: church.id, median: 6.6 }], records)).toBeNull()
    // From the first lot, over 200 rounds, no place of worship in the committed records comes up.
    const start = tiles.find((t) => t.id === tokens.map.hunt.first)!.at
    const places = new Set(records.filter((r) => worship(r)).map((r) => r.id))
    expect(places.size).toBeGreaterThan(3)
    for (let seed = 1; seed <= 200; seed++) {
      const pick = chooseCallable(rankCandidates(tiles, start, new Set([tokens.map.hunt.first]), cam, seeded(seed)), records)
      expect(pick, `seed ${seed}`).not.toBeNull()
      expect(places.has(pick!.id), pick!.id).toBe(false)
    }
  })
})
