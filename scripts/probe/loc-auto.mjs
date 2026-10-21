import { chromium } from 'playwright'
const b = await chromium.launch()
// 1) 처음 방문(권한 묻기 상태) → 창 + 안내 문구
let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }) })
let p = await ctx.newPage()
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500)
console.log('first visit prompt', await p.locator('.loc-prompt').count(), JSON.stringify(await p.locator('.loc-prompt-note').allTextContents()))
await p.screenshot({ path: 'la-first.png' })
// 2) 이미 허용한 기기 → 창 없이 위치 사용
ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, geolocation: { latitude: 21.168, longitude: 106.062 }, permissions: ['geolocation'] })
await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }) })
p = await ctx.newPage()
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000)
console.log('granted device prompt', await p.locator('.loc-prompt').count(), 'location used:', await p.getByText('Vị trí hiện tại của bạn').count())
await b.close()
