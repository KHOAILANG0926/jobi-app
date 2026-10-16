// Read-only public screenshots + browser-only fixtures. Never writes to a service.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const base = (process.env.BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '')
const out = process.env.SCREENSHOT_DIR || '/tmp/jobi-mobile-home'
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const results = []
async function ready(page) {
  await page.locator('[data-testid="home-map-job-counts"][data-loading="false"]').waitFor({ state: 'attached', timeout: 45000 })
}
async function noOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  assert.ok(overflow <= 0, `horizontal overflow: ${overflow}px`)
}
const fixtures = Array.from({ length: 7 }, (_, i) => ({
  id: 900000 + i, title: `TEST ONLY — Công việc kiểm tra ${i + 1}`, company: 'TEST ONLY',
  category: 'san_xuat_xay_dung', occupation_code: '8211', salary: i % 2 ? '11 triệu/tháng' : '15 triệu/tháng', salary_period: 'month',
  location: i < 2 ? 'Bắc Ninh' : 'Hà Nội', active: true, admin_hidden: false,
  source: 'manual', description: 'TEST ONLY', employer_phone: '', posted_at: '2026-10-16',
  shift_type: i < 3 ? 'day' : null, urgent: i === 0, recruitment_type: 'direct',
}))
try {
  for (const width of [360, 390, 412, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 900 : 844 }, isMobile: width < 760, hasTouch: width < 760, serviceWorkers: 'block' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await ready(page)
    assert.equal(await page.locator('.home-jobs-error').count(), 0, 'public jobs must load, not fail silently')
    await noOverflow(page)
    await page.screenshot({ path: `${out}/live-home-${width}.jpg` })
    if (width < 760) {
      assert.equal(await page.locator('.mobile-bottom-nav a:visible').count(), 4)
      await page.getByRole('button', { name: 'Mở tất cả danh mục', exact: true }).click()
      await page.getByRole('dialog', { name: 'Tất cả danh mục' }).waitFor()
      await page.screenshot({ path: `${out}/live-menu-${width}.jpg` })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Mức lương', exact: true }).click()
      await page.getByRole('dialog', { name: 'Bộ lọc việc làm' }).waitFor()
      await noOverflow(page)
      await page.screenshot({ path: `${out}/live-filters-${width}.jpg` })
      await page.keyboard.press('Escape')
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
      await page.getByRole('button', { name: 'Danh sách', exact: true }).click()
      assert.equal(await page.locator('.hme__map').isVisible(), false)
      await page.screenshot({ path: `${out}/live-list-${width}.jpg` })
      await page.getByRole('button', { name: 'Bản đồ', exact: true }).click()
      assert.equal(await page.locator('.hme__map').isVisible(), true)
    } else {
      assert.equal(await page.locator('.layout__header').isVisible(), true)
      assert.equal(await page.locator('.home-brand-hero').isVisible(), true)
      assert.equal(await page.locator('.hme__controls').isVisible(), true)
    }
    assert.deepEqual(errors, [], 'no uncaught page errors')
    results.push({ kind: 'public-live', width, ok: true })
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  let rows = fixtures
  let queryFailed = false
  await context.route('**/rest/v1/**', route => {
    const table = new URL(route.request().url()).pathname.split('/').pop()
    const payload = table === 'local_jobs' ? rows : []
    return route.fulfill({ status: table === 'local_jobs' && queryFailed ? 503 : 200, contentType: 'application/json', body: JSON.stringify(payload) })
  })
  await context.route('**/api/map-locations?**', route => route.fulfill({ json: { points: {} } }))
  await context.addInitScript(() => {
    window.__geoCalls = 0
    navigator.geolocation.getCurrentPosition = (success, error) => {
      window.__geoCalls += 1
      if (window.__allowGeo) success({ coords: { latitude: 21.0285, longitude: 105.8542, accuracy: 10 } })
      else error({ code: 1, message: 'test permission denied' })
    }
  })
  const page = await context.newPage()
  await page.goto(base)
  await ready(page)
  assert.equal(await page.evaluate(() => window.__geoCalls), 0, 'no unsolicited GPS permission request')
  assert.equal(await page.locator('.discovery-carousel__page').count(), 3)
  await page.getByRole('button', { name: 'Nhóm công việc tiếp theo', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.discovery-carousel__paging > span')?.textContent === '2/3')
  await page.getByRole('button', { name: 'Mức lương', exact: true }).click()
  await page.getByRole('button', { name: '12M+', exact: true }).click()
  await page.getByRole('dialog', { name: 'Bộ lọc việc làm' }).getByRole('button', { name: /Xem 4 việc làm/ }).click()
  assert.equal(await page.locator('[data-section="all"] .discovery-job').count(), 4, 'salary filters feed carousel and list')
  await page.getByRole('button', { name: 'Đặt lại', exact: true }).click()
  assert.equal(await page.locator('[data-section="all"] .discovery-job').count(), 7)
  await page.locator('.home-mobile-header__location').click()
  assert.equal(await page.locator('#hme-region').inputValue(), '')
  await page.locator('#hme-region').selectOption({ label: 'Hà Nội' })
  await page.getByRole('dialog', { name: 'Bộ lọc việc làm' }).getByRole('button', { name: /Xem 5 việc làm/ }).waitFor()
  await page.locator('.hme-loc__current').click()
  await page.locator('#hme-region').selectOption({ label: 'Bắc Ninh' })
  await page.getByRole('dialog', { name: 'Bộ lọc việc làm' }).getByRole('button', { name: /Xem 2 việc làm/ }).click()
  assert.equal(await page.locator('[data-section="all"] .discovery-job').count(), 2)
  assert.match(await page.locator('.home-mobile-header__location').innerText(), /Bắc Ninh/)
  await page.getByRole('button', { name: 'Đặt lại', exact: true }).click()
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click()
  await page.locator('.home-discovery-status').filter({ hasText: 'Không lấy được vị trí' }).waitFor()
  assert.equal(await page.evaluate(() => window.__geoCalls), 1)
  await page.evaluate(() => { window.__allowGeo = true })
  await page.locator('.home-mobile-header__location').click()
  await page.locator('.hme-loc__menu').getByRole('button', { name: 'Gần tôi', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="home-map-job-counts"]')?.getAttribute('data-radius-active') === 'true')
  await page.getByRole('button', { name: 'Đóng bộ lọc', exact: true }).click()
  assert.match(await page.locator('.home-mobile-header__location').innerText(), /Vị trí hiện tại/)
  results.push({ kind: 'browser-only-fixture', case: 'carousel/filter/reset/manual-region/GPS-allow-deny', ok: true })

  for (const count of [0, 1, 2, 3, 4]) {
    rows = fixtures.slice(0, count)
    await page.reload()
    await ready(page)
    assert.equal(await page.locator('.discovery-carousel__page').count(), Math.ceil(count / 3))
    assert.equal(await page.locator('.discovery-carousel .discovery-job').count(), count)
    assert.equal(await page.locator('.home-discovery-empty').isVisible(), count === 0)
    await noOverflow(page)
    results.push({ kind: 'browser-only-fixture', case: `record-count-${count}`, ok: true })
  }
  rows = [{ ...fixtures[0], salary: 'Thỏa thuận' }]
  await page.reload()
  await ready(page)
  assert.equal(await page.locator('[data-section="all"] .discovery-job').count(), 1, 'negotiable jobs remain browseable')
  results.push({ kind: 'browser-only-fixture', case: 'negotiable-salary-preserved', ok: true })
  queryFailed = true
  await page.reload()
  await ready(page)
  assert.equal(await page.locator('.home-jobs-error').isVisible(), true)
  assert.equal(await page.locator('.home-discovery-empty').isVisible(), false, 'query error is not an empty result')
  results.push({ kind: 'browser-only-fixture', case: 'API-error-distinct-from-empty', ok: true })
  await context.close()
  const noGpuContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await noGpuContext.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith('webgl') ? null : getContext.call(this, kind, ...args)
    }
  })
  const noGpuPage = await noGpuContext.newPage()
  await noGpuPage.goto(base)
  await ready(noGpuPage)
  await noGpuPage.locator('.hme__map').scrollIntoViewIfNeeded()
  await noGpuPage.locator('.hme-map__notice').waitFor({ timeout: 45000 })
  assert.equal(await noGpuPage.locator('.home-mobile-header').isVisible(), true, 'map GPU failure must not remove the home page')
  await noGpuPage.screenshot({ path: `${out}/no-webgl-home.jpg` })
  results.push({ kind: 'browser-only-fixture', case: 'WebGL-unavailable-preserves-home', ok: true })
  await noGpuContext.close()
} finally {
  await browser.close()
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}
