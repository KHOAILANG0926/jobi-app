/**
 * Standalone regression tests for jobCoords.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/jobCoords.test.ts`.
 */
import {
  findRegionCenter,
  resolveDistanceSearchPoint,
  resolveDistanceSearchPoints,
  resolveMapLocations,
  resolveWorkLocationQuery,
  workLocationExternalLinks,
  formatDistanceLabel,
} from './jobCoords.ts'
import { applyLocationApprovals } from './jobRows.ts'
import type { Job } from '../types/job.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertTrue(actual: unknown, label: string): void {
  if (!actual) throw new Error(`${label}: expected truthy, got ${JSON.stringify(actual)}`)
}

function assertFalse(actual: unknown, label: string): void {
  if (actual) throw new Error(`${label}: expected falsy, got ${JSON.stringify(actual)}`)
}

function testResolveWorkLocationQuery(): void {
  // 2026-09-04 사용자 지시: "Google Maps 텍스트 길찾기는 항상 원문 위치 + 상위
  // 시·도 + Vietnam을 URL 인코딩해 사용" — jobLocation(상위 시·도)이 주어지면
  // 그 값과 'Vietnam'을 항상 덧붙인다.

  // Approximate work locations carry a human-readable caveat in rawAddress
  // (e.g. "... vị trí trung tâm gần đúng") for on-screen display, but the
  // external Google Maps search/directions link must use the clean
  // normalizedAddress — not repeat that caveat text as part of the query.
  const approx = {
    rawAddress: 'Long An (khu vực dự án, vị trí trung tâm gần đúng)',
    normalizedAddress: 'Long An',
  }
  const query = resolveWorkLocationQuery(approx, 'Long An')
  assertEqual(query, 'Long An, Long An, Vietnam', 'approximate location: query uses normalizedAddress + jobLocation + Vietnam')
  assertEqual(query.includes('gần đúng'), false, 'approximate location: query must not include the on-screen caveat text')

  // A real, exact address (e.g. resolved from a depot's Google Maps link) has
  // no normalizedAddress override — the full address itself is already the
  // right search query base, with jobLocation + Vietnam always appended.
  const exact = { rawAddress: 'Depot Bình Tân, 1812-1814 Võ Văn Kiệt, P. An Lạc, Q. Bình Tân, TP.HCM' }
  assertEqual(
    resolveWorkLocationQuery(exact, 'TP.HCM'),
    'Depot Bình Tân, 1812-1814 Võ Văn Kiệt, P. An Lạc, Q. Bình Tân, TP.HCM, TP.HCM, Vietnam',
    'exact address with no normalizedAddress: falls back to rawAddress, still gets jobLocation + Vietnam appended',
  )

  // An empty-string normalizedAddress (falsy) must still fall back to rawAddress,
  // not resolve to an empty search query.
  const emptyNormalized = { rawAddress: 'Hưng Yên', normalizedAddress: '' }
  assertEqual(resolveWorkLocationQuery(emptyNormalized, 'Hưng Yên'), 'Hưng Yên, Hưng Yên, Vietnam', 'empty normalizedAddress falls back to rawAddress, jobLocation + Vietnam still appended')

  // jobLocation omitted/empty — still must append 'Vietnam' unconditionally
  // (country must always be explicit, even without a known province).
  assertEqual(resolveWorkLocationQuery({ rawAddress: 'Hưng Yên' }), 'Hưng Yên, Vietnam', 'no jobLocation given -> still appends Vietnam, no duplicate/empty segment')
  assertEqual(resolveWorkLocationQuery({ rawAddress: 'Hưng Yên' }, '  '), 'Hưng Yên, Vietnam', 'whitespace-only jobLocation is treated as absent, not an empty segment')
}

