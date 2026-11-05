// Isolated public-response replay. No production database reads or writes.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { buildDescriptionFromSources } from '../../src/lib/jobDescriptionBuild.ts'
const base = process.env.BASE_URL || 'http://127.0.0.1:4190'
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'local replay only')
const source = JSON.parse(readFileSync('scripts/ops/jobs/fb-new-teamrobotics-20261104.json', 'utf8'))
const job = { ...source, id: 910090, num_hires: String(source.num_hires), active: true, posted_at: '2026-11-04',
  description: buildDescriptionFromSources([{ name: 'source_text', text: source.source_text }], {}).description }
const out = process.env.SCREENSHOT_DIR || '/tmp/jobi-process-preview'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] })
try {
  for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**', route => {
      const url = new URL(route.request().url())
      if (url.pathname.includes('/storage/')) return route.fulfill({ contentType: 'image/png', body: readFileSync('public/logo.png') })
      const table = url.pathname.split('/').at(-1)
      return route.fulfill({ json: table === 'local_jobs' ? [job] : [], headers: { 'content-range': '0-0/1' } })
    })
    await context.route('**/api/map-locations?**', r => r.fulfill({ json: { points: {} } }))
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/viec-lam/sb-${job.id}`, { waitUntil: 'domcontentloaded' })
    await page.locator('h1.jd2-header__title').waitFor()
    const summary = page.locator('.jd2-page')
    for (const value of ['Không quá 30 tuổi.', 'Có kinh nghiệm làm nhân sự, nắm vững quy trình cơ bản.', 'Giao tiếp tiếng Trung lưu loát.', 'Ứng viên vui lòng gửi CV để được trao đổi chi tiết!']) {
      assert((await summary.getByText(value, { exact: true }).count()) >= 2, `${value}: summary and preserved source at ${width}px`)
    }
    assert.equal(await page.getByText('Không yêu cầu kinh nghiệm', { exact: true }).count(), 0, 'no invented no-experience requirement')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    assert(!overflow, `no horizontal overflow at ${width}px`)
    assert.equal(errors.length, 0, errors.join('\n'))
    await page.locator('.jd2-header').screenshot({ path: `${out}/header-${width}.png` })
    await page.screenshot({ path: `${out}/detail-${width}.png`, fullPage: true })
    await context.close()
    console.log(`PASS ${width}px: age, experience, Chinese, CV, preserved detail and no overflow`)
  }
} finally { await browser.close() }
