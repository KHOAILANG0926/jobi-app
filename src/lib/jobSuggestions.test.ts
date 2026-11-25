const assert = { equal(a: unknown, b: unknown, msg = '') { if (a !== b) throw new Error(msg || `${a} !== ${b}`) }, deepEqual(a: unknown, b: unknown, msg = '') { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) } }
import { hasSuggestionSignal, preferredCategoryCounts, suggestJobs } from './jobSuggestions.ts'
import type { Job } from '../types/job.ts'

const job = (id: string, category: string, extra: Partial<Job> = {}) => ({ id, title: id, company: 'Fixture', location: 'Bắc Ninh', category, salary: 'Thỏa thuận', description: '', postedAt: '2026-11-01', hireCount: 0, ...extra } as Job)
const food1 = job('f1', 'am_thuc_do_uong'), food2 = job('f2', 'am_thuc_do_uong', { hireCount: 5 }), factory = job('p1', 'san_xuat_xay_dung'), food3 = job('f3', 'am_thuc_do_uong')
const all = [food1, food2, factory, food3]

assert.deepEqual(suggestJobs({ jobs: all, savedJobs: [], appliedJobs: [] }), [], 'no signal → no suggestions (never fills with a general list)')
assert.equal(hasSuggestionSignal(preferredCategoryCounts([], []), undefined), false, 'no activity, no region → no signal')
const s = suggestJobs({ jobs: all, savedJobs: [food1], appliedJobs: [] })
assert.deepEqual(s.map((x) => x.job.id), ['f2', 'f3'], 'saved jobs are excluded; same category ranked by hireCount')
assert.equal(s[0].reasons[0], 'Ngành quan tâm: ' + (s[0].reasons[0].split(': ')[1]), 'reason names the category')
assert.equal(s.every((x) => x.reasons.length === 1), true, 'only real reasons are listed')
const counted = preferredCategoryCounts([food1], [food2])
assert.equal(counted.get('am_thuc_do_uong' as Job['category']), 2, 'saved and applied both count')
console.log('jobSuggestions: no-signal empty, exclusion of saved/applied, category ranking passed')
