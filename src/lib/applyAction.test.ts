// resolveApplyAction() — 목록·상세 지원 버튼의 공통 기준(2026-09-30).
import { resolveApplyAction } from './jobUtils.ts'
import type { Job } from '../types/job.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
}

const base = { employerId: undefined, employerPhone: '', zalo: undefined } as Pick<Job, 'employerId' | 'employerPhone' | 'zalo'>

function testPlatformEmployerJobUsesInternalApply(): void {
  assertEqual(resolveApplyAction({ ...base, employerId: 'emp-1', employerPhone: '0900000000' }), 'internal',
    'employer_id present -> internal apply (login flow kept) even if a phone is listed')
}

function testCrawledJobWithPhoneOrZaloIsDirectContact(): void {
  assertEqual(resolveApplyAction({ ...base, employerPhone: '0900000000' }), 'contact', 'crawled + phone -> direct contact')
  assertEqual(resolveApplyAction({ ...base, zalo: '0900000000' }), 'contact', 'crawled + zalo only -> direct contact')
}

function testCrawledJobWithoutContactIsNotApplicable(): void {
  assertEqual(resolveApplyAction(base), 'none', 'crawled without phone/zalo -> not applicable')
  assertEqual(resolveApplyAction({ ...base, employerPhone: '   ' }), 'none', 'whitespace phone is not a contact')
}

async function main() {
  const tests = [testPlatformEmployerJobUsesInternalApply, testCrawledJobWithPhoneOrZaloIsDirectContact, testCrawledJobWithoutContactIsNotApplicable]
  for (const test of tests) {
    await test()
    console.log(`✅ ${test.name}`)
  }
  console.log(`\n결과: ${tests.length}/${tests.length} applyAction tests passed`)
}

main()
