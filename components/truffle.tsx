'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Tabs } from '@base-ui/react/tabs'
import { Board, type BoardHandle, type Level, type Mode } from './board'
import { PanelBody, type PanelState } from './panel'
import { COPIED, HuntBody, type Call } from './hunt'
import { Search } from './search'
import { PhoneSheet } from './sheet'
import { LotsOnScreen } from './lots-on-screen'
import { FirstFrame } from './first-frame'
import { explainCall, lotTitle, sourceLine, sourcesFor, type Neighbor, type Typical } from '@/lib/copy'
import type { Lot, SearchHit, Summary } from '@/lib/types'
import { atOf, isStateLot } from '@/lib/state-lots'
import { money } from '@/lib/numbers'
import { callable, type CallRecord } from '@/lib/call-picker'
import { DAILY, dayNumber, lotForDay } from '@/lib/daily'
import { challengePath, decodeCall, resultLine } from '@/lib/challenge'
import { addCall, calledLot, calledOnDay, readBook, recordOf, writeBook, type Book } from '@/lib/record'
import { map as M } from '@/lib/tokens'

type Props = {
  initialMode: Mode
  /** The front door opens in fog: call a lot, then see why. */
  initialHunt?: boolean
  initialLot: Lot | null
  /** A lot from the state roll: the server has no record, so the map reads it once it's there. */
  initialStateLot?: string | null
  initialSharing: number | null
  summary: Summary
  /** A lot a friend sent (/call/[id]): it opens under fog, with their call in the link's ?c=. */
  initialChallenge?: string | null
}

/** The answer to a call, from the server's records: the same for every visitor (lib/call.ts). */
type Facts = { median: number | null; more: boolean | null; why: string | null; short: string | null; typical: Typical | null; near: number }

/** This browser's storage, or none: a private window or blocked site data can throw on access. */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'value', label: 'Value' },
  { key: 'rules', label: 'Rules' },
  { key: 'changing', label: 'Changing' },
]

const PHONE = '(max-width: 759px)'
const REDUCE = '(prefers-reduced-motion: reduce)'
function useMedia(q: string, server: boolean) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(q).matches,
    () => server,
  )
}

function pathFor(mode: Mode, lotId: string | null, at?: [number, number] | null) {
  if (lotId) {
    const q = new URLSearchParams()
    if (mode !== 'value') q.set('view', mode)
    if (at && isStateLot(lotId)) q.set('at', `${at[0].toFixed(6)},${at[1].toFixed(6)}`)
    const qs = q.toString().replace('%2C', ',')
    return `/lot/${encodeURIComponent(lotId)}${qs ? `?${qs}` : ''}`
  }
  return `/${mode}`
}

function titleFor(mode: Mode, lot: Lot | null) {
  if (lot) return `${lotTitle(lot)} · Truffle`
  return mode === 'value' ? 'Truffle' : `${MODES.find((m) => m.key === mode)!.label} · Truffle`
}

