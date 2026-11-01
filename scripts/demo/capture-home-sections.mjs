// 메인 칸 카드 확인용(Claude가 화면을 직접 보기 위함): PC·모바일 메인의 칸들을 찍는다.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
for (const [name, opt] of [['pc', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...opt, locale: 'vi-VN', geolocation: { latitude: 21.18, longitude: 106.07 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  for (const b of await page.locator('button:has-text("Để sau"), button:has-text("Đóng"), [aria-label="Đóng"]').all()) await b.click({ timeout: 1000 }).catch(() => {})
  const info = await page.evaluate(() => [...document.querySelectorAll('[data-home-section]')].map((s) => ({
    id: s.getAttribute('data-home-section'), cards: s.querySelectorAll('.hsec__grid .scard').length,
    imgs: [...s.querySelectorAll('.hsec__grid img')].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
  })))
  console.log(name, JSON.stringify(info))
  const secs = page.locator('.home-sections')
  if (await secs.count()) {
    await secs.first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(1500)
    await secs.first().screenshot({ path: `out/home-${name}.png` }).catch((e) => console.log('shot fail', e.message))
  } else console.log(name, 'no .home-sections')
  await page.screenshot({ path: `out/home-${name}-full.png`, fullPage: true }).catch(() => {})
  await ctx.close()
}
await browser.close()
