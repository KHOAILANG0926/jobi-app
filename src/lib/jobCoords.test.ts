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
  // Approximate work locations carry a human-readable caveat in rawAddress
  // (e.g. "... vị trí trung tâm gần đúng") for on-screen display, but the
  // external Google Maps search/directions link must use the clean
  // normalizedAddress — not repeat that caveat text as part of the query.
  const approx = {
    rawAddress: 'Long An (khu vực dự án, vị trí trung tâm gần đúng)',
    normalizedAddress: 'Long An',
  }
  const query = resolveWorkLocationQuery(approx)
  assertEqual(query, 'Long An', 'approximate location: query uses normalizedAddress')
  assertEqual(query.includes('gần đúng'), false, 'approximate location: query must not include the on-screen caveat text')

  // A real, exact address (e.g. resolved from a depot's Google Maps link) has
  // no normalizedAddress override — the full address itself is already the
  // right search query and must be used as-is.
  const exact = { rawAddress: 'Depot Bình Tân, 1812-1814 Võ Văn Kiệt, P. An Lạc, Q. Bình Tân, TP.HCM' }
  assertEqual(resolveWorkLocationQuery(exact), exact.rawAddress, 'exact address with no normalizedAddress: falls back to rawAddress')

  // An empty-string normalizedAddress (falsy) must still fall back to rawAddress,
  // not resolve to an empty search query.
  const emptyNormalized = { rawAddress: 'Hưng Yên', normalizedAddress: '' }
  assertEqual(resolveWorkLocationQuery(emptyNormalized), 'Hưng Yên', 'empty normalizedAddress falls back to rawAddress')
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
