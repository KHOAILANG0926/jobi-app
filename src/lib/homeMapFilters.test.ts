// homeMapFilters — 확인된 근무지·근무조건 필터의 NULL(미확인) 처리(2026-10-01).
import { DEFAULT_FILTERS, findNearbyJobs, matchesFilters } from './homeMapFilters.ts'
import { conditionBadges } from './jobConditions.ts'
import type { Job } from '../types/job.ts'

function assert(cond: boolean, label: string): void {
  if (!cond) throw new Error(label)
}

const ORIGIN = { lat: 21.1861, lng: 106.0763 }
function job(id: string, extra: Partial<Job> = {}, verified = true): Job {
  return {
    id, title: id, company: 'Cty', category: 'san_xuat_xay_dung', salary: '12 - 15 triệu', location: 'Bắc Ninh',
    description: '', postedAt: '2026-10-01', employerPhone: '0900000000', applicationDeadline: '',
    workLocations: [{ id: 1, rawAddress: 'KCN', lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng, sortOrder: 0, locationVerified: verified }],
    ...extra,
  } as Job
}

function testUnverifiedLocationIsNotOnMap(): void {
  const r = findNearbyJobs([job('a'), job('b', {}, false)], ORIGIN, DEFAULT_FILTERS)
  assert(r.length === 1 && r[0].job.id === 'a', 'only verified work locations are mapped')
}

function testRadiusUsesKilometersWithoutVisualScaling(): void {
  for (const radiusKm of [1, 3, 5, 10]) {
    const pointAtRadius = job(`edge-${radiusKm}`, {
      workLocations: [{
        id: radiusKm,
        rawAddress: 'edge',
        lat: ORIGIN.lat + radiusKm / 111.19508023352181,
        lng: ORIGIN.lng,
        sortOrder: 0,
        locationVerified: true,
      }],
    })
    const results = findNearbyJobs([pointAtRadius], ORIGIN, { ...DEFAULT_FILTERS, radiusKm })
    assert(results.length === 1, `${radiusKm}km filter uses the same geographic kilometer radius`)
  }
}

function testNullConditionNeverMatches(): void {
  const f = { ...DEFAULT_FILTERS, extras: ['shuttle_bus' as const] }
  assert(matchesFilters(job('yes', { shuttleBus: true }), f), 'shuttleBus true matches')
  assert(!matchesFilters(job('no', { shuttleBus: false }), f), 'shuttleBus false does not match')
  assert(!matchesFilters(job('unknown', { shuttleBus: null }), f), 'shuttleBus null (unknown) does not match')
}

function testRecruitmentTypeUsesExplicitValueOnly(): void {
  const f = { ...DEFAULT_FILTERS, extras: ['direct_hire' as const] }
  assert(!matchesFilters(job('emp', { employerId: 'u1', recruitmentType: null }), f), 'employer_id alone is not direct hire')
  assert(matchesFilters(job('d', { recruitmentType: 'direct' }), f), 'explicit direct matches')
  assert(!matchesFilters(job('u', { recruitmentType: 'unknown' }), f), 'unknown does not match direct')
}

function testBadgesSkipUnknownValues(): void {
  const labels = conditionBadges(job('x', { shuttleBus: false, dormitory: null, mealProvided: true, shiftType: 'night' })).map((b) => b.label)
  assert(labels.includes('Có bữa ăn') && labels.includes('Ca đêm'), 'confirmed values shown')
  assert(!labels.some((l) => /Xe đưa đón|Ký túc xá/.test(l)), 'false/null values are not shown as badges')
}

const tests = [testUnverifiedLocationIsNotOnMap, testRadiusUsesKilometersWithoutVisualScaling, testNullConditionNeverMatches, testRecruitmentTypeUsesExplicitValueOnly, testBadgesSkipUnknownValues]
for (const t of tests) { t(); console.log(`✅ ${t.name}`) }
console.log(`\n결과: ${tests.length}/${tests.length} homeMapFilters tests passed`)
