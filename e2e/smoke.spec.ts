import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { BURGER_KING, MIZNER_PLAZA, dayLot, mapReady, morningOf, watchErrors } from './helpers'

type M = {
  getPitch(): number
  queryRenderedFeatures(o: object): { id?: string | number; properties?: Record<string, unknown> }[]
  isMoving(): boolean
  getFeatureState(f: object): { sel?: boolean; lift?: number }
  getPaintProperty(l: string, p: string): unknown
}
declare global {
  interface Window {
    __truffleMap: M
  }
}

test('the map draws lots in color, not a blank canvas', async ({ page }) => {
  const done = watchErrors(page)
  await page.goto('/value')
  await mapReady(page)
  const shot = await page.locator('[data-testid="board"] canvas').screenshot()
  // Count distinct colors in the middle of the canvas: a blank board is one paper color.
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }))
  if (PNG) {
    const png = PNG.sync.read(shot)
    const seen = new Set<string>()
    for (let i = 0; i + 2 < png.data.length; i += 4 * 97) seen.add(`${png.data[i]! >> 4},${png.data[i + 1]! >> 4},${png.data[i + 2]! >> 4}`)
    expect(seen.size).toBeGreaterThan(8)
  }
  // The committed sample holds no homes, so Value draws about 200 lot pieces at its camera, not the thousands live.
  expect(await page.evaluate(() => window.__truffleMap.queryRenderedFeatures({ layers: ['value'] }).length)).toBeGreaterThan(100)
  done()
})

test('every page carries the security policy, and nothing the site loads is blocked by it', async ({ page, request }) => {
  for (const path of ['/', '/value', `/lot/${MIZNER_PLAZA}`, '/brand', '/built', '/no-such-page', '/llms.txt']) {
    const h = (await request.get(path)).headers()
    expect(h['content-security-policy'], path).toContain("default-src 'self'")
    expect(h['content-security-policy'], path).toContain("frame-ancestors 'self' https://samikirberg.com")
    expect(h['x-content-type-options'], path).toBe('nosniff')
    expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy'], path).toContain('camera=()')
  }
  // A blocked request fires securitypolicyviolation, which a console error doesn't always show.
  await page.addInitScript(() => {
    ;(window as unknown as { __blocked: string[] }).__blocked = []
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __blocked: string[] }).__blocked.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  const blocked = () => page.evaluate(() => (window as unknown as { __blocked: string[] }).__blocked)
  const done = watchErrors(page)
  await page.clock.setFixedTime(morningOf(3))
  await page.goto('/')
  await mapReady(page)
  await page.getByRole('button', { name: /^Less per acre/ }).click()
  await expect(page.getByTestId('verdict')).toBeVisible()
  expect(await blocked(), '/').toEqual([])
  await page.goto(`/lot/${MIZNER_PLAZA}`)
  await mapReady(page)
  expect(await blocked(), 'a lot').toEqual([])
  await page.goto('/brand')
  await page.waitForLoadState('load')
  expect(await blocked(), '/brand').toEqual([])
  done()
})

test('Mizner Plaza opens with its panel, truffle brown at its own height', async ({ page }) => {
  const done = watchErrors(page)
  await page.goto('/lot/608')
  await expect(page).toHaveURL(new RegExp(`/lot/${MIZNER_PLAZA}$`))
  await mapReady(page)
  const panel = page.getByTestId('panel-body')
  await expect(panel).toContainText('132 NE 2nd St')
  await expect(page.getByTestId('lot-value')).toHaveText('$7.2M an acre')
  await expect(page.getByTestId('reasons')).toHaveText(
    ['The land is 78% of the value. The building is worth $2.1M.', 'Worth more per acre than 83% of valued lots downtown.', 'Zoned for downtown.'].join(''),
  )
  await expect(page.getByTestId('source')).toContainText(/Palm Beach County property records.*City of Boca Raton.*[Pp]ulled [A-Z][a-z]{2} \d{1,2}, 2026/)
  // The reasons are pictures first, each carrying its sentence: the rank pinned on the skyline, the land
  // against the building. The sentences are one tap away, under "In words".
  await expect(panel.getByText('Beats 83%')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Worth more per acre than 83% of valued lots downtown.' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'The land is 78% of the value. The building is worth $2.1M.' })).toBeVisible()
  await expect(page.getByTestId('reasons')).toBeHidden()
  await panel.getByText('In words').click()
  await expect(page.getByTestId('reasons')).toBeVisible()
  // Several sources fold under one line that keeps their days.
  await expect(panel.getByText(/^Sources, pulled [A-Z][a-z]{2} \d{1,2}( to (?:[A-Z][a-z]{2} )?\d{1,2})?, 2026$/)).toBeVisible()
  const sel = await page.evaluate((id) => window.__truffleMap.getFeatureState({ source: 'lots', sourceLayer: 'lots', id }).sel, MIZNER_PLAZA)
  expect(sel).toBe(true)
  // Height is value per acre for the picked lot too: nothing is added to it (a flat, unvalued one only comes up to 1.2 m).
  expect(JSON.stringify(await page.evaluate(() => window.__truffleMap.getPaintProperty('value', 'fill-extrusion-height')))).toBe('["case",["boolean",["feature-state","sel"],false],["max",["to-number",["get","h"],1],1.2],["to-number",["get","h"],1]]')
  expect(await page.evaluate((id) => window.__truffleMap.getFeatureState({ source: 'lots', sourceLayer: 'lots', id }).lift, MIZNER_PLAZA)).toBeUndefined()
  done()
})

test('the lot page reads without the map: address, value and reasons are in the HTML', async ({ request }) => {
  const html = await (await request.get(`/lot/${MIZNER_PLAZA}`)).text()
  expect(html).toContain('132 NE 2nd St')
  expect(html).toContain('$7.2M')
  expect(html).toContain('The land is 78% of the value.')
  expect(html).toContain('<html lang="en"')
  expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1/)
  expect(html).toContain('property="og:image"')
})

