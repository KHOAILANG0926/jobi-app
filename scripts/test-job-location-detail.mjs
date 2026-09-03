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
//      -> markerCount/directionsCount must be 0-or-1 together (never a lone
//         directions button without a marker, or a marker without directions).
//   C. No location info at all — unknownMsg present
//      -> no map rendered at all: markerCount === 0, no addrItems, no singleAddr.
//
// On top of the structural invariant, this ALSO cross-checks State B against
// the real Supabase data for that job (via the public anon key, same one the
// shipped frontend bundle already uses client-side — not a secret): a job with
// zero job_work_locations rows AND no local_jobs.lat/lng must render ZERO
// markers/map-container/gmaps-links/directions on production — this is exactly
// the legacy-fallback bug Codex found live on sb-4366/sb-4367/sb-4368 (map +
// directions still shown despite no verified work location).
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const MAX_JOBS_TO_CHECK = 12
const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'

async function fetchGroundTruth(numericId) {
  const headers = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  const [jobRows, locRows] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/local_jobs?id=eq.${numericId}&select=lat,lng`, { headers }).then((r) => r.json()),
    fetch(`${SUPABASE_URL}/rest/v1/job_work_locations?job_id=eq.${numericId}&select=lat,lng`, { headers }).then((r) => r.json()),
  ])
  const job = Array.isArray(jobRows) ? jobRows[0] : null
  const workLocations = Array.isArray(locRows) ? locRows : []
  return {
    hasDirectCoords: !!job && job.lat != null && job.lng != null,
    workLocationCount: workLocations.length,
    mappableWorkLocationCount: workLocations.filter((r) => r.lat != null && r.lng != null).length,
  }
}

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

function checkInvariants(href, d, truth) {
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
    if (truth && truth.workLocationCount === 0) {
      failures.push(`${href}: DOM shows ${d.addrItems.length} address item(s) but job_work_locations has 0 rows in the DB — contradicts the source data`)
    }
  } else if (d.singleAddr) {
    // State B: one resolved point. Structural pairing: a marker never appears
    // without directions, and directions never appears without a marker.
    if ((d.markerCount > 0) !== (d.directionsCount > 0)) {
      failures.push(`${href}: marker/directions must appear together or not at all, got markerCount=${d.markerCount} directionsCount=${d.directionsCount}`)
    }
    if (d.markerCount > 1) {
      failures.push(`${href}: single-location state must render at most 1 marker, got ${d.markerCount}`)
    }
    if (!d.singleAddr || d.singleAddr.length < 2) {
      failures.push(`${href}: single address text is empty/too short: ${JSON.stringify(d.singleAddr)}`)
    }
    // Ground-truth cross-check: no job_work_locations rows AND no direct
    // local_jobs.lat/lng means there is NO verified work location at all —
    // production must not fabricate a marker/map/directions from a guessed
    // region-center coordinate (the exact bug Codex found on sb-4366/67/68).
    if (truth && truth.workLocationCount === 0 && !truth.hasDirectCoords) {
      if (d.markerCount !== 0) failures.push(`${href}: no verified work location in DB (0 job_work_locations rows, no local_jobs.lat/lng) but map shows ${d.markerCount} marker(s)`)
      if (d.mapContainerCount !== 0) failures.push(`${href}: no verified work location in DB but map container is rendered (count=${d.mapContainerCount})`)
      if (d.directionsCount !== 0) failures.push(`${href}: no verified work location in DB but a "Chỉ đường" directions button is rendered`)
      if (d.gmapsLinkCount > 1) failures.push(`${href}: no verified work location in DB but ${d.gmapsLinkCount} gmaps link(s) rendered (expected at most 1 search-only link)`)
    }
    if (truth && truth.hasDirectCoords) {
      if (d.markerCount !== 1) failures.push(`${href}: local_jobs has direct lat/lng but map shows ${d.markerCount} marker(s), expected 1`)
      if (d.directionsCount !== 1) failures.push(`${href}: local_jobs has direct lat/lng but directions button count is ${d.directionsCount}, expected 1`)
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
    const idMatch = href.match(/sb-(\d+)/)
    let truth = null
    if (idMatch) {
      try {
        truth = await fetchGroundTruth(idMatch[1])
      } catch (err) {
        console.error(`${href}: could not fetch DB ground truth (${err.message}) — skipping DB cross-check for this job`)
      }
    }
    results.push({ href, ...d, truth })
    failures.push(...checkInvariants(href, d, truth))
  }

  await page.close()

  console.log(JSON.stringify(results, null, 2))
  console.log(`checked ${toCheck.length}/${hrefs.length} job detail page(s)`)
  if (failures.length) throw new Error(failures.join('; '))
  console.log('✅ job location detail: every checked job is in exactly one consistent location state (multi-address/single/unknown), markers match address counts')
} finally {
  await browser.close()
}
