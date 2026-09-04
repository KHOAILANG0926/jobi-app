/**
 * Standalone regression tests for jobCoords.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/jobCoords.test.ts`.
 */
import { googleMapsLinks, resolveWorkLocationQuery } from './jobCoords.ts'
import type { CoordinateAccuracy } from '../types/job.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
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

function main(): void {
  const tests = [testResolveWorkLocationQuery, testDirectionsAlwaysAvailableRegardlessOfLocationState]
  for (const test of tests) {
    test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} jobCoords tests passed`)
}

main()
