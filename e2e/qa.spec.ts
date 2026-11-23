import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ROUTES, mapReady } from './helpers'
import { QA_WIDTHS, qaHeight } from '../lib/built'

// Every route at 320 (the narrowest phone in use), 375, 768, 1024 and 1440 px: axe, no sideways scroll, tap targets.
// /built draws these same widths (lib/built.ts), so the page and the check can't disagree.
const WIDTHS = QA_WIDTHS

// Pages without the map: the brand kit and how it's built.
const PAGES = ['/brand', '/built']

for (const route of [...ROUTES, ...PAGES]) {
  for (const width of WIDTHS) {
    test(`${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: qaHeight(width) })
      await page.goto(route)
      if (PAGES.includes(route)) await page.waitForLoadState('load')
      else await mapReady(page, route === '/rules' ? 'rules' : route === '/changing' ? 'changing' : 'value')

      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(sideways, 'page scrolls sideways').toBeLessThanOrEqual(0)

      // WCAG 2.5.8: every visible control is at least 24 by 24 px.
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a, button, input, [role="tab"], [role="option"]')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            const s = getComputedStyle(el)
            const hidden = el.closest('[aria-hidden="true"], .sr-only, [class*="sr-only"]')
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !hidden
          })
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width < 24 || r.height < 24
          })
          .map((el) => `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
      )
      expect(small).toEqual([])

      // From 760 px the panel is a card on the right: nothing in the top bar may sit under it (at 768 the
      // Changing tab once did).
      if (width >= 760 && !PAGES.includes(route)) {
        const under = await page.evaluate(() => {
          const panel = document.querySelector('aside[aria-label="Lot details"]')?.getBoundingClientRect()
          if (!panel) return []
          // The top bar's controls only: the panel's own card headers are headers too.
          return [...document.querySelectorAll<HTMLElement>('header a, header button, header [role="tab"]')]
            .filter((el) => !el.closest('aside'))
            .map((el) => ({ t: (el.textContent ?? '').trim() || el.getAttribute('aria-label'), r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.right > panel.left && r.bottom > panel.top && r.top < panel.bottom)
            .map(({ t }) => t)
        })
        expect(under, 'top bar under the panel').toEqual([])
      }
    })
  }
}

// The answer after a call, with its picture and its reason opened: axe, no sideways scroll.
for (const width of [375, 1440]) {
  test(`the answer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 })
    await page.goto('/')
    await mapReady(page)
    await page.getByRole('button', { name: /^Less per acre/ }).click()
    await expect(page.getByTestId('verdict')).toBeVisible()
    await page.locator('summary').first().click()
    await expect(page.getByTestId('reasons')).toBeVisible()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
}
