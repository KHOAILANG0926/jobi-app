import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile', geolocation: { latitude: 21.18, longitude: 106.07 }, permissions: ['geolocation'] })
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  const p = await ctx.newPage()
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  console.log(name, 'prompt', await p.locator('.loc-prompt').count(), JSON.stringify(await p.locator('.loc-prompt-text').allTextContents()))
  await p.screenshot({ path: `c-${name}-1.png` })
  if (await p.locator('.loc-prompt-allow').count()) await p.click('.loc-prompt-allow')
  await p.waitForTimeout(3000)
  for (const t of ['CTY KDA', 'Tuyển công nhân']) { const el = p.getByText(t, { exact: false }).first(); if (await el.count()) { await el.click().catch(() => {}); await p.waitForTimeout(800); console.log(name, t, JSON.stringify(await p.locator('.hme-tag--distance').allTextContents())) } }
  console.log(name, 'tags', JSON.stringify(await p.locator('.hme-tag--distance').allTextContents()))
  await p.screenshot({ path: `c-${name}-2.png`, fullPage: false })
}
await b.close()
