const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) } }
import { filterJobsByListConditions, sortJobsForList, type JobListConditions } from './jobListFilter.ts'
import type { Job } from '../types/job.ts'

const base = (j: Partial<Job> & { id: string }) => ({ title: j.id, company: 'Fixture', location: 'Bắc Ninh', category: 'san_xuat_xay_dung', salary: 'Thỏa thuận', description: '', postedAt: '2026-11-01', ...j } as Job)
const jobs = [
  base({ id: 'a', postedAt: '2026-11-01', applicationDeadline: '2026-12-01', workDays: 'Thứ 2 - Thứ 6', hours: '08:00 - 17:00', genderRequirement: 'Nam', description: 'ký túc xá' }),
  base({ id: 'b', postedAt: '2026-11-03', category: 'am_thuc_do_uong', subcategory: 'phuc_vu', workDays: 'Thứ 7, Chủ nhật', hours: '18:00 - 23:00', ageRequirement: '18-35' }),
  base({ id: 'c', postedAt: '2026-11-02', description: 'tăng ca nhiều', laborContractPledge: true }),
]
const areas = new Map([
  ['a', { provinces: ['Bắc Ninh'], wards: ['Võ Cường'] }],
  ['b', { provinces: ['Bắc Ninh'], wards: ['Tiền An'] }],
  ['c', { provinces: ['Hà Nội'], wards: [] }],
])
const none: JobListConditions = {
  selectedProvince: null, selectedWards: new Set(), categoryIds: new Set(), selectedSubcategoryKeys: new Set(), workPeriods: new Set(),
  jobDurations: new Set(), genderFilter: null, ageFilter: '', pledgeOnly: false, selectedDays: new Set(), selectedDayCounts: new Set(),
  excludeUnspecifiedDays: false, excludeUnspecifiedHours: false, selectedTimeBuckets: new Set(), includeKeywords: [], excludeKeywords: [],
}
const ids = (c: Partial<JobListConditions>) => filterJobsByListConditions(jobs, { ...none, ...c }, areas).map((j) => j.id)

assert.deepEqual(ids({}), ['a', 'b', 'c'], 'no condition keeps every posting')
assert.deepEqual(ids({ selectedProvince: 'Bắc Ninh' }), ['a', 'b'], 'province')
assert.deepEqual(ids({ selectedProvince: 'Bắc Ninh', selectedWards: new Set(['Tiền An']) }), ['b'], 'province + ward')
assert.deepEqual(ids({ categoryIds: new Set(['am_thuc_do_uong' as Job['category']]) }), ['b'], 'category')
assert.deepEqual(ids({ selectedSubcategoryKeys: new Set(['am_thuc_do_uong:phuc_vu']) }), ['b'], 'subcategory')
assert.deepEqual(ids({ genderFilter: 'Nam' }), ['a', 'b', 'c'], 'unset gender means no restriction and stays')
assert.deepEqual(ids({ genderFilter: 'Nữ' }), ['b', 'c'], 'other gender restriction is excluded, unset stays')
assert.deepEqual(ids({ ageFilter: '18-35' }), ['a', 'b', 'c'], 'unset age stays')
assert.deepEqual(ids({ pledgeOnly: true }), ['c'], 'pledge')
assert.deepEqual(ids({ selectedDays: new Set(['CN' as const]) }), ['b'], 'days')
assert.deepEqual(ids({ excludeUnspecifiedDays: true }), ['a', 'b'], 'unspecified days excluded')
assert.deepEqual(ids({ selectedTimeBuckets: new Set(['toi' as const]) }), ['b'], 'time bucket')
assert.deepEqual(ids({ includeKeywords: ['ky tuc xa'] }), ['a'], 'include keyword ignores diacritics')
assert.deepEqual(ids({ excludeKeywords: ['tang ca'] }), ['a', 'b'], 'exclude keyword')
assert.deepEqual(sortJobsForList(jobs, 'newest').map((j) => j.id), ['b', 'c', 'a'], 'newest first')
assert.deepEqual(sortJobsForList(jobs, 'deadline').map((j) => j.id), ['a', 'b', 'c'], 'deadline first, open-ended last')
console.log('jobListFilter: province/ward/category/gender/age/pledge/days/time/keywords and sort passed')
