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
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  // Let JobsContext's paginated fetch (up to a couple thousand rows over
  // 1-2 requests) finish before reading the DOM.
  await page.waitForSelector('.home-jobs-grid .home-card-wrap', { timeout: 30_000 })
  await page.waitForTimeout(1500)

  const result = await page.evaluate(() => {
    const nestedAnchorCount = document.querySelectorAll('a a').length
    const cardLinks = [...document.querySelectorAll('.home-jobs-grid .home-card-wrap')]
    const hrefs = cardLinks.map((el) => el.getAttribute('href') || '')
    const seen = new Set()
    const duplicates = new Set()
    for (const href of hrefs) {
      if (seen.has(href)) duplicates.add(href)
      seen.add(href)
    }
    return {
      nestedAnchorCount,
      totalCards: hrefs.length,
      uniqueCards: seen.size,
      duplicateHrefs: [...duplicates],
    }
  })

  await page.close()

  const failures = []
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
} finally {
  await browser.close()
}
