import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Production checks must choose data at runtime; generated fixture IDs and SQL
// RETURNING are fine. This gate is deliberately restricted to live check files.
export function fixedLocationSelectors(source) {
  const executable = source.split('\n').filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n')
  return [
    [/\bsb-\d+\b/, '고정 공고 ID'],
    [/\b(?:job_id|jobId|job\.id|\.id)\s*(?:===?|!==?)\s*['"]?\d+/, '공고 번호 조건'],
    [/\b(?:job_id|id)\s*(?:=|in\s*\()\s*\d{3,}/i, 'SQL 공고 번호 조건'],
    [/\b(?:company|title)\s*(?:===?|\.includes\()\s*['"][^'"]+['"]/, '고정 회사·제목 조건'],
  ].filter(([pattern]) => pattern.test(executable)).map(([, message]) => message)
}

export const LIVE_LOCATION_CHECKS = [
  'scripts/ops/map-summary-check.mjs',
  'scripts/ops/map-pin-fit-check.mjs',
  'scripts/ops/admin-location-review-e2e.mjs',
  'scripts/test-job-location-detail.mjs',
]

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = LIVE_LOCATION_CHECKS.flatMap(file => fixedLocationSelectors(readFileSync(file, 'utf8'))
    .map(error => `${file}: ${error}`))
  errors.forEach(error => console.error(error))
  if (errors.length) process.exit(1)
  console.log('운영 위치 시험: 고정 공고 선택 조건 없음')
}