function testDirectionsAlwaysAvailableRegardlessOfLocationState(): void {
  // 2026-09-29 개정(공고 4682 사고): 예전 테스트는 "모든 위치 상태에서 글자 검색 길찾기 URL이
  // 만들어진다"(URL 형식)만 검사해, Google이 "KCN VSIP, Bắc Ninh"을 논 한가운데로 추측한
  // 실제 목적지 오류를 잡지 못했다. 이제는 목적지 좌표가 사이트 지도 점과 같은지, 미확인
  // 위치에는 길찾기 목적지를 주지 않는지를 검사한다.
  const verified = { rawAddress: 'Lô A1, KCN X', lat: 10.7, lng: 106.7, coordinateAccuracy: 'exact' as const, locationVerified: true }
  const unverifiedWard = { rawAddress: '45 Trần Mai Ninh, Tân Bình', lat: 10.8, lng: 106.65, coordinateAccuracy: 'ward' as const, locationVerified: false, addressAccuracy: 'exact_text' as const }
  const noCoords = { rawAddress: 'Khu Công nghiệp Hiệp Phước', coordinateAccuracy: 'unresolved' as const, locationVerified: false, addressAccuracy: 'exact_text' as const, geocodeStatus: 'failed' as const }

  const v = workLocationExternalLinks(verified)
  assertTrue(v !== null && v.viewKind === 'exact', 'verified location -> exact pin link')
  assertTrue(!!v?.view.includes('query=10.7,106.7'), 'view link pins the same verified coordinate')
  // location_verified는 "그 건물이 여기"까지의 확인 — 출입구 미확인이라 길찾기는 열지 않는다
  assertEqual(v?.directions, null, 'building-level verification (no entrance) -> no directions')
  const entrance = workLocationExternalLinks({ ...verified, approvedPoint: { lat: 10.71, lng: 106.71, placePrecision: 'entrance' as const } })
  assertEqual(entrance?.directions, 'https://www.google.com/maps/dir/?api=1&destination=10.71,106.71', 'entrance-confirmed approval -> directions to that exact point')

  const u = workLocationExternalLinks(unverifiedWard)
  assertTrue(u !== null && u.viewKind === 'area' && u.directions === null, 'unverified coordinate -> area view only, NO directions')
  assertTrue(!!u?.view.includes('center=10.8,106.65'), 'area view centers on the same point the site map shows')
  assertFalse(!!u?.view.includes('query='), 'area view must not drop a pin')

  // 좌표도 지역 매칭도 없으면 외부 링크 자체를 만들지 않는다(글자 검색으로 추측시키지 않음)
  assertEqual(workLocationExternalLinks(noCoords), null, 'no confirmed point at all -> no external link')

  // 목적지 URL에 글자 주소가 들어가면 안 된다(Google이 해석·추측하는 경로 차단)
  for (const links of [v, u]) {
    assertFalse(!!links && (links.view + (links.directions ?? '')).includes(encodeURIComponent('Trần Mai Ninh')), 'external links must be coordinate-based, never a text query')
  }
}

function testCase4682IndustrialParkCenterIsNotACompanyLocation(): void {
  // 공고 4682(2026-09-28): 원문엔 "KCN VSIP BẮC NINH"만 있음. 자동 지오코딩 거절 후 공단 중심점을
  // local_jobs.lat/lng에 수동 입력 → 'exact'로 판정돼 "Vị trí chính xác" 표시, 외부 링크는 글자
  // 검색이라 Google이 논을 목적지로 찍었다.
  const manualRaw = resolveMapLocations({ rawLat: 21.0799208, rawLng: 105.9807154, rawLocation: 'KCN VSIP, Bắc Ninh' })
  assertTrue(manualRaw.source !== 'exact' && manualRaw.points.every((p) => !p.precise),
    'local_jobs.lat/lng (no provenance) must never be shown as an exact location')

  // 수정안: 공단 수준 근무지 행(미검증, 공단 중심점) — 지역 수준으로만 표시
  const park = {
    rawAddress: 'Khu công nghiệp VSIP Bắc Ninh', lat: 21.0799208, lng: 105.9807154,
    coordinateAccuracy: 'region' as const, addressAccuracy: 'exact_text' as const,
    locationVerified: false, geocodeStatus: 'manual' as const,
  }
  const map = resolveMapLocations({ rawLocation: 'KCN VSIP, Bắc Ninh', workLocations: [park] })
  assertTrue(map.source !== 'exact' && map.points.length === 1 && !map.points[0].precise, 'park center shown as approximate, not exact')
  const links = workLocationExternalLinks(park)
  assertTrue(links !== null && links.viewKind === 'area' && links.directions === null, 'park-level location: no directions, area view only')
  assertTrue(!!links?.view.includes(`center=${map.points[0].lat},${map.points[0].lng}`), 'external area view uses the same point as the site map')
  assertEqual(resolveDistanceSearchPoint({ workLocations: [park] }), null, 'park center must not be used for near-me / distance')
}

function testDistanceLabelSaysStraightLine(): void {
  // calcDistanceKm()은 직선거리(하버사인) — 표시도 이동거리로 오해하지 않게 '직선거리'를 명시
  assertEqual(formatDistanceLabel(1.234), '1.2 km đường chim bay', 'precise distance labelled as straight-line')
  assertEqual(formatDistanceLabel(3, false), '~3.0 km đường chim bay', 'approximate distance keeps ~ and straight-line label')
}

