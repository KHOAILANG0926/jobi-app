// 메인 칸 카드 확인용(Claude가 화면을 직접 보기 위함): PC·모바일 메인의 칸들을 찍는다.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
for (const [name, opt] of [['pc', { viewport: { width: 1366, height: 900 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...opt, locale: 'vi-VN', geolocation: { latitude: 21.18, longitude: 106.07 }, permissions: ['geolocation'] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(4000)
  for (const b of await page.locator('button:has-text("Để sau"), button:has-text("Đóng"), [aria-label="Đóng"]').all()) await b.click({ timeout: 1000 }).catch(() => {})
  const info = await page.evaluate(() => [...document.querySelectorAll('[data-home-section]')].map((s) => ({
    id: s.getAttribute('data-home-section'), cards: s.querySelectorAll('.hsec__grid .scard').length,
    imgs: [...s.querySelectorAll('.hsec__grid img')].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
  })))
  console.log(name, JSON.stringify(info))
  const logos = await page.evaluate(() => [...document.querySelectorAll('.jc')].map((c) => ({ company: c.querySelector('.jc__company')?.textContent, img: c.querySelector('.jc__logo-wrap img')?.getAttribute('src') ?? null, ok: !!c.querySelector('.jc__logo-wrap img') && c.querySelector('.jc__logo-wrap img').complete && c.querySelector('.jc__logo-wrap img').naturalWidth > 0, text: c.querySelector('.jc__logo-text')?.textContent ?? null })))
  console.log(name, 'LOGOS', JSON.stringify(logos))
  const brandReq = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /job_brand/.test(e.name)).map((e) => e.name.slice(0, 120)))
  console.log(name, 'BRAND_REQ', JSON.stringify(brandReq))
  const secs = page.locator('.home-sections')
  if (await secs.count()) {
    // 상단 고정 메뉴가 칸 제목을 가리지 않게 고정 요소를 잠시 숨기고 찍는다(화면 자체는 그대로).
    await page.addStyleTag({ content: 'header, .site-header, [class*="sticky"], [style*="position: fixed"], [style*="position:sticky"] { position: static !important; }' }).catch(() => {})
    await secs.first().scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(1500)
    await secs.first().screenshot({ path: `out/home-${name}.png` }).catch((e) => console.log('shot fail', e.message))
  } else console.log(name, 'no .home-sections')
  await page.screenshot({ path: `out/home-${name}-full.png`, fullPage: true }).catch(() => {})
  if (name === 'mobile') {
    // 2026-11-03 Lee "3 진행": 모바일 데모 확인 3가지를 숫자·사진으로 남긴다.
    // ① 옆으로 넘기는 칸이 처음에 몇 쪽인지 ② 지도 위 필터 줄에서 화면에 다 보이는 버튼 ③ "Xem danh sách" 누른 뒤 목록 탭.
    const pages = await page.evaluate(() => [...document.querySelectorAll('.discovery-featured')].map((s) => ({
      id: s.getAttribute('data-section'), paging: s.querySelector('.discovery-carousel__paging > span')?.textContent ?? null,
      head: s.querySelector('.discovery-section-head span')?.textContent ?? null, scrollLeft: s.querySelector('.discovery-carousel')?.scrollLeft ?? null })))
    console.log('mobile PAGES', JSON.stringify(pages))
    const rail = await page.evaluate(() => { const r = document.querySelector('.hme-mobile-toolbar__filters'); if (!r) return null; const box = r.getBoundingClientRect()
      return { scrollWidth: r.scrollWidth, clientWidth: r.clientWidth, buttons: [...r.querySelectorAll('button')].map((b) => { const x = b.getBoundingClientRect(); return { text: b.textContent?.trim(), fullyVisible: x.left >= box.left - 1 && x.right <= box.right + 1 } }) } })
    console.log('mobile FILTER_RAIL', JSON.stringify(rail))
    const listBtn = page.locator('.hme-mobile-summary').first()
    if (await listBtn.count()) {
      await listBtn.scrollIntoViewIfNeeded().catch(() => {})
      await listBtn.click({ timeout: 3000 }).catch((e) => console.log('list click fail', e.message))
      await page.waitForTimeout(1500)
      const list = await page.evaluate(() => ({ mapHidden: getComputedStyle(document.querySelector('.hme__map') ?? document.body).display === 'none',
        cards: document.querySelectorAll('.hme-mobile-list .discovery-job').length, head: document.querySelector('.hme-mobile-list .discovery-section-head')?.textContent ?? null }))
      console.log('mobile LIST_TAB', JSON.stringify(list))
      const box = page.locator('.hme').first()
      await box.screenshot({ path: 'out/home-mobile-list.png' }).catch((e) => console.log('list shot fail', e.message))
    } else console.log('mobile LIST_TAB no summary button')
  }
  await ctx.close()
}
await browser.close()
