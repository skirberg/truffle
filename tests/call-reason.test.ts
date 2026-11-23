import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { callReason, type Neighbor } from '@/lib/copy'
import { shareWords } from '@/lib/numbers'
import type { Lot } from '@/lib/types'

// The front door asks "more or less per acre than its neighbors?", so its reason has to compare the lot
// with its neighbors, and say only what the records show.
const base: Lot = {
  id: 'x', legacy: null, name: null, kind: null, address: '1 Main St', place: 'Boca Raton', area: 'downtown', use_text: 'single family', use: 'homes',
  zoning: null, zfam: 'none', acres: 0.2, land: 1_000_000, building: 200_000, vpa: 5_000_000, km: null, typical_km: null,
  pct: 40, peers: 100, year_added: 1990, neighborhood: null, units: 1, lon: 0, lat: 0,
}
const home: Neighbor = { vpa: 6_600_000, acres: 0.2, use: 'homes', land: 1_320_000, building: 230_000 }
const homes = (n: number, over: Partial<Neighbor> = {}): Neighbor[] => Array.from({ length: n }, () => ({ ...home, ...over }))

describe('the reveal’s reason', () => {
  it('says a big lot among small ones is big, and what it is among what they are', () => {
    const church: Lot = { ...base, use_text: 'religious', use: 'civic', kind: 'place_of_worship', acres: 2.543, land: 6_105_535, building: 5_987_407, vpa: 2_400_918 }
    expect(callReason(church, homes(12), 6_600_000)).toBe(
      'It’s a big lot: 2.5 acres, where the typical lot around it is 0.2 acres. Its value is spread over more ground. Most lots around it are homes. This one is a place of worship.',
    )
  })
  it('says a small lot worth more is small', () => {
    const sliver: Lot = { ...base, acres: 0.05, vpa: 12_000_000 }
    expect(callReason(sliver, homes(8), 6_600_000)).toBe('It’s a small lot: 0.05 acres, where the typical lot around it is 0.2 acres. Its value sits on less ground.')
  })
  it('counts a smaller gap in size when nothing bigger explains it', () => {
    const lot: Lot = { ...base, acres: 0.26, vpa: 5_000_000 }
    expect(callReason(lot, homes(8), 6_600_000)).toBe('It’s bigger than the typical lot around it: 0.26 acres against 0.2 acres. Its value is spread over more ground.')
  })
  it('never gives size as the reason when size points the other way', () => {
    const big: Lot = { ...base, acres: 2, vpa: 9_000_000 }
    expect(callReason(big, homes(8), 6_600_000)).not.toMatch(/big lot|small lot/)
  })
  it('compares land share when that is what differs', () => {
    const built: Lot = { ...base, land: 500_000, building: 500_000, vpa: 2_500_000 }
    expect(callReason(built, homes(8), 6_600_000)).toBe('The land is 50% of its value. Around it the land is typically 85%.')
  })
  it('compares year built where the records carry it', () => {
    const old: Lot = { ...base, built: 1958 }
    expect(callReason(old, homes(8, { built: 2004 }), 6_600_000)).toBe('It was built in 1958. The typical lot around it was built in 2004.')
  })
  it('falls back to the land values, and says so when the records show nothing that sets it apart', () => {
    expect(callReason(base, homes(8), 6_600_000)).toBe('It’s about the size of the lots around it and the same kind of use. The county puts its land at $1M, where theirs is typically $1.3M.')
    // The land value points the other way: no guess.
    expect(callReason({ ...base, land: 1_500_000 }, homes(8), 6_600_000)).toBe('It’s about the size of the lots around it and the same kind of use. The records don’t say why it’s worth less.')
  })
  it('gives no reason without enough neighbors to compare with', () => {
    expect(callReason(base, homes(4), 6_600_000)).toBeNull()
    expect(callReason(base, homes(8), null)).toBeNull()
  })
  it('ignores unvalued neighbors', () => {
    expect(callReason(base, [...homes(4), ...homes(6, { vpa: 0 })], 6_600_000)).toBeNull()
  })
  it('never rounds a building away', () => {
    expect(shareWords(99.6)).toBe('nearly all')
    expect(shareWords(100)).toBe('100%')
    expect(shareWords(92.1)).toBe('92%')
  })
})

describe('the reveal’s reason on the committed lots', () => {
  const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }
  const valued = snap.lots.filter((l) => l.vpa > 0)
  const around = (lot: Lot) =>
    valued.filter((l) => l.id !== lot.id && Math.hypot((l.lon - lot.lon) * 111_320 * Math.cos((lot.lat * Math.PI) / 180), (l.lat - lot.lat) * 110_540) <= 350)
  const median = (ns: Lot[]) => ns.map((n) => n.vpa).sort((a, b) => a - b)[ns.length >> 1]!

  it('answers for St Gregory’s: a big lot, a place of worship among homes', () => {
    const lot = snap.lots.find((l) => l.name === 'Saint Gregory\'s Episcopal Church')!
    const near = around(lot)
    const why = callReason(lot, near, median(near))!
    expect(why).toMatch(/^It’s a big lot: 2\.5 acres, where the typical lot around it is 0\.\d+ acres\. Its value is spread over more ground\./)
  })
  it('is always a comparison or an honest shrug, short, with no dashes, for every downtown lot', () => {
    for (const lot of valued.filter((l) => l.area === 'downtown')) {
      const near = around(lot)
      if (near.length < 5) continue
      const m = median(near)
      const why = callReason(lot, near, m)
      if (lot.vpa === m) continue
      expect(why, lot.id).toMatch(/[Aa]round it/)
      expect(why, lot.id).not.toMatch(/[\u2013\u2014]|undefined|NaN|null/)
      expect(why!.length, lot.id).toBeLessThanOrEqual(190)
      // Size is only a reason in the direction the arithmetic runs.
      if (/big lot/.test(why!)) expect(lot.vpa).toBeLessThan(m)
      if (/small lot/.test(why!)) expect(lot.vpa).toBeGreaterThan(m)
    }
  })
})
