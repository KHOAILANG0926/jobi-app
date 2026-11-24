import { buildDescriptionFromSources, cleanSourceText } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { descriptionRoleGroups, roleScopedMeals, roleConditionSummary, roleSalaryLines, isRoleHeading } from './jobRolePresentation.ts'
import { BOMUNTTL_SOURCE, BOMUNTTL_CONTEXT } from './jobMultiRole.fixtures.ts'
function assert(ok: unknown, msg: string): asserts ok { if (!ok) throw new Error(msg) }
const merged = cleanSourceText('Mức lương: 30k-35k/ 1h\n+ thưởng + tip').text
assert(merged === 'Mức lương: 30k-35k/ 1h + thưởng + tip', 'salary continuation joined without rewriting')
const built = buildDescriptionFromSources([{name:'source_text',text:BOMUNTTL_SOURCE}],BOMUNTTL_CONTEXT)
const sections = detailSections(built.description,BOMUNTTL_CONTEXT).sections
// Lee 2026-11-04 "상세 페이지는 중요한 내용만": 권유 인사말은 화면에서 빼고 뺀 줄 목록에 남긴다(전에는 기타란에 보였다).
assert(!built.description.includes('Gia nhập đội ngũ') && built.dropped.some(d=>d.reason==='promo'&&d.line.startsWith('Gia nhập đội ngũ')), 'join-team call is filtered as promo')
assert(!built.description.includes('Ứng tuyển sớm') && built.dropped.some(d=>d.reason==='promo'&&d.line.startsWith('Ứng tuyển sớm')), 'urgency call is filtered as promo')
const view=descriptionRoleGroups(sections)
const salaries=view.find(s=>s.key==='04')!
assert(salaries.groups.length===2, 'two role groups in salary section')
assert(salaries.groups.every(g=>g.role && g.lines.every(l=>!l.startsWith(g.role!))), 'role heading once per group, no repeated line prefixes')
assert(salaries.groups.some(g=>g.lines.includes('Mức lương: 30k-35k/ 1h + thưởng + tip')), 'whole waiter wage retained')
// Legacy persisted descriptions must improve without changing one job's stored row.
const legacy=descriptionRoleGroups([
 {key:'04',label:'Thu nhập',lines:['BẾP FULL TIME — Lương: 35k/1h','SẢNH PART TIME — Lương: 30k/1h']},
 {key:'07',label:'Thông tin khác',lines:['SẢNH PART TIME — + thưởng + tip','BẾP FULL TIME — Không cần kinh nghiệm']},
])
assert(legacy.find(s=>s.key==='04')?.groups.find(g=>g.role==='SẢNH PART TIME')?.lines[0]==='Lương: 30k/1h + thưởng + tip', 'legacy fragment rejoins same role salary across old section boundary')
assert(!legacy.find(s=>s.key==='07')?.groups.some(g=>g.role==='SẢNH PART TIME'), 'consumed fragment leaves no empty role heading')
assert(legacy.find(s=>s.key==='07')?.groups.find(g=>g.role==='BẾP FULL TIME')?.lines[0]==='Không cần kinh nghiệm', 'other role conditions remain intact')
const single=descriptionRoleGroups([{key:'04',label:'Thu nhập',lines:['310k/11h','Chuyên cần 50k/tuần']}])
assert(single[0].groups.length===1 && !single[0].groups[0].role, 'single-role KDA presentation unchanged')
console.log('jobRolePresentation: grouped roles, promotions, continuation and legacy fixtures pass')

assert(roleScopedMeals(built.description).length === 1, 'two meals belong to only one role')
assert(roleScopedMeals('CÔ RỬA BÁT FULL TIME\nNHÂN VIÊN CHẠY BÀN PART TIME\nBao ăn 2 bữa').length === 0, 'shared meal line must not be reclassified as exclusive')

