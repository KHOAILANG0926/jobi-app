// Lee 2026-11-08 "3 적용": 공고 등록 '미리보기'가 저장 전 입력값을 상세 화면 틀 그대로 새 창에 보여 주고, 단추는 눌리지 않는지(PC·휴대폰).
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined })
try {
  for (const [name, viewport, button] of [['pc', { width: 1366, height: 900 }, '.pj-side__pv button:first-child'], ['mobile', { width: 390, height: 844 }, '.pj-bar button:has-text("Xem trước")']]) {
    const ctx = await b.newContext({ viewport })
    await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return u.origin === new URL(base).origin ? r.continue() : r.fulfill({ json: [] }) })
    const page = await ctx.newPage(); page.setDefaultTimeout(15000)
    await page.goto(base + '/dang-tin', { waitUntil: 'domcontentloaded' })
    const title = 'Tuyển nhân viên phục vụ thử xem trước ' + name
    await page.locator('.pj input[maxlength="40"]').first().fill(title.slice(0, 40))
    await page.locator('.pj').getByRole('button', { name: 'Part-time', exact: true }).click()
    const popupP = ctx.waitForEvent('page')
    await page.locator(button).first().click()
    const pop = await popupP
    await pop.waitForLoadState('domcontentloaded')
    await pop.locator('.jd2-preview-note').waitFor()
    assert.equal((await pop.locator('h1.jd2-header__title').innerText()).trim(), title.slice(0, 40), 'preview shows typed title')
    assert.equal(await pop.locator('.jd2-page--v2').count(), 1, 'preview uses the latest detail frame')
    const pe = await pop.locator('.jd2-page--preview button').first().evaluate((el) => getComputedStyle(el).pointerEvents)
    assert.equal(pe, 'none', 'buttons are inert in preview')
    console.log('PASS job preview', name)
    await ctx.close()
  }
} finally { await b.close() }
