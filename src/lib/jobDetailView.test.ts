import type { Job } from '../types/job.ts'
import { JOB_SECTIONS } from '../data/jobSchema.ts'
import { JOB_SECTION_LABELS, JOB_SECTION_ORDER, jobSectionId, deadlineBadge, jobTags, shiftLabel, weekendLabel, contactOf, salaryPeriodLabel, isGenericCompanyName, JOB_TABS, tabOfSection, benefitList, isKcnLevelText } from './jobDetailView.ts'

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

// tabs: 3개, Điều kiện가 근무조건·모집조건·근무지역을 묶음 — 모든 구역이 정확히 한 탭에 속한다
assert(same(JOB_TABS.map((t) => t.label), ['Điều kiện', 'Mô tả công việc', 'Thông tin công ty']), '3 tabs')
assert(same(JOB_TABS[0].sections, ['conditions', 'recruit', 'location']), 'first tab groups conditions, recruit, location')
assert(same(JOB_TABS.flatMap((t) => t.sections), JOB_SECTIONS), 'every section belongs to exactly one tab, in schema order')
assert(tabOfSection('recruit') === 'conditions' && tabOfSection('location') === 'conditions' && tabOfSection('description') === 'description' && tabOfSection('company') === 'company', 'tabOfSection')

// header tags: only decision factors (shuttle, dormitory, meal, immediate start, weekly pay) and only when confirmed
const base = { id: 'sb-1', title: 't', company: 'c' } as unknown as Job
assert(jobTags(base).length === 0, 'no data → no tags')
assert(jobTags({ ...base, shuttleBus: false, dormitory: null, mealProvided: false, immediateStart: null } as Job).length === 0, 'false/null are never shown as tags')
assert(same(jobTags({ ...base, shuttleBus: true, dormitory: true, mealProvided: true, immediateStart: true, socialInsurancePledge: true, employmentType: 'seasonal' } as Job),
  ['Xe đưa đón', 'Ký túc xá', 'Bao ăn', 'Đi làm ngay']), 'header tags: fixed order, BHXH/employment type are not header tags')
assert(same(jobTags({ ...base, rawSalary: '1.500.000đ/tuần' } as Job), ['Lương tuần']), 'weekly pay from the salary text')
assert(jobTags({ ...base, rawSalary: '30 TRIỆU/THÁNG' } as Job).length === 0 && jobTags({ ...base, rawSalary: '6 ngày làm việc trong tuần 12tr' } as Job).length === 0, 'monthly pay / loose "tuần" mention is not weekly pay')

// Phúc lợi row: BHXH pledge + extracted benefits, minus what the header already shows
assert(same(benefitList({ ...base, benefitTags: ['BHXH', 'BHYT', 'Thưởng lễ, Tết'] } as Job), ['BHXH', 'BHYT', 'Thưởng lễ, Tết']), 'benefit list from extracted tags')
assert(same(benefitList({ ...base, socialInsurancePledge: true } as Job), ['BHXH']), 'BHXH pledge alone')
assert(same(benefitList({ ...base, mealProvided: true, benefitTags: ['Bao ăn', 'Thưởng'] } as Job), ['Thưởng']), 'no duplicates with header tags')
assert(benefitList(base).length === 0, 'no benefits → empty (row hidden)')

// KCN-level address text
assert(isKcnLevelText('KCN VSIP, Bắc Ninh') && isKcnLevelText('Khu công nghiệp Yên Phong') && isKcnLevelText('Cụm công nghiệp Tân Hà') && isKcnLevelText('Lô A, KCX Tân Thuận'), 'KCN-level texts')
assert(!isKcnLevelText('123 Nguyễn Trãi, Quận 1') && !isKcnLevelText('Công ty Kcnhd') && !isKcnLevelText(undefined), 'non-KCN texts')

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
