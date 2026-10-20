import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
  const p = await ctx.newPage()
  p.on('response', async (r) => { if (r.url().includes('/api/map-locations')) console.log(name, 'map-locations', r.status(), (await r.text().catch(() => '')).slice(0, 300)) })
  await p.goto('https://viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(4000)
  const panel = await p.locator('.hme-panel, [class*=hme-]').first().count()
  console.log(name, 'imgs', await p.locator('img').count(), 'canvas', await p.locator('canvas').count())
  await p.screenshot({ path: `m-${name}.png`, fullPage: true })
}
await b.close()
