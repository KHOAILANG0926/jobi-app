// 공식 직업분류 2단계 그룹 판정·필터 (2026-10-15, 규칙 R8 화면 연결).
import { matchesOccupationGroups, occupationGroupCode, occupationGroupsInJobs } from './occupationGroups.ts'
import { DEFAULT_FILTERS, findNearbyJobs, matchesFilters } from './homeMapFilters.ts'
import type { Job } from '../types/job.ts'

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label)
}
const job = (id: string, occupationCode?: string): Job => ({
  id, title: id, company: 'Cty', category: 'san_xuat_xay_dung', salary: '', location: '', description: '',
  postedAt: '2026-10-15', employerPhone: '', applicationDeadline: '', occupationCode,
} as Job)

assert(occupationGroupCode('82022') === '82', '5단계 → 2단계 그룹')
assert(occupationGroupCode('7212') === '72', '4단계 → 2단계 그룹')
assert(occupationGroupCode('0110') === '01', '앞자리 0 코드 보존')
assert(occupationGroupCode(undefined) === undefined && occupationGroupCode('abc') === undefined, '미분류·이상값은 그룹 없음')

const jobs = [job('a', '82022'), job('b', '8202'), job('c', '7212'), job('d')]
const groups = occupationGroupsInJobs(jobs)
assert(JSON.stringify(groups) === JSON.stringify([{ code: '82', count: 2 }, { code: '72', count: 1 }]), '공고 있는 그룹만, 많은 순')

assert(matchesOccupationGroups(job('d'), []), '선택 없음 = 전체(미분류 포함)')
assert(!matchesOccupationGroups(job('d'), ['82']), '그룹 선택 시 미분류 제외')
assert(matchesOccupationGroups(job('a', '82022'), ['72', '82']), '여러 그룹 중 하나')

assert(matchesFilters(job('d'), DEFAULT_FILTERS), '기본 필터는 미분류 공고도 통과')
assert(!matchesFilters(job('c', '7212'), { ...DEFAULT_FILTERS, occupationGroups: ['82'] }), '필터에 그룹 반영')
// 칩 숫자 = 반경 안 + 확인된 근무지가 있는 공고만 (2026-10-15 사용자 지적: #4824처럼 위치 미확인 공고가 100m·8km 모두 1로 나옴)
const ORIGIN = { lat: 21.1861, lng: 106.0763 }
const located = (id: string, code: string, dLat: number, verified = true): Job => ({
  ...job(id, code), workLocations: [{ id: 1, rawAddress: 'x', lat: ORIGIN.lat + dLat, lng: ORIGIN.lng, sortOrder: 0, locationVerified: verified }],
} as Job)
const pool = [job('unverified-no-location', '82022'), located('unverified', '82022', 0.001, false), located('near', '7212', 0.0005), located('far', '8202', 0.05)]
const groupsAt = (radiusKm: number) => occupationGroupsInJobs(findNearbyJobs(pool, ORIGIN, { ...DEFAULT_FILTERS, radiusKm }).map((n) => n.job))
assert(JSON.stringify(groupsAt(0.1)) === JSON.stringify([{ code: '72', count: 1 }]), '100m: 가까운 확인 공고만')
assert(JSON.stringify(groupsAt(8)) === JSON.stringify([{ code: '72', count: 1 }, { code: '82', count: 1 }]), '8km: 먼 공고 포함, 위치 미확인은 제외')
console.log('occupationGroups: all assertions passed')
