import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto('https://www.viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(400) }
  const r = await p.evaluate(() => ({ ids: [...new Set([...document.querySelectorAll('[data-job-id]')].map(e => e.getAttribute('data-job-id')))],
    sal: [...document.querySelectorAll('[data-job-id="sb-4982"] .jc__salary')].map(e => e.innerText.replace(/\n/g, ' / ')).slice(0, 2) }))
  console.log(`::error title=main ${w}::${JSON.stringify(r)}`)
}
await b.close()
