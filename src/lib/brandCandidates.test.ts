/**
 * Standalone regression tests for brandCandidates.ts — plain assertions, no
 * test framework (matches jobRows.test.ts convention). Run directly:
 * `node src/lib/brandCandidates.test.ts`.
 */
import { detectBrandCandidates } from './brandCandidates.ts'
import { ensureJobFields } from './jobUtils.ts'
import type { Job } from '../types/job.ts'

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}
function assertTrue(value: unknown, label: string): void {
  if (!value) throw new Error(label)
}

function job(overrides: Partial<Job>): Job {
  return ensureJobFields({
    id: 'x', title: '', company: '', category: 'khac', salary: '', location: '',
    hours: '', urgent: false, description: '', employerPhone: '', applicationDeadline: '',
    postedAt: '2026-01-01', ...overrides,
  } as Job)
}

const registeredBrands = [{ matchKeys: ['Jollibee'] }]

// 1) 등록 브랜드와 매칭되는 공고는 후보에서 제외된다.
{
  const jobs = [
    job({ company: 'Jollibee Việt Nam', category: 'am_thuc_do_uong' }),
    job({ company: 'Jollibee Việt Nam', category: 'am_thuc_do_uong' }),
  ]
  const candidates = detectBrandCandidates(jobs, registeredBrands, new Set())
  assertEqual(candidates.length, 0, '등록 브랜드 매칭 공고는 후보에서 제외')
}

// 2) 동일 회사 공고 2건 이상 + 대상 업종이면 후보로 잡힌다.
{
  const jobs = [
    job({ company: 'Chuỗi Cafe ABC', category: 'am_thuc_do_uong', title: 'Pha chế 1', description: 'hệ thống nhiều chi nhánh' }),
    job({ company: 'Chuỗi Cafe ABC', category: 'am_thuc_do_uong', title: 'Pha chế 2', location: 'TP.HCM' }),
  ]
  const candidates = detectBrandCandidates(jobs, registeredBrands, new Set())
  assertEqual(candidates.length, 1, '2건 이상 + 대상 업종 → 후보 1건')
  assertEqual(candidates[0].companyName, 'Chuỗi Cafe ABC', '후보 회사명 일치')
  assertEqual(candidates[0].jobCount, 2, '후보 공고 수 일치')
  assertTrue(candidates[0].chainSignal, '"hệ thống" 표현이 있으면 chainSignal=true')
}

// 3) 공고 1건뿐인 회사는 후보가 되지 않는다("일반 단일 회사" 자동 공개 방지).
{
  const jobs = [job({ company: 'Single Shop', category: 'quan_ly_ban_hang' })]
  const candidates = detectBrandCandidates(jobs, registeredBrands, new Set())
  assertEqual(candidates.length, 0, '공고 1건뿐이면 후보 아님')
}

// 4) 제조 대기업 키워드는 공고가 여러 건이어도 후보에서 제외된다.
{
  const jobs = [
    job({ company: 'Samsung Electronics Việt Nam', category: 'san_xuat_xay_dung' }),
    job({ company: 'Samsung Electronics Việt Nam', category: 'san_xuat_xay_dung' }),
  ]
  const candidates = detectBrandCandidates(jobs, registeredBrands, new Set())
  assertEqual(candidates.length, 0, '제조 대기업(Samsung)은 후보에서 제외')
}

// 5) 대상 업종이 아니면(van_phong/san_xuat_xay_dung/dich_vu/khac 등) 여러 건이어도 후보가 아니다.
{
  const jobs = [
    job({ company: 'Văn Phòng Test', category: 'van_phong' }),
    job({ company: 'Văn Phòng Test', category: 'van_phong' }),
  ]
  const candidates = detectBrandCandidates(jobs, registeredBrands, new Set())
  assertEqual(candidates.length, 0, '대상 업종 밖이면 후보 아님')
}

// 6) 무시(dismiss)된 회사는 조건을 만족해도 후보에 다시 나타나지 않는다.
{
  const jobs = [
    job({ company: 'Dismissed Co', category: 'quan_ly_ban_hang' }),
    job({ company: 'Dismissed Co', category: 'quan_ly_ban_hang' }),
  ]
  const dismissed = new Set(['dismissed co'])
  const candidates = detectBrandCandidates(jobs, registeredBrands, dismissed)
  assertEqual(candidates.length, 0, '무시된 회사는 후보로 재등장하지 않음')
}

console.log('brandCandidates.test.ts: all assertions passed')