const summary=roleConditionSummary(built.description)
assert(summary?.salary==='Theo từng vị trí (2 vị trí) — xem chi tiết', 'approved salary summary, no invented numeric range')
assert(summary?.hours==='Khác nhau theo 2 vị trí — xem chi tiết', 'approved hours summary')
assert(summary?.workPeriod==='Full time / Part time', 'both documented employment types')
assert(summary?.workDays==='Rửa bát: nghỉ 4 ngày/tháng; chạy bàn: chưa nêu', 'holiday conditions do not spread to waiter')
assert(summary?.numHires==='2 vị trí; số người chưa nêu', 'roles are not headcount')
assert(summary?.mealBenefit==='Ăn ca: chỉ rửa bát, 2 bữa', 'approved scoped benefit text')
assert(roleConditionSummary('Công việc\nLàm linh kiện tai nghe')===null, 'ordinary KDA unaffected')
assert(roleScopedMeals('BẾP FULL TIME\nSẢNH PART TIME\nBẾP FULL TIME — Không bao ăn').length===0, 'negated role meals must not become a benefit promise')
const noWageContinuation=cleanSourceText('Tháng nghỉ 4 ngày\n+ thưởng + tip').text
assert(noWageContinuation==='Tháng nghỉ 4 ngày\n+ thưởng + tip', 'continuation cannot attach to a non-wage condition just because it has a number')

// 2026-11-01 #5247 Wallace: "1. FULL-TIME CA TỐI: 02 NHÂN VIÊN" 형식도 직무 제목 — 메인 카드 직무별 급여
import { isRoleHeading as _isRole, roleSalaryLines as _rsl } from './jobRolePresentation.ts'
if (!_isRole('1. FULL-TIME CA TỐI: 02 NHÂN VIÊN') || !_isRole('CÔ RỬA BÁT FULL TIME') || _isRole('• Nhân viên Bán hàng (Sales)  Fulltime- partime') || _isRole('Lương part-time 25k/giờ')) throw new Error('role heading forms')
{
  const d = 'Thu nhập\n1. FULL-TIME CA TỐI: 02 NHÂN VIÊN — Mức lương: 34K – 36K – 38K/giờ\n2. PART-TIME CA TỐI: 08 NHÂN VIÊN — Mức lương: 25K – 27K/giờ'
  const got = JSON.stringify(_rsl(d))
  if (got !== JSON.stringify(['Full-time ca tối: 34K – 36K – 38K/giờ', 'Part-time ca tối: 25K – 27K/giờ'])) throw new Error('#5247 card lines ' + got)
}
console.log('jobRolePresentation #5247 numbered role headings passed')

// 2026-11-03 #5342 Joy Thái 같은 꼴(공고 번호 전용 아님): "CÁC VỊ TRÍ" 아래 대문자 직무 제목 + 금액만 있는 급여 줄.
{
  const JOY = ['THU NHẬP HẤP DẪN', '• Part-time: 25.000 – 31.000đ/giờ', 'CÁC VỊ TRÍ ĐANG TUYỂN', 'NHÂN VIÊN PHỤC VỤ',
    '• Full-time: 8.974.000 – 10.490.000đ/tháng', 'NHÂN VIÊN PHA CHẾ', '• Full-time: 8.500.000 – 10.000.000đ/tháng',
    'NHÂN VIÊN BẾP / PHỤ BẾP', '• Bếp phụ: 8.000.000 – 11.200.000đ/tháng', 'GIA NHẬP JOY THÁI, BẠN NHẬN ĐƯỢC GÌ?',
    'Hỗ trợ ăn ca 2 bữa/ngày', 'HR. Hải – 0366.268.503'].join('\n')
  const d = buildDescriptionFromSources([{ name: 'source_text', text: JOY }], { title: 'Tuyển phục vụ', company: 'JOY THÁI', phones: ['0366268503'] }).description
  const lines = roleSalaryLines(d)
  assert(lines.length === 3 && lines[0] === 'Phục vụ: Full-time: 8.974.000 – 10.490.000đ/tháng', 'caps role headings + amount-only salary lines read: ' + lines.join(' / '))
  assert(!d.split('\n').some((l) => l.startsWith('NHÂN VIÊN BẾP / PHỤ BẾP — Hỗ trợ ăn ca')), 'benefits after another caps heading are not the last role\'s')
  const s = roleConditionSummary(d)
  assert(s?.roleCount === 3 && s.hours === undefined && s.workPeriod === undefined && s.workDays === undefined, 'no invented hours/work type/days when roles do not state them')
  assert(!isRoleHeading('TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH') && !isRoleHeading('Nhân viên phục vụ'), 'title line and normal-case text are not role headings')
  console.log('jobRolePresentation: caps role headings (Joy Thái form) pass')
}