function testHumanApprovedLocationLifecycle(): void {
  // 2026-09-29: 사람이 승인한 근무지(job_location_candidates)만 핀·거리에 쓰이고, 길찾기는 출입구까지
  // 확인된 승인만. 회사명·근무지 텍스트가 바뀌거나 승인이 철회되면 지역 수준으로 돌아간다.
  // (좌표 값은 테스트용 임의값 — 실제 공고 좌표 아님)
  const addr = 'Số 10, đường 5, KCN VSIP Bắc Ninh, Phù Chẩn, Từ Sơn, Bắc Ninh, Từ Sơn'
  const baseJob = {
    id: 'sb-4453', company: 'Công Ty Cổ Phần Als Đông Hà Nội',
    workLocations: [{ id: 1, rawAddress: addr, lat: 21.07, lng: 105.97, coordinateAccuracy: 'ward', locationVerified: false, addressAccuracy: 'exact_text' }],
  } as unknown as Job
  const building = { job_id: 4453, company_snapshot: 'Công Ty Cổ Phần Als Đông Hà Nội', address_snapshot: addr, lat: 21.05, lng: 105.95, place_precision: 'building' }

  const before = baseJob.workLocations![0]
  assertEqual(workLocationExternalLinks(before)?.directions, null, 'before approval: no directions')
  assertEqual(resolveDistanceSearchPoint(baseJob), null, 'before approval: excluded from near-me')

  const [approvedJob] = applyLocationApprovals([baseJob], [building])
  const loc = approvedJob.workLocations![0]
  const map = resolveMapLocations(approvedJob)
  assertTrue(map.source === 'exact' && map.points[0].precise && map.points[0].lat === 21.05, 'building approved: precise pin at the approved coordinate')
  assertTrue(!!workLocationExternalLinks(loc)?.view.includes('query=21.05,105.95'), 'building approved: external view pins the same point as the site map')
  assertEqual(workLocationExternalLinks(loc)?.directions, null, 'building approved: still NO directions (entrance not confirmed)')
  const d = resolveDistanceSearchPoint(approvedJob)
  assertTrue(d !== null && d.lat === 21.05 && d.precise, 'building approved: used for near-me distance at the same point')

  const [entranceJob] = applyLocationApprovals([baseJob], [{ ...building, place_precision: 'entrance' }])
  assertEqual(workLocationExternalLinks(entranceJob.workLocations![0])?.directions,
    'https://www.google.com/maps/dir/?api=1&destination=21.05,105.95', 'entrance approved: directions to the approved point')

  const [companyChanged] = applyLocationApprovals([{ ...baseJob, company: 'Công ty khác' } as Job], [building])
  assertEqual(resolveDistanceSearchPoint(companyChanged), null, 'company changed -> approval not applied until re-review')
  const movedJob = { ...baseJob, workLocations: [{ ...before, rawAddress: 'Lô B2, KCN Quế Võ' }] } as Job
  assertEqual(resolveDistanceSearchPoint(applyLocationApprovals([movedJob], [building])[0]), null, 'address changed -> approval not applied')
  const [areaJob] = applyLocationApprovals([baseJob], [{ ...building, place_precision: 'area' }])
  assertEqual(resolveDistanceSearchPoint(areaJob), null, 'area-level record is never used as a workplace pin')
  assertEqual(resolveDistanceSearchPoint(applyLocationApprovals([baseJob], [])[0]), null, 'after revoke: back to area-level only')
}

