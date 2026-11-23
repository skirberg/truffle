import { test } from '@playwright/test'
import { BURGER_KING, MIZNER_PLAZA, mapReady } from './helpers'
import { challengePath } from '../lib/challenge'

// npm run shots: screenshots of each view, saved to shots/.
const views = [
  { name: 'Front door', path: '/', layer: 'value', w: 1440, h: 900 },
  { name: 'Phone, front door', path: '/', layer: 'value', w: 390, h: 844 },
  { name: 'Phone, a friend’s lot', path: challengePath(BURGER_KING, true, null), layer: 'value', w: 390, h: 844 },
  { name: 'Value', path: '/value', layer: 'value', w: 1440, h: 900 },
  { name: 'Mizner Plaza Selected', path: `/lot/${MIZNER_PLAZA}`, layer: 'value', w: 1440, h: 900 },
  { name: 'Rules', path: '/rules', layer: 'rules', w: 1440, h: 900 },
  { name: 'Changing', path: '/changing', layer: 'changing', w: 1440, h: 900 },
  { name: 'Phone', path: '/value', layer: 'value', w: 390, h: 844 },
  { name: 'Phone, Mizner Plaza', path: `/lot/${MIZNER_PLAZA}`, layer: 'value', w: 390, h: 844 },
]
for (const v of views) {
  test(v.name, async ({ page }) => {
    await page.setViewportSize({ width: v.w, height: v.h })
    await page.goto(v.path)
    await mapReady(page, v.layer)
    // The front door holds the wide view, then flies down to the first lot.
    await page.waitForTimeout(v.path === '/' || v.path.startsWith('/call/') ? 7000 : 3500)
    await page.screenshot({ path: `shots/${v.name}.png` })
  })
}
