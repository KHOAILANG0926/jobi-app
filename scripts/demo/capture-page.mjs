// 간편 템플릿 데모 촬영(PC·모바일): node scripts/demo/capture-page.mjs /demo/mau-nhanh → out/page-*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const path = process.argv[2] || '/'
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
for (const [name, opt] of [['pc', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...opt, locale: 'vi-VN' })
  const page = await ctx.newPage()
  const errors = []
  const dialogs = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => { dialogs.push(d.message().slice(0, 60)); d.accept() })
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const shot = (n, full = true) => page.screenshot({ path: `out/page-${name}-${n}.png`, fullPage: full })
  const click = async (sel) => { const l = page.locator(sel).first(); if (await l.count() && await l.isVisible()) await l.click().catch((e) => errors.push(`click ${sel}: ${e.message.slice(0, 80)}`)); else errors.push(`missing ${sel}`) }
  await shot('01-start')
  // 적용하기 → 제목·첫 글칸 입력
  await click('.amt-apply__btn')
  await page.locator('.amt-visual__title textarea').fill('Tuyển nhân viên phục vụ').catch((e) => errors.push('title ' + e.message.slice(0, 60)))
  await page.locator('.amt-tbl td textarea').first().fill('Phục vụ').catch(() => {})
  await page.waitForTimeout(400)
  if (name === 'pc') {
    await page.evaluate(() => { const a = document.querySelector('.amt-area'); if (a) a.scrollTop = 900 })
    await click('.amt-ed__btn[title="Màu chữ"]')
    await page.waitForTimeout(300)
    await shot('02-applied-colormenu')
    await click('.amt-ed__btn[title="Màu chữ"]')
    await click('.amt-item--add')
    await click('.amt-pager button[aria-label="Sau"]')
    await click('.amt-thumbs .amt-thumb:nth-child(2)')
    await click('.amt-color:nth-child(1)')
    await page.evaluate(() => { const a = document.querySelector('.amt-area'); if (a) a.scrollTop = 0 })
    await shot('03-changed')
    await click('.amt-side__all')
    await page.waitForTimeout(600)
    await shot('04-all', false)
    await click('.amt-all__zoom')
    await page.waitForTimeout(600)
    await shot('05-zoom', false)
    await click('.amt-modal--top .amt-modal__h button')
    await click('.amt-btn-line')
    // 미리보기 = 새 창
    for (const [i, label] of [[0, 'pc'], [1, 'mobile']]) {
      const pop = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null)
      await page.locator('.amt-previews button').nth(i).click().catch((e) => errors.push('preview ' + e.message.slice(0, 60)))
      const p = await pop
      if (p) { await p.waitForLoadState('load').catch(() => {}); await p.waitForTimeout(1200); await p.screenshot({ path: `out/page-${name}-06-preview-${label}.png`, fullPage: true }); errors.push(`popup ${label} ${JSON.stringify(p.viewportSize())}`); await p.close() } else errors.push(`no popup ${label}`)
    }
  } else {
    await click('.amt-row:nth-child(1)')
    await page.waitForTimeout(500)
    await shot('02-sheet-tpl', false)
    await click('.amt-chip:nth-child(2)')
    await click('.amt-all__pick')
    await click('.amt-sheet__foot button')
    await click('.amt-row:nth-child(3)')
    await page.waitForTimeout(400)
    await shot('03-sheet-items', false)
    await click('.amt-sheet__foot button')
    await shot('04-after')
  }
  // 직접입력 탭
  await click('.amt-tab:nth-child(3)')
  await page.waitForTimeout(400)
  if (name === 'pc') { for (let i = 1; i <= 4; i++) await click(`.amt-item--ins:nth-child(${i})`) } else { await click('.amt-row'); await click('.amt-pill:nth-child(1)'); await click('.amt-pill:nth-child(3)'); await click('.amt-sheet__foot button') }
  await page.waitForTimeout(400)
  await shot('07-direct')
  console.log(name, JSON.stringify({ errors, dialogs }))
  await ctx.close()
}
await browser.close()
