// A new lot every day, the same one for everyone that day, the way Wordle gives one word a day: the day's
// number counts calendar days from Nov 20, 2026 (No. 1), by the visitor's own calendar, and picks from a
// fixed list in a fixed order (data/daily.json). The list holds only lots whose answer is clear and whose
// reason is a real one, and tests/daily.test.ts checks every lot on it against the committed records.
import daily from '@/data/daily.json'

export const DAILY = daily as { first: string; lots: string[] }

const DAY_MS = 86_400_000

/** Midnight UTC of a calendar date, so daylight saving never makes a day 23 or 25 hours long. */
const utcOf = (y: number, m: number, d: number) => Date.UTC(y, m, d)

/** The day's number for a date on the visitor's own calendar: No. 1 on the list's first day. Never under 1. */
export function dayNumber(now: Date, first = DAILY.first): number {
  const [y, m, d] = first.split('-').map(Number) as [number, number, number]
  const n = Math.round((utcOf(now.getFullYear(), now.getMonth(), now.getDate()) - utcOf(y, m - 1, d)) / DAY_MS) + 1
  return Math.max(1, n)
}

/** The lot for day n. The list runs in its fixed order and starts again from the top when it runs out. */
export function lotForDay(n: number, lots = DAILY.lots): string | null {
  if (!lots.length) return null
  const i = (Math.max(1, Math.floor(n)) - 1) % lots.length
  return lots[i]!
}

/** A seeded shuffle (mulberry32), for putting the list in its order once, when it is drawn up. */
export function shuffled<T>(xs: T[], seed: number): T[] {
  let a = seed >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Puts the day's lots in order: shuffled with a fixed seed, then nudged so the same answer never comes up more
 * than `run` days in a row, which would teach a returning player to press the same button.
 */
export function orderLots<T extends { id: string; more: boolean }>(lots: T[], seed: number, run = 2): T[] {
  const out = shuffled([...lots].sort((a, b) => (a.id < b.id ? -1 : 1)), seed)
  for (let i = run; i < out.length; i++) {
    const same = out.slice(i - run, i).every((l) => l.more === out[i]!.more)
    if (!same) continue
    const j = out.findIndex((l, k) => k > i && l.more !== out[i]!.more)
    if (j > 0) [out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
