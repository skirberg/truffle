import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { callable, ordinary } from '@/lib/call-picker'
import { lotTitle } from '@/lib/copy'
import { dayNumber, lotForDay } from '@/lib/daily'
import type { Lot } from '@/lib/types'

// The day's lot is the front door's first question for everyone that day, so every lot on the list has to be a
// fair one: a business people can see from the street (never a home, a place of worship or civic land), an
// answer that is clear rather than a coin flip, and a reason that explains it in plain words. The list
// (data/daily.json) is drawn up against every record downtown and in West Boca, homes included; the committed
// sample leaves the homes out, so the answers and their balance are checked where those records are. Here
// every lot on the list is held to what the sample can show: a business with a record, called by its name or
// its address, of a size and value the front door will ask about.
const snap = JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: Lot[] }
const committed = JSON.parse(readFileSync('data/daily.json', 'utf8')) as { first: string; lots: string[] }
const byId = new Map(snap.lots.map((l) => [l.id, l]))
const FIRST = '2026-11-20'

describe('the day’s lot', () => {
  it('starts on Nov 20, 2026', () => {
    expect(committed.first).toBe(FIRST)
  })

  it('has a month and more of lots, each one once', () => {
    expect(committed.lots.length).toBeGreaterThanOrEqual(30)
    expect(new Set(committed.lots).size).toBe(committed.lots.length)
  })

  it('is always a business with a record, a name or an address to call it by, and a sane size and value', () => {
    for (const id of committed.lots) {
      const lot = byId.get(id)
      expect(lot, id).toBeDefined()
      expect(id, id).not.toContain('-')
      expect(lot!.use, lotTitle(lot!)).toBe('biz')
      expect(ordinary(lot!), lotTitle(lot!)).toBe(true)
      expect(Boolean(lot!.name || lot!.address), id).toBe(true)
      expect(callable({ median: null }, lot!), lotTitle(lot!)).toBe(true)
    }
  })
})

describe('the day’s number', () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)
  it('is No. 1 on Nov 20, 2026 and counts calendar days from there', () => {
    expect(dayNumber(at(2026, 11, 20), FIRST)).toBe(1)
    expect(dayNumber(at(2026, 11, 21), FIRST)).toBe(2)
    expect(dayNumber(at(2026, 12, 31), FIRST)).toBe(42)
    expect(dayNumber(at(2027, 11, 20), FIRST)).toBe(366)
  })
  it('is the same all day, from just after midnight to just before the next', () => {
    expect(dayNumber(at(2026, 11, 25, 0, 1), FIRST)).toBe(dayNumber(at(2026, 11, 25, 23, 59), FIRST))
    expect(dayNumber(at(2026, 11, 26, 0, 0), FIRST)).toBe(dayNumber(at(2026, 11, 25, 23, 59), FIRST) + 1)
  })
  it('steps by one across the clock changes, which make a day 23 or 25 hours long', () => {
    expect(dayNumber(at(2027, 3, 15), FIRST) - dayNumber(at(2027, 3, 14), FIRST)).toBe(1)
    expect(dayNumber(at(2027, 11, 8), FIRST) - dayNumber(at(2027, 11, 7), FIRST)).toBe(1)
  })
  it('never goes under 1, even on a clock set before the first day', () => {
    expect(dayNumber(at(2025, 1, 1), FIRST)).toBe(1)
  })
})

describe('the lot for a day', () => {
  const lots = ['a', 'b', 'c', 'd']
  it('is the same for everyone with the same day: a pure function of the number', () => {
    expect(lotForDay(3, lots)).toBe('c')
    expect(lotForDay(3, [...lots])).toBe(lotForDay(3, lots))
  })
  it('changes every day and starts the list over when it runs out', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => lotForDay(n, lots))).toEqual(['a', 'b', 'c', 'd', 'a', 'b'])
    for (let n = 1; n < 400; n++) expect(lotForDay(n + 1, committed.lots)).not.toBe(lotForDay(n, committed.lots))
  })
  it('is null only when there is no list at all', () => {
    expect(lotForDay(1, [])).toBeNull()
  })
})
