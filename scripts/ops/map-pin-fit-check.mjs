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
    // The CI preview has no Vercel map keys. Supply only its empty basemap style;
    // real job rows/coordinates/GPS and camera/marker code remain unchanged.
    // Production always uses its actual map style and tiles.
    if (new URL(base).hostname === 'localhost') {
      await context.route('https://maps.geoapify.com/v1/styles/**', route => route.fulfill({ json: {
        version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef2f6' } }],
      } }))
    }
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await context.route('**/api/map-locations?**', async route => {
      const url = new URL(route.request().url())
      const response = await context.request.get(`https://www.viecganban.vn${url.pathname}${url.search}`)
      assert.equal(response.status(), 200, 'real public map-locations response')
      // Prove the race order, rather than relying only on a fixed network delay.
      await page.waitForFunction(() => document.querySelector('.hme')?.textContent.includes('Vị trí hiện tại của bạn'))
      assert.equal(await page.locator('.hme-map__job-marker').count(), 0, 'GPS applied before first job pins')
      const data = await response.json()
      assert.ok(data.points['sb-4824'] && data.points['sb-4828'], 'real current public pin IDs')
      console.log(`GPS-before-pins proven (${width}px), real public IDs sb-4824 and sb-4828`)
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
      assert.ok(pins.some(p => /dây mạng/i.test(p.title)), '#4828 real public title present (company is blank)')
      if (new URL(base).hostname !== 'localhost') {
        assert.equal(await page.locator('.hme-map__notice:visible').count(), 0, 'production map must not show tile/style failure')
      }
      assert.deepEqual(errors, [], 'no page errors')
      results.push({ width, provider, gpsBeforePins: true, ok: true, pins })
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
