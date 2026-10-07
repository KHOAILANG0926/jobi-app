import type { Job } from '../types/job.ts'
import { JOB_SECTIONS } from '../data/jobSchema.ts'
import { JOB_SECTION_LABELS, JOB_SECTION_ORDER, jobSectionId, deadlineBadge, jobTags, shiftLabel, weekendLabel, contactOf, salaryPeriodLabel, isGenericCompanyName } from './jobDetailView.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// sections: order comes from jobSchema, every section has a label + anchor
assert(same(JOB_SECTION_ORDER, JOB_SECTIONS), 'section order = jobSchema order')
for (const s of JOB_SECTIONS) assert(!!JOB_SECTION_LABELS[s] && jobSectionId(s) === `jd-sec-${s}`, `label/anchor for ${s}`)

// D-day
assert(deadlineBadge(null) === null && deadlineBadge('') === null, 'no deadline → no badge')
assert(same(deadlineBadge('2026-10-10', '2026-10-07'), { label: 'D-3', tone: 'soon' }), 'D-3 is soon')
assert(same(deadlineBadge('2026-10-17', '2026-10-07'), { label: 'D-10', tone: 'normal' }), 'D-10 normal')
assert(deadlineBadge('2026-10-07', '2026-10-07')?.label === 'Hết hạn hôm nay', 'today')
assert(deadlineBadge('2026-10-06', '2026-10-07')?.tone === 'expired', 'past → expired')
assert(deadlineBadge('2026-10-10T00:00:00+00:00', '2026-10-07')?.label === 'D-3', 'timestamp deadline uses the date part')

// tags: only confirmed values, nothing guessed
const base = { id: 'sb-1', title: 't', company: 'c' } as unknown as Job
assert(jobTags(base).length === 0, 'no data → no tags')
assert(jobTags({ ...base, shuttleBus: false, dormitory: null, mealProvided: false, immediateStart: null } as Job).length === 0, 'false/null are never shown as tags')
assert(same(jobTags({ ...base, shuttleBus: true, dormitory: true, mealProvided: true, socialInsurancePledge: true, immediateStart: true } as Job),
  ['Xe đưa đón', 'Ký túc xá', 'Bao ăn', 'BHXH', 'Đi làm ngay']), 'confirmed tags in fixed order')
assert(jobTags({ ...base, employmentType: 'seasonal', shiftType: 'rotating', rotatingShifts: 3, benefitTags: ['Thưởng', 'Bao ăn'], mealProvided: true } as Job).join('|')
  === 'Thời vụ|Bao ăn|Ca xoay 3 ca|Thưởng', 'employment/rotating/benefit tags, no duplicates')

assert(shiftLabel({ ...base, shiftType: 'rotating', rotatingShifts: 2 } as Job) === 'Ca xoay (2 ca)', 'rotating shift label')
assert(shiftLabel(base) === undefined, 'no shift → undefined')
assert(weekendLabel(null) === undefined && weekendLabel(true) === 'Có làm cuối tuần' && weekendLabel(false) === 'Không làm cuối tuần', 'weekend label')

// salary period badge: only month/day/hour
assert(salaryPeriodLabel('month') === 'Lương tháng' && salaryPeriodLabel('day') === 'Lương ngày' && salaryPeriodLabel('hour') === 'Lương giờ', 'period labels')
assert(salaryPeriodLabel('other') === undefined && salaryPeriodLabel(undefined) === undefined && salaryPeriodLabel(null) === undefined, 'other/none → no badge')

// contact
assert(same(contactOf({ employerPhone: '', zalo: undefined }), { phone: undefined, zalo: undefined }), 'no contact')
assert(same(contactOf({ employerPhone: '0901 234 567', zalo: undefined }), { phone: '0901 234 567', zalo: '0901 234 567' }), 'zalo falls back to phone')
assert(contactOf({ employerPhone: '0901', zalo: '0902' }).zalo === '0902', 'own zalo wins')

assert(isGenericCompanyName('Nhà tuyển dụng Facebook') && isGenericCompanyName('') && isGenericCompanyName('Nhà Tuyển Dụng Ẩn Danh'), 'placeholder company names')
assert(!isGenericCompanyName('Công ty TNHH Samsung') && !isGenericCompanyName('Nhà hàng Hoa Sen'), 'real company names are not generic')

console.log('jobDetailView.test.ts: all assertions passed')
