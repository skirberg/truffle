import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { heightM, landShare, money, pctBelow, tileLabel, tileMoney } from '@/lib/numbers'
import { reasons, sourceLine, sourcesFor } from '@/lib/copy'
import type { Lot, Pull } from '@/lib/types'

// The committed sample (data/snapshot.json.gz) is what the app serves without a database: the lots of Downtown
// Boca Raton and West Boca that aren't homes. Mizner Plaza, a block of shops downtown, is the lot every check
// holds to.
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { pulls: Pull[]; lots: Lot[] }
const downtown = snap.lots.filter((l) => l.area === 'downtown')
const lot = snap.lots.find((l) => l.name === 'Mizner Plaza')!

describe('Mizner Plaza', () => {
  it('is 132 NE 2nd St, parcel 06434720280000070, lot 608 on the first board', () => {
    expect(lot.address).toBe('132 NE 2nd St')
    expect(lot.id).toBe('06434720280000070')
    expect(lot.legacy).toBe(608)
  })
  it('is $7.2M an acre ($7,206,459)', () => {
    expect(lot.vpa).toBe(7_206_459)
    expect(money(lot.vpa)).toBe('$7.2M')
    expect(tileLabel(lot.vpa)).toBe('7.2')
  })
  it('writes money one way, on the map and in the panel', () => {
    expect(tileMoney(tileLabel(lot.vpa))).toBe(money(7_200_000))
    // A round million never keeps its ".0": the map said "$1.0M" where the panel said "$1M".
    expect(tileMoney('1.0')).toBe('$1M')
    expect(tileMoney(tileLabel(1_020_000))).toBe(money(1_000_000))
    expect(tileMoney('104')).toBe('$104M')
    expect(tileMoney('1.2B')).toBe('$1.2B')
    expect(tileMoney('')).toBe('')
  })
  it('has land at 78% of value and a $2,080,803 building', () => {
    expect(landShare(lot.land, lot.building)).toBe(78)
    expect(lot.building).toBe(2_080_803)
  })
  it('is worth more per acre than 83% of the 613 valued lots downtown, counted across every lot', () => {
    // The rank was counted across every valued lot downtown, homes included; the sample keeps 152 of them.
    expect(lot.pct).toBe(83)
    expect(lot.peers).toBe(613)
    const valued = downtown.filter((l) => l.vpa > 0).map((l) => l.vpa).sort((a, b) => a - b)
    expect(downtown.length).toBe(175)
    expect(valued.length).toBe(152)
    expect(pctBelow(lot.vpa, valued)).toBe(51)
  })
  it('is zoned DDRI, downtown', () => {
    expect(lot.zoning).toBe('DDRI')
    expect(lot.zfam).toBe('downtown')
  })
  it('says it in the panel’s words', () => {
    expect(reasons(lot)).toEqual([
      'The land is 78% of the value. The building is worth $2.1M.',
      'Worth more per acre than 83% of valued lots downtown.',
      'Zoned for downtown.',
    ])
  })
  it('says how far a short walk reaches where the records carry it', () => {
    expect(reasons({ ...lot, km: 17, typical_km: 13.8 })).toContain('A 10-minute walk reaches 17.0 km of street. The typical lot here reaches 14.')
  })
  it('names each source and the date it was pulled', () => {
    const line = sourceLine(sourcesFor(lot, snap.pulls))
    for (const name of ['Palm Beach County property records', 'City of Boca Raton']) expect(line).toContain(name)
    // one date for all, or one per source when they differ
    expect(line).toMatch(/([Pp]ulled [A-Z][a-z]{2} \d{1,2}, \d{4}\.)$/)
  })
})

describe('the sample', () => {
  it('holds no homes: no house, condo, townhouse or manufactured home, and no empty land zoned for one', () => {
    expect(snap.lots.length).toBe(497)
    expect(snap.lots.filter((l) => l.use === 'homes' || l.use === 'vacant')).toEqual([])
    expect(snap.lots.filter((l) => /single family|townhouse|condo|multifamily|mht|modular|mh pk/i.test(l.use_text))).toEqual([])
  })
  it('shows 13 West Boca lots added since 2023', () => {
    expect(snap.lots.filter((l) => l.area === 'west-boca' && l.year_added >= 2023).length).toBe(13)
  })
})

describe('numbers', () => {
  it('height matches the brand book formula', () => {
    expect(heightM(0)).toBe(1)
    expect(heightM(16_000_000)).toBe(49)
    expect(heightM(1e9)).toBe(60)
    expect(heightM(7_206_459)).toBeCloseTo(3 + 46 * Math.sqrt(7_206_459 / 16e6), 9)
  })
  it('money', () => {
    expect(money(24_882_819)).toBe('$25M')
    expect(money(950)).toBe('$950')
    expect(money(5_407_000_000)).toBe('$5.4B')
    expect(tileLabel(5_407_000_000)).toBe('5.4B')
    expect(tileLabel(49_999)).toBe('')
    expect(tileLabel(50_000)).toBe('0.1')
  })
})
