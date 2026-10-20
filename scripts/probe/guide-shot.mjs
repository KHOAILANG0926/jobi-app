import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile' })
  await ctx.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
    navigator.geolocation.getCurrentPosition = () => {} // 브라우저 팝업이 떠 있는 상태 흉내(응답 없음)
    if (navigator.permissions) navigator.permissions.query = async () => ({ state: 'prompt' })
  })
  const p = await ctx.newPage()
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await p.click('.loc-prompt-allow')
  await p.waitForTimeout(600)
  console.log(name, 'guide', await p.locator('.loc-guide').count())
  await p.screenshot({ path: `guide-${name}.png` })
}
await b.close()
