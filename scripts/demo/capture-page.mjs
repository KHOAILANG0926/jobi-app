// 데모 화면 전체 촬영(PC·모바일): node scripts/demo/capture-page.mjs /demo/mau-nhanh → out/page-*.png
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
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `out/page-${name}.png`, fullPage: true })
  // 버튼 동작: 조건 적용 → 다음 업종 → 두 번째 템플릿 → 색 바꾸기 → 미리보기
  const click = async (sel) => { const l = page.locator(sel).first(); if (await l.count()) await l.click().catch((e) => errors.push(`click ${sel}: ${e.message}`)); else errors.push(`missing ${sel}`) }
  await click('.amt-apply button')
  await click('.amt-pager button[aria-label="Sau"]')
  await click('.amt-thumbs .amt-thumb:nth-child(2)')
  await click('.amt-color:nth-child(1)')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `out/page-${name}-after.png`, fullPage: true })
  await click(name === 'pc' ? '.amt-previews button:nth-child(1)' : '.amt-previews button:nth-child(2)')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `out/page-${name}-preview.png`, fullPage: true })
  await click('.amt-modal__h button')
  // 직접입력 탭: 열기 → 템플릿 가져오기 → 미리보기
  await click('.amt-tab:nth-child(3)')
  await click('.amt-direct__btns button:nth-child(1)')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `out/page-${name}-direct.png`, fullPage: true })
  await click(name === 'pc' ? '.amt-direct__btns button:nth-child(2)' : '.amt-direct__btns button:nth-child(3)')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `out/page-${name}-direct-preview.png` })
  console.log(name, JSON.stringify({ errors }))
  await ctx.close()
}
await browser.close()
