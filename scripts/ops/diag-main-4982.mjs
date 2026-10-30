import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto('https://www.viecganban.vn/viec-lam/sb-4879', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(() => { const row = document.querySelector('.jd2-benefits'); const tiles = [...document.querySelectorAll('.bai-tile')]
    return { animated: tiles.length, size: tiles[0] ? Math.round(tiles[0].getBoundingClientRect().width) : 0, rowW: row ? Math.round(row.getBoundingClientRect().width) : 0, overflowX: document.documentElement.scrollWidth > innerWidth } })
  console.log(`::error title=4879 ${w}::${JSON.stringify(r)}`)
}
await b.close()
