// First view on a phone over 4G: when the panel's text paints and when the map has drawn lots.
// Profiles follow Chrome's presets: "Fast 4G" (9 Mbps down, 60 ms) and "Slow 4G" (1.6 Mbps, 150 ms) with a 4x slower CPU.
import { chromium } from '@playwright/test'
const url = process.argv[2] ?? 'http://localhost:3300/value'
const profiles = {
  'Fast 4G': { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8, cpu: 4 },
  'Slow 4G': { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 },
}
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
for (const [name, p] of Object.entries(profiles)) {
  const runs = []
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.downloadThroughput, uploadThroughput: p.uploadThroughput })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu })
    let bytes = 0
    cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength))
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'commit' })
    await page.waitForFunction(() => performance.getEntriesByType('paint').some((e) => e.name === 'first-contentful-paint'))
    const fcp = await page.evaluate(() => performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint').startTime)
    await page.waitForFunction(() => { const m = window.__truffleMap; return m && m.loaded() && m.queryRenderedFeatures({ layers: ['value'] }).length > 20 }, null, { timeout: 60000, polling: 50 })
    const map = Date.now() - t0
    runs.push({ fcp: Math.round(fcp), map, kb: Math.round(bytes / 1024) })
    await ctx.close()
  }
  const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[1]
  console.log(`${name}: text on screen ${med('fcp')} ms, map drawn ${med('map')} ms, ${med('kb')} KB transferred (median of 3)`)
}
await b.close()
