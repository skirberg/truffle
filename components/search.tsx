'use client'

import { useRef, useState, useTransition } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import type { SearchHit } from '@/lib/types'

// Address search: the ARIA combobox pattern from Base UI (arrow keys, Enter, Escape, Home and End),
// results from the server, styled only from the tokens.
export function Search({ onChoose, placeholder, coverage }: { onChoose: (hit: SearchHit) => void; placeholder: string; coverage: 'county' | 'boca' }) {
  const [hits, setHits] = useState<SearchHit[]>([])
  const [term, setTerm] = useState('')
  const [failed, setFailed] = useState(false)
  const [pending, start] = useTransition()
  const abort = useRef<AbortController | null>(null)
  const trimmed = term.trim()

  let status: string | null = null
  if (pending) status = 'Looking…'
  else if (failed) status = 'Search isn’t answering right now. Try again in a moment.'
  else if (trimmed.length >= 2 && hits.length === 0)
    status =
      coverage === 'county'
        ? 'That address isn’t covered yet. Truffle has Palm Beach County lots on record.'
        : 'That address isn’t covered yet. Truffle has Downtown Boca Raton and West Boca so far.'

  return (
    <Combobox.Root<SearchHit>
      items={hits}
      filter={null}
      value={null}
      itemToStringLabel={(h) => h.label}
      isItemEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
      onValueChange={(hit) => {
        if (!hit) return
        setTerm('')
        setHits([])
        onChoose(hit)
      }}
      inputValue={term}
      onInputValueChange={(next, { reason }) => {
        setTerm(next)
        if (reason === 'item-press') return
        const q = next.trim()
        if (q.length < 2) {
          setHits([])
          setFailed(false)
          return
        }
        const ctl = new AbortController()
        abort.current?.abort()
        abort.current = ctl
        start(async () => {
          try {
            const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
            if (!r.ok) throw new Error(String(r.status))
            const body = (await r.json()) as SearchHit[]
            if (!ctl.signal.aborted) start(() => (setHits(body), setFailed(false)))
          } catch (e) {
            if (!ctl.signal.aborted) start(() => (setHits([]), setFailed(true)))
            void e
          }
        })
      }}
    >
      <label className="sr-only" htmlFor="search">
        Search an address
      </label>
      <div className="relative">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint">
          <circle cx="6.75" cy="6.75" r="5.25" />
          <path d="M10.75 10.75 14.5 14.5" />
        </svg>
        <Combobox.Input
          id="search"
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="w-full h-12 rounded-md border-0 bg-paper pr-4 pl-10 text-ui-body font-medium text-truffle placeholder:text-faint focus:outline-2 focus:outline-truffle"
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50 outline-none">
          <Combobox.Popup
            aria-busy={pending || undefined}
            className="w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-hidden rounded-md bg-card shadow-popup"
          >
            <Combobox.Status>{status && <div className="px-4 py-3 text-ui-small font-medium text-soft">{status}</div>}</Combobox.Status>
            <Combobox.List>
              {(hit: SearchHit) => (
                <Combobox.Item
                  key={`${hit.kind}-${hit.id}`}
                  value={hit}
                  className="block cursor-pointer px-4 py-3 text-ui-body font-medium outline-none select-none data-highlighted:bg-paper"
                >
                  {hit.label}
                  {hit.kind === 'lot' && hit.place !== 'Boca Raton' && <span className="text-soft"> · {hit.place}</span>}
                  {hit.kind === 'town' && <span className="text-soft"> · {hit.place}</span>}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
