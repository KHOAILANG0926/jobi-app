import { chromium } from 'playwright'
const pts = { 'sb-4828': { kind: 'area', lat: 21.156843910000077, lng: 106.12752774200004, source: 'VietMap ward cache phuong:phuong lieu||bac ninh', checkedAt: '2026-10-08T06:40:06.349Z' },
  'sb-4824': { kind: 'area', lat: 21.1965731, lng: 105.9932563, source: 'VietMap geocode (KCN)', checkedAt: '2026-10-20T15:00:08Z' } }
const b = await chromium.launch()
for (const id of [4824, 4828]) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } })
  const p = await ctx.newPage()
  await p.route('**/api/map-locations*', (r) => { const q = new URL(r.request().url()).searchParams.get('ids'); const out = {}; for (const i of q.split(',')) if (pts[`sb-${i}`]) out[`sb-${i}`] = pts[`sb-${i}`]; r.fulfill({ contentType: 'application/json', body: JSON.stringify({ points: out }) }) })
  await p.route('**/api/ward-area*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ lat: 21.156843910000077, lng: 106.12752774200004, at: 'x' }) }))
  await p.goto(`http://localhost:4173/viec-lam/sb-${id}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(4000)
  const info = await p.evaluate(() => ({ markers: document.querySelectorAll('.jd2-vmap [class*=marker]').length, vmaps: document.querySelectorAll('.jd2-vmap').length, notes: [...document.querySelectorAll('.jd2-map-pending-note')].map((e) => e.textContent) }))
  console.log(id, JSON.stringify(info))
  const sec = p.locator('#jd-sec-location'); if (await sec.count()) await sec.screenshot({ path: `d-${id}.png` })
}
await b.close()
