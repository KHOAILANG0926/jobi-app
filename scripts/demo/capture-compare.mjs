// 전·후 비교: 운영(지금 사이트) vs 데모 같은 화면 같은 크기 → out/cmp-*.png
import { chromium } from 'playwright'
const BEFORE = 'https://www.viecganban.vn'
const AFTER = process.env.BASE_URL || 'http://localhost:4173'
const b = await chromium.launch()
for (const [tag, base] of [['before', BEFORE], ['after', AFTER]]) {
  for (const [n, o] of [['pc', { viewport: { width: 1297, height: 760 } }], ['m', { viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ ...o, locale: 'vi-VN' }); const p = await ctx.newPage()
    await p.goto(base + '/chu-de/ky-tuc-xa', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1500)
    await p.screenshot({ path: `out/cmp-${n}-top-${tag}.png` })
    if (n === 'pc') {
      await p.getByRole('button', { name: 'Mở danh mục Việc làm', exact: true }).hover().catch(() => {}); await p.waitForTimeout(600)
      await p.screenshot({ path: `out/cmp-${n}-menu-${tag}.png` })
      await p.mouse.move(600, 750); await p.waitForTimeout(300)
    }
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(600)
    await p.screenshot({ path: `out/cmp-${n}-foot-${tag}.png` })
    await ctx.close()
  }
}
await b.close()
