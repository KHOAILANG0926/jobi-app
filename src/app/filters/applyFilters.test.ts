const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) } }
import { activeFilterCount, applyAppFilters, EMPTY_APP_FILTERS } from './applyFilters.ts'
import type { Job } from '../../types/job.ts'

const job = (id: string, extra: Partial<Job> = {}) => ({ id, title: 'Công nhân ' + id, company: 'Fixture', location: 'Bắc Ninh', category: 'san_xuat_xay_dung', salary: '10 triệu', description: '', postedAt: '2026-11-01', ...extra } as Job)
const jobs = [
  job('a', { dormitory: true, workDays: 'Thứ 2 - Thứ 6' }),
  job('b', { category: 'am_thuc_do_uong', title: 'Phục vụ quán', shuttleBus: true }),
  job('c', { location: 'Hà Nội' }),
]
const areas = new Map([['a', { provinces: ['Tỉnh Bắc Ninh'], wards: [] }], ['b', { provinces: ['Tỉnh Bắc Ninh'], wards: [] }], ['c', { provinces: ['Thành phố Hà Nội'], wards: [] }]])
const ids = (f: Partial<typeof EMPTY_APP_FILTERS>) => applyAppFilters(jobs, { ...EMPTY_APP_FILTERS, ...f }, areas).map((j) => j.id)

assert.deepEqual(ids({}), ['a', 'b', 'c'], 'no condition keeps all postings')
assert.equal(activeFilterCount(EMPTY_APP_FILTERS), 0, 'no condition → count 0')
assert.deepEqual(ids({ query: 'phuc vu' }), ['b'], 'query ignores diacritics (jobSearch)')
assert.deepEqual(ids({ province: 'Tỉnh Bắc Ninh' }), ['a', 'b'], 'province (jobListFilter)')
assert.deepEqual(ids({ categories: ['am_thuc_do_uong'] }), ['b'], 'category')
assert.deepEqual(ids({ extras: ['dormitory'] }), ['a'], 'benefit extra (homeMapFilters.matchesFilters, confirmed true only)')
assert.deepEqual(ids({ extras: ['shuttle_bus', 'dormitory'] }), [], 'extras are ANDed')
assert.deepEqual(ids({ days: ['T3'] }), ['a'], 'working days')
assert.equal(activeFilterCount({ ...EMPTY_APP_FILTERS, province: 'x', extras: ['dormitory'], minSalary: 8_000_000 }), 3, 'count')
console.log('app applyFilters: query/province/category/extras/days composed from existing lib functions passed')