function testDistanceSearchOnlyUsesVerifiedLocations(): void {
  // 고정 테스트 #8 (2026-09-05 2단계 거리검색 정책으로 개정 — 독립 검증에서
  // 4389/4391/4392처럼 실제 지오코딩된 ward 좌표가 있는데도 location_
  // verified가 원문에 대조할 사이트 제공 좌표 자체가 없어(정상) 통째로
  // 거리검색에서 빠지는 사례가 다수 확인됨): 정밀(location_verified===true)
  // 과 근사(미검증이지만 coordinateAccuracy가 'exact'/'ward'인 실제
  // 지오코딩 좌표) 두 등급으로 나눠 근사 좌표도 거리검색에 포함하되,
  // precise 플래그로 호출부가 "N km"/"~N km"를 구분하게 한다.
  const exactUnverified = { rawAddress: 'A', lat: 10.1, lng: 106.1, coordinateAccuracy: 'exact' as const, locationVerified: false }
  const exactVerified = { rawAddress: 'A2', lat: 10.15, lng: 106.15, coordinateAccuracy: 'exact' as const, locationVerified: true }
  const verifiedWard = { rawAddress: 'B', lat: 10.2, lng: 106.2, coordinateAccuracy: 'ward' as const, locationVerified: true }
  const unverifiedWard = { rawAddress: 'C', lat: 10.3, lng: 106.3, coordinateAccuracy: 'ward' as const, locationVerified: false }
  const regionTier = { rawAddress: 'D', lat: 10.4, lng: 106.4, coordinateAccuracy: 'region' as const }
  const noCoords = { rawAddress: 'E', coordinateAccuracy: 'unresolved' as const, locationVerified: true }

  // 2026-09-29: 미검증 좌표는 근사 거리검색에서도 제외(4682 후속, 사용자 지시).
  assertEqual(resolveDistanceSearchPoint({ workLocations: [exactUnverified] }), null, "unverified exact-tagged coordinate must be EXCLUDED from distance search")

  // lat/lng 있음 + exact + locationVerified=true → 정밀 거리검색 포함(precise=true).
  const onlyExactVerified = resolveDistanceSearchPoint({ workLocations: [exactVerified] })
  assertTrue(onlyExactVerified !== null && onlyExactVerified.lat === 10.15 && onlyExactVerified.lng === 106.15 && onlyExactVerified.precise === true, "lat/lng present + exact + locationVerified=true must be INCLUDED as PRECISE (precise=true)")

  // lat/lng 있음 + ward + locationVerified=true → 정밀 거리검색 포함.
  const onlyWardVerified = resolveDistanceSearchPoint({ workLocations: [verifiedWard] })
  assertTrue(onlyWardVerified !== null && onlyWardVerified.lat === 10.2 && onlyWardVerified.lng === 106.2 && onlyWardVerified.precise === true, "lat/lng present + ward + locationVerified=true must be INCLUDED as PRECISE (coordinateAccuracy tier is irrelevant once verified)")

  assertEqual(resolveDistanceSearchPoint({ workLocations: [unverifiedWard] }), null, "unverified ward coordinate must be EXCLUDED from distance search")

  // lat/lng 있음 + region → 등급 무관 완전 제외(행정 중심, 근사 거리검색도 안 됨).
  assertEqual(resolveDistanceSearchPoint({ workLocations: [regionTier] }), null, "region-tier point must be EXCLUDED from distance search even though it has real lat/lng, and even as an approximate point")

  // lat/lng 없음 + locationVerified=true → 거리검색 제외(검증 플래그만으로는
  // 부족하다 — 실제 유한한 좌표가 없으면 애초에 계산할 게 없다).
  assertEqual(resolveDistanceSearchPoint({ workLocations: [noCoords] }), null, "locationVerified=true but no lat/lng at all -> must still be excluded, nothing to calculate distance from")

  // 복수 근무지 — 정밀 2개 + 근사 2개 + region(좌표 있음) + 좌표없음, 총 4개만 포함.
  const mixed = resolveDistanceSearchPoints({ workLocations: [exactUnverified, exactVerified, verifiedWard, unverifiedWard, regionTier, noCoords] })
  assertEqual(mixed.length, 2, "only the two verified locations count; unverified, region-tier and no-coords are excluded")
  assertTrue(mixed.some((p) => p.lat === 10.15 && p.lng === 106.15 && p.precise), "verified exact point must be included as precise")
  assertTrue(mixed.some((p) => p.lat === 10.2 && p.lng === 106.2 && p.precise), "verified ward point must be included as precise")
  assertFalse(mixed.some((p) => p.lat === 10.1 || p.lat === 10.3), "unverified points must be excluded")
  assertFalse(mixed.some((p) => p.lat === 10.4), "region-tier point must be excluded even though it has real lat/lng")

  // 대표 1점은 정밀이 하나라도 있으면 정밀을 우선한다(같은 공고 안에 정밀/
  // 근사가 섞여 있을 때 배지에 근사치를 보여주는 일이 없도록).
  const preferPrecise = resolveDistanceSearchPoint({ workLocations: [exactUnverified, verifiedWard] })
  assertTrue(preferPrecise !== null && preferPrecise.precise === true && preferPrecise.lat === 10.2, "resolveDistanceSearchPoint must prefer a precise point over an approximate one when both exist")

  // 전부 region/좌표없음이면 대표 1점도 null — 지도 fallback으로라도 거리를 계산하면 안 된다.
  assertEqual(resolveDistanceSearchPoint({ workLocations: [regionTier, noCoords] }), null, "only region/no-coords locations -> resolveDistanceSearchPoint must return null, never fall back to an administrative-center point")
  assertEqual(resolveDistanceSearchPoint({ workLocations: [] }), null, "no work locations at all -> null")
  assertEqual(resolveDistanceSearchPoint({}), null, "no workLocations field at all -> null")
}

