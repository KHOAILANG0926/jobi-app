/**
 * Standalone regression tests for jobCoords.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/jobCoords.test.ts`.
 */
import {
  findRegionCenter,
  googleMapsLinks,
  resolveDistanceSearchPoint,
  resolveDistanceSearchPoints,
  resolveMapLocations,
  resolveWorkLocationQuery,
} from './jobCoords.ts'
import type { CoordinateAccuracy } from '../types/job.ts'

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
  // 2026-09-04 사용자 지시("길찾기 정책 수정"): "location_verified=false인
  // ward도 길찾기 버튼을 숨기지 않음 — 마커와 정확한 거리 계산만 제외. 길찾기는
  // 좌표 대신 raw_address + 상위 시·도 + Vietnam 텍스트 검색으로 실행. 공개된
  // 모든 위치 상태에서 길찾기가 존재하는 회귀 테스트 추가."
  //
  // googleMapsLinks()는 텍스트 쿼리만 받고 좌표/coordinateAccuracy/
  // locationVerified를 아예 파라미터로도 받지 않는다 — 즉 by construction
  // 모든 위치 상태에서 항상 유효한 길찾기 링크를 만들 수 있다. 이 테스트는
  // 실제 발행 가능한 모든 coordinateAccuracy 등급 × locationVerified × lat/lng
  // 유무 조합에 대해 resolveWorkLocationQuery()가 항상 비어있지 않은 쿼리를
  // 만들고, 그 결과로 googleMapsLinks()가 항상 유효한 view/directions URL을
  // 만드는지 exhaustively 확인한다 — JobDetail.tsx가 이 값들로 링크 표시 여부를
  // 절대 게이팅하면 안 된다는 사실을 함수 시그니처 수준에서 증명한다.
  const tiers: (CoordinateAccuracy | undefined)[] = ['exact', 'ward', 'region', 'unresolved', undefined]
  const verifiedStates = [true, false, undefined]
  const coordStates: { lat?: number; lng?: number }[] = [{ lat: 10.7, lng: 106.7 }, {}]

  for (const coordinateAccuracy of tiers) {
    for (const locationVerified of verifiedStates) {
      for (const coords of coordStates) {
        const loc = {
          rawAddress: 'Khu Công nghiệp Hiệp Phước, xã Hiệp Phước, Nhà Bè',
          coordinateAccuracy,
          locationVerified,
          ...coords,
        }
        const query = resolveWorkLocationQuery(loc, 'TP.HCM')
        const label = `tier=${coordinateAccuracy} verified=${locationVerified} hasCoords=${'lat' in coords}`
        if (!query || query.trim().length === 0) {
          throw new Error(`${label}: resolveWorkLocationQuery must never return an empty query`)
        }
        const links = googleMapsLinks(query)
        if (!links.view.startsWith('https://www.google.com/maps/search/')) {
          throw new Error(`${label}: view link must always be constructible`)
        }
        if (!links.directions.startsWith('https://www.google.com/maps/dir/')) {
          throw new Error(`${label}: directions link must always be constructible, regardless of coordinate trust state`)
        }
        // 길찾기는 좌표가 아니라 텍스트 검색이다 — destination 파라미터 안에
        // encode된 주소 텍스트가 그대로 들어있어야 한다(좌표 쌍이 아님).
        if (!links.directions.includes(encodeURIComponent('Khu Công nghiệp Hiệp Phước'))) {
          throw new Error(`${label}: directions must be text-search based (raw_address encoded in the URL), not coordinate-based`)
        }
      }
    }
  }
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

  // lat/lng 있음 + exact + locationVerified=false → 근사 거리검색 포함(precise=false).
  const onlyExactUnverified = resolveDistanceSearchPoint({ workLocations: [exactUnverified] })
  assertTrue(onlyExactUnverified !== null && onlyExactUnverified.lat === 10.1 && onlyExactUnverified.precise === false, "lat/lng present + coordinateAccuracy='exact' + locationVerified=false must be INCLUDED as APPROXIMATE (precise=false)")

  // lat/lng 있음 + exact + locationVerified=true → 정밀 거리검색 포함(precise=true).
  const onlyExactVerified = resolveDistanceSearchPoint({ workLocations: [exactVerified] })
  assertTrue(onlyExactVerified !== null && onlyExactVerified.lat === 10.15 && onlyExactVerified.lng === 106.15 && onlyExactVerified.precise === true, "lat/lng present + exact + locationVerified=true must be INCLUDED as PRECISE (precise=true)")

  // lat/lng 있음 + ward + locationVerified=true → 정밀 거리검색 포함.
  const onlyWardVerified = resolveDistanceSearchPoint({ workLocations: [verifiedWard] })
  assertTrue(onlyWardVerified !== null && onlyWardVerified.lat === 10.2 && onlyWardVerified.lng === 106.2 && onlyWardVerified.precise === true, "lat/lng present + ward + locationVerified=true must be INCLUDED as PRECISE (coordinateAccuracy tier is irrelevant once verified)")

  // lat/lng 있음 + ward + locationVerified=false → 근사 거리검색 포함(precise=false).
  const onlyWardUnverified = resolveDistanceSearchPoint({ workLocations: [unverifiedWard] })
  assertTrue(onlyWardUnverified !== null && onlyWardUnverified.lat === 10.3 && onlyWardUnverified.precise === false, "lat/lng present + ward + locationVerified=false must be INCLUDED as APPROXIMATE (precise=false)")

  // lat/lng 있음 + region → 등급 무관 완전 제외(행정 중심, 근사 거리검색도 안 됨).
  assertEqual(resolveDistanceSearchPoint({ workLocations: [regionTier] }), null, "region-tier point must be EXCLUDED from distance search even though it has real lat/lng, and even as an approximate point")

  // lat/lng 없음 + locationVerified=true → 거리검색 제외(검증 플래그만으로는
  // 부족하다 — 실제 유한한 좌표가 없으면 애초에 계산할 게 없다).
  assertEqual(resolveDistanceSearchPoint({ workLocations: [noCoords] }), null, "locationVerified=true but no lat/lng at all -> must still be excluded, nothing to calculate distance from")

  // 복수 근무지 — 정밀 2개 + 근사 2개 + region(좌표 있음) + 좌표없음, 총 4개만 포함.
  const mixed = resolveDistanceSearchPoints({ workLocations: [exactUnverified, exactVerified, verifiedWard, unverifiedWard, regionTier, noCoords] })
  assertEqual(mixed.length, 4, "the two precise + two approximate locations count; region-tier and no-coords are excluded")
  assertTrue(mixed.some((p) => p.lat === 10.15 && p.lng === 106.15 && p.precise), "verified exact point must be included as precise")
  assertTrue(mixed.some((p) => p.lat === 10.2 && p.lng === 106.2 && p.precise), "verified ward point must be included as precise")
  assertTrue(mixed.some((p) => p.lat === 10.1 && !p.precise), "unverified exact-tagged point must be included as approximate")
  assertTrue(mixed.some((p) => p.lat === 10.3 && !p.precise), "unverified ward point must be included as approximate")
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

function main(): void {
  const tests = [
    testResolveWorkLocationQuery,
    testDirectionsAlwaysAvailableRegardlessOfLocationState,
    testDistanceSearchOnlyUsesVerifiedLocations,
    testMapShownForEveryLocationTier,
    testRecruitmentRegionFallbackNeverDuplicatesOneCoordinate,
    testCompanyRegisteredAddressNeverUsedAsMapOrDirectionsFallback,
  ]
  for (const test of tests) {
    test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} jobCoords tests passed`)
}

main()
