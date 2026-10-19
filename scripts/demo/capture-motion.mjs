// 데모 움직임 확인용: 공고 상세 근무지 칸을 0.5초 간격으로 찍어 한 장으로 붙인다(Claude가 움직임을 직접 확인하기 위함).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const id = process.argv[2] || '4828'
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
for (const [name, opt] of [['pc', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...opt, locale: 'vi-VN' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  const box = page.locator('.jd2-bike-host').first()
  await box.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(3000)
  const info = await page.evaluate(() => {
    const b = document.querySelector('.jd2-ride-bike'); const s = b && getComputedStyle(b)
    return { bike: !!b, display: s?.display, offsetPath: s?.offsetPath?.slice(0, 120), arrow: !!document.querySelector('.jd2-google-arrow'), map: !!document.querySelector('.jd2-map-tap') }
  })
  console.log(name, JSON.stringify(info))
  for (let i = 0; i < 14; i++) {
    await box.screenshot({ path: `out/${name}-${String(i).padStart(2, '0')}.png` }).catch((e) => console.log('shot fail', e.message))
    await page.waitForTimeout(450)
  }
  await ctx.close()
}
await browser.close()
