import { chromium } from 'playwright'

import assert from 'node:assert/strict'
import {sourcePoints,assertPoints} from './ops/location-point-oracle.mjs'

// Structural/address safeguards plus an independent, paginated canonical source
// oracle. Keyless local runs validate planned count only; keyed runs validate
// the complete actual marker provenance (kind, precision, identity, revision).
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const MAX_JOBS_TO_CHECK = 12
const CARD_SELECTOR = '.home-featured .home-card-wrap, .home-jobs-grid .home-card-wrap'
const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'

function locationGroundTruth(workLocations) {
  const points=sourcePoints(workLocations)
  return {points,workLocationCount:workLocations.length,mappableWorkLocationCount:points.length}
}
async function fetchGroundTruth(numericId) {
  const headers={apikey:SUPABASE_ANON_KEY,authorization:`Bearer ${SUPABASE_ANON_KEY}`}
  const rows=[]
  for(let offset=0;;offset+=500) {
    const query=new URLSearchParams({job_id:`eq.${numericId}`,select:'id,job_id,raw_address,lat,lng,point_kind,point_precision,point_revision',order:'id.asc',offset:String(offset),limit:'500'})
    const response=await fetch(`${SUPABASE_URL}/rest/v1/job_work_locations?${query}`,{headers})
    if(!response.ok)throw new Error(`Canonical ground truth HTTP ${response.status}`)
    const page=await response.json()
    if(!Array.isArray(page))throw new Error('Canonical ground truth is not a row list')
    rows.push(...page)
    if(page.length<500)return locationGroundTruth(rows)
  }
}

async function readJobDetail(page, href) {
  await page.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForSelector('h1.jd2-header__title', { timeout: 30_000 })
  await page.waitForTimeout(1200) // allow the client map and actual markers to mount
  return page.evaluate(() => {
    const addrItems = [...document.querySelectorAll('.jd2-map-addr-item .jd2-map-addr')].map((el) => el.textContent?.trim() || '')
    const singleAddr = document.querySelector('.jd2-card__body > .jd2-map-addr')?.textContent?.trim() || null
    const note = document.querySelector('.jd2-map-note')?.textContent?.trim() || ''
    // A visible marker must not be described as an independently verified factory pin unless that is established.
    // The source location may only be an approximate address/geocode.
    const actualPoints=[...document.querySelectorAll('.jd2-vmap [data-location-points]')].flatMap(el=>JSON.parse(el.getAttribute('data-location-points')))
    const markerCount = document.querySelectorAll('.jd2-vmap .vietmapgl-marker, .jd2-vmap .maplibregl-marker').length
    const map = document.querySelector('.jd2-vmap')
    const plannedPoints=JSON.parse(map?.getAttribute('data-planned-location-points')||'[]')
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
    // 2026-10-30 Lee: 모든 길찾기는 기준(KDA) 버튼 하나 모양 — 예전 작은 버튼(.jd2-map-gmaps-links) 금지.
    const oldStyleButtons = document.querySelectorAll('.jd2-map-gmaps-links').length
    const nonStandardDirections = [...document.querySelectorAll('.jd2-map-links a')].filter((a) => (a.textContent || '').includes('Chỉ đường') && !a.classList.contains('jd2-map-dir--google') && !/^tel:/.test(a.getAttribute('href') || '')).length
    const unverifiedDirNote = /chưa xác minh|không phải địa chỉ nơi làm việc/iu.test(document.body.innerText || '')
    return { plannedPoints, actualPoints, addrItems, singleAddr, note, markerCount, plannedMarkerCount, mapUnavailable, unknownMsg, mapContainerCount, gmapsLinkCount, viewOnMapCount, directionsCount, directionsHrefs, unverifiedDirNote, visibleAddresses, areaNotes, areaState, oldStyleButtons, nonStandardDirections }
  })
}

// 위치 미확인 공고의 글자 검색 길찾기(좌표 아님) 1개 + 미확인 안내 = 사용자 규칙(2026-10-13)상 허용되는 상태
const coordDirections = (h) => /destination=-?\d+(\.\d+)?,-?\d+(\.\d+)?(&|$)/.test(h)
const isSearchOnlyDirections = (d) => d.directionsCount === 1 && d.markerCount === 0 && d.unverifiedDirNote && !(d.directionsHrefs || []).some(coordDirections)

