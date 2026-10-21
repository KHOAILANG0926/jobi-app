import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage()
let key = ''
p.on('request', (r) => { const m = r.url().match(/maps\.vietmap\.vn\/maps\/[^?]*\?apikey=([^&]+)/); if (m && !key) key = m[1] })
await p.goto('https://viecganban.vn/', { waitUntil: 'networkidle', timeout: 60000 }); await p.locator('.hme-map').first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(6000)
await b.close(); process.stdout.write(key)
