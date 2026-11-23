import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { challengePath, compareLine, decodeCall, encodeCall, resultLine, townWords } from '@/lib/challenge'

// Sending a lot to a friend: the call travels in the link and nowhere else, and nothing that is shared ever
// says which way the lot went.
const BK = '06434720270010152'
const daily = JSON.parse(readFileSync('data/daily.json', 'utf8')) as { lots: string[] }

describe('the link a call travels in', () => {
  it('carries the call and the day’s number there and back, for every lot on the list', () => {
    for (const id of [BK, ...daily.lots]) {
      for (const more of [true, false]) {
        for (const n of [null, 1, 12, 365, 4000]) {
          expect(decodeCall(id, encodeCall(id, more, n))).toEqual({ more, n })
        }
      }
    }
  })
  it('is short, and More and Less don’t read as such', () => {
    const code = encodeCall(BK, true, 12)
    expect(code).toMatch(/^[0-9a-z]{1,6}$/)
    expect(code).not.toMatch(/more|less/)
    expect(challengePath(BK, true, 12)).toBe(`/call/${BK}?c=${code}`)
  })
  it('gives no call for a missing, cut or mistyped code, and a code for one lot means nothing on another', () => {
    expect(decodeCall(BK, null)).toBeNull()
    expect(decodeCall(BK, '')).toBeNull()
    expect(decodeCall(BK, 'MORE')).toBeNull()
    expect(decodeCall(BK, 'zzzzzz')).toBeNull()
    expect(decodeCall(BK, 'a b')).toBeNull()
    // Another lot's code decodes to some call but never this lot's day: the page checks the day against the list.
    const other = decodeCall(daily.lots[0]!, encodeCall(BK, true, 3))
    expect(other === null || other.n !== 3 || other.more !== true).toBe(true)
  })
  it('holds nothing about the sender: just the lot, and one call', () => {
    const url = challengePath(BK, false, 7)
    expect(url).not.toMatch(/name|user|id=|@/)
    expect(new URL(url, 'https://www.truffle.city').searchParams.size).toBe(1)
  })
})

describe('the line to paste', () => {
  const downtown = { area: 'downtown', place: 'Boca Raton' }
  it('says how you did and where, never which way the lot went', () => {
    expect(resultLine(downtown, true, 12)).toBe('Truffle No. 12: called it in Boca')
    expect(resultLine(downtown, false, 12)).toBe('Truffle No. 12: missed it in Boca')
    expect(resultLine({ area: 'west-boca', place: 'Boca Raton' }, true, 3)).toBe('Truffle No. 3: called it in West Boca')
    expect(resultLine(downtown, true, null)).toBe('Truffle: called it in Boca')
    expect(resultLine(downtown, null, 5)).toBe('Truffle No. 5: made the call in Boca')
    for (const right of [true, false, null]) expect(resultLine(downtown, right, 9)).not.toMatch(/more|less|\$|acre/i)
  })
  it('names a town the way a local would', () => {
    expect(townWords({ area: null, place: 'Delray Beach' })).toBe('Delray Beach')
    expect(townWords({ area: null, place: 'Unincorporated Palm Beach County' })).toBe('Palm Beach County')
  })
  it('keeps to the voice: no exclamation points and no dashes', () => {
    for (const right of [true, false, null]) expect(resultLine(downtown, right, 1)).not.toMatch(/[!–—]/)
  })
})

describe('two calls side by side', () => {
  it('says when you agreed and when you didn’t', () => {
    expect(compareLine(false, false)).toBe('You both said Less')
    expect(compareLine(true, true)).toBe('You both said More')
    expect(compareLine(true, false)).toBe('You said More, they said Less')
    expect(compareLine(false, true)).toBe('You said Less, they said More')
  })
})

describe('the name a link travels under', () => {
  it('is a business’s name, and a home’s kind, never a home’s address', async () => {
    const { inviteName } = await import('@/lib/challenge')
    const base = { id: 'x', legacy: null, kind: null, place: 'Boca Raton', area: 'downtown', zoning: null, zfam: 'none' as const, acres: 0.2, land: 1, building: 1, vpa: 1, km: null, typical_km: null, pct: null, peers: null, year_added: 1990, neighborhood: null, units: 1, lon: 0, lat: 0 }
    expect(inviteName({ ...base, name: 'Burger King', address: '175 N Federal Hwy', use: 'biz', use_text: 'restaurant' })).toBe('Burger King')
    expect(inviteName({ ...base, name: null, address: '12 Elm St', use: 'homes', use_text: 'single family' })).toBe('A single-family home')
  })
})
