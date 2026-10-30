import { chromium } from 'playwright'
const b = await chromium.launch()
for (const id of ['4879', '4878', '4824', '4828', '4982']) for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto('https://www.viecganban.vn/viec-lam/sb-' + id, { waitUntil: 'networkidle', timeout: 60000 })
  const r = await p.evaluate(() => { const m = document.querySelector('.jd2-vmap'); const a = [...document.querySelectorAll('a.jd2-map-dir--google')]
    return { btn: a.length, belowMap: m ? a.map(x => !!(m.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING)) : 'no map', old: document.querySelectorAll('.jd2-map-gmaps-links').length } })
  console.log(`::error title=${id} ${w}::${JSON.stringify(r)}`)
}
await b.close()
