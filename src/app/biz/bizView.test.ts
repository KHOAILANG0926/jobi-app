import { applicationsOfMyJobs, countByJob, filterByJob, pendingApplications, recentApplications, SELECTABLE_STATUSES } from './bizView.ts'
import type { JobApplication } from '../../lib/applicationsStorage.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }
const a = (jobId: string, status: JobApplication['status'], appliedAt: string): JobApplication => ({ jobId, jobTitle: 't', company: 'c', appliedAt, status })
const apps = [a('sb-1', 'submitted', '2026-11-01'), a('sb-1', 'accepted', '2026-11-03'), a('sb-2', 'reviewing', '2026-11-02'), a('sb-9', 'submitted', '2026-11-04')]
const mine = applicationsOfMyJobs(apps, ['sb-1', 'sb-2'])
assert(mine.length === 3, '내 공고 지원만')
assert(JSON.stringify(countByJob(mine)) === JSON.stringify({ 'sb-1': 2, 'sb-2': 1 }), '공고별 지원자 수')
assert(pendingApplications(mine).length === 2, '대기 = 제출됨 + 검토 중')
assert(filterByJob(mine, 'sb-2').length === 1 && filterByJob(mine, 'all').length === 3, '공고 필터')
assert(recentApplications(mine, 2).map((x) => x.appliedAt).join() === '2026-11-03,2026-11-02', '최근순')
assert(!SELECTABLE_STATUSES.includes('submitted') && SELECTABLE_STATUSES.length === 4, '선택 가능한 상태')
console.log('app bizView: 내 공고 지원·공고별 수·대기·필터·최근순 통과')