test('reduced motion: heights as ever, no camera glide', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const done = watchErrors(page)
  await page.goto('/value')
  await mapReady(page)
  const h = JSON.stringify(await page.evaluate(() => window.__truffleMap.getPaintProperty('value', 'fill-extrusion-height')))
  expect(h).toBe('["case",["boolean",["feature-state","sel"],false],["max",["to-number",["get","h"],1],1.2],["to-number",["get","h"],1]]')
  await page.goto(`/lot/${MIZNER_PLAZA}`)
  await mapReady(page)
  expect(await page.evaluate((id) => window.__truffleMap.getFeatureState({ source: 'lots', sourceLayer: 'lots', id }), MIZNER_PLAZA)).toMatchObject({ sel: true })
  await page.getByRole('tab', { name: 'Rules' }).click()
  // The camera jumps: no easing frames after the click.
  expect(await page.evaluate(() => [window.__truffleMap.isMoving(), Math.round(window.__truffleMap.getPitch())])).toEqual([false, 45])
  done()
  await ctx.close()
})

test('the OpenStreetMap credit is always visible', async ({ page }) => {
  for (const [w, h] of [[1440, 900], [375, 812]] as const) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/value')
    const credit = page.getByTestId('osm-credit')
    await expect(credit).toBeVisible()
    await expect(credit).toContainText('OpenStreetMap contributors')
    const box = await credit.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(h)
  }
  // On a phone with the sheet at its top stop (typing in search raises it), the credit stays on screen and
  // clear of the wordmark and tabs.
  await page.getByRole('combobox', { name: 'Search an address' }).focus()
  await page.waitForTimeout(700)
  const credit = page.getByTestId('osm-credit')
  await expect(credit).toBeVisible()
  const box = (await credit.boundingBox())!
  const bar = (await page.getByRole('tablist', { name: 'Views' }).boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height)
  expect(box.y + box.height).toBeLessThanOrEqual(812)
})

test('search works from the keyboard', async ({ page }) => {
  const done = watchErrors(page)
  await page.goto('/value')
  await mapReady(page)
  const input = page.getByRole('combobox', { name: 'Search an address' })
  await input.fill('132 NE 2nd St')
  await expect(page.getByRole('option', { name: /Mizner Plaza/ })).toBeVisible()
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByTestId('panel-body')).toContainText('132 NE 2nd St')
  await expect(page).toHaveURL(new RegExp(`/lot/${MIZNER_PLAZA}$`))
  await input.fill('west bo')
  await expect(page.getByRole('option', { name: 'West Boca', exact: true })).toBeVisible()
  await input.press('Escape')
  await expect(page.getByRole('option', { name: 'West Boca', exact: true })).toHaveCount(0)
  await input.fill('999 Nowhere Lane')
  await expect(page.getByText('That address isn’t covered yet.', { exact: false })).toBeVisible()
  done()
})

test('lots can be picked with the keyboard', async ({ page }) => {
  await page.goto('/value')
  await mapReady(page)
  const list = page.getByRole('navigation', { name: 'Lots on screen' })
  await expect(list.getByRole('button').first()).toBeAttached()
  await list.getByRole('button').first().focus()
  await expect(list).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-body')).toContainText(/an acre|Not valued/)
})

// The committed sample holds no homes, so Changing has the 13 West Boca lots added since 2023 that aren't homes,
// too few on any one plat to name it on the map (lib/marks.ts names a place from 50 new lots).
test('Changing shows the West Boca lots added since 2023', async ({ page }) => {
  const done = watchErrors(page)
  await page.goto('/changing')
  await mapReady(page, 'changing')
  await expect(page.getByTestId('panel-body')).toContainText('13 new lots since 2023')
  done()
})

