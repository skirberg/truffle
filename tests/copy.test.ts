import { describe, expect, it } from 'vitest'
import { reasons, scopePhrase, sourceLine } from '@/lib/copy'
import type { Lot } from '@/lib/types'

const base: Lot = {
  id: 'x', legacy: null, name: null, kind: null, address: '1 Main St', place: 'Delray Beach', area: null, use_text: 'stores', use: 'biz',
  zoning: null, zfam: 'none', acres: 1, land: 1_000_000, building: 0, vpa: 1_000_000, km: null, typical_km: null,
  pct: 40, peers: 100, year_added: 1990, neighborhood: null, units: 1, lon: 0, lat: 0,
}

describe('copy', () => {
  it('ranks a lot in its own town', () => {
    expect(scopePhrase(base)).toBe('in Delray Beach')
  })
  it('says a $0 building plainly', () => {
    expect(reasons(base)[0]).toBe('The building is valued at $0. All of the value is the land.')
  })
  it('never invents zoning', () => {
    expect(reasons(base).at(-1)).toBe('No zoning in the records.')
  })
  it('gives each source its own date when they differ', () => {
    const line = sourceLine([
      { key: 'parcels', name: 'P', url: '', pulled: '2026-11-04', rows: 1 },
      { key: 'streets', name: 'S', url: '', pulled: '2026-11-03', rows: null },
    ])
    expect(line).toBe('Values: Palm Beach County property records, pulled Nov 4, 2026. Walk reach: OpenStreetMap streets, pulled Nov 3, 2026.')
  })
  it('uses no em or en dashes', () => {
    expect(reasons(base).join(' ')).not.toMatch(/[\u2013\u2014]/)
  })
})
