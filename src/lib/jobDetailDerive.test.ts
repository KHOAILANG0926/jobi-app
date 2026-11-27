import { activeBenefitText, benefitFlags, conditionSalaryLines, employmentText, isAllowanceNote } from './jobDetailDerive.ts'
import type { Job } from '../types/job.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }
const job = (over: Partial<Job> = {}): Job => ({ id: 'sb-1', title: 't', company: 'c', category: 'khac', salary: '', location: '', description: '', postedAt: '2026-11-01', ...over }) as Job

// 급여 줄 접기: 3줄까지는 그대로, 넘으면 앞 2줄 + 세 번째 줄 +나머지
assert(conditionSalaryLines(['a', 'b', 'c']).join('|') === 'a|b|c', '3줄은 그대로')
assert(conditionSalaryLines(['a', 'b', 'c', 'd', 'e']).join('|') === 'a|b|c +2', '5줄은 앞 2줄 + "c +2"')
assert(conditionSalaryLines([]).length === 0, '빈 목록')

// 급여 메모가 수당·상여 설명이면 수당 칸으로
assert(isAllowanceNote('Phụ cấp 500k') && isAllowanceNote('thưởng tháng 13') && isAllowanceNote('PHỤ CẤP ĂN'), '수당·상여 낱말')
assert(!isAllowanceNote('Lương thỏa thuận') && !isAllowanceNote(undefined) && !isAllowanceNote(''), '일반 메모·없음')

// 고용형태 글자: 직무 요약 → 원문 근무형태 여럿 → 구조화 고용형태(+추가) → 근무기간 글자 → 원문 첫 근무형태
assert(employmentText(job(), { workPeriod: 'Dài hạn' }, { workTypes: ['x'] }, 'wp') === 'Dài hạn', '직무 요약이 먼저')
assert(employmentText(job(), null, { workTypes: ['Full-time', 'Part-time'] }, undefined) === 'Full-time / Part-time', '원문 근무형태가 여럿이면 합침')
assert(employmentText(job({ employmentType: 'part_time', employmentTypeExtra: 'internship' }), null, { workTypes: [] }, 'wp') === 'Bán thời gian · Thực tập', '고용형태 + 추가 형태')
assert(employmentText(job({ employmentType: 'full_time', employmentTypeExtra: '' as never }), null, { workTypes: [] }, 'wp') === 'Toàn thời gian', '추가 형태가 빈 글자면 뺌')
assert(employmentText(job(), null, { workTypes: ['Thời vụ'] }, undefined) === 'Thời vụ', '원문 첫 근무형태')
assert(employmentText(job(), null, { workTypes: [] }, undefined) === undefined, '없으면 undefined')
assert(employmentText(job(), null, { workTypes: ['Fulltime'] }, 'Khác') === 'Fulltime', '#921 근무기간 "Khác"는 원문 근무형태를 가리지 않음')
assert(employmentText(job(), null, { workTypes: ['Thời vụ'] }, 'Dài hạn') === 'Dài hạn', '근무기간 글자가 원문 첫 형태보다 먼저')

// 복리후생 7칸: 구조화 값·원문 낱말·AI 태그로 켠다, 모르면 꺼진 채
const none = benefitFlags(job(), null)
assert(none.length === 7 && none.every((f) => !f.active), '아무 근거 없으면 7칸 모두 꺼짐')
assert(none.map((f) => f.key).join() === 'bus,dorm,meal,attendance,housing,fuel,performance', '칸 순서와 키')
const on = benefitFlags(job({ shuttleBus: true, dormitory: true, mealProvided: true, description: 'Phụ cấp nhà ở 500k, thưởng năng suất', benefitTags: ['Chuyên cần'] }), null)
assert(on.filter((f) => f.active).map((f) => f.key).join() === 'bus,dorm,meal,attendance,housing,performance', '구조화 값 + 원문 낱말 + AI 태그')
assert(activeBenefitText(on).split(' · ').length === 6, '켜진 이름을 " · "로 이음')
assert(benefitFlags(job(), { mealBenefit: 'Ăn trưa' }).find((f) => f.key === 'meal')?.label === 'Ăn trưa', '직무 요약의 식사 표시가 우선')
assert(benefitFlags(job(), { mealBenefit: 'Ăn trưa' }).find((f) => f.key === 'meal')?.active === true, '직무 요약에 식사가 있으면 켬')
console.log('jobDetailDerive: salary lines / allowance note / employment text / benefit flags passed')