test('Rules has a row for lots with no zoning on record, and names the big families on the map', async ({ page }) => {
  await page.goto('/rules')
  await expect(page.getByTestId('panel-body')).toContainText('No zoning on record')
  await mapReady(page, 'rules')
  const names = () => page.evaluate(() => window.__truffleMap.queryRenderedFeatures({ layers: ['marks'] }).map((f) => f.properties?.text))
  await expect.poll(names, { timeout: 15_000 }).toContain('Downtown')
  // Only in Rules: Value has no zoning names on it.
  await page.getByRole('tab', { name: 'Value' }).click()
  await expect.poll(names).toEqual([])
})

test('an unknown lot says so plainly', async ({ page }) => {
  const res = await page.goto('/lot/00000000000000000')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We have no record of that lot')
})

test('an address that is no page says so without talking about lots', async ({ page }) => {
  const res = await page.goto('/nope')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There’s no page here')
  await expect(page.getByRole('main')).not.toContainText('lot')
})

test('an unvalued lot is not asked why it is worth this, and says what it is in plain words', async ({ page }) => {
  await page.goto('/lot/06434720000007020')
  const panel = page.getByTestId('panel-body')
  await expect(panel).toContainText('Not valued')
  await expect(panel).toContainText('What the records say')
  await expect(panel).not.toContainText('Why it’s worth this')
  await expect(panel).toContainText('Utility or railroad land')
  await expect(panel).not.toContainText(/centrally assessed/i)
})

test('search names the area on screen', async ({ page }) => {
  await page.goto('/changing')
  await expect(page.getByRole('combobox', { name: 'Search an address' })).toHaveAttribute('placeholder', /West Boca|Palm Beach County/)
})

test('numbers on tiles stay near 40, the picked lot first', async ({ page }) => {
  await page.goto(`/lot/${MIZNER_PLAZA}`)
  await mapReady(page)
  // Tags are placed after the tiles settle; on a busy machine that can take a few seconds.
  const read = () =>
    page.evaluate(() => {
      const m = window.__truffleMap
      return [new Set(m.queryRenderedFeatures({ layers: ['tags'] }).map((f) => f.id)).size, m.queryRenderedFeatures({ layers: ['tag-picked'] }).map((f) => f.id)] as const
    })
  await expect.poll(async () => (await read())[1], { timeout: 10_000 }).toContain(MIZNER_PLAZA)
  // The map thins its tags toward 40 over a few settles.
  await expect.poll(async () => (await read())[0], { timeout: 10_000 }).toBeLessThanOrEqual(46)
})

test('the phone sheet drags between a peek, half and nearly full', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto('/value')
  await mapReady(page)
  const sheet = page.getByRole('dialog', { name: 'Lot details' })
  await expect(sheet).toBeVisible()
  const top0 = (await sheet.boundingBox())!.y
  // Drag the handle up.
  await page.mouse.move(195, top0 + 12)
  await page.mouse.down()
  for (let y = top0 + 12; y > 120; y -= 40) await page.mouse.move(195, y)
  await page.mouse.up()
  // Wait for the sheet to settle at its stop rather than a fixed time, which flakes on a busy machine.
  await expect.poll(async () => (await sheet.boundingBox())!.y, { timeout: 5000 }).toBeLessThan(top0 - 150)
  await page.waitForTimeout(500)
  const top1 = (await sheet.boundingBox())!.y
  // And back down to the peek; it never closes.
  await page.mouse.move(195, top1 + 12)
  await page.mouse.down()
  for (let y = top1 + 12; y < 830; y += 40) await page.mouse.move(195, y)
  await page.mouse.up()
  await expect(sheet).toBeVisible()
  await expect.poll(async () => (await sheet.boundingBox())!.y, { timeout: 5000 }).toBeGreaterThan(top0)
  await ctx.close()
})

test('on a phone, a swipe raises the sheet before its content scrolls', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 600 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(`/lot/${MIZNER_PLAZA}`)
  await mapReady(page)
  const sheet = page.getByRole('dialog', { name: 'Lot details' })
  const content = page.getByTestId('sheet-content')
  // Make the content longer than the screen, as a long lot panel would be.
  await content.evaluate((el) => el.appendChild(Object.assign(document.createElement('div'), { style: 'height: 900px' })))
  const cdp = await ctx.newCDPSession(page)
  const swipe = async (y0: number, y1: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: y0 }] })
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: y0 + ((y1 - y0) * i) / 12 }] })
      await page.waitForTimeout(12)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(800)
  }
  const top = async () => (await sheet.boundingBox())!.y
  const scrolled = () => content.evaluate((el) => el.scrollTop)
  const half = await top()
  await swipe(half + 220, half + 40)
  expect(await top()).toBeLessThan(half - 150) // the sheet rose
  expect(await scrolled()).toBe(0) // and the content didn't move
  await swipe(450, 200)
  expect(await scrolled()).toBeGreaterThan(100) // all the way up, the content scrolls
  for (let i = 0; i < 3 && (await scrolled()) > 0; i++) await swipe(250, 500)
  expect(await scrolled()).toBe(0) // swiping down scrolls back to the top of the content first
  const full = await top()
  expect(full).toBeLessThan(half) // and the sheet hasn't moved yet
  await swipe(250, 500)
  expect(await top()).toBeGreaterThan(full + 100) // then the sheet lowers
  await ctx.close()
})