function checkInvariants(href, d, truth) {
  const failures = []
  if(!truth)failures.push(`${href}: independent canonical source unavailable`)
  else if(d.mapUnavailable) {
    if(d.plannedMarkerCount!==truth.points.length)failures.push(`${href}: keyless planned canonical count ${d.plannedMarkerCount} differs from source ${truth.points.length}`)
    if(d.markerCount!==0)failures.push(`${href}: keyless map unexpectedly renders markers`)
    try{assertPoints(truth.points,d.plannedPoints||[],`${href}: keyless planned canonical point set (not actual markers)`)}catch(error){failures.push(error.message)}
  } else {
    try {assertPoints(truth.points,d.actualPoints||[],`${href}: actual canonical point set`)}catch(error){failures.push(error.message)}
    if(d.markerCount!==truth.points.length)failures.push(`${href}: actual marker count differs from canonical source`)
  }
  // Current UI distinguishes an explicitly unverified area map from a verified workplace.
  // Area maps are permitted by the current rules; they must not claim an exact workplace.
  if (d.oldStyleButtons) failures.push(`${href}: old small Google buttons shown (standard KDA directions button required)`)
  if (d.nonStandardDirections) failures.push(`${href}: directions button is not the standard KDA Google button`)
  if (d.areaState) {
    if (!d.visibleAddresses?.length) failures.push(`${href}: area map has no visible source address`)
    if (!/chưa.*(?:xác minh|xác định)|ước tính/iu.test(d.areaNotes || '')) failures.push(`${href}: area map lacks unverified warning`)
    if (d.note && !truth?.points.some(p=>p.kind==='exact')) failures.push(`${href}: area-only map incorrectly claims a verified workplace`)
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
    // Addresses may exist without coordinates. Only canonical resolved source
    // points determine planned/actual markers; every approximate site counts.
    const expectedMarkers = truth ? truth.mappableWorkLocationCount : null
    const observedMarkers=d.mapUnavailable?d.plannedMarkerCount:d.markerCount
    if (expectedMarkers !== null && observedMarkers !== expectedMarkers) {
      failures.push(`${href}: canonical source points ${expectedMarkers}건, ${d.mapUnavailable?'키 누락 시 계획':'표시'} 마커 ${observedMarkers}개 — 일치해야 한다`)
    }
    if (d.addrItems.some((a) => !a || a.length < 5)) {
      failures.push(`${href}: address list contains an empty/too-short entry: ${JSON.stringify(d.addrItems)}`)
    }
    if (expectedMarkers > 1 && truth.points.every(p=>p.kind==='exact') && !d.mapUnavailable && !d.note.includes(String(expectedMarkers))) {
      failures.push(`${href}: caption must mention the mappable work-location count (${expectedMarkers}), got "${d.note}"`)
    }
    if (truth && truth.workLocationCount === 0) {
      failures.push(`${href}: DOM shows ${d.addrItems.length} address item(s) but job_work_locations has 0 rows in the DB — contradicts the source data`)
    }
  } else if (d.singleAddr) {
    if(d.singleAddr.length<2)failures.push(`${href}: single address text is too short`)
    if(truth?.points.length===0) {
      if(d.markerCount!==0)failures.push(`${href}: no canonical point but marker rendered`)
      if(d.mapContainerCount!==0)failures.push(`${href}: no canonical point but workplace map rendered`)
      if((d.directionsHrefs||[]).some(coordDirections))failures.push(`${href}: no canonical point but coordinate directions rendered`)
      if(d.directionsCount && !isSearchOnlyDirections(d))failures.push(`${href}: unverified text directions require warning`)
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

if(baseUrl==='--self-test') {
 const row=(id,kind='exact')=>({id,lat:21.1+id/10000,lng:106.1,point_kind:kind,point_precision:kind==='exact'?'building':'commune',point_revision:2})
 const one=locationGroundTruth([row(1)]),multi=locationGroundTruth([row(1),row(2,'area')]),zero=locationGroundTruth([])
 const base={addrItems:['Source address'],singleAddr:null,note:'',markerCount:1,actualPoints:one.points,mapUnavailable:false,unknownMsg:null,mapContainerCount:1,directionsCount:0,gmapsLinkCount:0,viewOnMapCount:0}
 const area={...base,areaState:true,areaNotes:'Khu vực — chưa xác minh',visibleAddresses:['Source address','Second site'],markerCount:2,actualPoints:multi.points}
 const cases=[
  ['one canonical point',base,one,true],
  ['canonical zero unknown',{...base,addrItems:[],unknownMsg:'unknown',markerCount:0,actualPoints:[],mapContainerCount:0},zero,true],
  ['multiple approximate/exact sites',area,multi,true],
  ['keyless planned only',{...area,mapUnavailable:true,plannedMarkerCount:2,plannedPoints:multi.points,markerCount:0,actualPoints:[]},multi,true],
  ['keyless wrong planned count',{...area,mapUnavailable:true,plannedMarkerCount:1,markerCount:0,actualPoints:[]},multi,false],
  ['legacy/candidate overlay cannot create point',base,zero,false],
  ['old revision overlay',{...base,actualPoints:[{...one.points[0],revision:1}]},one,false],
  ['missing second source site',{...area,markerCount:1,actualPoints:one.points},multi,false],
  ['approximate without warning',{...area,areaNotes:''},multi,false],
  ['approximate falsely verified',{...area,note:'verified',markerCount:1,actualPoints:sourcePoints([row(2,'area')])},locationGroundTruth([row(2,'area')]),false],
  ['unknown map contradicts source',{...base,addrItems:[],unknownMsg:'unknown'},one,false],
 ]
 for(const [name,dom,truth,pass]of cases) {
  const failures=checkInvariants('/synthetic',dom,truth)
  assert.equal(failures.length===0,pass,name+': '+failures.join('; '))
  console.log('Location canonical fixture PASS: '+name)
 }
 // Unresolved rows, legacy local-job coordinates and independent candidate rows
 // are never a second source: this function accepts only work-location rows.
 assert.equal(locationGroundTruth([{id:5,lat:null,lng:null,point_kind:'unresolved'}]).points.length,0)
 console.log('Location canonical self-tests PASS: '+cases.length+' cases plus unresolved source')
 process.exit(0)
}
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined})
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
  console.log('✅ job location detail: every checked job is in exactly one consistent location state (multi-address/single/unknown), actual canonical fullsets (or explicit keyless planned counts) match source')
} finally {
  await browser.close()
}
