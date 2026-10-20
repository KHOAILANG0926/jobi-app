import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: name === 'mobile', geolocation: { latitude: 21.18, longitude: 106.07 }, permissions: ['geolocation'] })
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  const p = await ctx.newPage()
  // 실제 운영 데이터(map_r1_location_jobs #4828, 2026-10-20 조회)를 그대로 돌려준다 — 로컬 미리보기에는 서버 함수가 없어서
  await p.route('**/api/map-locations*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ points: { 'sb-4828': { kind: 'area', lat: 21.156843910000077, lng: 106.12752774200004, source: 'VietMap ward cache phuong:phuong lieu||bac ninh', checkedAt: '2026-10-08T06:40:06.349Z' } } }) }))
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  console.log(name, 'prompt', await p.locator('.loc-prompt').count(), JSON.stringify(await p.locator('.loc-prompt-text').allTextContents()))
  await p.screenshot({ path: `c-${name}-1.png` })
  if (await p.locator('.loc-prompt-allow').count()) await p.click('.loc-prompt-allow')
  await p.waitForTimeout(3000)
  for (const t of ['Tuyển công nhân sản xuất', 'dây mạng']) { const els = p.getByText(t, { exact: false }); const n = await els.count(); for (let i = 0; i < n; i++) { await els.nth(i).click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(700); const tags = await p.locator('.hme-tag--distance').allTextContents(); if (tags.length) { console.log(name, 'clicked', t, i, JSON.stringify(tags)); break } } }
  const pins = p.locator('[class*=marker], [class*=pin]'); console.log(name, 'pins', await pins.count())
  console.log(name, 'tags', JSON.stringify(await p.locator('.hme-tag--distance').allTextContents()))
  await p.screenshot({ path: `c-${name}-2.png`, fullPage: false })
}
await b.close()