test('on a phone, a quick swipe that arrives as one jump still moves the sheet', async ({ browser }) => {
  // Safari merges touch moves when the page is busy, so a flick can reach the page as a single move.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto('/')
  await mapReady(page)
  await expect(page.getByTestId('call')).toBeVisible()
  // After the opening flight has landed, as a person swipes; in software rendering the flight keeps the page
  // too busy for the touch to read as a flick.
  await page.waitForFunction(() => !window.__truffleMap.isMoving(), null, { timeout: 20_000 })
  const sheet = page.getByRole('dialog', { name: 'Lot details' })
  const cdp = await ctx.newCDPSession(page)
  // Sent together, as a phone stamps a flick's touches when they happen: awaiting each one lets a busy test
  // machine spread them over seconds, and a flick that long reads as a slow drag.
  const flick = async (y0: number, y1: number) => {
    await Promise.all([
      cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: y0 }] }),
      cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: y1 }] }),
      cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    ])
  }
  const top = async () => (await sheet.boundingBox())!.y
  const low = await top()
  await flick(low + 60, low - 180)
  await expect.poll(top, { timeout: 5000 }).toBeLessThan(low - 100)
  const raised = await top()
  await flick(raised + 60, raised + 300)
  await expect.poll(top, { timeout: 5000 }).toBeGreaterThan(raised + 100)
  await ctx.close()
})

test('when the map can’t load, the panel says so and search still works', async ({ page }) => {
  await page.route('**/*.pmtiles', (r) => r.abort())
  await page.goto('/value')
  await expect(page.getByText('The map didn’t load')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('combobox', { name: 'Search an address' }).fill('132 NE 2nd St')
  await expect(page.getByRole('option', { name: /Mizner Plaza/ })).toBeVisible()
})

test('the front door opens on the lit city with the day’s lot under fog: call it, it rises, then the next', async ({ page }) => {
  await page.clock.setFixedTime(morningOf(1))
  await page.goto('/')
  await mapReady(page)
  // The city is lit; only the lot to call is under fog.
  expect(JSON.stringify(await page.evaluate(() => window.__truffleMap.getPaintProperty('value', 'fill-extrusion-color')))).toContain('fog')
  const title = page.getByTestId('panel-body').getByRole('heading', { level: 1 })
  // The day's lot, with its number: an ordinary business lot, never a place of worship or a home.
  await expect(title).toHaveText(dayLot(1).title)
  await expect(page.getByTestId('panel-body')).toContainText('Lot No. 1')
  await expect(page.getByTestId('call')).toBeVisible()
  // The name says what it means, once, where the first call is made.
  await expect(page.getByTestId('truffle-line')).toHaveText('A truffle is value hidden underground. You find it by searching.')
  // No number before the call.
  await expect(page.getByTestId('lot-value')).toHaveCount(0)
  await page.getByRole('button', { name: /^Less per acre/ }).click()
  await expect(page.getByTestId('verdict')).toHaveText(/^(You called it|Not this one)\.$/)
  await expect(page.getByTestId('lot-value')).toContainText('an acre')
  // The answer is a picture first: the lot beside the typical lot around it, drawn as the map draws them, with
  // the reason in a few words and the whole sentence a tap away.
  await expect(page.getByRole('img', { name: /^This lot: \$[\d.]+[MK] an acre.*The typical lot around it: \$[\d.]+[MK] an acre/ })).toBeVisible()
  await expect(page.getByTestId('reasons')).toBeHidden()
  await page.getByText(/^(Bigger lot|Smaller lot|Mostly|Land:|Built|Land at|The records)/).click()
  // The reason answers the question asked: it compares the lot with the lots around it.
  await expect(page.getByTestId('reasons')).toBeVisible()
  await expect(page.getByTestId('reasons')).toContainText(/typical lot around it|Most lots around it|Around it the land/)
  // And the map draws the typical height around it as a level the lot stands above or below.
  await expect.poll(() => page.evaluate(() => window.__truffleMap.queryRenderedFeatures({ layers: ['level'] }).length), { timeout: 10_000 }).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.__truffleMap.queryRenderedFeatures({ layers: ['level-tag'] }).map((f) => f.properties?.label)), { timeout: 10_000 }).toContainEqual(expect.stringMatching(/^\$[\d.]+[MK] typical$/))
  // The URL stays on the front door, so a reload doesn't give the answer away.
  expect(new URL(page.url()).pathname).toBe('/')
  // The next lot comes up under fog for its own call, without the truffle line.
  await page.getByRole('button', { name: 'Next lot' }).click()
  await expect(page.getByTestId('call')).toBeVisible()
  await expect(title).not.toHaveText(dayLot(1).title)
  await expect(page.getByTestId('truffle-line')).toHaveCount(0)
  // The level goes with the lot it measured.
  await expect.poll(() => page.evaluate(() => window.__truffleMap.queryRenderedFeatures({ layers: ['level'] }).length)).toBe(0)
  await expect(page.getByTestId('panel-body')).not.toContainText(/church|worship|synagogue|temple|chabad|Lot No\./i)
  await expect(page.getByTestId('lot-value')).toHaveCount(0)
})

