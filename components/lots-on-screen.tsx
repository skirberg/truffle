'use client'

import { useEffect, useState } from 'react'
import { money } from '@/lib/numbers'
import { whatItIs } from '@/lib/copy'
import type { Lot } from '@/lib/types'
import type { Mode } from './board'

type Row = { id: string; address: string | null; vpa: number; year_added: number; use_text: string; use?: Lot['use'] }

// Keyboard access to lots: a list of the lots on screen, reached with Tab. It stays out of sight until it
// has focus, then shows as a card under the tabs. Enter picks a lot exactly as a tap does.
// On the front door it names the lots without their values until the call is made: a screen reader reads
// this list in full, so a value here would give the call away the way a number on a tile would.
export function LotsOnScreen({
  ids,
  mode,
  onPick,
  values = true,
  asking = null,
}: {
  ids: string[]
  mode: Mode
  onPick: (id: string) => void
  /** False on the front door until the lot under fog has been called. */
  values?: boolean
  /** The lot under fog, named as the lot to call. */
  asking?: string | null
}) {
  const [rows, setRows] = useState<Row[]>([])
  const key = ids.join(',')
  if (!ids.length && rows.length) setRows([])
  useEffect(() => {
    if (!ids.length) return
    const ctl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/lots?ids=${encodeURIComponent(key)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((body: Row[]) => {
          const order = new Map(ids.map((id, i) => [id, i]))
          setRows(body.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
        })
        .catch(() => {})
    }, 250)
    return () => (clearTimeout(t), ctl.abort())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const label = (r: Row) => {
    const where = r.address ?? whatItIs({ kind: null, use_text: r.use_text, use: r.use }) ?? 'Lot with no address'
    if (mode === 'changing') return `${where}, added ${r.year_added || 'year unknown'}`
    if (!values) return r.id === asking ? `${where}, the lot to call` : where
    return r.vpa > 0 ? `${where}, ${money(r.vpa)} an acre` : `${where}, not valued`
  }

  return (
    <nav
      aria-label="Lots on screen"
      className="fixed top-[calc(80px+env(safe-area-inset-top,0px))] left-[max(24px,env(safe-area-inset-left,0px))] z-30 max-[759px]:left-3 [&:not(:focus-within)]:sr-only"
    >
      <div className="max-h-[50vh] w-[300px] overflow-auto rounded-2xl bg-card p-2 shadow-panel">
        <p className="px-3 pt-2 pb-1 text-ui-label font-medium text-faint">
          {rows.length ? `${rows.length} lots on screen. Enter ${values ? 'picks one' : 'calls one'}.` : 'No lots on screen. Zoom or move the map.'}
        </p>
        <ul className="m-0 list-none p-0">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r.id)}
                className="block min-h-[40px] w-full rounded-md px-3 py-2 text-left text-ui-small font-semibold hover:bg-paper focus-visible:bg-paper"
              >
                {label(r)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
