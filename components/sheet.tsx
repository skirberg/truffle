'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Drawer } from '@base-ui/react/drawer'

// The phone panel: a bottom sheet with three stops, a peek showing the search, half the screen, and
// nearly all of it. It works like a maps app: swiping up anywhere on the sheet raises it, and only once it
// is all the way up does its content scroll; at the top of that scroll, swiping down lowers it again.
// It never closes and never traps focus; the map behind it stays live.
const PEEK = '144px'
const HALF = 0.5
const FULL = 0.92

export function PhoneSheet({
  search,
  children,
  expanded,
  peek: peekProp = PEEK,
  fit = false,
  above,
}: {
  search: React.ReactNode
  children: React.ReactNode
  expanded: boolean
  /** The lowest stop. The hunt's front door sets it to fit its prompt and search. */
  peek?: string
  /** Fit the lowest stop to the content: it ends 16 px (the sheet's padding) under the block marked
   * data-peek, plus the phone's safe area. Until there is one to measure, `peek` holds. */
  fit?: boolean
  /** A line that rides just above the sheet's top edge, where a maps app keeps its map credit. At the top
   * stop there is no map left between the sheet and the top bar, so the line moves to the sheet's foot. */
  above?: React.ReactNode
}) {
  const content = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const safe = useRef<HTMLDivElement>(null)
  const [fitted, setFitted] = useState<string | null>(null)
  // The drawer's portal mounts after this component, so the measuring waits for the content to be there.
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null)
  const contentRef = useCallback((el: HTMLDivElement | null) => {
    content.current = el
    setContentEl(el)
  }, [])
  const peek = (fit && fitted) || peekProp
  const own = peekProp !== PEEK
  const SNAPS: Drawer.Root.SnapPoint[] = [peek, HALF, FULL]
  // The hunt opens at its peek, with the map in view; the open map opens at half, as before.
  const [snap, setSnap] = useState<Drawer.Root.SnapPoint>(own ? peek : HALF)
  // A fitted peek that changes (a longer name on the next lot) moves a sheet resting on it.
  const [lastPeek, setLastPeek] = useState(peek)
  if (peek !== lastPeek) {
    setLastPeek(peek)
    if (snap === lastPeek) setSnap(peek)
  }
  const downY = useRef(0)
  const full = snap === FULL
  const snapNow = useRef(snap)
  useEffect(() => {
    snapNow.current = snap
  }, [snap])
  const gesture = useRef<{ y: number; snap: Drawer.Root.SnapPoint; t: number; scrolled: boolean } | null>(null)
  // A stop the sheet set itself, held for a moment against the drawer settling back to where the touch began,
  // which it can do late when the page is busy.
  const forced = useRef<{ snap: Drawer.Root.SnapPoint; until: number } | null>(null)

  // Safari merges touch moves when the page is busy (the map draws on the same thread), so a quick swipe
  // can arrive as one jump and the drawer never sees a drag. When a touch on the sheet ends with a clear
  // swipe and the sheet hasn't moved, step it in that direction: one stop, two for a long swipe.
  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement
    // A field being typed in keeps its touches (moving the caret, selecting); an idle one is just part of the sheet.
    const typing = el.closest('input, textarea') && el.closest('input, textarea') === document.activeElement
    if (e.touches.length !== 1 || typing) return (gesture.current = null)
    gesture.current = { y: e.touches[0]!.clientY, snap: snapNow.current, t: e.timeStamp, scrolled: (content.current?.scrollTop ?? 0) > 0 }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current
    gesture.current = null
    const t = e.changedTouches[0]
    if (!g || !t) return
    const dy = t.clientY - g.y
    // A flick, or a short drag on a busy page; a long slow drag the drawer follows itself.
    if (Math.abs(dy) < 36 || e.timeStamp - g.t > 1200) return
    // Content already scrolled when the touch began: the swipe was a scroll, not a sheet move.
    if (dy > 0 && g.snap === FULL && g.scrolled) return
    window.setTimeout(() => {
      if (snapNow.current !== g.snap) return // the drawer followed the drag itself
      const i = SNAPS.indexOf(g.snap)
      const step = Math.abs(dy) > window.innerHeight * 0.3 ? 2 : 1
      const next = SNAPS[Math.max(0, Math.min(SNAPS.length - 1, i + (dy < 0 ? step : -step)))]
      if (next === undefined || next === g.snap) return
      forced.current = { snap: next, until: performance.now() + 700 }
      setSnap(next)
    }, 80)
  }

  // Picking a lot brings the sheet up to half, where its name, value and first reasons show over the map;
  // it doesn't lower a sheet already pulled all the way up. Adjusted while rendering, when the prop changes.
  const [wasExpanded, setWasExpanded] = useState(expanded)
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded)
    if (expanded && snap !== FULL) setSnap(HALF)
  }
  // The hunt's own peek holds the call; once a new lot is up for a call the sheet goes back down to it. After
  // the drawer has settled from the tap that asked for it, which it does by setting its own stop again.
  useEffect(() => {
    if (expanded || !own || snapNow.current !== HALF) return
    const t = window.setTimeout(() => setSnap(peek), 0)
    return () => window.clearTimeout(t)
  }, [expanded, peek, own])

  // The fitted peek: measured from the sheet's top to the bottom of the block marked data-peek, both under
  // the same slide, so the gap is layout and not where the sheet happens to be. Only while that block is up
  // (the call, not the answer), and never past 45% of the screen, under the half stop.
  useEffect(() => {
    if (!fit || !contentEl) return
    const measure = () => {
      const el = contentEl.querySelector<HTMLElement>('[data-peek]')
      const top = popup.current?.getBoundingClientRect().top
      if (!el || top === undefined) return
      const px = Math.round(el.getBoundingClientRect().bottom - top + 16 + (safe.current?.offsetHeight ?? 0))
      const next = `${Math.max(148, Math.min(px, Math.floor(window.innerHeight * 0.45)))}px`
      setFitted((f) => (f === next ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(contentEl)
    const panel = contentEl.firstElementChild
    if (panel) ro.observe(panel)
    const mo = new MutationObserver(measure)
    mo.observe(contentEl, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => (ro.disconnect(), mo.disconnect(), window.removeEventListener('resize', measure))
  }, [fit, contentEl])

  useEffect(() => {
    // Below the top stop the content doesn't scroll, so a swipe on it moves the sheet. Start it from the top
    // each time, so the next swipe up raises the sheet instead of finishing an old scroll.
    if (!full && content.current) content.current.scrollTop = 0
  }, [full])

  return (
    <Drawer.Root
      open
      modal={false}
      disablePointerDismissal
      // Swiping past the peek would close it; it settles at the peek instead.
      onOpenChange={(open) => {
        // Base UI puts the last snap point back when the sheet stays open, so settle after it.
        if (!open) setTimeout(() => setSnap(peek), 0)
      }}
      snapPoints={SNAPS}
      snapPoint={snap}
      onSnapPointChange={(s) => {
        const f = forced.current
        if (f && performance.now() < f.until && s !== f.snap) return
        setSnap(s ?? peek)
      }}
    >
      <Drawer.Portal>
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center">
          <Drawer.Popup
            ref={popup}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            initialFocus={false}
            finalFocus={false}
            aria-label="Lot details"
            className="pointer-events-auto relative flex h-[calc(100dvh*0.92)] w-full flex-col rounded-t-panel bg-card shadow-panel [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] transition-transform duration-(--motion-sheet) ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-swiping:duration-0"
          >
            {/* The phone's safe area at the bottom, read by the fitted peek. */}
            {fit && <div ref={safe} aria-hidden="true" className="pointer-events-none invisible absolute h-[env(safe-area-inset-bottom,0px)] w-0" />}
            {above && !full && <div className="pointer-events-auto absolute bottom-full left-4 mb-2">{above}</div>}
            {/* The top of the sheet is the grip: drag it, or tap it to step the sheet up (or back down from the
                top). Not a button, because the sheet ignores drags that start on buttons. */}
            <div
              aria-hidden="true"
              onPointerDown={(e) => (downY.current = e.clientY)}
              // A drag that ends on the grip is a swipe, not a tap.
              onClick={(e) => {
                if (Math.abs(e.clientY - downY.current) > 6) return
                setSnap((s) => (s === peek ? HALF : s === HALF ? FULL : HALF))
              }}
              className="flex h-8 w-full shrink-0 cursor-grab items-start justify-center pt-3"
            >
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <Drawer.Title className="sr-only">Lot details</Drawer.Title>
            {/* Typing needs room for the results above the keyboard, so focusing search raises the sheet. */}
            {search && (
              <div className="shrink-0 px-4 pb-4" data-base-ui-swipe-ignore="" onFocusCapture={() => setSnap(FULL)}>
                {search}
              </div>
            )}
            <Drawer.Content
              ref={contentRef}
              data-testid="sheet-content"
              // Search can sit in the content (the hunt's front door): typing raises the sheet over the keyboard.
              onFocusCapture={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT') setSnap(FULL)
              }}
              className={`min-h-0 flex-1 overscroll-contain px-4 select-text ${full ? 'overflow-y-auto pb-4' : 'overflow-y-hidden pb-[calc(40px+env(safe-area-inset-bottom,0px))]'}`}
            >
              {children}
            </Drawer.Content>
            {above && full && <div className="flex shrink-0 px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))]">{above}</div>}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
