import { addDays, buildJobFields, emptyPostForm, preferenceText, processText, salaryNoteText, validatePostForm, type PostForm } from './postJobSubmit.ts'
import type { JobConditions } from './jobConditions.ts'

// jobConditions.ts는 node 시험에서 못 불러오는 import가 있어 필요한 칸(workSchedule)만 가진 값으로 대신한다.
const NO_CONDITIONS = { workSchedule: null } as unknown as JobConditions

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }
const valid = (over: Partial<PostForm> = {}): PostForm => ({
  ...emptyPostForm, title: 'Tuyển công nhân', company: 'Cty A', salaryAmount: '8.000.000', hoursNegotiable: false, timeStart: '08:00', timeEnd: '17:00',
  employmentType: 'full_time', ongoing: true, hires: '5', street: '12 Nguyễn Trãi', ward: 'Phường 1', province: 'Bắc Ninh', work: 'Lắp ráp', employerPhone: '0912 345 678', ...over,
})

// 필수 검사: 순서와 문구는 웹 PostJob과 같다 — 가장 앞에서 걸린 칸 하나만 알려 준다.
const empty = validatePostForm(emptyPostForm, false)
assert(!empty.ok && empty.field === 'title' && empty.message === 'Vui lòng nhập tiêu đề công việc.', '빈 폼은 제목부터')
assert(validatePostForm(valid({ company: '' }), false).ok === false, '회사 필수')
const noSalary = validatePostForm(valid({ salaryAmount: '' }), false)
assert(!noSalary.ok && noSalary.field === 'salary', '급여 필수')
assert(validatePostForm(valid({ salaryAmount: '', salaryNegotiable: true }), false).ok, '급여 Thỏa thuận 허용')
const noTime = validatePostForm(valid({ timeEnd: '' }), false)
assert(!noTime.ok && noTime.field === 'time', '근무시간 필수')
assert(validatePostForm(valid({ timeEnd: '', hoursNegotiable: true }), false).ok, '근무시간 협의 허용')
const noDeadline = validatePostForm(valid({ ongoing: false, applicationDeadline: '' }), false)
assert(!noDeadline.ok && noDeadline.field === 'deadline', '마감일 또는 상시')
assert(validatePostForm(valid({ ongoing: false, applicationDeadline: '' }), true).ok, '빠른 등록(로그인 없음)은 마감일 없이 통과')
const badAge = validatePostForm(valid({ ageMin: '40', ageMax: '20' }), false)
assert(!badAge.ok && badAge.field === 'age', '나이 범위 오류')
const noAddr = validatePostForm(valid({ ward: '' }), false)
assert(!noAddr.ok && noAddr.field === 'street', '주소는 번지·동·성 모두')
const badPhone = validatePostForm(valid({ employerPhone: '123' }), false)
assert(!badPhone.ok && badPhone.field === 'phone', '전화 형식')
const badZalo = validatePostForm(valid({ zaloSameAsPhone: false, zalo: 'abc' }), false)
assert(!badZalo.ok && badZalo.field === 'zalo', 'Zalo 형식')
const hires = validatePostForm(valid({ hires: '' }), false)
assert(!hires.ok && hires.field === 'hires', '인원 필수')
assert(validatePostForm(valid({ hires: '', hiresUndecided: true }), false).ok, '인원 미정 허용')

// 저장 칸: 급여 단위·근무일수→workSchedule·전화 정규화
const ok = validatePostForm(valid({ workDays: ['T2', 'T3', 'T4', 'T5', 'T6'] }), false)
assert(ok.ok, '정상 폼')
if (ok.ok) {
  const f = buildJobFields(valid({ workDays: ['T2', 'T3', 'T4', 'T5', 'T6'] }), NO_CONDITIONS, ok.composed, { imagePaths: [] })
  assert(f.salary === '8.000.000/tháng' && f.salaryPeriod === 'month', '급여 대표 1개+단위')
  assert(f.workSchedule === '5_days', '5일 근무')
  assert(f.employerPhone === '0912345678' && f.zalo === '0912345678', '전화 정규화·Zalo 같음')
  assert(f.location === '12 Nguyễn Trãi, Phường 1, Bắc Ninh' && f.images === undefined && f.imageUrl === undefined, '주소·사진 없음')
  assert(f.hours === '08:00 - 17:00' && f.numHires === '5 người', '근무시간·인원')
}

// 기존 칸에 넣는 글
assert(preferenceText(valid({ beginner: true, prefPicks: ['Ở gần'], preference: 'Siêng' })) === 'Không cần kinh nghiệm, Ở gần, Siêng', '우대 글')
assert(processText(valid({ process: 'Phỏng vấn', contactName: 'Lan' })) === 'Phỏng vấn\nCách ứng tuyển: Gọi điện, Nhắn Zalo\nNgười liên hệ: Lan', '채용 절차 글')
assert(salaryNoteText(valid({ allowance: '500k', probation: true, payMethod: 'Chuyển khoản' })) === 'Phụ cấp·Thưởng: 500k; Có thời gian thử việc; Trả lương: Chuyển khoản', '급여 비고 글')
assert(/^\d{4}-\d{2}-\d{2}$/.test(addDays(7)), '날짜 형식')
console.log('postJobSubmit: 필수 검사 순서·문구·저장 칸·기존 칸 글 통과')
