/**
 * Standalone regression tests for jobCoords.ts — plain assertions, no test
 * framework (none is set up in this project). Run directly with Node's native
 * TypeScript support: `node src/lib/jobCoords.test.ts`.
 */
import { resolveWorkLocationQuery } from './jobCoords.ts'

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

function main(): void {
  const tests = [testResolveWorkLocationQuery]
  for (const test of tests) {
    test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} jobCoords tests passed`)
}

main()
