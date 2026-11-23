import { describe, expect, it } from 'vitest'
import { KEY, addCall, calledLot, calledOnDay, readBook, recordOf, writeBook, type Book } from '@/lib/record'

// Your record, in this browser only.
class Memory {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}
const blocked = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}
const fresh = (): Book => ({ v: 1, calls: [] })

describe('the record', () => {
  it('counts every call that had something to compare with: "4 of 6 called right"', () => {
    let b = fresh()
    const plays = [true, true, false, true, false, true].map((right, i) => ({ id: `l${i}`, more: i % 2 === 0, right, n: i === 0 ? 1 : null }))
    for (const p of plays) b = addCall(b, p)
    b = addCall(b, { id: 'flat', more: true, right: null, n: null })
    expect(recordOf(b)).toMatchObject({ called: 6, right: 4 })
  })
  it('keeps one call per lot and day: calling the same lot again replaces it', () => {
    let b = addCall(fresh(), { id: 'a', more: true, right: false, n: null })
    b = addCall(b, { id: 'a', more: false, right: true, n: null })
    expect(b.calls).toHaveLength(1)
    expect(calledLot(b, 'a')?.more).toBe(false)
  })
  it('knows the day’s lot is called only when the day and the lot both match', () => {
    const b = addCall(fresh(), { id: 'a', more: true, right: true, n: 4 })
    expect(calledOnDay(b, 4, 'a')?.right).toBe(true)
    expect(calledOnDay(b, 5, 'a')).toBeNull()
    expect(calledOnDay(b, 4, 'b')).toBeNull()
  })
  it('survives a reload, and starts fresh on a private window or blocked storage', () => {
    const m = new Memory()
    writeBook(m, addCall(fresh(), { id: 'a', more: true, right: true, n: 1 }))
    expect(readBook(m).calls).toHaveLength(1)
    expect(readBook(blocked)).toEqual(fresh())
    expect(() => writeBook(blocked, fresh())).not.toThrow()
    expect(readBook(null)).toEqual(fresh())
  })
  it('ignores a book it can’t read rather than breaking the game', () => {
    const m = new Memory()
    m.setItem(KEY, '{not json')
    expect(readBook(m)).toEqual(fresh())
    m.setItem(KEY, JSON.stringify({ v: 1, calls: [{ id: 'a', more: 'yes' }, { id: 'b', more: true, right: null, n: null }] }))
    expect(readBook(m).calls).toEqual([{ id: 'b', more: true, right: null, n: null }])
  })
  it('stays small: a thousand calls at most, oldest out first', () => {
    let b = fresh()
    for (let i = 0; i < 1100; i++) b = addCall(b, { id: `l${i}`, more: true, right: true, n: null })
    expect(b.calls).toHaveLength(1000)
    expect(b.calls[0]!.id).toBe('l100')
  })
})
