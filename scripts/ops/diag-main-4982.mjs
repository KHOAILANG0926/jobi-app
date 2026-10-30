import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const api = []
p.on('response', async r => { const u = r.url(); if (/rest\/v1\/(local_jobs|job_work_locations|rpc\/map_r1)/.test(u) && /4879/.test(u + '')) { try { api.push(u.split('?')[0].split('/').pop() + ' ' + (await r.text()).slice(0, 700)) } catch {} } })
await p.goto('https://www.viecganban.vn/viec-lam/sb-4879', { waitUntil: 'networkidle', timeout: 60000 })
const r = await p.evaluate(() => ({ g: [...document.querySelectorAll('a[href*="google."]')].map(a => a.innerText.trim() + ' => ' + a.getAttribute('href')),
  area: document.querySelector('[id*="location"], .jd2-sec--location, .jd2-vmap')?.closest('section')?.innerText.slice(0, 600) }))
console.log(`::error title=links::${JSON.stringify(r.g)}`)
console.log(`::error title=area::${JSON.stringify(r.area)}`)
console.log(`::error title=api::${api.join(' || ').slice(0, 1800)}`)
await b.close()
