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
    if (new URL(base).hostname === 'localhost') await context.route('**/api/map-locations?**', async route => {
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
      if (process.env.MAP_CLEANUP_CHECK === '1') {
        await page.waitForFunction(() => document.querySelector('.hme')?.textContent.includes('Vị trí hiện tại của bạn'))
        if (width === 390) await page.getByRole('button', {name:'Mở bộ lọc bản đồ'}).click()
        await page.locator('.hme').getByRole('button', {name:'20 km',exact:true}).click()
        if (width === 390) await page.getByRole('button', {name:'Đóng bộ lọc',exact:true}).click()
      }
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
      if (process.env.MAP_CLEANUP_CHECK === '1') {
        // Real radius controls must filter representative pins and list together.
        const preset = (text) => page.locator('.hme').getByRole('button', {name:text, exact:true})
        if (width === 390) await page.getByRole('button', {name:'Mở bộ lọc bản đồ'}).click()
        await preset('100 m').click()
        if (width === 390) await page.getByRole('button', {name:'Đóng bộ lọc',exact:true}).click()
        await page.waitForFunction(() => document.querySelectorAll('.hme-map__job-marker').length === 0)
        if (width === 1366) assert.equal(await page.locator('.hme-map-r1-results > button').count(), 0)
        await page.screenshot({path:`${out}/radius-small-${width}.png`})
        if (width === 390) await page.getByRole('button', {name:'Mở bộ lọc bản đồ'}).click()
        await preset('20 km').click()
        if (width === 390) await page.getByRole('button', {name:'Đóng bộ lọc',exact:true}).click()
        await page.waitForFunction(() => document.querySelectorAll('.hme-map__job-marker').length === 2)
        if (width === 1366) assert.equal(await page.locator('.hme-map-r1-results > button').count(), 2)
        await page.screenshot({path:`${out}/radius-large-${width}.png`})

        assert.doesNotMatch(await page.locator('.hme').innerText(), /Độ chính xác vị trí|Chọn điểm trên bản đồ|đường chim bay|Cách điểm đại diện|Cách cổng KCN/i)
        if (width === 1366) assert.equal(await page.locator('.hme-map-r1-results > button').count(), 2, 'PC list agrees with two visible pins even with location enabled')
        await page.locator('.hme-map__job-marker[title*="KDA"]').click()
        const actions = page.locator('.hme-job__actions')
        assert.deepEqual(await actions.locator('a').allTextContents(), ['Xem chi tiết', 'Chỉ đường'], 'B panel has only two actions')
        assert.equal(await page.locator('.hme-job .jd2-map-links, .hme-tag--distance').count(), 0)
        const colors = await actions.evaluate(el => [...el.querySelectorAll('a')].map(a => {
          const s = getComputedStyle(a); return { background: s.backgroundColor, border: s.borderTopColor, color: s.color }
        }))
        assert.equal(colors[1].background, 'rgb(255, 255, 255)', 'directions white background')
        assert.equal(colors[1].border, colors[0].background, 'directions outline matches red detail button')
        await page.screenshot({ path: `${out}/cleanup-selected-${width}.png` })
        await page.locator(width < 760 ? '.hme-sheet__close' : '.hme-job__close').click()
        if (width === 1366) {
          const box = await page.locator('.hme-map__canvas').boundingBox()
          assert.ok(box)
          await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 25 })
          await page.mouse.up()
          await page.waitForFunction(() => document.querySelector('.hme-intro__count strong')?.textContent === '0')
          assert.equal(await page.locator('.hme-map-r1-results > button').count(), 0, 'panning away removes outside jobs from PC list')
          await page.screenshot({ path: `${out}/cleanup-panned-${width}.png` })
        }
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
