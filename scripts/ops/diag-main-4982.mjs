import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto('https://www.viecganban.vn/dang-tin', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(5000)
  const r = await p.evaluate(() => ({ h: [...document.querySelectorAll('.pj-sec__h')].map(x => x.textContent), canvas: !!document.querySelector('canvas'), bar: !!document.querySelector('.pj-bar') }))
  console.log(`::error title=prod ${w}::${JSON.stringify(r)} errs=${errs.join(' | ').slice(0, 300)}`)
}
await b.close()