export function Truffle({ initialMode, initialHunt = false, initialLot, initialStateLot = null, initialSharing, summary, initialChallenge = null }: Props) {
  const phone = useMedia(PHONE, false)
  const reduced = useMedia(REDUCE, false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [hunt, setHunt] = useState(initialHunt && !initialLot)
  const [calls, setCalls] = useState<Record<string, Call>>({})
  const pickedAt = useRef<[number, number] | null>(null)
  const [state, setState] = useState<PanelState>(initialLot ? { kind: 'lot', lot: initialLot, sharing: initialSharing } : { kind: 'overview' })
  const [pickedId, setPickedId] = useState<string | null>(initialLot?.id ?? null)
  const [mapFailed, setMapFailed] = useState(false)
  const [where, setWhere] = useState<string | null>(null)
  const [visible, setVisible] = useState<string[]>([])
  const board = useRef<BoardHandle>(null)
  const req = useRef(0)
  // The daily loop: your calls kept in this browser, the day's lot and its number, a friend's call from a link.
  const [book, setBook] = useState<Book>({ v: 1, calls: [] })
  const [today, setToday] = useState<{ n: number; id: string } | null>(null)
  const [numbers, setNumbers] = useState<Record<string, number>>({})
  const [theirs, setTheirs] = useState<Record<string, boolean>>({})
  const [firstId, setFirstId] = useState<string | null>(null)
  const [shared, setShared] = useState<string | null>(null)
  const [drawn, setDrawn] = useState(false)
  const facts = useRef(new Map<string, Promise<Facts | null>>())
  const calling = useRef(false)
  const skippedToday = useRef(false)

  /** The answer for a lot, asked once and kept: read while the lot is under fog, so the call settles at once. */
  const factsFor = useCallback((id: string): Promise<Facts | null> => {
    let p = facts.current.get(id)
    if (!p) {
      p = isStateLot(id)
        ? Promise.resolve(null)
        : fetch(`/api/call/${encodeURIComponent(id)}`)
            .then((r) => (r.ok ? (r.json() as Promise<Facts>) : null))
            .catch(() => null)
      // A failed answer isn't kept, so the next try asks again.
      void p.then((f) => f === null && facts.current.delete(id))
      facts.current.set(id, p)
    }
    return p
  }, [])

  /** Keep a call in this browser's book. */
  const keep = (id: string, more: boolean, right: boolean | null, n: number | null) =>
    setBook((b) => {
      const next = addCall(b, { id, more, right, n })
      writeBook(storage(), next)
      return next
    })

  /** A call made on an earlier visit, shown as answered: the lot stands at its height with its verdict. */
  const restore = useCallback(
    (id: string, more: boolean, right: boolean | null) => {
      setCalls((c) => ({ ...c, [id]: { more, right, median: null, why: undefined } }))
      void factsFor(id).then((f) =>
        setCalls((c) => (c[id] ? { ...c, [id]: { ...c[id]!, median: f?.median ?? null, why: f?.why ?? null, short: f?.short ?? null, typical: f?.typical ?? null } } : c)),
      )
    },
    [factsFor],
  )

  const load = useCallback(async (id: string, at: [number, number] | null = null) => {
    const n = ++req.current
    setState({ kind: 'loading', id })
    if (isStateLot(id)) {
      const lot = (await board.current?.readLot(id, at)) ?? null
      if (n !== req.current) return null
      setState(lot ? { kind: 'lot', lot, sharing: null } : { kind: 'missing', id })
      return lot
    }
    try {
      const r = await fetch(`/api/lot/${encodeURIComponent(id)}`)
      if (n !== req.current) return null
      if (r.status === 404) {
        setState({ kind: 'missing', id })
        return null
      }
      if (!r.ok) throw new Error(String(r.status))
      const body = (await r.json()) as { lot: Lot; sharing: number | null }
      if (n !== req.current) return null
      setState({ kind: 'lot', lot: body.lot, sharing: body.sharing })
      return body.lot
    } catch {
      if (n === req.current) setState({ kind: 'missing', id })
      return null
    }
  }, [])

  const pick = useCallback(
    (id: string | null, opts: { push?: boolean; fly?: boolean; at?: [number, number] | null } = {}) => {
      const push = (opts.push ?? true) && !hunt
      pickedAt.current = opts.at ?? null
      setPickedId(id)
      if (id === null) {
        req.current++
        setState({ kind: 'overview' })
        if (push) history.pushState(null, '', pathFor(mode, null))
        if (!hunt) document.title = titleFor(mode, null)
        return
      }
      if (push) history.pushState(null, '', pathFor(mode, id, opts.at))
      void load(id, opts.at ?? null).then((lot) => {
        if (!lot) return
        if (!hunt) document.title = titleFor(mode, lot)
        if (opts.fly) board.current?.goToLot(lot, true)
      })
    },
    [mode, load, hunt],
  )

  /** The call on the picked lot: lift the fog, and settle it against the valued lots within a few blocks. */
  const makeCall = async (more: boolean) => {
    if (state.kind !== 'lot' || !board.current || calling.current) return
    const lot = state.lot
    if (calls[lot.id]) return
    calling.current = true
    const r = board.current.reveal(lot.id, pickedAt.current ?? [lot.lon, lot.lat])
    // The answer comes from the records, the same for everyone (lib/call.ts); the tiles are the fallback for
    // a lot with no record (the state roll), as before.
    const f = await factsFor(lot.id)
    calling.current = false
    const median = f ? f.median : r.median === null ? null : r.median * 1e6
    const right = median === null ? null : more === lot.vpa > median
    setCalls((c) => ({ ...c, [lot.id]: { more, right, median, why: f ? f.why : undefined, short: f?.short ?? null, typical: f?.typical ?? null } }))
    keep(lot.id, more, right, numbers[lot.id] ?? null)
    if (f) return
    // Why, without the server's answer: the records of the valued lots around it, compared with this one.
    const ids = r.around.slice(0, 60)
    const settle = (near: Neighbor[]) => {
      const r = explainCall(lot, near, median)
      setCalls((c) => (c[lot.id] ? { ...c, [lot.id]: { ...c[lot.id]!, why: r?.text ?? null, short: r?.short ?? null, typical: r?.typical ?? null } } : c))
    }
    if (!ids.length) return settle([])
    fetch(`/api/lots?ids=${encodeURIComponent(ids.join(','))}`)
      .then((res) => (res.ok ? (res.json() as Promise<Neighbor[]>) : []))
      .then(settle, () => settle([]))
  }

  /** Send the lot to a friend: a link that opens it under fog with this call hidden in it, and the result line. */
  const shareCall = async () => {
    if (state.kind !== 'lot') return
    const lot = state.lot
    const c = calls[lot.id]
    if (!c) return
    const n = numbers[lot.id] ?? null
    const url = new URL(challengePath(lot.id, c.more, n), location.origin).href
    const text = resultLine(lot, c.right, n)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, url })
        return
      } catch (e) {
        // Closing the share sheet is not an error; anything else falls back to the clipboard.
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setShared(COPIED)
    } catch {
      // No clipboard either: the line and the link, to copy by hand.
      setShared(`${text} ${url}`)
    }
  }

  const record = recordOf(book)

  // After a call, the map draws the typical lot's height around it as a level the called lot stands above or below.
  const called = state.kind === 'lot' && hunt ? calls[state.lot.id] : undefined
  const levelLot = state.kind === 'lot' ? state.lot : null
  const level = useMemo<Level | null>(
    () => (levelLot && called && called.median !== null ? { lon: levelLot.lon, lat: levelLot.lat, median: called.median, label: `${money(called.median)} typical`, acres: levelLot.acres } : null),
    [levelLot, called],
  )

  /** The next lot to call: one nearby that a person can see and reason about, and that has a record. */
  const nextLot = async () => {
    setShared(null)
    // Done with a friend's lot: the address goes back to the front door, so a reload starts from the day's lot.
    if (initialChallenge && location.pathname !== '/') history.replaceState(null, '', '/')
    // The day's lot comes before any other, until it's called or skipped.
    if (today && pickedId === today.id && !calls[today.id]) skippedToday.current = true
    if (today && pickedId !== today.id && !skippedToday.current && !calls[today.id] && !calledOnDay(book, today.n, today.id)) {
      const n = ++req.current
      setNumbers((x) => ({ ...x, [today.id]: today.n }))
      setPickedId(today.id)
      const lot = await load(today.id)
      if (n !== req.current || !lot) return
      pickedAt.current = null
      board.current?.goToLot(lot)
      return
    }
    const from = state.kind === 'lot' ? ([state.lot.lon, state.lot.lat] as [number, number]) : null
    // Never a lot you've called before, and never one of the days' lots: each keeps its day.
    const skip = new Set([...Object.keys(calls), ...book.calls.map((c) => c.id), ...DAILY.lots, ...(pickedId ? [pickedId] : [])])
    const n = ++req.current
    // The other answer than the lot just called, so the right call isn't always the same button.
    const last = state.kind === 'lot' ? calls[state.lot.id] : undefined
    const prefer = state.kind === 'lot' && last && last.median !== null ? (state.lot.vpa > last.median ? 'less' : 'more') : null
    // A call can come while the opening flight is still in the air, when the map may hold no lots at all: wait
    // for the camera to stop and the tiles under it to arrive, or Next lot found nothing and the round stalled.
    // A slow phone can still be drawing when it says so, so a pick that finds nothing waits for the next rest and
    // looks again, twice, before the front door gives up.
    for (let tries = 0; tries < 3; tries++) {
      await board.current?.settled(tries > 0)
      if (n !== req.current) return
      const wanted = board.current?.nextLots(from, skip, prefer) ?? []
      // The tiles hold lots the records don't (every outline the county draws, and without the database only
      // the two Boca areas have records). Asking for them one at a time put up to five 404s on a round, so one
      // question first: which of these have a record with a value. That answer is never a 404.
      const county = wanted.filter((w) => !isStateLot(w.id)).map((w) => w.id)
      const known = new Map<string, CallRecord>()
      if (county.length) {
        const rows = await fetch(`/api/lots?ids=${encodeURIComponent(county.join(','))}`).then((r) => (r.ok ? (r.json() as Promise<CallRecord[]>) : []), () => [])
        if (n !== req.current) return
        for (const r of rows) known.set(r.id, r)
      }
      // The records have the last word on size, value and what it is: a place of worship is never asked about,
      // and a sliver of 0.04 acres at $104M an acre is a real
      // lot with a page of its own, and not one to ask anybody to call. If nothing nearby passes, any lot with
      // a value and the minimum area will do before the front door gives up.
      const order = [...wanted.filter((w) => isStateLot(w.id) || callable(w, known.get(w.id))), ...wanted.filter((w) => !isStateLot(w.id) && !callable(w, known.get(w.id)) && callable({ median: null }, known.get(w.id)))]
      for (const next of order) {
        const lot = isStateLot(next.id)
          ? await board.current?.readLot(next.id, next.at)
          : await fetch(`/api/lot/${encodeURIComponent(next.id)}`).then((r) => (r.ok ? (r.json() as Promise<{ lot: Lot }>).then((b) => b.lot) : null), () => null)
        if (n !== req.current) return
        if (!lot || !callable(isStateLot(next.id) ? next : { median: null }, lot)) continue
        board.current?.goToLot({ lon: next.at[0], lat: next.at[1] })
        pickedAt.current = next.at
        setPickedId(next.id)
        setState({ kind: 'lot', lot, sharing: null })
        return
      }
    }
    pick(null)
  }

  const openMap = () => {
    setHunt(false)
    pick(null, { push: false })
    history.pushState(null, '', '/value')
  }

  const switchMode = useCallback((next: Mode, push = true) => {
    req.current++
    setHunt(false)
    setMode(next)
    setPickedId(null)
    setState({ kind: 'overview' })
    if (push) history.pushState(null, '', pathFor(next, null))
    document.title = titleFor(next, null)
  }, [])

  // Old prototype links (#lot-608, #rules) and ?view= on lot pages.
  useEffect(() => {
    const h = location.hash.slice(1)
    const legacy = /^lot-(\d+)$/.exec(h)
    if (legacy) {
      location.replace(`/lot/${legacy[1]}`)
      return
    }
    if (h === 'value' || h === 'rules' || h === 'changing') {
      // Old prototype links (#rules): read once from the address bar on arrival.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      switchMode(h, false)
      history.replaceState(null, '', `/${h}`)
    }
    if (initialStateLot) pick(initialStateLot, { push: false, at: atOf(location.search) })
    // The front door opens on the lit city and flies down to the first lot to call: an ordinary business lot
    // (tests/call-picker.test.ts holds it to that). Later rounds never land on a place of worship.
    if (hunt) {
      // A new lot every day, the same for everyone that day: the day's number on this device's calendar picks
      // it from data/daily.json. Read here, after the page has hydrated, so the server and the page agree.
      const b = readBook(storage())
      setBook(b)
      const day = dayNumber(new Date())
      const dayId = lotForDay(day)
      if (dayId) setToday({ n: day, id: dayId })
      let first = dayId ?? M.hunt.first
      let n: number | null = dayId ? day : null
      if (initialChallenge) {
        // A friend's lot: their call travels in the link. A day's number in it counts only if it is that lot's day.
        const sent = decodeCall(initialChallenge, new URLSearchParams(location.search).get('c'))
        first = initialChallenge
        n = sent?.n && lotForDay(sent.n) === initialChallenge ? sent.n : null
        if (sent) setTheirs({ [initialChallenge]: sent.more })
      }
      if (n) setNumbers({ [first]: n })
      setFirstId(first)
      // Called already (earlier today, or a friend's lot you've seen): it opens answered, not asked again.
      const done = n ? calledOnDay(b, n, first) : calledLot(b, first)
      if (done) restore(first, done.more, done.right)
      setPickedId(first)
      void load(first).then((lot) => lot && board.current?.arrive(lot))
    }
    const view = new URLSearchParams(location.search).get('view')
    if (initialLot && (view === 'rules' || view === 'changing')) setMode(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The answer is asked for while the lot is under fog, so the call settles the moment it's made.
  const asking = hunt && state.kind === 'lot' && !calls[state.lot.id] ? state.lot.id : null
  useEffect(() => {
    if (asking) void factsFor(asking)
  }, [asking, factsFor])

  useEffect(() => {
    const onPop = () => {
      const m = /^\/(value|rules|changing)?$/.exec(location.pathname)
      const l = /^\/lot\/([^/]+)$/.exec(location.pathname)
      if (m) {
        switchMode((m[1] as Mode) ?? 'value', false)
      } else if (l) {
        const view = new URLSearchParams(location.search).get('view') as Mode | null
        setMode(view ?? 'value')
        setPickedId(decodeURIComponent(l[1]!))
        void load(decodeURIComponent(l[1]!), atOf(location.search))
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [load, switchMode])

  const choose = (hit: SearchHit) => {
    if (hit.kind === 'town') {
      if (mode === 'changing') switchMode('value')
      pick(null)
      setWhere(hit.label)
      board.current?.goToPlace(hit.lon, hit.lat, hit.place === 'City' ? 13 : 14.5)
      return
    }
    setWhere(null)
    if (hit.kind === 'place') {
      switchMode(hit.id === 'west-boca' ? 'changing' : 'value')
      return
    }
    if (mode !== 'value') switchMode('value', false)
    pick(hit.id, { fly: true })
  }

  const placeholder = summary.statewide
    ? 'Type a Florida town or a Palm Beach County address'
    : summary.coverage === 'county'
      ? 'Type a Palm Beach County address'
      : // Without the database search covers the two Boca areas: name the one on screen.
        mode === 'changing' || (state.kind === 'lot' && state.lot.area === 'west-boca')
        ? 'Type a West Boca address'
        : 'Type a downtown Boca Raton address'
  const body = hunt ? (
    <HuntBody
      state={state}
      call={state.kind === 'lot' ? (calls[state.lot.id] ?? null) : null}
      record={record}
      number={state.kind === 'lot' ? (numbers[state.lot.id] ?? null) : null}
      first={state.kind === 'lot' && state.lot.id === firstId}
      theirs={state.kind === 'lot' ? (theirs[state.lot.id] ?? null) : null}
      onShare={state.kind === 'lot' && !isStateLot(state.lot.id) ? () => void shareCall() : null}
      shared={shared}
      search={<Search onChoose={choose} placeholder="Call your own street" coverage={summary.coverage} />}
      // The answer's numbers are this lot's and its neighbors' values: one line naming where they come from.
      source={state.kind === 'lot' ? sourceLine(sourcesFor(state.lot, summary.pulls).filter((p) => p.key === 'parcels' || p.key === 'parcels_florida')) : ''}
      onCall={(more) => void makeCall(more)}
      onNext={() => void nextLot()}
    />
  ) : (
    <PanelBody
      mode={mode}
      state={state}
      summary={summary}
      mapFailed={mapFailed}
      onBack={() => pick(null)}
      where={where}
    />
  )

  // The map credit, small, the way a maps app sets it: in the desktop's corner, and on a phone just above the
  // sheet, so it moves with the sheet. With the sheet at its top stop it sits at the sheet's foot, never over
  // the top bar.
  const credit = (place: string) => (
    <p className={`${place} rounded-sm bg-card/90 px-2 text-ui-credit font-medium text-soft`} data-testid="osm-credit">
      ©{' '}
      <a href="https://www.openstreetmap.org/copyright" className="inline-block py-1 underline-offset-2 hover:underline">
        OpenStreetMap contributors
      </a>{' '}
      · {summary.statewide ? 'Florida Department of Revenue, Palm Beach County' : 'Palm Beach County'}
    </p>
  )

  return (
    <Tabs.Root value={mode} onValueChange={(v) => switchMode(v as Mode)} className="contents">
      <Board
        ref={board}
        mode={mode}
        hunt={hunt}
        pickedId={pickedId}
        verdict={(() => {
          const c = pickedId ? calls[pickedId] : undefined
          return c ? (c.right === null ? 'Called' : c.right ? 'You called it' : 'Not this one') : null
        })()}
        verdictValue={state.kind === 'lot' && state.lot.id === pickedId && calls[pickedId] ? money(state.lot.vpa) : null}
        tilesUrl={summary.tilesUrl}
        basemapUrl={summary.basemapUrl}
        westBounds={summary.westNewBounds}
        reduced={reduced}
        phone={phone}
        initialLot={initialLot}
        // In the hunt a tap on open ground keeps the lot you're calling.
        onPick={(id, at) => (hunt && id === null ? undefined : pick(id, { at }))}
        onVisible={setVisible}
        onFail={() => {
          setMapFailed(true)
          setDrawn(true)
        }}
        onDrawn={() => setDrawn(true)}
        level={level}
        marks={summary.marks}
      />
      {/* The front door paints the city before the map is ready, then the map takes over. */}
      {initialHunt && !initialLot && <FirstFrame gone={drawn} />}

      {/* On the 4 px grid: 16 px from the phone's edges, 24 from the desktop's; controls 48 px tall. */}
      <header
        className={`fixed top-[calc(16px+env(safe-area-inset-top,0px))] left-[max(16px,env(safe-area-inset-left,0px))] z-10 flex items-center gap-3 min-[760px]:top-[calc(24px+env(safe-area-inset-top,0px))] min-[760px]:left-[max(24px,env(safe-area-inset-left,0px))] ${
          hunt ? 'right-[max(16px,env(safe-area-inset-right,0px))] justify-between min-[760px]:right-[432px]' : 'flex-wrap min-[760px]:max-w-[calc(100vw-456px)]'
        }`}
      >
        <Link href="/" className="flex h-12 items-center rounded-pill bg-card px-4 shadow-pill" aria-label="Truffle, back to the start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wordmark.svg" alt="" width={80} height={24} className="block h-6 w-auto" />
        </Link>
        {hunt ? (
          <button
            type="button"
            onClick={openMap}
            className="flex h-12 items-center rounded-pill bg-card px-4 text-ui-small font-bold shadow-pill transition-transform duration-(--motion-tap) ease-out active:scale-[0.97]"
          >
            Open the map
          </button>
        ) : (
          <Tabs.List aria-label="Views" className="flex h-12 items-center gap-1 rounded-pill bg-card p-1 shadow-pill">
            {MODES.map((m) => (
              <Tabs.Tab
                key={m.key}
                value={m.key}
                className="relative h-10 cursor-pointer rounded-pill px-4 text-ui-small font-bold text-soft after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] data-active:bg-truffle data-active:text-paper max-[759px]:px-3"
              >
                {m.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        )}
      </header>

      {!phone && credit('fixed bottom-[calc(8px+env(safe-area-inset-bottom,0px))] left-[max(16px,env(safe-area-inset-left,0px))] z-[5]')}

      {phone ? (
        <PhoneSheet
          search={hunt ? null : <Search onChoose={choose} placeholder={placeholder} coverage={summary.coverage} />}
          // In the hunt the sheet stays low over the call and comes up for the answer.
          expanded={hunt ? state.kind === 'lot' && !!calls[state.lot.id] : state.kind !== 'overview'}
          peek={hunt ? '288px' : undefined}
          // The call's peek ends just under Less and More, whatever the lot's name takes.
          fit={hunt}
          above={credit('block')}
        >
          <Tabs.Panel value={mode} keepMounted={false} className="flex min-h-0 flex-col gap-4 outline-none" aria-live="polite" data-testid="panel-body">
            {body}
          </Tabs.Panel>
        </PhoneSheet>
      ) : (
        // A 384 px card, 24 px in from the corner: three 104 px columns with 12 px gutters inside 24 px padding.
        // In the hunt it hugs what it holds, like a place card; the open map keeps it full height for its lists.
        <aside
          aria-label="Lot details"
          className={`fixed top-[calc(24px+env(safe-area-inset-top,0px))] right-[max(24px,env(safe-area-inset-right,0px))] z-10 flex w-[384px] flex-col gap-6 overflow-auto rounded-lg bg-card p-6 shadow-panel ${
            hunt ? 'max-h-[calc(100dvh-48px)]' : 'bottom-[calc(24px+env(safe-area-inset-bottom,0px))]'
          }`}
        >
          {!hunt && <Search onChoose={choose} placeholder={placeholder} coverage={summary.coverage} />}
          <Tabs.Panel value={mode} keepMounted={false} className="flex min-h-0 flex-1 flex-col gap-4 outline-none" aria-live="polite" data-testid="panel-body">
            {body}
          </Tabs.Panel>
        </aside>
      )}
      {/* After search in the tab order; shown under the tabs while it has focus. */}
      {/* On the front door no value is read out until the lot under fog has been called, as on the tiles. */}
      <LotsOnScreen
        ids={visible}
        mode={mode}
        onPick={(id) => pick(id)}
        values={!hunt || (pickedId !== null && !!calls[pickedId])}
        asking={hunt && pickedId !== null && !calls[pickedId] ? pickedId : null}
      />
    </Tabs.Root>
  )
}