test('a new lot every day: the same one all day, answered when you come back, a new one tomorrow, the record kept', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const done = watchErrors(page)
  await page.clock.setFixedTime(morningOf(3))
  await page.goto('/')
  await mapReady(page)
  const title = page.getByTestId('panel-body').getByRole('heading', { level: 1 })
  await expect(title).toHaveText(dayLot(3).title)
  await page.getByRole('button', { name: /^More per acre/ }).click()
  await expect(page.getByTestId('verdict')).toBeVisible()
  await expect(page.getByTestId('record')).toHaveText(/^[01] of 1 called right$/)
  const verdict = await page.getByTestId('verdict').textContent()

  // Back the same evening: the day's lot opens answered, standing at its height, and isn't asked again.
  const later = await ctx.newPage()
  await later.clock.setFixedTime(new Date(morningOf(3).getTime() + 12 * 3600_000))
  await later.goto('/')
  await mapReady(later)
  await expect(later.getByTestId('verdict')).toHaveText(verdict!)
  await expect(later.getByTestId('panel-body')).toContainText(`Lot No. 3 · ${dayLot(3).title}`)
  await expect(later.getByTestId('call')).toHaveCount(0)
  await expect(later.getByTestId('lot-value')).toContainText('an acre')
  expect(await later.evaluate((id) => window.__truffleMap.getFeatureState({ source: 'lots', sourceLayer: 'lots', id }), dayLot(3).id)).not.toMatchObject({ fog: true })

  // The next morning: a new lot, No. 4, and the record carries on.
  const tomorrow = await ctx.newPage()
  await tomorrow.clock.setFixedTime(morningOf(4))
  await tomorrow.goto('/')
  await mapReady(tomorrow)
  await expect(tomorrow.getByTestId('panel-body').getByRole('heading', { level: 1 })).toHaveText(dayLot(4).title)
  await expect(tomorrow.getByTestId('panel-body')).toContainText('Lot No. 4')
  await tomorrow.getByRole('button', { name: /^Less per acre/ }).click()
  await expect(tomorrow.getByTestId('record')).toHaveText(/^[012] of 2 called right$/)
  done()
  await ctx.close()
})

test('send a lot to a friend: the link opens it under fog, your call hidden until theirs, then both calls', async ({ browser }) => {
  const mine = await browser.newContext()
  await mine.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await mine.newPage()
  await page.clock.setFixedTime(morningOf(1))
  await page.goto('/')
  await mapReady(page)
  await page.getByRole('button', { name: /^More per acre/ }).click()
  await expect(page.getByTestId('verdict')).toBeVisible()
  const right = (await page.getByTestId('verdict').textContent()) === 'You called it.'
  await page.getByTestId('send').click()
  await expect(page.getByTestId('shared')).toHaveText('Copied. Paste it to a friend.')
  // Said by the button itself; the sentence is for a screen reader.
  await expect(page.getByTestId('send')).toHaveText('Copied')
  const [line, link] = (await page.evaluate(() => navigator.clipboard.readText())).split('\n')
  // The line to paste says how you did, never which way the lot went.
  expect(line).toBe(`Truffle No. 1: ${right ? 'called it' : 'missed it'} in Boca`)
  expect(line).not.toMatch(/more|less|\$/i)
  const url = new URL(link!)
  expect(url.pathname).toBe(`/call/${dayLot(1).id}`)
  expect([...url.searchParams.keys()]).toEqual(['c'])
  await mine.close()

  // The friend, on a phone, with no history here.
  const theirs = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const friend = await theirs.newPage()
  const done = watchErrors(friend)
  await friend.clock.setFixedTime(morningOf(1))
  await friend.goto(url.pathname + url.search)
  await mapReady(friend)
  const panel = friend.getByTestId('panel-body')
  await expect(panel.getByRole('heading', { level: 1 })).toHaveText(dayLot(1).title)
  await expect(panel).toContainText('A friend called this one · Lot No. 1')
  // Their call stays hidden until the friend makes theirs.
  await expect(panel).not.toContainText(/said|More,|Less,/)
  await expect(friend.getByTestId('truffle-line')).toBeVisible()
  await friend.getByRole('button', { name: /^Less per acre/ }).tap()
  await expect(panel).toContainText('You said Less, they said More')
  await expect(friend.getByTestId('verdict')).toBeVisible()
  // On to the next lot, the address goes back to the front door.
  await friend.getByRole('button', { name: 'Next lot' }).tap()
  await expect(friend.getByTestId('call')).toBeVisible()
  expect(new URL(friend.url()).pathname).toBe('/')
  done()
  await theirs.close()
})

