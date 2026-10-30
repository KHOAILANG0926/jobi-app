import { chromium } from 'playwright'
const b = await chromium.launch()
for (const id of ['4879', '4878']) for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const api = []
  p.on('response', async r => { const u = r.url(); if (/rest\/v1\/(job_work_locations|rpc\/map_r1)/.test(u)) { try { api.push(u.split('?')[0].split('/').pop() + ' ' + (await r.text()).slice(0, 500)) } catch {} } })
  await p.goto('https://www.viecganban.vn/viec-lam/sb-' + id, { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 1200); await p.waitForTimeout(400) }
  const r = await p.evaluate(() => ({ g: [...document.querySelectorAll('a[href*="google."]')].map(a => a.innerText.trim().slice(0, 40) + ' => ' + a.getAttribute('href')),
    loc: [...document.querySelectorAll('section, .jd2-sec')].map(s => s.innerText).find(t => /Khu vực làm việc/.test(t))?.slice(0, 500) }))
  console.log(`::error title=${id} ${w} links::${JSON.stringify(r.g)}`)
  if (w === 1280) { console.log(`::error title=${id} loc::${JSON.stringify(r.loc)}`); console.log(`::error title=${id} api::${api.join(' || ').slice(0, 1500)}`) }
}
await b.close()
