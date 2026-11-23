// Your record, kept in this browser and nowhere else: every lot you've called, whether you called it right, and
// which day's lot it was. It is what makes a return visit pick up where you left off, the way Wordle keeps your
// board in the browser: the day's lot already called shows its answer, and the rounds after it skip the lots
// you've seen. Nothing here leaves the device.

export type Played = {
  id: string
  /** Your call: more per acre than the lots around it. */
  more: boolean
  /** Null when there was nothing around it to compare with. */
  right: boolean | null
  /** The day's number when it was that day's lot (or a friend sent that day's lot), else null. */
  n: number | null
}

export type Book = { v: 1; calls: Played[] }

export const KEY = 'truffle:calls'
/** Plenty for years of daily play; the oldest calls go first past it. */
const KEEP = 1000

const empty = (): Book => ({ v: 1, calls: [] })

const isPlayed = (x: unknown): x is Played => {
  const p = x as Played
  return !!p && typeof p.id === 'string' && typeof p.more === 'boolean' && (p.right === null || typeof p.right === 'boolean') && (p.n === null || typeof p.n === 'number')
}

/** The book from storage. Private windows and blocked storage throw or come back empty: that is a fresh book. */
export function readBook(storage: Pick<Storage, 'getItem'> | null | undefined): Book {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return empty()
    const b = JSON.parse(raw) as Book
    return b && b.v === 1 && Array.isArray(b.calls) ? { v: 1, calls: b.calls.filter(isPlayed) } : empty()
  } catch {
    return empty()
  }
}

export function writeBook(storage: Pick<Storage, 'setItem'> | null | undefined, book: Book): void {
  try {
    storage?.setItem(KEY, JSON.stringify(book))
  } catch {
    // Full or blocked storage: the game still plays, it just won't remember.
  }
}

/** Add a call. A lot is called once per day's number (or once, when it was never a day's lot). */
export function addCall(book: Book, p: Played): Book {
  const calls = book.calls.filter((c) => !(c.id === p.id && c.n === p.n))
  return { v: 1, calls: [...calls, p].slice(-KEEP) }
}

/** How many calls the record draws as tiles: the latest ten, the way Wordle's share draws one row per guess. */
export const RECENT = 10

/** "4 of 6 called right": every call with something to compare it with, and the latest of them in order. */
export function recordOf(book: Book): { called: number; right: number; recent: boolean[] } {
  const counted = book.calls.filter((c) => c.right !== null)
  return { called: counted.length, right: counted.filter((c) => c.right).length, recent: counted.slice(-RECENT).map((c) => c.right === true) }
}

/** Your call on day n's lot, if you've made it. The lot has to match: a day's list redrawn after a pull can
 * put another lot on that day, and an old call on a different lot doesn't answer it. */
export function calledOnDay(book: Book, n: number, id: string): Played | null {
  return [...book.calls].reverse().find((c) => c.n === n && c.id === id) ?? null
}

/** Your latest call on a lot, whichever day it was. */
export function calledLot(book: Book, id: string): Played | null {
  return [...book.calls].reverse().find((c) => c.id === id) ?? null
}
