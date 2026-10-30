import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto('https://jobi-demo-mshw1895-6089s-projects.vercel.app/dang-tin', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => ({ title: document.title, legends: [...document.querySelectorAll('legend')].map(l => l.textContent), labels: document.querySelectorAll('.field__label').length,
    map: !!document.querySelector('.vietmap-canvas, canvas'), leaflet: !!document.querySelector('.leaflet-container') }))
  console.log(`::error title=demo ${w}::${JSON.stringify(r)} errs=${errs.join(' | ').slice(0, 300)}`)
}
await b.close()
