// The numbers Truffle shows. The pipeline that writes the records computes the same ones; tests hold them to
// Mizner Plaza.

/** min(60, 3 + 46 * sqrt(v / 16,000,000)) meters; unvalued lots sit at 1 m. */
export function heightM(valuePerAcre: number): number {
  if (!(valuePerAcre > 0)) return 1
  return Math.min(60, 3 + 46 * Math.sqrt(valuePerAcre / 16_000_000))
}

/** $6.6M, $112K, $950. Tens of millions lose the decimal. */
export function money(v: number): string {
  if (v >= 999.5e6) return '$' + (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + Math.round(v)
}

/** The number on a tile, in millions per acre. Under $50K an acre it would read 0.0, so the tile shows none. */
export function tileLabel(v: number): string {
  if (!(v >= 50_000)) return ''
  if (v >= 999.5e6) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  return v >= 9.95e6 ? (v / 1e6).toFixed(0) : (v / 1e6).toFixed(1)
}

/** A tile's number ("6.6", "1.0", "1.2B") as money, through the one formatter: $6.6M, $1M, $1.2B. */
export function tileMoney(n: unknown): string {
  const s = String(n ?? '')
  const v = s.endsWith('B') ? parseFloat(s) * 1e9 : parseFloat(s) * 1e6
  return v > 0 ? money(v) : ''
}

/** Share of the value that is land, when both land and building are valued. */
export function landShare(land: number, building: number): number | null {
  if (land > 0 && building > 0) return Math.round((100 * land) / (land + building))
  return null
}

/** A share of value in words that never rounds a real building away: 100% only when it is all of it. */
export function shareWords(pct: number): string {
  if (pct >= 100) return '100%'
  if (pct >= 99.5) return 'nearly all'
  if (pct > 0 && pct < 0.5) return 'almost none'
  return `${Math.round(pct)}%`
}

/** The land's share as it reads beside a building value: "92%", or "nearly all" where rounding would say 100%. */
export function landShareWords(land: number, building: number): string | null {
  if (land > 0 && building > 0) return shareWords((100 * land) / (land + building))
  return null
}

/** Share of valued lots worth strictly less per acre. */
export function pctBelow(v: number, sorted: number[]): number {
  if (!sorted.length) return 0
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < v) lo = mid + 1
    else hi = mid
  }
  // A lot can't be worth more than itself, so the top lot reads 99%, never 100%.
  return Math.min(99, Math.round((100 * lo) / sorted.length))
}

export function km(v: number): string {
  return v.toFixed(1)
}

export function count(n: number): string {
  return n.toLocaleString('en-US')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** 2026-11-03 -> Nov 3, 2026 */
export function day(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`
}