test('where the share sheet exists, Send hands it the line and the link', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => {
    ;(window as unknown as { __shared: unknown[] }).__shared = []
    navigator.share = (d?: ShareData) => {
      ;(window as unknown as { __shared: unknown[] }).__shared.push(d)
      return Promise.resolve()
    }
  })
  const page = await ctx.newPage()
  await page.clock.setFixedTime(morningOf(2))
  await page.goto('/')
  await mapReady(page)
  await page.getByRole('button', { name: /^Less per acre/ }).tap()
  await page.getByTestId('send').tap()
  const shared = (await page.evaluate(() => (window as unknown as { __shared: { text: string; url: string }[] }).__shared)) ?? []
  expect(shared).toHaveLength(1)
  expect(shared[0]!.text).toMatch(/^Truffle No\. 2: (called it|missed it) in Boca$/)
  expect(shared[0]!.url).toMatch(new RegExp(`/call/${dayLot(2).id}\\?c=[0-9a-z]+$`))
  // The share sheet said it all; nothing is copied.
  await expect(page.getByTestId('shared')).toHaveText('')
  await ctx.close()
})

test('a friend’s link previews the lot under fog with the question, the same for any call, never the answer', async ({ request }) => {
  const a = await (await request.get(`/call/${BURGER_KING}?c=1`)).text()
  const b = await (await request.get(`/call/${BURGER_KING}?c=2`)).text()
  for (const html of [a, b]) {
    expect(html).toContain('<meta name="robots" content="noindex, follow"/>')
    expect(html).toContain('Burger King: more or less?')
    expect(html).not.toMatch(/\$5\.9M|an acre|said More|said Less/)
  }
  const og = /property="og:image" content="https?:\/\/[^/]+(\/call\/[^"]+)"/.exec(a)![1]!.replaceAll('&amp;', '&')
  const img = await request.get(og)
  expect(img.status()).toBe(200)
  expect(img.headers()['content-type']).toContain('image/png')
  expect((await img.body()).length).toBeGreaterThan(50_000)
  // A lot with no record is no page.
  expect((await request.get('/call/00000000000000000')).status()).toBe(404)
})

test('the front door paints the city before the map, then the map takes over', async ({ page }) => {
  await page.goto('/', { waitUntil: 'commit' })
  const frame = page.getByTestId('first-frame')
  // In the page's HTML, so it paints with the page: the city, not empty paper.
  await expect(frame).toBeAttached()
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="first-frame"] img')
    return !!img && img.complete && img.naturalWidth > 0
  })
  await mapReady(page)
  await expect(frame).toHaveAttribute('data-gone', '')
  await expect(frame).toHaveCSS('opacity', '0')
  // Only the front door: a lot page opens close in, where the wide picture would be wrong.
  await page.goto(`/lot/${MIZNER_PLAZA}`)
  await expect(page.getByTestId('first-frame')).toHaveCount(0)
})

test('the front door reads out no value before the call, and the answer names its source and pull date', async ({ page }) => {
  await page.goto('/')
  await mapReady(page)
  await expect(page.getByTestId('call')).toBeVisible()
  // The keyboard list of lots on screen is read in full by a screen reader: no values in it before the call.
  const list = page.getByRole('navigation', { name: 'Lots on screen' })
  await expect(list.getByRole('button').first()).toBeAttached()
  await expect(list).not.toContainText(/\$|an acre|not valued/)
  await expect(page.getByTestId('panel-body')).not.toContainText(/\$|an acre/)
  await page.getByRole('button', { name: /^Less per acre/ }).click()
  await expect(page.getByTestId('verdict')).toBeVisible()
  // After the answer the list is useful again: each lot with its value.
  await expect(list).toContainText(/an acre|not valued/)
  // Rule 2: the answer's numbers carry their source and the date they were pulled, as every panel does.
  await expect(page.getByTestId('panel-body').getByTestId('source')).toHaveText(/^Values: Palm Beach County property records\. Pulled [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/)
  // The next lot is under fog again, and the list keeps keyboard access: Enter puts a lot up for a call.
  await page.getByRole('button', { name: 'Next lot' }).click()
  await expect(page.getByTestId('call')).toBeVisible()
  await expect(list).not.toContainText(/\$|an acre|not valued/)
  await list.getByRole('button').first().focus()
  await expect(list).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('panel-body')).not.toContainText(/Looking up/)
  await expect(page.getByTestId('panel-body')).not.toContainText(/\$|an acre/)
})

