import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.waitForTimeout(60000)
const res = await p.goto('https://www.viecganban.vn/viec-lam/sb-5157', { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(3000)
const r = await p.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, secs: [...document.querySelectorAll('.jd2-sec__title, h2')].map(x => x.textContent).slice(0, 10),
  loc: [...document.querySelectorAll('section')].map(s => s.innerText).find(t => /Khu vực làm việc/.test(t))?.slice(0, 300), dir: [...document.querySelectorAll('a.jd2-map-dir--google')].map(a => a.getAttribute('href')) }))
console.log(`::error title=5157 ${res?.status()}::${JSON.stringify(r)}`)
await p.goto('https://www.viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 })
for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(300) }
console.log(`::error title=main::${JSON.stringify(await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-job-id]')].map(e => e.getAttribute('data-job-id')))]))}`)
await b.close()
