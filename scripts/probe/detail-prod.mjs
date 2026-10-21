import { chromium } from 'playwright'
const b = await chromium.launch()
for (const id of [4824, 4828]) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } })
  const p = await ctx.newPage()
  await p.goto(`https://viecganban.vn/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 60000 })
  const sec = p.locator('.jd2-vmap').first(); if (await sec.count()) await sec.scrollIntoViewIfNeeded()
  await p.waitForTimeout(8000)
  const info = await p.evaluate(async (id) => {
    const api = await fetch(`/api/map-locations?ids=${id}`).then((r) => r.json())
    return { api: api.points?.[`sb-${id}`] ? [api.points[`sb-${id}`].lat, api.points[`sb-${id}`].lng] : null, markers: document.querySelectorAll('.jd2-vmap [class*=marker]').length, maps: document.querySelectorAll('.jd2-vmap').length }
  }, id)
  console.log(id, JSON.stringify(info))
  if (await sec.count()) await sec.screenshot({ path: `dp-${id}.png` })
}
await b.close()
