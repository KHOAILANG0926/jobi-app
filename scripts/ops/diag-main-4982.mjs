import { chromium } from 'playwright'
const b = await chromium.launch()
for (const id of ['4879', '4878', '4824', '4828']) for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto('https://www.viecganban.vn/viec-lam/sb-' + id, { waitUntil: 'networkidle', timeout: 60000 })
  const r = await p.evaluate(() => ({ old: document.querySelectorAll('.jd2-map-gmaps-links').length,
    std: [...document.querySelectorAll('a.jd2-map-dir--google')].map(a => a.getAttribute('href')) }))
  console.log(`::error title=${id} ${w}::${JSON.stringify(r)}`)
}
await b.close()
