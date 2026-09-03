import { chromium } from 'playwright'

// Regression checks for the "상세 근무지 주소" bug: a job's detail page must show
// the actual street/ward-level address text (not just a province name) when one
// is known, and its map markers must correspond 1:1 to that address data — not
// just a link string that happens to contain the right words.
//
// Deliberately NOT tied to specific job ids (a prior version hardcoded sb-3981/
// sb-4311, which broke the moment those ids were no longer in the DB — e.g.
// after a bulk cleanup). Instead this walks whatever jobs are currently on the
// home page and checks a data-independent structural invariant: for every job
// detail page, exactly one of these three states must hold, and the DOM must
// be internally consistent about which one it's in.
//
//   A. Multiple real addresses  — addrItems.length > 0
//      -> markerCount === addrItems.length, caption mentions that count,
//         no "unknown location" message, no single-address block.
//   B. One resolved location (province-level or a single exact address)
//      — singleAddr present, no addrItems
//      -> markerCount === 1, no "unknown location" message.
//   C. No location info at all — unknownMsg present
//      -> no map rendered at all: markerCount === 0, no addrItems, no singleAddr.
//
// This still catches the original bug class (a fabricated marker for a
// province-only job, or a nested-list count mismatch) without depending on
// which specific ids happen to exist when CI runs.
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const MAX_JOBS_TO_CHECK = 12
const browser = await chromium.launch({ headless: true })

async function readJobDetail(page, href) {
  await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('.jd2-card__title', { timeout: 30_000 })
  await page.waitForTimeout(1200) // let the Leaflet map + markers finish mounting
  return page.evaluate(() => {
    const addrItems = [...document.querySelectorAll('.jd2-map-addr-item .jd2-map-addr')].map((el) => el.textContent?.trim() || '')
    const singleAddr = document.querySelector('.jd2-card__body > .jd2-map-addr')?.textContent?.trim() || null
    const note = document.querySelector('.jd2-map-note')?.textContent?.trim() || ''
    const markerCount = document.querySelectorAll('.leaflet-marker-icon').length
    const unknownMsg = document.querySelector('.jd2-map-unknown')?.textContent?.trim() || null
    // "확인 불가" 상태에서는 안내 문구뿐 아니라 지도 자체, "지도 보기"/"길찾기"
    // 버튼까지 전부 없어야 한다 — 안내 문구만 보고 통과시키면 지도/버튼은
    // 여전히 렌더링되는 회귀를 놓친다.
    const mapContainerCount = document.querySelectorAll('.job-location-map, .leaflet-container').length
    const gmapsLinkCount = [...document.querySelectorAll('.jd2-map-gmaps-links a')].length
    const viewOnMapCount = [...document.querySelectorAll('.jd2-map-gmaps-links a')].filter((a) => (a.textContent || '').includes('bản đồ lớn')).length
    const directionsCount = [...document.querySelectorAll('.jd2-map-gmaps-links a')].filter((a) => (a.textContent || '').includes('Chỉ đường')).length
    return { addrItems, singleAddr, note, markerCount, unknownMsg, mapContainerCount, gmapsLinkCount, viewOnMapCount, directionsCount }
  })
}

function checkInvariants(href, d) {
  const failures = []
  const states = [d.addrItems.length > 0, !!d.singleAddr, !!d.unknownMsg]
  const activeStates = states.filter(Boolean).length

  if (activeStates === 0) {
    failures.push(`${href}: no location state matched at all (no address list, no single address, no unknown message) — page rendered nothing`)
    return failures
  }
  if (activeStates > 1) {
    failures.push(`${href}: more than one location state active at once (contradictory DOM): ${JSON.stringify(d)}`)
    return failures
  }

  if (d.addrItems.length > 0) {
    // State A: multiple real addresses.
    if (d.markerCount !== d.addrItems.length) {
      failures.push(`${href}: address list has ${d.addrItems.length} item(s) but map shows ${d.markerCount} marker(s) — must match 1:1`)
    }
    if (d.addrItems.some((a) => !a || a.length < 5)) {
      failures.push(`${href}: address list contains an empty/too-short entry: ${JSON.stringify(d.addrItems)}`)
    }
    if (d.addrItems.length > 1 && !d.note.includes(String(d.addrItems.length))) {
      failures.push(`${href}: caption must mention the work-location count (${d.addrItems.length}), got "${d.note}"`)
    }
  } else if (d.singleAddr) {
    // State B: one resolved point (province-level approximate, or a single exact address).
    if (d.markerCount !== 1) {
      failures.push(`${href}: single-location state must render exactly 1 marker, got ${d.markerCount}`)
    }
    if (!d.singleAddr || d.singleAddr.length < 2) {
      failures.push(`${href}: single address text is empty/too short: ${JSON.stringify(d.singleAddr)}`)
    }
  } else {
    // State C: no location info at all — must not fabricate a marker, and
    // must not render ANY map/marker/view-on-map/directions affordance —
    // checking the caption text alone would miss a regression where the
    // map (or its buttons) still renders despite the "unknown" message.
    if (d.markerCount !== 0) {
      failures.push(`${href}: "unknown location" state must render NO map markers, got ${d.markerCount}`)
    }
    if (d.mapContainerCount !== 0) {
      failures.push(`${href}: "unknown location" state must render NO map container at all, got ${d.mapContainerCount}`)
    }
    if (d.gmapsLinkCount !== 0) {
      failures.push(`${href}: "unknown location" state must show NO "xem bản đồ/chỉ đường" links, got ${d.gmapsLinkCount}`)
    }
    if (d.viewOnMapCount !== 0) {
      failures.push(`${href}: "unknown location" state must show NO "Xem trên bản đồ lớn" button, got ${d.viewOnMapCount}`)
    }
    if (d.directionsCount !== 0) {
      failures.push(`${href}: "unknown location" state must show NO "Chỉ đường" button, got ${d.directionsCount}`)
    }
  }
  return failures
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('.home-jobs-grid .home-card-wrap', { timeout: 30_000 })
  await page.waitForTimeout(1000)
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.home-jobs-grid .home-card-wrap')].map((el) => el.getAttribute('href') || '').filter(Boolean),
  )

  if (hrefs.length === 0) {
    throw new Error('no job cards found on the home page at all — cannot run the location-detail structural check')
  }

  const toCheck = hrefs.slice(0, MAX_JOBS_TO_CHECK)
  const results = []
  const failures = []
  for (const href of toCheck) {
    const d = await readJobDetail(page, href)
    results.push({ href, ...d })
    failures.push(...checkInvariants(href, d))
  }

  await page.close()

  console.log(JSON.stringify(results, null, 2))
  console.log(`checked ${toCheck.length}/${hrefs.length} job detail page(s)`)
  if (failures.length) throw new Error(failures.join('; '))
  console.log('✅ job location detail: every checked job is in exactly one consistent location state (multi-address/single/unknown), markers match address counts')
} finally {
  await browser.close()
}