function testMapShownForEveryLocationTier(): void {
  // 고정 테스트 #9: "모든 위치 등급에서 지도 표시" — resolveMapLocations()가
  // exact/ward(미검증 포함)/region_only(좌표 없음, 텍스트 지역명 fallback)/
  // 모집지역만 있는 경우 전부 'default'가 아닌 source로 점을 최소 1개 반환해야
  // 한다. 'default'(완전히 위치 정보 없음)일 때만 지도를 숨기는 게 정책이다.

  // Tier A: 검증된 exact 좌표(locationVerified===true) — 이것만 정확한 핀.
  const exactJob = { workLocations: [{ rawAddress: 'A', lat: 10.1, lng: 106.1, coordinateAccuracy: 'exact' as const, locationVerified: true }] }
  const exactResult = resolveMapLocations(exactJob)
  assertEqual(exactResult.source, 'exact', "verified exact location -> map source 'exact'")
  assertTrue(exactResult.points[0]?.precise, "locationVerified=true exact location's point must be marked precise")

  // lat/lng 있음 + exact + locationVerified=false → 근사 스타일(정확한 핀
  // 아님) — coordinateAccuracy만으로 정확하다고 표시하지 않는다.
  const exactUnverifiedJob = { workLocations: [{ rawAddress: 'A-unverified', lat: 10.11, lng: 106.11, coordinateAccuracy: 'exact' as const, locationVerified: false }] }
  const exactUnverifiedResult = resolveMapLocations(exactUnverifiedJob)
  assertTrue(exactUnverifiedResult.points.length > 0, "exact-tagged but unverified location must still produce a map point")
  assertFalse(exactUnverifiedResult.points[0]?.precise, "coordinateAccuracy==='exact' alone (locationVerified=false) must NOT be marked precise")
  assertEqual(exactUnverifiedResult.source, 'address', "no precise point among this job's locations -> map source 'address', not 'exact'")

  // lat/lng 있음 + ward + locationVerified=true → 정확한 핀(coordinateAccuracy
  // 등급과 무관하게 locationVerified만이 근거).
  const wardVerifiedJob = { workLocations: [{ rawAddress: 'B-verified', lat: 10.25, lng: 106.25, coordinateAccuracy: 'ward' as const, locationVerified: true }] }
  const wardVerifiedResult = resolveMapLocations(wardVerifiedJob)
  assertEqual(wardVerifiedResult.source, 'exact', "locationVerified=true ward location -> map source 'exact'")
  assertTrue(wardVerifiedResult.points[0]?.precise, "locationVerified=true ward point must be marked precise, regardless of coordinateAccuracy tier")

  // Tier B: 구체적 주소 + 좌표 미검증(ward, locationVerified 없음) — 좌표
  // 자체는 지오코더가 반환한 것이므로 근사 지도에 그대로 쓴다.
  const wardUnverifiedJob = { workLocations: [{ rawAddress: 'B', lat: 10.2, lng: 106.2, coordinateAccuracy: 'ward' as const }] }
  const wardResult = resolveMapLocations(wardUnverifiedJob)
  assertTrue(wardResult.points.length > 0 && wardResult.source !== 'default', "ward-tier unverified location must still produce a map point, not fall through to 'default'")
  assertFalse(wardResult.points[0]?.precise, "unverified ward point must NOT be marked precise")

  // Tier B/C: 구체적 주소인데 좌표를 아예 못 찾음(unresolved, lat/lng 없음) —
  // 원문 텍스트 자체에 알려진 지역명이 있으면 그 지역 중심으로라도 표시.
  const unresolvedWithRegionText = { workLocations: [{ rawAddress: 'Nhà máy ABC, Bình Dương', coordinateAccuracy: 'unresolved' as const }] }
  const unresolvedResult = resolveMapLocations(unresolvedWithRegionText)
  assertTrue(unresolvedResult.points.length > 0 && unresolvedResult.source !== 'default', "unresolved-tier location with a recognizable region name in its own text must still get an approximate map point, not be hidden")
  assertFalse(unresolvedResult.points[0]?.precise, "region-text fallback point must not be marked precise")

  // Tier C/D: region_only 텍스트, 매칭된 모집지역으로 fallback.
  const regionOnlyViaMatchedRegion = {
    workLocations: [{ rawAddress: 'Quận 1, TP.HCM', coordinateAccuracy: 'unresolved' as const, matchedRecruitmentRegions: ['Hồ Chí Minh'] }],
  }
  const matchedRegionResult = resolveMapLocations(regionOnlyViaMatchedRegion)
  assertTrue(matchedRegionResult.points.length > 0 && matchedRegionResult.source !== 'default', "region_only location falls back through its own text, then its matched recruitment region")

  // Tier E: 근무지 행 0건, 모집지역만 있음.
  const recruitmentOnlyJob = { workLocations: [], recruitmentRegions: ['Hà Nội', 'Đà Nẵng'] }
  const recruitmentResult = resolveMapLocations(recruitmentOnlyJob)
  assertEqual(recruitmentResult.source, 'region', "recruitment-regions-only job -> map source 'region'")
  assertEqual(recruitmentResult.points.length, 2, "one map point per recruitment region")
  assertFalse(recruitmentResult.points.every((p) => p.precise), "recruitment-region fallback points must never be marked precise")

  // 위치 정보가 전혀 없으면(근무지도 모집지역도 텍스트도 없음) 'default'.
  const nothingJob = { workLocations: [], recruitmentRegions: [] }
  const nothingResult = resolveMapLocations(nothingJob)
  assertEqual(nothingResult.source, 'default', "no location info at all -> 'default' (the only tier the UI is allowed to hide the map for)")
}