// 2026-11-24 R #872(운영 공고 6337 원문 그대로): 직무 제목 줄 없이 "인원 + 직무 : 금액" 줄로 직무 4개 — 같은 여러 직무 표시(상단 Theo vị trí·직무별 급여)를 쓴다.
{
  const { roleSalaryRows, roleAmountLine } = await import('./jobRolePresentation.ts')
  const post = 'MỲ CAY YAGAMI ĐANG TUYỂN NHÂN VIÊN \n VỊ TRÍ: \n 3 Nam & Nữ Phục Vụ : 7tr5~ 12tr \n 2 Nữ oder : 8tr~11tr + tip\n 1 Nam Làm Bếp : 8tr5 ~ 14tr\n 2 Cô Tạp Vụ : 7 - 8tr\n+500k phụ cấp\nHỖ TRỢ ĂN Ở ( phòng riêng,đầy đủ điều hòa nóng lạnh)\nĐịa chỉ : Lê Đức Thọ - Nam Từ Liêm - Hà Nội\nSdt: 0833.210.308'
  const d = buildDescriptionFromSources([{ name: 'source_text', text: post }], {}).description
  const sum = roleConditionSummary(d)
  assert(sum?.roleCount === 4 && sum.salary === 'Theo từng vị trí (4 vị trí) — xem chi tiết', 'inline role lines → multi-role summary: ' + JSON.stringify(sum))
  assert(sum?.numHires === 'Nam & nữ phục vụ: 3 người; nữ oder: 2 người; nam làm bếp: 1 người; tạp vụ: 2 người', 'per-role hire counts from source (not summed): ' + sum?.numHires)
  assert(JSON.stringify(roleSalaryLines(d)) === JSON.stringify(['Nam & nữ phục vụ: 7tr5~ 12tr', 'Nữ oder: 8tr~11tr + tip', 'Nam làm bếp: 8tr5 ~ 14tr', 'Tạp vụ: 7 - 8tr']), 'card role lines: ' + JSON.stringify(roleSalaryLines(d)))
  assert(roleSalaryRows(d).map((r) => `${r.label}|${r.amount}`).join(' / ') === 'Nam & nữ phục vụ|7tr5~ 12tr / Nữ oder|8tr~11tr + tip / Nam làm bếp|8tr5 ~ 14tr / Tạp vụ|7 - 8tr', 'detail role rows: ' + JSON.stringify(roleSalaryRows(d)))
  // 상세요강 묶음 표시(승인된 틀)는 그대로 — 이 줄들을 직무 묶음으로 바꾸지 않는다
  assert(descriptionRoleGroups(detailSections(d, {}).sections).every((s) => s.groups.every((g) => !g.role)), 'description grouping unchanged (no inline role groups)')
  // 교대·기간 낱말과 직무 하나뿐인 줄은 여러 직무가 아니다
  assert(!roleAmountLine('1 ca : 300k') && !roleAmountLine('2 tháng : 8tr') && roleConditionSummary('1 ca : 300k\n2 ca : 600k') === null, 'shift/period words are not roles')
  assert(roleConditionSummary('3 Nam & Nữ Phục Vụ : 7tr5~ 12tr\nSdt: 0833.210.308') === null, 'single inline role is not multi-role')
  console.log('jobRolePresentation: inline count + role : amount lines (6337) pass')
}
