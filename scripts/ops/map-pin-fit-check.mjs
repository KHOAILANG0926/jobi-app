// Read-only browser regression: granted GPS arrives before real public pin data.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const base = process.env.BASE_URL
assert.ok(base, 'BASE_URL required')
const out = process.env.SCREENSHOT_DIR || '/tmp/map-pin-fit'
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const results = []
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 },
      geolocation: { latitude: 21.10, longitude: 106.07, accuracy: 20 }, permissions: ['geolocation'],
      isMobile: width === 390, hasTouch: width === 390 })
    // LocationPrompt intentionally skips automation; enable its real granted-permission path for this test.
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await context.route('**/api/map-locations?**', async route => {
      const url = new URL(route.request().url())
      const response = await context.request.get(`https://www.viecganban.vn${url.pathname}${url.search}`)
      assert.equal(response.status(), 200, 'real public map-locations response')
      // Deliberately release pins after granted GPS. Never substitute fabricated job coordinates.
      await new Promise(resolve => setTimeout(resolve, 2500))
      await route.fulfill({ response })
    })
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' })
      await page.locator('.hme__map').scrollIntoViewIfNeeded()
      await page.waitForFunction(() => {
        const box = document.querySelector('.hme-map__canvas')?.getBoundingClientRect()
        const pins = [...document.querySelectorAll('.hme-map__job-marker')]
        return box && pins.length === 2 && pins.every(p => {
          const r = p.getBoundingClientRect()
          return r.width > 0 && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom
        })
      }, undefined, { timeout: 60000 })
      assert.match(await page.locator('.hme').innerText(), /Vị trí hiện tại của bạn/, 'real location applied')
      const provider = await page.locator('[data-map-provider]').getAttribute('data-map-provider')
      const pins = await page.locator('.hme-map__job-marker').evaluateAll(els => els.map(el => ({ title: el.title, rect: el.getBoundingClientRect().toJSON() })))
      assert.ok(pins.some(p => /KDA/i.test(p.title)), 'KDA pin present')
      assert.ok(pins.some(p => /Mao Yên/i.test(p.title)), 'Mao Yên pin present')
      assert.deepEqual(errors, [], 'no page errors')
      results.push({ width, provider, ok: true, pins })
    } finally {
      await page.screenshot({ path: `${out}/map-pins-${width}.png` })
      await context.close()
    }
  }
} finally {
  await browser.close()
  await writeFile(`${out}/result.json`, JSON.stringify({ base, location: [21.10, 106.07], results }, null, 2))
  console.log(JSON.stringify({ base, results }, null, 2))
}
