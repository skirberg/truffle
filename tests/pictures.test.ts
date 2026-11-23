import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { explainCall, pulledWhen, shortWhy, typicalOf, type Neighbor } from '@/lib/copy'
import { changingMarks, placeOf, rulesMarks, RULES_MIN } from '@/lib/marks'
import { addCall, recordOf, RECENT, type Book } from '@/lib/record'
import { zoningColor } from '@/lib/tokens'
import type { Lot } from '@/lib/types'

// The design pass of Nov 20, 2026: sentences became pictures. What each picture is drawn from is tested here.
const base: Lot = {
  id: 'x', legacy: null, name: null, kind: null, address: '1 Main St', place: 'Boca Raton', area: 'downtown', use_text: 'single family', use: 'homes',
  zoning: null, zfam: 'none', acres: 0.2, land: 1_000_000, building: 200_000, vpa: 5_000_000, km: null, typical_km: null,
  pct: 40, peers: 100, year_added: 1990, neighborhood: null, units: 1, lon: 0, lat: 0,
}
const home: Neighbor = { vpa: 6_600_000, acres: 0.2, use: 'homes', land: 1_320_000, building: 230_000 }
const homes = (n: number, over: Partial<Neighbor> = {}): Neighbor[] => Array.from({ length: n }, () => ({ ...home, ...over }))
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }

describe('the answer’s picture: the lot beside the typical one around it', () => {
  it('knows the typical lot’s size and use, and says the reason in a few words', () => {
    const church: Lot = { ...base, use_text: 'religious', use: 'civic', kind: 'place_of_worship', acres: 2.543, land: 6_105_535, building: 5_987_407, vpa: 2_400_918 }
    const r = explainCall(church, homes(12), 6_600_000)!
    expect(r.typical).toMatchObject({ acres: 0.2, use: 'homes' })
    expect(r.short).toBe('Bigger lot, value spread thin.')
    // The whole sentence is still there, a tap away.
    expect(r.text).toMatch(/^It’s a big lot: 2\.5 acres/)
  })
  it('names the use when that is the reason, and says so when the records don’t know', () => {
    const shop: Lot = { ...base, use: 'biz', use_text: 'stores', acres: 0.2, vpa: 9_000_000 }
    expect(shortWhy(shop, ['use'], typicalOf(homes(8)), false)).toBe('Mostly homes around it.')
    expect(shortWhy(base, ['none'], typicalOf(homes(8)), true)).toBe('The records don’t say why.')
    expect(shortWhy({ ...base, built: 1958 }, ['built'], typicalOf(homes(8, { built: 2004 })), true)).toBe('Built 1958, around it 2004.')
  })
  it('names no typical use when the lots around it are a mix', () => {
    expect(typicalOf([...homes(5), ...homes(5, { use: 'biz' })]).use).toBeNull()
  })
  it('keeps every short reason short, with no dashes, on every downtown lot', () => {
    const valued = snap.lots.filter((l) => l.vpa > 0)
    for (const lot of valued.filter((l) => l.area === 'downtown').slice(0, 300)) {
      const near = valued.filter((l) => l.id !== lot.id && Math.hypot((l.lon - lot.lon) * 99_800, (l.lat - lot.lat) * 110_540) <= 350)
      if (near.length < 5) continue
      const median = near.map((n) => n.vpa).sort((a, b) => a - b)[near.length >> 1]!
      const r = explainCall(lot, near, median)
      if (!r) continue
      expect(r.short.split(/\s+/).length, r.short).toBeLessThanOrEqual(8)
      expect(r.short).not.toMatch(/[\u2013\u2014]/)
    }
  })
})

describe('the record as tiles', () => {
  it('draws the latest ten calls in order, right ones filled', () => {
    let b: Book = { v: 1, calls: [] }
    for (let i = 0; i < 14; i++) b = addCall(b, { id: `l${i}`, more: true, right: i % 3 !== 0, n: null })
    b = addCall(b, { id: 'flat', more: true, right: null, n: null })
    const r = recordOf(b)
    expect(r.called).toBe(14)
    expect(r.recent).toHaveLength(RECENT)
    expect(r.recent).toEqual([true, true, false, true, true, false, true, true, false, true])
  })
})

