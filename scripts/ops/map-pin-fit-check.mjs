// Read-only browser regression: granted GPS arrives before real public pin data.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import {sourcePoints} from './location-point-oracle.mjs'
import {hasExcludedMoneyRole} from '../../src/lib/jobPostingPolicy.mjs'
const base = process.env.BASE_URL
assert.ok(base, 'BASE_URL required')
const out = process.env.SCREENSHOT_DIR || '/tmp/map-pin-fit'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
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
    const jobRows=new Map(), locationRows=new Map()
    let jobsFetched=false, sourceResponses=0, gpsBeforeSource=false
    await context.route('**/rest/v1/local_jobs?**',async route=>{
      const response=await route.fetch()
      assert.equal(response.status(),200,'real public jobs response')
      const rows=await response.json()
      for(const row of rows)if(!hasExcludedMoneyRole(row))jobRows.set(String(row.id),row)
      jobsFetched=true
      await route.fulfill({response})
    })
    await context.route('**/rest/v1/job_work_locations?**',async route=>{
      const response=await route.fetch()
      assert.equal(response.status(),200,'real canonical source response')
      const rows=await response.json()
      for(const row of rows)locationRows.set(String(row.id),row)
      // Hold the actual canonical response until GPS has reached the application.
      await page.waitForFunction(()=>document.querySelector('.hme')?.textContent.includes('Vị trí hiện tại của bạn'))
      if(sourceResponses===0) {
        assert.equal(await page.locator('.hme-map__job-marker').count(),0,'GPS applied before first canonical pins')
        gpsBeforeSource=true
      }
      sourceResponses++
      await route.fulfill({response})
    })
    const firstJobsReply=page.waitForResponse(r=>r.url().includes('/rest/v1/local_jobs?') && r.status()===200)
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' })
      await page.locator('.hme__map').scrollIntoViewIfNeeded()
      await page.waitForFunction(()=>document.querySelector('.hme')?.textContent.includes('Vị trí hiện tại của bạn'),undefined,{timeout:60000})
      await firstJobsReply
      assert.equal(jobsFetched,true,'raw public rows observed')
      await page.waitForFunction(n=>{
        const counts=document.querySelector('[data-testid="home-map-job-counts"]')
        return counts && counts.getAttribute('data-loading')!=='true' && (n===0 ? Number(counts.getAttribute('data-loaded'))===0 : Number(counts.getAttribute('data-loaded'))>0)
      },jobRows.size,{timeout:60000})
      const expectedJobs=jobRows.size
      assert.equal(Number(await page.getByTestId('home-map-job-counts').getAttribute('data-loaded')),expectedJobs,'all paginated admitted public jobs loaded')
      const expected=sourcePoints([...locationRows.values()].filter(row=>jobRows.has(String(row.job_id))))
      if(expectedJobs)assert.ok(sourceResponses>0,'loaded jobs require canonical source fetch')
      if(sourceResponses)assert.equal(gpsBeforeSource,true,'real canonical response gated behind GPS')
      await page.waitForFunction(n => {
        const box = document.querySelector('.hme-map__canvas')?.getBoundingClientRect()
        const pins = [...document.querySelectorAll('.hme-map__job-marker')]
        return box && (n===0 ? pins.length===0 : pins.length>0) && pins.every(p => {
          const r = p.getBoundingClientRect()
          return r.width > 0 && r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom
        })
      }, expected.length, { timeout: 60000 })
      assert.match(await page.locator('.hme').innerText(), /Vị trí hiện tại của bạn/, 'real location applied')
      const provider = await page.locator('[data-map-provider]').getAttribute('data-map-provider')
      const pins = await page.locator('.hme-map__job-marker').evaluateAll(els => els.map(el => ({ title: el.title, rect: el.getBoundingClientRect().toJSON() })))
      const loaded=Number(await page.getByTestId('home-map-job-counts').getAttribute('data-loaded'))
      if(expected.length>0) assert.ok(pins.length>0,'resolved public source produces fitted pins')
      else assert.equal(pins.length,0,'unresolved/empty source produces no workplace pins')
      if (new URL(base).hostname !== 'localhost') {
        assert.equal(await page.locator('.hme-map__notice:visible').count(), 0, 'production map must not show tile/style failure')
      }
      if (new URL(base).hostname !== 'localhost') await page.waitForTimeout(15000)
      if (process.env.MAP_CLEANUP_CHECK === '1') {
        // Real radius controls must filter representative pins and list together.
        const preset = (text) => page.locator('.hme').getByRole('button', {name:text, exact:true})
        if (width === 390) await page.getByRole('button', {name:'Mở bộ lọc bản đồ'}).click()
        await preset('100 m').click()
        if (width === 390) await page.getByRole('button', {name:'Đóng bộ lọc',exact:true}).click()
        await page.waitForFunction(() => document.querySelector('[data-in-radius]')?.dataset.radiusActive === 'true')
        const smallCount=Number(await page.locator('[data-in-radius]').getAttribute('data-in-radius'))

        await page.screenshot({path:`${out}/radius-small-${width}.png`})
        if (width === 390) await page.getByRole('button', {name:'Mở bộ lọc bản đồ'}).click()
        await preset('20 km').click()
        if (width === 390) await page.getByRole('button', {name:'Đóng bộ lọc',exact:true}).click()
        const largeCount=Number(await page.locator('[data-in-radius]').getAttribute('data-in-radius'))
        assert.ok(largeCount>=smallCount,'increasing radius cannot remove nearby jobs')
        await page.screenshot({path:`${out}/radius-large-${width}.png`})
        assert.doesNotMatch(await page.locator('.hme').innerText(), /Độ chính xác vị trí|Chọn điểm trên bản đồ|đường chim bay|Cách điểm đại diện|Cách cổng KCN/i)
        const marker=page.locator('.hme-map__job-marker').first()
        if(expected.length>0) {
        await marker.waitFor({timeout:30000})
        await marker.click({force:true})
        if(await page.locator('.hme-map__job-picker button').count())await page.locator('.hme-map__job-picker button').first().click()
        const actions = page.locator('.hme-job__actions')
        await actions.waitFor()
        assert.equal(await actions.locator('a').count(),2,'selected workplace panel has detail and directions')
        assert.equal(await actions.locator('a').first().innerText(),'Xem chi tiết')
        assert.match(await actions.locator('a').nth(1).innerText(),/Chỉ đường|Đến cổng KCN|Xem khu vực/)
        assert.match(await actions.locator('a').nth(1).getAttribute('href'),/^https:\/\/(www\.)?google\.com\/maps/)
        assert.equal(await page.locator('.hme-job .jd2-map-links, .hme-tag--distance').count(), 0)
        const colors = await actions.evaluate(el => [...el.querySelectorAll('a')].map(a => {
          const s = getComputedStyle(a); return { background: s.backgroundColor, border: s.borderTopColor, color: s.color }
        }))
        assert.equal(colors[1].background, 'rgb(255, 255, 255)', 'directions white background')
        assert.equal(colors[1].border, colors[0].background, 'directions outline matches red detail button')
        await page.screenshot({ path: `${out}/cleanup-selected-${width}.png` })
        await page.locator(width < 760 ? '.hme-sheet__close' : '.hme-job__close').click()
        }
      }
      assert.deepEqual(errors, [], 'no page errors')
      results.push({ width, provider, gpsBeforePins: sourceResponses ? gpsBeforeSource : null, canonicalResponses:sourceResponses, expectedPoints:expected.length, ok: true, pins })
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
