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
  }
}
function problems(result) {
  const errors = []
  if (result.nestedAnchorCount) errors.push('Nested anchor tags')
  if (result.duplicateHrefs.length) errors.push('Duplicate cards: ' + result.duplicateHrefs.join(', '))
  if (!result.totalCards) errors.push('No job cards rendered')
  return errors
}
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  if (baseUrl === '--self-test') {
    const link = id => `<a class="home-card-wrap" href="/viec-lam/${id}">job</a>`
    const section = (cls, ids) => `<section class="${cls}">${ids.map(link).join('')}</section>`
    for (const [name, html, shouldPass] of [
      ['featured only', section('home-featured', ['1','2','3']), true],
      ['regular only', section('home-jobs-grid', ['1','2']), true],
      ['mixed', section('home-featured', ['1']) + section('home-jobs-grid', ['2']), true],
      ['duplicate across sections', section('home-featured', ['1']) + section('home-jobs-grid', ['1']), false],
      ['empty', '<main></main>', false],
    ]) {
      await page.setContent(html)
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
