// Sending a lot to a friend. The link opens the same lot under fog, the way a GeoGuessr challenge link opens
// the same round, and the sender's call rides along in it, so nothing about anyone is kept on a server: no
// account, no record, just a lot and one bit. The friend sees that call only after making their own.
// The result line is Wordle's spoiler-free share: how you did, never the answer.
import type { Lot } from './types'
import { lotTitle, whatItIs } from './copy'

/** FNV-1a over the lot's id: mixes the call with the lot, so the code doesn't read "more" at a glance. */
function salt(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0
  return h & 0xfffff
}

/** The highest day number a code carries: three thousand years of days. */
const MAX_N = 999_999

/** The code for a call on a lot: the call and, for a day's lot, its number, as a few letters and digits. */
export function encodeCall(id: string, more: boolean, n: number | null): string {
  const day = n && n > 0 && n <= MAX_N ? Math.floor(n) : 0
  return ((day * 2 + (more ? 1 : 0)) ^ salt(id)).toString(36)
}

/** The call back out of a code, or null when the link carries none or it was cut short or mistyped. */
export function decodeCall(id: string, code: string | null | undefined): { more: boolean; n: number | null } | null {
  if (!code || !/^[0-9a-z]{1,6}$/.test(code)) return null
  const v = parseInt(code, 36) ^ salt(id)
  if (!(v >= 0) || v > MAX_N * 2 + 1) return null
  return { more: (v & 1) === 1, n: v >> 1 || null }
}

/** The path that opens a lot under fog for a friend, with the sender's call in it. */
export function challengePath(id: string, more: boolean, n: number | null): string {
  return `/call/${encodeURIComponent(id)}?c=${encodeCall(id, more, n)}`
}

/** What a sent lot is called where the link shows outside Truffle (the chat's preview): its name or address,
 * except a home, which goes by what it is. A preview travels further than the page, and no one's house should
 * ride along in it by address. */
export function inviteName(lot: Lot): string {
  return lot.use === 'homes' ? (whatItIs(lot) ?? 'A home') : lotTitle(lot)
}

/** Where a lot is, the way a local says it: "Boca", "West Boca", "Delray Beach". */
export function townWords(lot: Pick<Lot, 'area' | 'place'>): string {
  if (lot.area === 'west-boca') return 'West Boca'
  if (lot.place === 'Boca Raton') return 'Boca'
  if (lot.place.startsWith('Unincorporated')) return 'Palm Beach County'
  return lot.place
}

/** The line to paste: "Truffle No. 12: called it in Boca". How you did, never which way the lot went. */
export function resultLine(lot: Pick<Lot, 'area' | 'place'>, right: boolean | null, n: number | null): string {
  const how = right === null ? 'made the call' : right ? 'called it' : 'missed it'
  return `Truffle${n ? ` No. ${n}` : ''}: ${how} in ${townWords(lot)}`
}

/** Two calls side by side, for the friend: "You both said Less", or "You said More, they said Less". */
export function compareLine(mine: boolean, theirs: boolean): string {
  const say = (more: boolean) => (more ? 'More' : 'Less')
  return mine === theirs ? `You both said ${say(mine)}` : `You said ${say(mine)}, they said ${say(theirs)}`
}
