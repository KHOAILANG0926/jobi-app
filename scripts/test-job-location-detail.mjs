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
const CARD_SELECTOR = '.home-featured .home-card-wrap, .home-jobs-grid .home-card-wrap'
const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'

function locationGroundTruth(job, workLocations, approvals) {
  const normalize=value=>String(value??'').normalize('NFC').toLowerCase().replace(/\s+/g,' ').trim()
  // Approved coordinates live independently of legacy work-location lat/lng.
  // Count each current work location once, rejecting revoked/stale/imprecise evidence.
  const locations=workLocations.length?workLocations:job?.location?[{raw_address:job.location}]:[]
  const approved=location=>approvals.some(a=>a.status==='approved' &&
    normalize(a.company_snapshot)===normalize(job?.company) &&
    normalize(a.address_snapshot)===normalize(location.raw_address) &&
    ['entrance','building','site'].includes(a.place_precision) &&
    Number.isFinite(a.lat) && Number.isFinite(a.lng))
  const approvedLocationCount=locations.filter(approved).length
  return {
    hasDirectCoords: !!job && job.lat != null && job.lng != null,
    workLocationCount: workLocations.length || approvedLocationCount,
    approvedLocationCount,
    mappableWorkLocationCount: locations.filter(r=>(r.lat!=null && r.lng!=null) || approved(r)).length,
  }
}

async function fetchGroundTruth(numericId) {
  const headers = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  const readRows=async path=>{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers})
    if(!response.ok)throw new Error(`Ground truth HTTP ${response.status}`)
    const rows=await response.json()
    if(!Array.isArray(rows))throw new Error('Ground truth is not a row list')
    return rows
  }
  const [jobRows,workLocations,approvals]=await Promise.all([
    readRows(`local_jobs?id=eq.${numericId}&select=lat,lng,company,location`),
    readRows(`job_work_locations?job_id=eq.${numericId}&select=raw_address,lat,lng`),
    readRows(`job_location_candidates?job_id=eq.${numericId}&status=eq.approved&select=company_snapshot,address_snapshot,lat,lng,place_precision,status`),
  ])
  if(!jobRows[0])throw new Error('Public job missing from ground truth')
  return locationGroundTruth(jobRows[0],workLocations,approvals)
}


async function readJobDetail(page, href) {
  await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('h1.jd2-header__title', { timeout: 30_000 })
  await page.waitForTimeout(1200) // let the Leaflet map + markers finish mounting
  return page.evaluate(() => {
    const addrItems = [...document.querySelectorAll('.jd2-map-addr-item .jd2-map-addr')].map((el) => el.textContent?.trim() || '')
    const singleAddr = document.querySelector('.jd2-card__body > .jd2-map-addr')?.textContent?.trim() || null
    const note = document.querySelector('.jd2-map-note')?.textContent?.trim() || ''
    // A visible marker must not be described as an independently verified factory pin unless that is established.
    // The source location may only be an approximate address/geocode.
    const markerCount = document.querySelectorAll('.leaflet-marker-icon, .jd2-vmap .vietmapgl-marker, .jd2-vmap .maplibregl-marker').length
    const map = document.querySelector('.jd2-vmap')
    const expectedMarkerAttribute = map?.getAttribute('data-expected-marker-count')
    const plannedMarkerCount = expectedMarkerAttribute == null ? null : Number(expectedMarkerAttribute)
    const mapUnavailable = map?.getAttribute('data-map-unavailable') === 'missing-key' && !!document.querySelector('.job-location-map__error')
    const visibleAddresses = [...document.querySelectorAll('.jd2-location-above-map__row span')].map(el => el.textContent?.trim() || '').filter(Boolean)
    const areaNotes = [...document.querySelectorAll('.jd2-map-area-note, .jd2-location-pending-compact .jd2-map-dir-note')].map(el => el.textContent?.trim() || '').join(' ')
    const areaState = !!document.querySelector('.jd2-location-pending-compact, .jd2-map-area-note')
    const unknownMsg = document.querySelector('.jd2-map-unknown')?.textContent?.trim() || null
    // "확인 불가" 상태에서는 안내 문구뿐 아니라 지도 자체, "지도 보기"/"길찾기"
    // 버튼까지 전부 없어야 한다 — 안내 문구만 보고 통과시키면 지도/버튼은
    // 여전히 렌더링되는 회귀를 놓친다.
    const mapContainerCount = document.querySelectorAll('.jd2-vmap, .job-location-map, .leaflet-container').length
    const gmapsLinkCount = [...document.querySelectorAll('.jd2-map-gmaps-links a, .jd2-map-links a')].length
    const viewOnMapCount = [...document.querySelectorAll('.jd2-map-gmaps-links a, .jd2-map-links a')].filter((a) => (a.textContent || '').includes('bản đồ lớn')).length
    const directionsCount = [...document.querySelectorAll('.jd2-map-gmaps-links a, .jd2-map-links a')].filter((a) => (a.textContent || '').includes('Chỉ đường')).length
    const directionsHrefs = [...document.querySelectorAll('.jd2-map-gmaps-links a, .jd2-map-links a')].filter((a) => (a.textContent || '').includes('Chỉ đường')).map((a) => a.getAttribute('href') || '')
    // 2026-10-13 사용자 규칙 "길찾기는 숨기지 않는다": 위치 미확인이면 회사명/지역 글자 검색 길찾기 + 미확인 안내(directionsPlan.ts COMPANY_AREA_NOTE·AREA_ONLY_NOTE)
    const unverifiedDirNote = /chưa xác minh|không phải địa chỉ nơi làm việc/iu.test(document.body.innerText || '')
    return { addrItems, singleAddr, note, markerCount, plannedMarkerCount, mapUnavailable, unknownMsg, mapContainerCount, gmapsLinkCount, viewOnMapCount, directionsCount, directionsHrefs, unverifiedDirNote, visibleAddresses, areaNotes, areaState }
  })
}

