import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile' })
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  const p = await ctx.newPage()
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const shown = await p.locator('.loc-prompt').count()
  console.log(name, 'prompt', shown)
  await p.screenshot({ path: `shot-${name}.png` })
  if (shown) { await p.click('.loc-prompt-later'); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000); console.log(name, 'after later+reload', await p.locator('.loc-prompt').count()) }
}
await b.close()
