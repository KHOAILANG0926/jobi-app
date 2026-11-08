// 바탕 흰색 전·후: 운영(지금) vs 데모 — 메인·상세(KDA·새 틀)·등록·고객센터, PC·휴대폰 → out/bg-*.png
import { chromium } from 'playwright'
const BEFORE = 'https://www.viecganban.vn'
const AFTER = process.env.BASE_URL || 'http://localhost:4173'
const pages = [['home', '/'], ['kda', '/viec-lam/sb-4824'], ['new', '/viec-lam/sb-4828'], ['post', '/dang-tin'], ['area', '/viec-lam/khu-vuc']]
const b = await chromium.launch()
for (const [tag, base] of [['before', BEFORE], ['after', AFTER]]) {
  for (const [n, o] of [['pc', { viewport: { width: 1297, height: 900 } }], ['m', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ ...o, locale: 'vi-VN' })
    for (const [k, path] of pages) {
      const p = await ctx.newPage()
      await p.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(2000)
      await p.getByRole('button', { name: 'Để sau' }).click({ timeout: 2000 }).catch(() => {})
      await p.waitForTimeout(500)
      const h = await p.evaluate(() => document.documentElement.scrollHeight)
      await p.screenshot({ path: `out/bg-${n}-${k}-${tag}.png`, fullPage: true, clip: { x: 0, y: 0, width: o.viewport.width, height: Math.min(h, n === 'pc' ? 2600 : 3200) } })
      await p.close()
    }
    await ctx.close()
  }
}
await b.close()
