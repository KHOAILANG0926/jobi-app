import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['pc', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile', hasTouch: name === 'mobile', geolocation: { latitude: 21.168, longitude: 106.062 }, permissions: ['geolocation'] })
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  const p = await ctx.newPage()
  await p.goto('https://viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(1500)
  if (await p.locator('.loc-prompt-allow').count()) await p.click('.loc-prompt-allow')
  const map = p.locator('.hme-map').first(); if (await map.count()) await map.scrollIntoViewIfNeeded()
  await p.waitForTimeout(8000)
  const pins = await p.evaluate(() => [...document.querySelectorAll('.hme-map [class*=marker], .hme-map [class*=pin]')].filter((e) => { const r = e.getBoundingClientRect(); const m = document.querySelector('.hme-map').getBoundingClientRect(); return r.width > 0 && r.left >= m.left && r.right <= m.right && r.top >= m.top && r.bottom <= m.bottom }).length)
  console.log(name, 'pins in view', pins)
  if (await map.count()) await map.screenshot({ path: `lf-${name}.png` })
}
await b.close()
