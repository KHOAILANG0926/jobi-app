import { chromium } from 'playwright'
const b = await chromium.launch()
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const apis = []
  p.on('response', async r => { const u = r.url(); if (/rest\/v1\/(local_jobs|rpc)/.test(u)) { try { const t = await r.text(); apis.push(u.split('?')[0].split('/').slice(-1)[0] + ' ' + (t.match(/"id":\s*\d+/g) || []).join(',').slice(0, 300)) } catch {} } })
  await p.goto('https://www.viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 1500); await p.waitForTimeout(400) }
  const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/viec-lam/"]')].map(a => a.getAttribute('href')))])
  console.log(`::error title=main ${w}::${JSON.stringify(ids)}`)
  console.log(`::error title=api ${w}::${apis.join(' | ').slice(0, 1500)}`)
  for (const id of ['sb-4824','sb-4828','sb-4878','sb-4879','sb-4982','sb-4880','sb-4881']) {
    const r = await p.goto('https://www.viecganban.vn/viec-lam/' + id, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
    const t = await p.locator('h1').first().textContent({ timeout: 8000 }).catch(() => '(no h1)')
    if (w === 1280) console.log(`::error title=detail ${id}::${r?.status()} ${t}`)
  }
}
await b.close()
