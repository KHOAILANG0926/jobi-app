import { chromium } from 'playwright'

for (const ev of ['uncaughtException','unhandledRejection']) process.on(ev,e=>{console.log(`::error title=tefal::${String(e?.message||e).slice(0,1500)}`);process.exit(1)})
const base = process.env.BASE_URL || 'http://localhost:4173'
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(base + '/viec-lam/sb-4878', { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('h1.jd2-header__title').waitFor({ timeout: 15000 })
    const result = await page.evaluate(() => {
      const recruit = document.querySelector('.jd2-sec--recruit-grid')
      const conditions = document.querySelector('.jd2-sec--conditions-grid')
      const text = recruit?.textContent || ''
      const desc = document.querySelector('#jd2-section-description')?.textContent || ''
      const cr = conditions?.getBoundingClientRect()
      const rr = recruit?.getBoundingClientRect()
      const directions = [...document.querySelectorAll('a[href*="google.com/maps/dir"]')].map(a => a.getAttribute('href') || '')
      return { text, desc, gap: cr && rr ? rr.top - cr.bottom : null, directions,
        map: !!document.querySelector('.jd2-vmap'),
        title: document.querySelector('h1.jd2-header__title')?.textContent || '' }
    })
    const expected = ['22 - 35', 'THCS', '6 tháng', 'Không yêu cầu']
    for (const word of expected) if (!result.text.includes(word)) throw new Error(width + ' recruitment missing: ' + word)
    if (result.gap === null || result.gap < 30) throw new Error(width + ' section gap too small: ' + result.gap)
    // 길찾기 순서(CLAUDE.md): 승인 좌표가 있으면 좌표, 없으면 주소 글자. Lee 2026-10-30 #4878 좌표 확정 후 좌표가 정상.
    if (!result.directions.some(href => /destination=-?\d+\.\d+,-?\d+\.\d+/.test(href) || decodeURIComponent(href).includes('33 Lý Thái Tổ'))) throw new Error(width + ' no coordinate or street address in directions: ' + JSON.stringify(result.directions))
    if (!result.map) throw new Error(width + ' no VietMap detail container')
    if (['Hiện số', 'Thông tin cơ bản', 'Cá nhân đăng tuyển'].some(t => result.desc.includes(t))) throw new Error(width + ' source portal UI junk displayed')
    console.log('TEFAL_ACCEPTANCE', width, 'gap', result.gap, 'fields', expected.length, 'map', result.map, 'directions', result.directions.length)
    await page.close()
  }
} finally { await browser.close() }
