// Test-only fixtures: never included in the production app or public job data.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// 하단 Hình ảnh tuyển dụng은 대표 사진 선택과 무관하게 전체 목록을 유지한다.
const detailSource = readFileSync('src/pages/JobDetail.tsx', 'utf8')
assert.ok(detailSource.includes('const extraImages = (job.images ?? []).map(jobImagePublicUrl).filter((u): u is string => !!u)'), 'lower gallery keeps its existing conversion of all stored images')
assert.ok(detailSource.includes('<ImageGallery images={extraImages} title={job.title} />'), 'lower gallery still renders its independent full image list')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let browser
try {
  const { default: JobCard } = await server.ssrLoadModule('/src/components/JobCard.tsx')
  const data = { company: 'CTY KDA', title: 'tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', location: 'KCN Yên Phong, Bắc Ninh', category: 'san_xuat_xay_dung', salary: '310k/11h ca ngày', postedAt: '2026-10-16' }
  const cases = [
    { id: 'test-image', imageUrl: 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/layout-test.png' },
    { id: 'test-no-image' },
    { id: 'test-rejected-image', imageUrl: 'https://external.invalid/poster.png' },
    { id: 'test-first-stored-image', images: ['layout-first.png'] },
    { id: 'test-rejected-with-stored-image', imageUrl: 'https://external.invalid/poster.png', images: ['layout-first.png'] },
  ]
  const cards = cases.map(job => renderToStaticMarkup(createElement(JobCard, { job: { ...data, ...job }, isApplied: false })))
  // This fails on the original bug, before any production edit.
  for (const [i, html] of cards.entries()) assert.match(html, /class="jc__logo-wrap"/, `case ${cases[i].id} must preserve poster slot`)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.route('https://edhuesdnuxlbcfephutq.supabase.co/**', route => route.abort())
  const styles = readFileSync('src/index.css', 'utf8') + '\n' + readFileSync('src/components/JobCard.css', 'utf8')
  for (const width of [360, 390, 412, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    await page.setContent(`<style>${styles}\n#test-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:${width < 600 ? width - 32 : 1270}px} @media(max-width:600px){#test-cards{grid-template-columns:1fr}}</style><div id="test-cards">${cards.join('')}</div>`)
    const bounds = await page.locator('.jc').evaluateAll(cards => cards.map(card => {
      const origin = card.getBoundingClientRect()
      return Object.fromEntries(['.jc__logo-wrap','.jc__identity','.jc__title','.jc__footer'].map(selector => {
        const b = card.querySelector(selector).getBoundingClientRect()
        return [selector, [b.x-origin.x, b.y-origin.y, b.width, b.height].map(n => Math.round(n*100)/100)]
      }))
    }))
    assert.deepEqual(bounds[1], bounds[0], `missing image layout at ${width}px`)
    assert.deepEqual(bounds[2], bounds[0], `rejected image layout at ${width}px`)
    assert.deepEqual(bounds[3], bounds[0], `stored image layout at ${width}px`)
    assert.deepEqual(bounds[4], bounds[0], `rejected imageUrl with stored image layout at ${width}px`)
    for (const index of [3, 4]) assert.equal(await page.locator('.jc__logo').nth(index).getAttribute('src'), 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/layout-first.png', 'stored image is converted and selected before the industry fallback')
    // 2026-11-02 Lee "로고·사진 없는 공고는 업종 사진으로 대신(사람인처럼)": 빈 로고 자리만 업종 대표 사진(public/images/industry),
    // 카드 틀·크기는 그대로. 공고 사진처럼 꾸미지 않고 jc__logo--photo로 구분.
    assert.equal(await page.locator('.jc__logo').count(), 5, 'poster + 2 stored images + 2 industry photos in the same logo slot')
    assert.equal(await page.locator('.jc__logo--photo').count(), 2, 'missing or rejected image uses the industry photo')
    assert.ok((await page.locator('.jc__logo--photo').evaluateAll(els => els.map(e => e.getAttribute('src')))).every(src => src?.startsWith('/images/industry/')), 'industry photo comes from our own folder')
    console.log(`JobCard ${width}px: image/missing/blocked-image geometry identical`)
  }
  // Lee 2026-10-30: 여러 직무 공고는 급여 칸 안에서만 직무별 2줄 — 이미지·회사·제목 자리는 기준 카드와 같아야 한다.
  const multi = renderToStaticMarkup(createElement(JobCard, { job: { ...data, id: 'test-multi-role', salary: 'Theo vị trí — xem chi tiết',
    description: 'CÔ RỬA BÁT FULL TIME — Lương thỏa thuận + thưởng\nNHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h' }, isApplied: false }))
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    await page.setContent(`<style>${styles}\n#test-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:${width < 600 ? width - 32 : 1270}px} @media(max-width:600px){#test-cards{grid-template-columns:1fr}}</style><div id="test-cards">${cards[1]}${multi}</div>`)
    const bounds = await page.locator('.jc').evaluateAll(cards => cards.map(card => {
      const origin = card.getBoundingClientRect()
      return Object.fromEntries(['.jc__logo-wrap','.jc__identity','.jc__title'].map(selector => {
        const b = card.querySelector(selector).getBoundingClientRect()
        return [selector, [b.x-origin.x, b.y-origin.y, b.width, b.height].map(n => Math.round(n*100)/100)]
      }))
    }))
    assert.deepEqual(bounds[1], bounds[0], `multi-role card frame at ${width}px`)
    const lines = await page.locator('.jc').nth(1).locator('.jc__salary > span').allInnerTexts()
    assert.deepEqual(lines, ['₫ Xem lương theo vị trí'], 'multi-role: one gray line (2026-11-01 Lee 알바몬 구성)')
    const meta = await page.locator('.jc').nth(0).locator('.jc__meta').innerText()
    assert.equal(meta, 'KCN Yên Phong, Bắc Ninh', 'short area (no house number)')
    console.log(`JobCard ${width}px: multi-role one line inside the same frame`)
  }
  // 2026-11-01 Lee(알바몬): 지급 단위 이름표 색 — 월급 빨강, 시급·연봉 파랑, 일급 보라, 금액 회색
  const payCards = [['month', '5.500.000đ/tháng', 'month'], ['hour', '23.000 – 25.000 VNĐ/giờ', 'hour'], ['day', '310k/11h ca ngày', 'day']]
    .map(([id, salary, salaryPeriod]) => renderToStaticMarkup(createElement(JobCard, { job: { ...data, id: 'pay-' + id, salary, salaryPeriod }, isApplied: false })))
  await page.setContent(`<style>${styles}</style><div>${payCards.join('')}</div>`)
  const colors = await page.locator('.jc').evaluateAll(cards => cards.map(c => [getComputedStyle(c.querySelector('.jc__pay-label')).color, getComputedStyle(c.querySelector('.jc__pay-amount')).color]))
  assert.deepEqual(colors, [['rgb(229, 57, 53)', 'rgb(75, 85, 99)'], ['rgb(26, 115, 232)', 'rgb(75, 85, 99)'], ['rgb(124, 58, 237)', 'rgb(75, 85, 99)']], 'pay unit label colors and gray amount')
  console.log('JobCard: pay unit label colors (month red, hour blue, day purple, amount gray)')
  // 2026-11-01 Lee(브랜드 로고 수평 전개): 등록 브랜드 공고는 로고 칸에 브랜드 공식 사이트 아이콘, 칸 크기는 그대로.
  const { BrandsContext } = await server.ssrLoadModule('/src/context/BrandsContext.tsx')
  const brand = { id: 1, name: 'Highlands Coffee', matchKeys: ['Highlands Coffee'], category: 'cafe', linkTo: 'Highlands Coffee', domain: 'highlandscoffee.com.vn', initial: 'H', color: '#b22830', featured: true }
  const branded = renderToStaticMarkup(createElement(BrandsContext.Provider, { value: { brands: [brand], loading: false, refreshBrands: async () => {} } },
    createElement(JobCard, { job: { ...data, id: 'brand', company: 'Highlands Coffee Mường Thanh Bắc Ninh' }, isApplied: false })))
  assert.match(branded, /favicons\?sz=128&amp;domain=highlandscoffee\.com\.vn/, 'brand job shows the brand logo')
  await page.setViewportSize({ width: 1366, height: 844 })
  await page.setContent(`<style>${styles}\n#test-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:1270px}</style><div id="test-cards">${cards[1]}${branded}</div>`)
  const logoBoxes = await page.locator('.jc__logo-wrap').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] }))
  assert.deepEqual(logoBoxes[1], logoBoxes[0], 'brand logo keeps the same logo slot size')
  console.log('JobCard: brand logo in the same logo slot')
  // 2026-11-07 Lee "2번으로 하고 문제는 상호명이 긴거야"→OK: 카드 상호는 회사 형태 낱말 빼고 최대 2줄, 지점은 지역 줄("지점, 성"), 로고 칸 크기 그대로.
  const longName = renderToStaticMarkup(createElement(JobCard, { job: { ...data, id: 'long-name', company: 'CÔNG TY CỔ PHẦN BẤT ĐỘNG SẢN PHÚC LỘC VINHOMES OLYMPIC TRỐNG ĐỒNG MIỀN BẮC VIỆT NAM', location: 'Kinh Bắc, Bắc Ninh' }, isApplied: false }))
  const branchCard = renderToStaticMarkup(createElement(JobCard, { job: { ...data, id: 'branch', company: 'nhẹ cafe – Bách Nghệ Kinh Bắc', title: 'nhẹ cafe Bách Nghệ Kinh Bắc tuyển nhân viên pha chế & phục vụ', location: '128 Đ. Triệu Việt Vương, P. Võ Cường, Bắc Ninh' }, isApplied: false }))
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    await page.setContent(`<style>${styles}\n#test-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:${width < 600 ? width - 32 : 1270}px} @media(max-width:600px){#test-cards{grid-template-columns:1fr}}</style><div id="test-cards">${cards[1]}${longName}${branchCard}</div>`)
    const company = page.locator('.jc__company')
    assert.ok(!/CÔNG TY|CỔ PHẦN/.test(await company.nth(1).innerText()), `legal form removed on card at ${width}px`)
    const lines = await company.nth(1).evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
    assert.ok(lines <= 2, `company name at most 2 lines at ${width}px (got ${lines})`)
    assert.equal(await company.nth(2).innerText(), 'nhẹ cafe', 'shop name only')
    assert.equal(await page.locator('.jc__meta').nth(2).innerText(), 'Bách Nghệ Kinh Bắc, Bắc Ninh', 'branch goes to the location line')
    assert.ok(!/nhẹ cafe|Bách Nghệ/i.test(await page.locator('.jc__title').nth(2).innerText()), 'title does not repeat shop or branch')
    const logos = await page.locator('.jc__logo-wrap').evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)] }))
    assert.deepEqual(logos[1], logos[0], `logo slot unchanged for long name at ${width}px`)
    console.log(`JobCard ${width}px: card company ≤2 lines, legal form removed, branch on location line`)
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