test('a call made while the opening flight is in the air still gets a next lot', async ({ page }) => {
  // Called before the camera landed, Next lot once read the map mid-flight, found no lots at all, and the round
  // stalled on "Tap any lot to call it". Downtown, where the committed sample (no homes) has lots enough around
  // the day's lot for a next one.
  await page.clock.setFixedTime(morningOf(1))
  await page.goto('/')
  await expect(page.getByTestId('call')).toBeVisible()
  await page.getByRole('button', { name: /^Less per acre/ }).click()
  await expect(page.getByTestId('verdict')).toBeVisible()
  await page.getByRole('button', { name: 'Next lot' }).click()
  await expect(page.getByTestId('call')).toBeVisible()
})

test('the front door never asks for a lot that has no record', async ({ page }) => {
  const missing: string[] = []
  page.on('response', (r) => {
    if (r.status() === 404 && r.url().includes('/api/lot')) missing.push(r.url())
  })
  await page.goto('/')
  await mapReady(page)
  await expect(page.getByTestId('call')).toBeVisible()
  for (let round = 0; round < 4; round++) {
    await page.getByRole('button', { name: /^Less per acre/ }).click()
    await expect(page.getByTestId('verdict')).toBeVisible()
    await page.getByRole('button', { name: 'Next lot' }).click()
    await expect(page.getByTestId('call')).toBeVisible()
  }
  expect(missing, missing.join('\n')).toEqual([])
})

test('on a phone, the sheet stays low over each call and comes up for the answer, with touch', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('/')
  await mapReady(page)
  const sheet = page.getByRole('dialog', { name: 'Lot details' })
  const top = async () => (await sheet.boundingBox())!.y
  await expect(page.getByTestId('call')).toBeVisible()
  // The peek fits the call: the sheet ends 16 px under the call's last line (the first round's truffle line,
  // then Less and More), not a fixed height with room to spare.
  const last = async () => ((await page.getByTestId('truffle-line').count()) ? page.getByTestId('truffle-line') : page.getByTestId('call'))
  const under = async () => {
    const box = (await (await last()).boundingBox())!
    return 844 - box.y - box.height
  }
  await expect.poll(under).toBeLessThanOrEqual(20)
  await expect.poll(under).toBeGreaterThanOrEqual(12)
  const low = await top()
  await page.getByRole('button', { name: /^More per acre/ }).tap()
  await expect(page.getByTestId('verdict')).toBeVisible()
  await expect.poll(top).toBeLessThan(low - 100)
  // The drawer settles on every touch; the next call still brings it back down, fitted to that lot's name.
  await page.getByRole('button', { name: 'Next lot' }).tap()
  await expect(page.getByTestId('call')).toBeVisible()
  await expect.poll(under).toBeLessThanOrEqual(20)
  await expect.poll(under).toBeGreaterThanOrEqual(12)
  await ctx.close()
})

test('every share card and icon is served as an image', async ({ request }) => {
  const images: [string, string][] = [
    ['/opengraph-image', 'image/png'],
    ['/value/opengraph-image', 'image/png'],
    ['/rules/opengraph-image', 'image/png'],
    ['/changing/opengraph-image', 'image/png'],
    ['/built/opengraph-image', 'image/png'],
    [`/lot/${MIZNER_PLAZA}/opengraph-image`, 'image/png'],
    [`/call/${BURGER_KING}/opengraph-image`, 'image/png'],
    ['/favicon.ico', 'image/x-icon'],
    ['/icon.svg', 'image/svg+xml'],
    ['/apple-icon.png', 'image/png'],
    ['/icon-192.png', 'image/png'],
    ['/icon-512.png', 'image/png'],
    ['/icon-maskable-192.png', 'image/png'],
    ['/icon-maskable-512.png', 'image/png'],
    ['/icon-maskable.svg', 'image/svg+xml'],
  ]
  for (const [path, type] of images) {
    const r = await request.get(path)
    expect(r.status(), path).toBe(200)
    expect(r.headers()['content-type'], path).toContain(type)
    expect((await r.body()).length, path).toBeGreaterThan(300)
  }
  // The install icons: both shapes at both sizes Android asks for, and a vector of each.
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[]
  for (const purpose of ['any', 'maskable'])
    expect(icons.filter((i) => i.purpose === purpose).map((i) => i.sizes).sort(), purpose).toEqual(['192x192', '512x512', 'any'])
  expect(manifest.id).toBe('/')
})