describe('sources fold under one line with their days', () => {
  it('says the day, or the span of days, as short as stays true', () => {
    expect(pulledWhen([{ pulled: '2026-11-04' }, { pulled: '2026-11-04' }])).toBe('Nov 4, 2026')
    expect(pulledWhen([{ pulled: '2026-11-04' }, { pulled: '2026-11-02' }])).toBe('Nov 2 to 4, 2026')
    expect(pulledWhen([{ pulled: '2026-11-04' }, { pulled: '2026-10-30' }])).toBe('Oct 30 to Nov 4, 2026')
    expect(pulledWhen([{ pulled: '2027-01-02' }, { pulled: '2026-12-30' }])).toBe('Dec 30, 2026 to Jan 2, 2027')
  })
})

describe('names on the map', () => {
  it('names each big zoning family downtown once, in its own color, on a lot of that family', () => {
    const marks = rulesMarks(snap.lots)
    const down = snap.lots.filter((l) => l.area === 'downtown')
    const big = new Set(Object.entries(down.reduce<Record<string, number>>((a, l) => ((a[l.zfam] = (a[l.zfam] ?? 0) + 1), a), {})).filter(([k, n]) => n >= RULES_MIN && k !== 'none' && k !== 'special').map(([k]) => k))
    expect(marks.length).toBe(big.size)
    for (const m of marks) {
      expect(m.mode).toBe('rules')
      const on = down.find((l) => l.lon === m.lon && l.lat === m.lat)!
      expect(on, m.text).toBeTruthy()
      expect(m.fill).toBe(zoningColor[on.zfam as keyof typeof zoningColor])
    }
    // The sample holds no homes, so Downtown is the one family big enough to name.
    expect(marks.map((m) => m.text)).toEqual(['Downtown'])
  })
  it('names the land the new West Boca lots stand on, with how many, in plain words', () => {
    expect(placeOf('Johns Pud West Plat Four')).toBe('Johns West')
    expect(placeOf('Johns West Pud Plat One')).toBe('Johns West')
    expect(placeOf('Boca Raton Golf Course Pud Plat Six')).toBe('The old municipal golf course')
    expect(placeOf(null)).toBeNull()
    // The new West Boca lots are nearly all homes, which the committed sample leaves out: it names no place.
    expect(changingMarks(snap.lots)).toEqual([])
    // Two places with many new lots, the one in the west first, and a few lots on land of their own.
    const at = (lon: number, i: number) => ({ lon: lon + (i % 10) * 0.0004, lat: 26.37 + Math.floor(i / 10) * 0.0004 })
    const fresh = [
      ...Array.from({ length: 60 }, (_, i) => ({ ...at(-80.2, i), area: 'west-boca', year_added: 2024, neighborhood: i % 2 ? 'Johns Pud West Plat Four' : 'Johns West Pud Plat One' })),
      ...Array.from({ length: 55 }, (_, i) => ({ ...at(-80.15, i), area: 'west-boca', year_added: 2023, neighborhood: 'Boca Raton Golf Course Pud Plat Six' })),
      ...Array.from({ length: 3 }, (_, i) => ({ ...at(-80.1, i), area: 'west-boca', year_added: 2025, neighborhood: 'Small Plat One' })),
      { ...at(-80.2, 0), area: 'west-boca', year_added: 1998, neighborhood: 'Johns West Pud Plat One' },
    ]
    const marks = changingMarks(fresh)
    expect(marks.map((m) => m.text)).toEqual(['Johns West', 'The old municipal golf course'])
    expect(marks.map((m) => m.sub)).toEqual(['60 new lots', '55 new lots'])
    for (const m of marks) expect(m.sub).toMatch(/^\d[\d,]* new lots$/)
    // Side by side, so neither name hides the other place's lots: the western one on its west.
    expect(marks.find((m) => m.text === 'Johns West')!.side).toBe('left')
    expect(marks.find((m) => m.text !== 'Johns West')!.side).toBe('right')
  })
})
