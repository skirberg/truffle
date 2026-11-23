import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { NEAR_M, asNeighbor, neighborsOf, settle } from '@/lib/call'
import { metersBetween } from '@/lib/call-picker'
import type { Lot } from '@/lib/types'

// One answer for everyone: a call settles against the records of the valued lots within a few blocks.
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }
const BK = snap.lots.find((l) => l.id === '06434720270010152')!

describe('settling a call', () => {
  it('compares a lot with the valued lots within a few blocks, nearest first, never itself', () => {
    const near = neighborsOf(BK, snap.lots)
    expect(near.length).toBeGreaterThan(20)
    expect(near.some((l) => l.id === BK.id)).toBe(false)
    expect(near.every((l) => l.vpa > 0 && metersBetween([BK.lon, BK.lat], [l.lon, l.lat]) <= NEAR_M)).toBe(true)
    const d = near.map((l) => metersBetween([BK.lon, BK.lat], [l.lon, l.lat]))
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })
  it('the Burger King: worth less per acre than its neighbors, because it is a big lot', () => {
    const f = settle(BK, neighborsOf(BK, snap.lots).map(asNeighbor))
    expect(f.more).toBe(false)
    expect(f.median).toBeGreaterThan(BK.vpa)
    expect(f.why).toMatch(/^It’s a big lot: 0\.86 acres/)
    expect(f.grounds).toContain('size')
  })
  it('is the same answer whatever order the records come in', () => {
    const a = settle(BK, neighborsOf(BK, snap.lots).map(asNeighbor))
    const b = settle(BK, neighborsOf(BK, [...snap.lots].reverse()).map(asNeighbor))
    expect(b).toEqual(a)
  })
  it('has no answer with nothing around it, or for a lot with no value', () => {
    expect(settle(BK, []).more).toBeNull()
    expect(settle({ ...BK, vpa: 0 }, neighborsOf(BK, snap.lots).map(asNeighbor)).more).toBeNull()
  })
})