function testRecruitmentRegionFallbackNeverDuplicatesOneCoordinate(): void {
  // 고정 테스트 #13: "복수 모집지역에 하나의 좌표를 복제하지 않음" — 각
  // 모집지역은 자기 자신의 findRegionCenter() 결과를 쓴다, 서로 다른 실제
  // 지역이면 좌표도 달라야 한다(하나의 값을 그대로 복사해 여러 지역인 척
  // 하지 않음).
  const hcm = findRegionCenter('Hồ Chí Minh')
  const hanoi = findRegionCenter('Hà Nội')
  assertTrue(hcm !== null && hanoi !== null, "sanity: both region names must resolve via findRegionCenter for this test to mean anything")
  assertFalse(hcm!.lat === hanoi!.lat && hcm!.lng === hanoi!.lng, "sanity: the two real regions must have genuinely different centers")

  const result = resolveMapLocations({ workLocations: [], recruitmentRegions: ['Hồ Chí Minh', 'Hà Nội'] })
  assertEqual(result.points.length, 2, "two distinct recruitment regions -> two distinct map points")
  const [p1, p2] = result.points
  assertFalse(p1.lat === p2.lat && p1.lng === p2.lng, "the two recruitment-region points must not be the same coordinate copy-pasted across regions")
  assertEqual(p1.lat, hcm!.lat, "first region's point must be that region's own center")
  assertEqual(p2.lat, hanoi!.lat, "second region's point must be that region's own center, not a copy of the first")
}

function testCompanyRegisteredAddressNeverUsedAsMapOrDirectionsFallback(): void {
  // 고정 테스트 #12: "회사 등록주소를 근무지 fallback으로 사용하지 않음" —
  // resolveWorkLocationQuery()/resolveMapLocations()/googleMapsLinks() 중
  // 어느 것도 회사 등록주소를 파라미터로조차 받지 않는다(구조적으로 불가능
  // 하다는 것을 함수 시그니처 자체로 증명) — 근무지 텍스트가 없을 때
  // 회사 주소로 몰래 대체하는 코드 경로가 존재하지 않는다는 뜻이다.
  const jobWithOnlyCompanyAddressLikeField = {
    workLocations: [] as never[],
    recruitmentRegions: [] as string[],
    // 의도적으로 실제 코드가 절대 읽지 않는 필드를 붙여본다 — resolveMapLocations가
    // 이런 필드를 우연히라도 근무지 fallback으로 쓰면 안 된다.
    companyAddress: 'Phòng 402, Tầng 04 Tòa nhà số 186B Đường Nguyễn Văn Hưởng, Phường An Khánh, TP Hồ Chí Minh',
  }
  const result = resolveMapLocations(jobWithOnlyCompanyAddressLikeField)
  assertEqual(result.source, 'default', "a job with no real work-location/recruitment-region data must fall through to 'default', never silently pick up an unrelated companyAddress-shaped field")
}

function testPendingGeocodeStatusIsDistinctFromDefaultAndNeverFallsBackToText(): void {
  // 2026-09-07 사용자 지시: geocode_status='pending'인 근무지만 있는 공고는
  // 'default'(베트남 전체 중심)로 표시하거나 숨기지 말고 명확한 'pending'
  // source로 구분해야 한다 — 매칭되는 지역명이 전혀 없을 때의 기본 동작을
  // 확인한다(addressAccuracy가 'region_only'여도 매칭되는 PLACES 항목이
  // 없으면 여전히 'pending'이어야 함 — 아래 별도 테스트가 매칭되는 경우의
  // 예외를 검증한다).
  //
  // 2026-09-07 최종 검증에서 발견된 결함 수정: 이전 버전은 여기 "매칭되는
  // 지역명이 전혀 없는" 표본으로 "Toàn khu vực, Vũng Tàu"를 썼는데, 그 뒤
  // PLACES에 Vũng Tàu(운영 데이터 실측으로 확인된 실제 지역)를 추가하면서
  // 이 표본이 더 이상 "매칭 없음" 사례가 아니게 됐다 — 미등록 지역을
  // 정상이라고 가정했던 셈이라 잘못된 테스트였다. 실존하지 않는 합성
  // 지명으로 바꿔 "정말 매칭이 없는 경우"만 검증하도록 정정한다.
  const pendingJob = {
    workLocations: [{
      rawAddress: 'Toàn khu vực, Khu Vực Không Xác Định', coordinateAccuracy: 'unresolved' as const,
      geocodeStatus: 'pending' as const, addressAccuracy: 'region_only' as const,
    }],
  }
  const pendingResult = resolveMapLocations(pendingJob)
  assertEqual(pendingResult.source, 'pending', "geocode_status='pending' + 매칭되는 지역명이 전혀 없으면 -> map source 'pending', not 'default'")
  assertEqual(pendingResult.points.length, 0, "pending source must return zero points (nothing to plot yet)")

  // 여러 근무지 중 하나라도 pending이 아니면(예: 이미 success로 지오코딩됨)
  // 더 이상 전부 pending은 아니므로, 기존 로직대로 그 위치를 사용해야 한다.
  const mixedJob = {
    workLocations: [
      {
        rawAddress: 'Toàn khu vực, Khu Vực Không Xác Định', coordinateAccuracy: 'unresolved' as const,
        geocodeStatus: 'pending' as const, addressAccuracy: 'region_only' as const,
      },
      { rawAddress: 'C', lat: 10.4, lng: 106.4, coordinateAccuracy: 'exact' as const, locationVerified: true, geocodeStatus: 'success' as const },
    ],
  }
  const mixedResult = resolveMapLocations(mixedJob)
  assertEqual(mixedResult.source, 'exact', "when at least one work location isn't pending, resolveMapLocations must not force the whole job into 'pending'")
}

