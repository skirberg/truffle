'use client'

import { useEffect, useState } from 'react'
import { heightM, count } from '@/lib/numbers'
import { scopePhrase } from '@/lib/copy'
import type { Lot } from '@/lib/types'

// The lot among its neighbors: every valued lot it is compared with, lowest to highest, drawn with the
// map's own height formula, and this lot in truffle where it stands, with its rank pinned over it the way the
// map pins the picked lot's number. The rank sentence, as a picture; the sentence is its label.
export function Skyline({ lot, label }: { lot: Lot; label: string | null }) {
  const [spread, setSpread] = useState<{ n: number; values: number[] } | null>(null)
  useEffect(() => {
    const q = new URLSearchParams({ place: lot.place, ...(lot.area ? { area: lot.area } : {}) })
    const ctl = new AbortController()
    fetch(`/api/spread?${q}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSpread)
      .catch(() => {})
    return () => ctl.abort()
  }, [lot.area, lot.place])

  // Hold the space while it loads so the rows under it don't jump; draw nothing where there's no set to compare with.
  if (!spread) return <div aria-hidden="true" className="h-32" />
  if (spread.values.length < 8 || !(lot.vpa > 0)) return null
  // Heights run from the lowest lot to the highest with the map's formula, stretched so the spread shows.
  const lo = Math.min(heightM(spread.values[0]!), heightM(lot.vpa))
  const hi = Math.max(heightM(spread.values.at(-1)!), heightM(lot.vpa))
  const pct = (v: number) => 12 + (88 * (heightM(v) - lo)) / Math.max(1e-6, hi - lo)
  const at = spread.values.findIndex((v) => v >= lot.vpa)
  const mine = at === -1 ? spread.values.length - 1 : at
  const x = ((mine + 0.5) / spread.values.length) * 100
  const rank = lot.pct !== null ? Math.min(99, lot.pct) : null
  return (
    <figure className="m-0 flex flex-col gap-2 pb-4" role="img" aria-label={label ?? `Among ${count(spread.n)} valued lots ${scopePhrase(lot)}, lowest to highest.`} data-testid="skyline">
      <div className="relative flex h-24 items-end gap-px pt-8" aria-hidden="true" data-marks>
        {spread.values.map((v, i) => (
          <span
            key={i}
            className={`flex-1 rounded-t-[2px] ${i === mine ? 'bg-truffle' : 'bg-[var(--vacant-l)]'}`}
            style={{ height: `${(pct(i === mine ? lot.vpa : v) * 64) / 100}px` }}
          />
        ))}
        {rank !== null && (
          <span
            className="absolute -translate-x-1/2 rounded-sm bg-truffle px-2 text-ui-label font-bold whitespace-nowrap text-paper"
            style={{ left: `clamp(32px, ${x}%, calc(100% - 32px))`, bottom: `${(pct(lot.vpa) * 64) / 100 + 4}px` }}
          >
            Beats {rank}%
          </span>
        )}
      </div>
      <figcaption className="text-ui-label font-semibold text-soft" aria-hidden="true">
        {count(spread.n)} lots {scopePhrase(lot)}, low to high
      </figcaption>
    </figure>
  )
}
