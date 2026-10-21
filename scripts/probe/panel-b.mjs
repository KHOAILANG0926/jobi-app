import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['pc', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
  const p = await ctx.newPage()
  await p.route('**/api/map-locations*', async (r) => { const res = await fetch('https://viecganban.vn' + new URL(r.request().url()).pathname + new URL(r.request().url()).search); r.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() }) })
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  const map = p.locator('.hme-map').first(); await map.scrollIntoViewIfNeeded(); await p.waitForTimeout(7000)
  const pins = p.locator('.hme-map__pin, .hme-map [class*=pin]')
  console.log(name, 'pins', await pins.count())
  if (await pins.count()) { await pins.first().click({ force: true }); await p.waitForTimeout(1500) }
  const panel = p.locator('.hme-job').first()
  console.log(name, 'panel', await panel.count(), JSON.stringify(await p.locator('.hme-job__actions a').allTextContents()), 'blue', await p.locator('.hme-job .jd2-map-dir').count())
  if (await panel.count()) await panel.screenshot({ path: `pb-${name}.png` }); else await p.screenshot({ path: `pb-${name}.png` })
}
await b.close()