// 위치 미확인 공고의 글자 검색 길찾기(좌표 아님) 1개 + 미확인 안내 = 사용자 규칙(2026-10-13)상 허용되는 상태
const coordDirections = (h) => /destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?(&|$)/.test(h)
const isSearchOnlyDirections = (d) => d.directionsCount === 1 && d.markerCount === 0 && d.unverifiedDirNote && !(d.directionsHrefs || []).some(coordDirections)

function checkInvariants(href, d, truth) {
  const failures = []
  // Current UI distinguishes an explicitly unverified area map from a verified workplace.
  // Area maps are permitted by the current rules; they must not claim an exact workplace.
  if (d.areaState) {
    if (!d.visibleAddresses?.length) failures.push(`${href}: area map has no visible source address`)
    if (!/chưa.*(?:xác minh|xác định)|ước tính/iu.test(d.areaNotes || '')) failures.push(`${href}: area map lacks unverified warning`)
    if (d.note) failures.push(`${href}: area map incorrectly claims a verified workplace`)
    if (d.markerCount > 1) failures.push(`${href}: area map has multiple workplace-like pins`)
    if (d.unknownMsg) failures.push(`${href}: area map contradicts unknown-location state`)
    return failures
  }
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
    // State A: 상세주소 목록이 있는 공고. 마커는 "주소 항목 수"가 아니라 DB에
    // 좌표가 있는(coordinate_accuracy exact/ward, truth.mappableWorkLocationCount)
    // 항목 수와 일치해야 한다 — exact_text 주소라도 좌표 판정이 region/
    // unresolved면 텍스트만 보여주고 마커는 찍지 않는 것이 이번 세션에 확정된
    // 정책(예: sb-4369는 주소 1건, 마커 0건이 정상). 항목 수와 마커 수를 1:1로
    // 강제하던 예전 불변조건은 이 정책 도입 전 가정이라 폐기한다.
    const expectedMarkers = truth ? truth.mappableWorkLocationCount : null
    const observedMarkers=d.mapUnavailable?d.plannedMarkerCount:d.markerCount
    if (expectedMarkers !== null && observedMarkers !== expectedMarkers) {
      failures.push(`${href}: DB상 사용 가능한 좌표(승인 포함) ${expectedMarkers}건, ${d.mapUnavailable?'키 누락 시 계획':'표시'} 마커 ${observedMarkers}개 — 일치해야 한다`)
    }
    if (d.addrItems.some((a) => !a || a.length < 5)) {
      failures.push(`${href}: address list contains an empty/too-short entry: ${JSON.stringify(d.addrItems)}`)
    }
    if (expectedMarkers > 1 && !d.mapUnavailable && !d.note.includes(String(expectedMarkers))) {
      failures.push(`${href}: caption must mention the mappable work-location count (${expectedMarkers}), got "${d.note}"`)
    }
    if (truth && truth.workLocationCount === 0) {
      failures.push(`${href}: DOM shows ${d.addrItems.length} address item(s) but job_work_locations has 0 rows in the DB — contradicts the source data`)
    }
  } else if (d.singleAddr) {
    // State B: one resolved point. Structural pairing: a marker never appears
    // without directions, and directions never appears without a marker.
    if ((d.markerCount > 0) !== (d.directionsCount > 0) && !isSearchOnlyDirections(d)) {
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
      if (d.directionsCount !== 0 && !isSearchOnlyDirections(d)) failures.push(`${href}: no verified work location in DB but a coordinate/unflagged "Chỉ đường" directions button is rendered: ${JSON.stringify(d.directionsHrefs)}`)
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

if (baseUrl === '--self-test') {
  const sourceJob={company:'CTY TEST',location:'KCN TEST',lat:null,lng:null}
  const sourceWork=[{raw_address:'KCN TEST',lat:null,lng:null}]
  const approval={status:'approved',company_snapshot:'CTY TEST',address_snapshot:'KCN TEST',lat:21.1,lng:106.1,place_precision:'building'}
  const approvedTruth=locationGroundTruth(sourceJob,sourceWork,[approval])
  if(approvedTruth.mappableWorkLocationCount!==1)throw new Error('Approved point must count even when legacy work coordinates are null')
  if(locationGroundTruth(sourceJob,[{...sourceWork[0],lat:21.1,lng:106.1}],[approval]).mappableWorkLocationCount!==1)throw new Error('Legacy and approved coordinates for one work row must not double count')
  for(const invalid of [{...approval,status:'revoked'},{...approval,company_snapshot:'OTHER'},{...approval,address_snapshot:'OTHER'},{...approval,place_precision:'area'},{...approval,lat:null}]) {
    if(locationGroundTruth(sourceJob,sourceWork,[invalid]).mappableWorkLocationCount!==0)throw new Error('Invalid/stale approval must not count')
  }
  if(locationGroundTruth(sourceJob,[],[approval]).workLocationCount!==1)throw new Error('Approved source address without a work row must count')
  const base = { addrItems: [], singleAddr: null, note: '', markerCount: 0, unknownMsg: null, mapContainerCount: 0, gmapsLinkCount: 0, viewOnMapCount: 0, directionsCount: 0 }
  const area = { ...base, areaState: true, areaNotes: 'Khu vực — chưa xác minh vị trí nhà xưởng', visibleAddresses: ['KCN Yên Phong, Bắc Ninh'], markerCount: 1, mapContainerCount: 1 }
  const cases = [
    ['single approved marker uses existing singular caption', {...base,addrItems:['KCN TEST'],note:'Vị trí nơi làm việc đã được xác minh trên bản đồ.',markerCount:1},true,approvedTruth],
    ['multiple verified markers require numerical caption', {...base,addrItems:['KCN TEST','Other address'],note:'Verified',markerCount:2},false,{...approvedTruth,workLocationCount:2,mappableWorkLocationCount:2}],
    ['approved point with null legacy coordinates', {...base,addrItems:['KCN TEST'],note:'Vị trí đã xác minh',mapUnavailable:true,plannedMarkerCount:1},true,approvedTruth],
    ['explicit unverified area', area, true],
    ['area without warning', { ...area, areaNotes: '' }, false],
    ['area without address', { ...area, visibleAddresses: [] }, false],
    ['area falsely verified', { ...area, note: 'đã xác minh' }, false],
    ['area multiple pins', { ...area, markerCount: 2 }, false],
    ['empty location section', base, false],
    ['unknown without map', { ...base, unknownMsg: 'unknown' }, true],
    ['unknown with map', { ...base, unknownMsg: 'unknown', mapContainerCount: 1 }, false],
    ['unknown with mapped address', { ...base, unknownMsg: 'unknown', mapContainerCount: 1, plannedMarkerCount: 1, mapUnavailable: true }, false],
    ['fabricated precise marker', { ...base, singleAddr: 'Bắc Ninh', markerCount: 1, directionsCount: 1 }, false],
  ]
  for (const [name, value, pass, truth] of cases) {
    const errors = checkInvariants('/fixture', value, truth || { workLocationCount: 0, mappableWorkLocationCount: 0, hasDirectCoords: false })
    if ((errors.length === 0) !== pass) throw new Error('Location fixture failed: ' + name + ': ' + errors.join('; '))
    console.log('Location fixture PASS: ' + name)
  }
  process.exit(0)
}
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector(CARD_SELECTOR, { timeout: 30_000 })
  await page.waitForTimeout(1000)
  const hrefs = await page.evaluate(selector =>
    [...new Set([...document.querySelectorAll(selector)].map(el => el.getAttribute('href') || '').filter(Boolean))], CARD_SELECTOR,
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
        failures.push(`${href}: could not fetch DB ground truth (${err.message})`)
      }
    }
    results.push({ href, ...d, truth })
    failures.push(...checkInvariants(href, d, truth))
  }

  await page.close()

  console.log(JSON.stringify(results, null, 2))
  console.log(`checked ${toCheck.length}/${hrefs.length} job detail page(s)`)
  // 실패 내용을 GitHub 주석으로도 남긴다(로그를 못 여는 환경에서도 원인 확인 가능, 2026-10-18)
  for (const f of failures) console.log(`::error::${f.replace(/\r?\n/g, ' ').slice(0, 900)}`)
  if (failures.length) throw new Error(failures.join('; '))
  console.log('✅ job location detail: every checked job is in exactly one consistent location state (multi-address/single/unknown), markers match address counts')
} finally {
  await browser.close()
}