// What a chat app or a network shows when someone pastes a link: crawlers read the page's head without running
// it, so each kind of page is fetched as one, and its card must be there, be an image and load.
test('every kind of page carries its share card, as a link preview reads it', async ({ request }) => {
  const pages = ['/', '/value', '/rules', '/changing', '/brand', '/built', `/lot/${MIZNER_PLAZA}`, '/lot/608', `/call/${BURGER_KING}`, '/lot/00000000000000000', '/call/00000000000000000', '/no-such-page']
  for (const ua of ['Twitterbot/1.0', 'facebookexternalhit/1.1']) {
    for (const path of pages) {
      const html = await (await request.get(path, { headers: { 'user-agent': ua } })).text()
      const tag = (attr: string, key: string) => new RegExp(`<meta ${attr}="${key}" content="([^"]+)"`).exec(html)?.[1]?.replaceAll('&amp;', '&')
      expect(tag('name', 'twitter:card'), `${path} as ${ua}`).toBe('summary_large_image')
      const og = tag('property', 'og:image')
      expect(og, `${path} as ${ua}: og:image`).toBeTruthy()
      expect(tag('name', 'twitter:image'), `${path} as ${ua}: twitter:image`).toBe(og)
      const img = await request.get(new URL(og!).pathname + new URL(og!).search)
      expect(img.status(), `${path}: ${og}`).toBe(200)
      expect(img.headers()['content-type'], `${path}: ${og}`).toContain('image/png')
    }
  }
})

test('/built: the lot it follows, every source with its day, and the way there from the map and the kit', async ({ page }) => {
  const done = watchErrors(page)
  await page.goto('/value')
  await mapReady(page)
  await page.getByRole('link', { name: 'How it’s built' }).click()
  await expect(page).toHaveURL(/\/built$/)
  await expect(page.getByRole('heading', { level: 1, name: 'How it’s built.' })).toBeVisible()
  // Mizner Plaza from its record to its tile, in the record's own numbers.
  const trace = page.getByRole('region', { name: 'One lot, start to finish.' })
  await expect(trace).toContainText('$7.4M')
  await expect(trace).toContainText('1.02 acres')
  await expect(trace).toContainText('$7.2M')
  await expect(trace).toContainText('33.9 m')
  await expect(trace.getByRole('link')).toHaveAttribute('href', '/lot/06434720280000070')
  // Every source, with the day it was pulled; the versions are what's installed.
  const sources = page.getByRole('region', { name: 'Every number has a source.' })
  await expect(sources.getByRole('link', { name: 'Palm Beach County property records' })).toBeVisible()
  await expect(sources).toContainText(/Pulled [A-Z][a-z]{2} \d{1,2}, 2026/)
  await expect(page.getByRole('region', { name: 'Chosen for this product.' })).toContainText(/Next\.js \d+\.\d+/)
  // Labeled facts, no paragraphs, and nothing set in capitals.
  expect(await page.locator('main section p').count()).toBeLessThanOrEqual(2)
  expect(await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase').length)).toBe(0)
  done()
  await page.goto('/brand')
  await page.getByRole('link', { name: 'How it’s built' }).click()
  await expect(page).toHaveURL(/\/built$/)
})

test('the brand kit: /brand links its files, and kit.json matches every icon the site serves', async ({ page, request }) => {
  const done = watchErrors(page)
  await page.goto('/brand')
  await expect(page.getByRole('heading', { name: 'The logo.' })).toBeVisible()
  // Every image on the page draws.
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.loading === 'lazy' ? ((i.loading = 'eager'), i.decode().catch(() => {})) : i.decode().catch(() => {})))))
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.src))
  expect(broken).toEqual([])
  done()

  const kit = await (await request.get('/brand/kit.json')).json()
  expect(kit.files.length).toBeGreaterThan(70)
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const byPath = new Map<string, { sha256: string }>(kit.files.map((f: { path: string; sha256: string }) => [f.path, f]))
  for (const [url, path] of Object.entries(kit.served as Record<string, string>)) {
    const r = await request.get(url)
    expect(r.status(), url).toBe(200)
    expect(sha(await r.body()), `${url} is the kit's ${path}`).toBe(byPath.get(path)!.sha256)
  }
  for (const f of kit.files as { path: string; sha256: string }[]) {
    const r = await request.get(`/brand/${f.path}`)
    expect(r.status(), f.path).toBe(200)
    expect(sha(await r.body()), f.path).toBe(f.sha256)
  }
  const zip = await request.get('/brand/kit.zip')
  expect(zip.status()).toBe(200)
  expect((await zip.body()).subarray(0, 4).toString('hex')).toBe('504b0304')
})
