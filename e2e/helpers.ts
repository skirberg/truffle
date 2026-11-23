import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, type Page } from '@playwright/test'

/** Mizner Plaza, a block of shops downtown: the lot the checks open, lot 608 on the first board. */
export const MIZNER_PLAZA = '06434720280000070'
/** The Burger King on N Federal Hwy: a lot with a record and a value, for the pages a friend's link opens. */
export const BURGER_KING = '06434720270010152'

export const ROUTES = ['/', '/value', '/rules', '/changing', `/lot/${MIZNER_PLAZA}`, `/call/${BURGER_KING}`]

// The day's lot comes from data/daily.json, No. 1 on Nov 20, 2026, so a test can fake the date and know the lot.
const daily = JSON.parse(readFileSync('data/daily.json', 'utf8')) as { lots: string[] }
const records = (JSON.parse(gunzipSync(readFileSync('data/snapshot.json.gz')).toString()) as { lots: { id: string; name: string | null; address: string | null }[] }).lots
/** Day n's lot: its id and the title the panel gives it (its name, else its address). */
export function dayLot(n: number) {
  const id = daily.lots[(n - 1) % daily.lots.length]!
  const r = records.find((l) => l.id === id)!
  return { id, title: r.name ?? r.address! }
}
/** Ten in the morning on day n, on the browser's own calendar (No. 1 is Nov 20, 2026). */
export const morningOf = (n: number) => new Date(2026, 10, 19 + n, 10)

/** Wait until the map has drawn lots: the style is loaded, tiles are in, features are on screen. */
export async function mapReady(page: Page, layer = 'value') {
  await page.waitForFunction(
    (l) => {
      const m = (window as unknown as { __truffleMap?: { loaded(): boolean; queryRenderedFeatures(o: object): unknown[] } }).__truffleMap
      return !!m && m.loaded() && m.queryRenderedFeatures({ layers: [l] }).length > 20
    },
    layer,
    { timeout: 45_000 },
  )
}

/** Fails the test on any console error or uncaught exception. */
export function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  return () => expect(errors, errors.join('\n')).toEqual([])
}