function testRegionOnlyPendingRealVungTauCase(): void {
  // 2026-09-07 사용자 지시(최종 검증 미완료 사항 보완) — 실측 job_id=436
  // "Toàn khu vực, Vũng Tàu"(pending, region_only)는 findRegionCenter가
  // PLACES에 Vũng Tàu를 인식하지 못해 지도 좌표가 전혀 안 나오던 사례.
  // Bà Rịa - Vũng Tàu가 2025년 성급 통합으로 Hồ Chí Minh에 합쳐졌다는
  // 기존 백엔드 표준화 자료(vn_province_merger_2025.py)를 재사용해 PLACES를
  // 보완한 뒤, 이 실제 사례가 요구사항대로 나오는지 직접 확인한다:
  // source='region'이 아니어도(현재 구현은 'address'를 씀 — 아래 참고)
  // 최소한 'pending'/'default'가 아니어야 하고, 점 1개, precise=false.
  const job = {
    workLocations: [{
      rawAddress: 'Toàn khu vực, Vũng Tàu',
      coordinateAccuracy: 'unresolved' as const,
      geocodeStatus: 'pending' as const,
      addressAccuracy: 'region_only' as const,
    }],
  }
  const result = resolveMapLocations(job)
  assertTrue(result.source !== 'pending' && result.source !== 'default', "실측 Vũng Tàu 사례는 PLACES 보완 후 'pending'/'default'로 남으면 안 됨")
  assertEqual(result.points.length, 1, "지역 대표 좌표 1개가 나와야 함")
  assertFalse(result.points[0].precise, "정확한 사업장 좌표가 아니므로 precise=false를 유지해야 함")
  assertEqual(result.points[0].lat, 10.7769, "Bà Rịa - Vũng Tàu가 합쳐진 Hồ Chí Minh의 PROVINCE_COORDS 좌표를 그대로 재사용해야 함")
  assertEqual(resolveDistanceSearchPoints(job).length, 0, "지역 대표 좌표는 거리검색 대상이 될 수 없다(좌표 없는 region_only 원본)")
}

function testRegionOnlyPendingStillShowsRegionCenterMap(): void {
  // 2026-09-07 사용자 지시(충돌 수정) — addressAccuracy==='region_only'면
  // geocodeStatus==='pending'이어도 기존 findRegionCenter() 지역 대표 지도를
  // 그대로 보여줘야 한다. "아직 확인 안 됨"(geocodeStatus)과 "원문 자체가
  // 지역 수준"(addressAccuracy)은 서로 다른 사실이고, 후자는 pending 여부와
  // 무관하게 항상 지역 대표 위치를 보여줘 왔다 — 처음 pending 처리를 넣을 때
  // 이 기존 동작을 덮어써버린 충돌을 여기서 되돌린다.
  const job = {
    workLocations: [{
      rawAddress: 'Toàn khu vực Hà Nội, Đống Đa',
      coordinateAccuracy: 'unresolved' as const,
      geocodeStatus: 'pending' as const,
      addressAccuracy: 'region_only' as const,
    }],
  }
  const result = resolveMapLocations(job)
  assertTrue(result.source !== 'pending' && result.source !== 'default', "region_only + pending인데 매칭되는 지역명이 있으면 'pending'/'default'로 떨어지면 안 됨")
  assertEqual(result.points.length, 1, "지역 대표 좌표 1개가 그대로 나와야 함")
  assertFalse(result.points[0].precise, "지역 대표 좌표는 정확한 사업장 위치가 아니므로 precise=false를 유지해야 함")

  // 거리검색에서는 계속 제외돼야 한다 — resolveDistanceSearchPoints는 실제
  // job_work_locations.lat/lng이 있는 행만 보므로(지역 대표 좌표는 lat/lng
  // 자체가 없음), 이 케이스는 애초에 대상이 될 수 없다.
  const distancePoints = resolveDistanceSearchPoints(job)
  assertEqual(distancePoints.length, 0, "region_only(좌표 없음)는 거리검색 대상이 될 수 없다 — 지역 대표 좌표를 거리계산에 쓰면 안 됨")
}

