import { chromium } from 'playwright'

// Regression checks for two production bugs found on viecganban.vn:
// 1. Nested <a> tags in job cards (the whole card is a NavLink <a>, and an
//    inner Zalo/"Xem chi tiết" link was also an <a> — invalid HTML, 1,168
//    instances found live).
// 2. Duplicate job cards in the "Tất cả kết quả" list, caused by
//    JobsContext's paginated fetch ordering only by `posted_at` (not stable
//    when many rows share the same date) — the same job could land on two
//    pages.
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const CARD_SELECTOR = '.home-featured .home-card-wrap, .home-jobs-grid .home-card-wrap'
function inspectCards(selector) {
  const links = [...document.querySelectorAll(selector)]
  const hrefs = links.map(el => el.getAttribute('href') || '')
  return {
    nestedAnchorCount: document.querySelectorAll('a a').length,
    totalCards: hrefs.length,
    uniqueCards: new Set(hrefs).size,
    duplicateHrefs: [...new Set(hrefs.filter((href, i) => hrefs.indexOf(href) !== i))],
    // 직무 중심 대표 이미지(2026-11-27): 카드 로고 자리 그림 주소가 깨지지 않았는지(다 받았는데 폭 0인 것만 — 지연 로딩 대기분은 제외).
    // 우리 이미지(/images/…)가 로고 자리에 올 때는 항상 사진 모양(jc__logo--photo, 꽉 채움)이어야 한다 — 고정 배정 이미지가 계산한 사진과 달라도 같은 모양.
    unstyledPhotos: [...document.querySelectorAll('.jc__logo')].filter((img) => (img.getAttribute('src') || '').startsWith('/images/') && !img.classList.contains('jc__logo--photo')).map((img) => img.getAttribute('src')),
    // 카드 썸네일(사용량 정리): 우리 저장소 job-images 그림은 카드 칸(≤96px)에 작은 사본 주소(/storage/v1/render/image/…)로 받는다 — 원본 주소가 그대로 쓰이면
    // 변환 후보가 빠졌거나(회귀) 변환이 실패해 원본으로 넘어간 것이다.
    fullSizeStorageLogos: [...document.querySelectorAll('.jc__logo')].filter((img) => (img.getAttribute('src') || '').includes('/storage/v1/object/public/job-images/')).map((img) => img.getAttribute('src')),
    brokenLogos: [...document.querySelectorAll('.jc__logo')].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute('src')),
  }
}
function problems(result) {
  const errors = []
  if (result.nestedAnchorCount) errors.push('Nested anchor tags')
  if (result.duplicateHrefs.length) errors.push('Duplicate cards: ' + result.duplicateHrefs.join(', '))
  if (result.unstyledPhotos?.length) errors.push('Industry picture without photo styling: ' + result.unstyledPhotos.join(', '))
  if (result.brokenLogos?.length) errors.push('Broken card pictures: ' + result.brokenLogos.join(', '))
  if (result.fullSizeStorageLogos?.length) errors.push('Card picture uses the full-size original instead of the small copy: ' + result.fullSizeStorageLogos.join(', '))
  if (!result.totalCards) errors.push('No job cards rendered')
  return errors
}
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  if (baseUrl === '--self-test') {
    // 그림 주소(/images/…)가 실제로 열리는 가짜 주소에서 열리게 해 '깨진 그림'과 '모양 없는 그림'을 따로 시험한다.
    const FIXTURE_BASE = '<base href="http://fixture.test/">'
    await page.route('http://fixture.test/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }))
    const link = id => `<a class="home-card-wrap" href="/viec-lam/${id}">job</a>`
    const section = (cls, ids) => `<section class="${cls}">${ids.map(link).join('')}</section>`
    for (const [name, html, shouldPass] of [
      ['featured only', section('home-featured', ['1','2','3']), true],
      ['regular only', section('home-jobs-grid', ['1','2']), true],
      ['mixed', section('home-featured', ['1']) + section('home-jobs-grid', ['2']), true],
      ['duplicate across sections', section('home-featured', ['1']) + section('home-jobs-grid', ['1']), false],
      ['empty', '<main></main>', false],
      ['managed picture without photo styling', FIXTURE_BASE + section('home-featured', ['1']) + '<img class="jc__logo" src="/images/industry/khac.jpg">', false],
      ['managed picture with photo styling', FIXTURE_BASE + section('home-featured', ['1']) + '<img class="jc__logo jc__logo--photo" src="/images/industry/khac.jpg">', true],
      ['card picture uses small copy', section('home-featured', ['1']) + '<img class="jc__logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" data-small="1">', true],
      ['card picture uses full-size original', section('home-featured', ['1']) + '<img class="jc__logo" src="http://fixture.test/storage/v1/object/public/job-images/kda/a.png">', false],
      ['broken card picture', section('home-featured', ['1']) + '<img class="jc__logo" src="data:image/png;base64,AAAA">', false],
    ]) {
      await page.setContent(html)
      await page.waitForFunction(() => [...document.images].every((i) => i.complete)).catch(() => {})
      const result = await page.evaluate(inspectCards, CARD_SELECTOR)
      if ((problems(result).length === 0) !== shouldPass) throw new Error('Fixture failed: ' + name)
      console.log('Integrity fixture PASS: ' + name)
    }
    await page.setContent(section('home-featured', ['1']))
    await page.evaluate(() => {
      const inner = document.createElement('a'); inner.href = '/nested'
      document.querySelector('a').append(inner)
    })
    if (!(await page.evaluate(inspectCards, CARD_SELECTOR)).nestedAnchorCount) throw new Error('Nested links must be detected')
    console.log('Integrity fixture PASS: nested anchors rejected')
    process.exitCode = 0
  } else {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  // Let JobsContext's paginated fetch (up to a couple thousand rows over
  // 1-2 requests) finish before reading the DOM.
  await page.waitForSelector(CARD_SELECTOR, { timeout: 30_000 }).catch(error => {
    throw new Error(error.message + (pageErrors.length ? '\nPage errors: ' + pageErrors.join('; ') : ''))
  })
  await page.waitForTimeout(1500)

  const result = await page.evaluate(inspectCards, CARD_SELECTOR)

  await page.close()

  const failures = pageErrors.map(error => `Page error: ${error}`)
  if (result.nestedAnchorCount !== 0) {
    failures.push(`Found ${result.nestedAnchorCount} nested <a> tag(s) — expected 0`)
  }
  if (result.duplicateHrefs.length > 0) {
    failures.push(`Found ${result.duplicateHrefs.length} duplicate job card(s): ${result.duplicateHrefs.slice(0, 10).join(', ')}`)
  }
  if (result.unstyledPhotos?.length) failures.push(`Found card picture(s) without photo styling: ${result.unstyledPhotos.slice(0, 10).join(', ')}`)
  if (result.brokenLogos?.length) failures.push(`Found broken card picture(s): ${result.brokenLogos.slice(0, 10).join(', ')}`)
  if (result.totalCards === 0) {
    failures.push('No job cards rendered at all — page likely failed to load real data')
  }

  console.log(JSON.stringify(result, null, 2))
  if (failures.length) throw new Error(failures.join('; '))
  console.log('✅ job card integrity: no nested <a>, no duplicate cards')
  }
} finally {
  await browser.close()
}
