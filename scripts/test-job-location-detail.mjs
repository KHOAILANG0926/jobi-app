import { chromium } from 'playwright'

// Regression checks for the "상세 근무지 주소" bug: a job's detail page must show
// the actual street/ward-level address text (not just a province name) when one
// is known, and its map markers must correspond 1:1 to that address data — not
// just a link string that happens to contain the right words.
//
// Fixtures (real production data, do not rename/reuse without re-checking):
// - sb-3981: has 2 geocoded job_work_locations rows (OfficeHaus Tân Phú /
//   Onehub Saigon Tower Thủ Đức) — must render both addresses and 2 map markers.
// - sb-4311 (Unilever Củ Chi wastewater operator): the site's own "Địa điểm làm
//   việc" section is a shuttle-bus pickup-point list (not real work sites), so
//   the crawler correctly stores zero job_work_locations rows for it — the page
//   must show only the province-level text plus an explicit "no detailed
//   address found" caption, never a fabricated precise-looking marker.
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })

async function readJobDetail(page, id) {
  await page.goto(`${baseUrl}/viec-lam/${id}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('.jd2-card__title', { timeout: 30_000 })
  await page.waitForTimeout(1200) // let the Leaflet map + markers finish mounting
  return page.evaluate(() => {
    const addrItems = [...document.querySelectorAll('.jd2-map-addr-item .jd2-map-addr')].map((el) => el.textContent?.trim() || '')
    const singleAddr = document.querySelector('.jd2-card__body > .jd2-map-addr')?.textContent?.trim() || null
    const note = document.querySelector('.jd2-map-note')?.textContent?.trim() || ''
    const markerCount = document.querySelectorAll('.leaflet-marker-icon').length
    const unknownMsg = document.querySelector('.jd2-map-unknown')?.textContent?.trim() || null
    return { addrItems, singleAddr, note, markerCount, unknownMsg }
  })
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const failures = []

  // ── sb-3981: 2 real geocoded addresses → 2 addresses shown, 2 markers ──
  const multi = await readJobDetail(page, 'sb-3981')
  if (multi.addrItems.length !== 2) {
    failures.push(`sb-3981: expected 2 address list items, got ${multi.addrItems.length}: ${JSON.stringify(multi.addrItems)}`)
  }
  if (!multi.addrItems.some((a) => a.includes('Tân Thắng'))) {
    failures.push(`sb-3981: address list must include the real street-level text "Tân Thắng", got ${JSON.stringify(multi.addrItems)}`)
  }
  if (!multi.addrItems.some((a) => a.includes('Onehub Saigon Tower'))) {
    failures.push(`sb-3981: address list must include the real street-level text "Onehub Saigon Tower", got ${JSON.stringify(multi.addrItems)}`)
  }
  if (multi.markerCount !== 2) {
    failures.push(`sb-3981: expected 2 map markers (1 per real address), got ${multi.markerCount}`)
  }
  if (!multi.note.includes('2 địa điểm làm việc')) {
    failures.push(`sb-3981: map caption must state 2 work locations, got "${multi.note}"`)
  }

  // ── sb-4311: shuttle-pickup-only source data → province text + explicit "no detailed address" state, no fabricated precise marker ──
  const single = await readJobDetail(page, 'sb-4311')
  if (single.addrItems.length !== 0) {
    failures.push(`sb-4311: must have no per-address list (shuttle pickup points are not real work sites), got ${JSON.stringify(single.addrItems)}`)
  }
  if (!single.singleAddr || !single.singleAddr.includes('Hồ Chí Minh')) {
    failures.push(`sb-4311: expected the single displayed location text to include "Hồ Chí Minh", got ${JSON.stringify(single.singleAddr)}`)
  }
  if (!single.note.includes('Không tìm thấy địa chỉ làm việc chi tiết')) {
    failures.push(`sb-4311: map caption must explicitly say no detailed address was found, got "${single.note}"`)
  }
  if (single.markerCount !== 1) {
    failures.push(`sb-4311: expected exactly 1 (approximate, province-level) marker, got ${single.markerCount}`)
  }

  await page.close()

  console.log(JSON.stringify({ multi, single }, null, 2))
  if (failures.length) throw new Error(failures.join('; '))
  console.log('✅ job location detail: sb-3981 shows real street-level addresses + 2 markers, sb-4311 shows honest "no detailed address" state')
} finally {
  await browser.close()
}