function testExactTextPendingNeverFabricatesMapPointEvenWithMatchableText(): void {
  // 2026-09-07 사용자 지시(충돌 수정) — addressAccuracy==='exact_text'인데
  // geocodeStatus==='pending'(아직 지오코딩 시도 자체를 안 함)이면, 원문에
  // 우연히 매칭되는 지명이 있어도("Aeon Mall Hà Đông, Hà Đông"의 "Hà Đông")
  // 지도에 임의 좌표를 만들면 안 된다 — 기존처럼 "위치 확인 중"만 표시해야
  // 한다("아직 시도 안 한 구체 주소"를 "확인된 근사 위치"처럼 보여주면 안 됨).
  const job = {
    workLocations: [{
      rawAddress: 'Aeon Mall Hà Đông, Hà Đông',
      coordinateAccuracy: 'unresolved' as const,
      geocodeStatus: 'pending' as const,
      addressAccuracy: 'exact_text' as const,
    }],
  }
  const result = resolveMapLocations(job)
  assertEqual(result.source, 'pending', "exact_text + pending은 텍스트에 매칭되는 지명이 있어도 'pending'으로 남아야 함(임의 좌표 생성 금지)")
  assertEqual(result.points.length, 0, "exact_text + pending은 지도에 점을 만들면 안 됨")
}

function testFindRegionCenterCoversEveryProvinceUsedByRegionOnlyProductionData(): void {
  // 2026-09-07 사용자 지시 — 운영 DB의 job_work_locations(address_accuracy=
  // 'region_only')에서 matched_recruitment_regions로 실제 쓰이는 고유 성·시
  // 26개를 읽기 전용으로 집계한 결과(전수 확인, 2026-09-07 기준 region_only
  // 76건 전체가 matched_recruitment_regions를 최소 1개씩 가짐 — 원문 텍스트만
  // 보고 판단할 필요가 없었음). 이 26개 전부가 findRegionCenter()에서 null이
  // 아니어야 한다 — 알려진 성·시를 'pending'으로 방치하지 않는다는 요구사항의
  // 직접적인 회귀 가드.
  const productionRegionOnlyProvinces = [
    'TP.HCM', 'Hà Nội', 'Bình Dương', 'Long An', 'Hải Dương', 'Đồng Nai',
    'Yên Bái', 'Hòa Bình', 'Ninh Bình', 'Tiền Giang', 'Nghệ An', 'Bình Phước',
    'Lâm Đồng', 'Trà Vinh', 'Bến Tre', 'Vĩnh Long', 'Lạng Sơn', 'Quảng Ninh',
    'Thái Nguyên', 'Hà Nam', 'Phú Yên', 'Khánh Hòa', 'Bắc Ninh', 'Hưng Yên',
    'Nam Định', 'Bà Rịa - Vũng Tàu',
  ]
  const unresolved = productionRegionOnlyProvinces.filter((p) => findRegionCenter(p) === null)
  assertTrue(unresolved.length === 0, `findRegionCenter는 운영 region_only 데이터가 쓰는 26개 성·시 전부를 인식해야 한다 — 미인식: ${JSON.stringify(unresolved)}`)
}

function main(): void {
  const tests = [
    testResolveWorkLocationQuery,
    testDirectionsAlwaysAvailableRegardlessOfLocationState,
    testCase4682IndustrialParkCenterIsNotACompanyLocation,
    testHumanApprovedLocationLifecycle,
    testDistanceLabelSaysStraightLine,
    testDistanceSearchOnlyUsesVerifiedLocations,
    testMapShownForEveryLocationTier,
    testRecruitmentRegionFallbackNeverDuplicatesOneCoordinate,
    testCompanyRegisteredAddressNeverUsedAsMapOrDirectionsFallback,
    testPendingGeocodeStatusIsDistinctFromDefaultAndNeverFallsBackToText,
    testRegionOnlyPendingRealVungTauCase,
    testRegionOnlyPendingStillShowsRegionCenterMap,
    testExactTextPendingNeverFabricatesMapPointEvenWithMatchableText,
    testFindRegionCenterCoversEveryProvinceUsedByRegionOnlyProductionData,
  ]
  for (const test of tests) {
    test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} jobCoords tests passed`)
}

main()
