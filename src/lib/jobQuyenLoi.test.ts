import { quyenLoiKeyOf, albamonConditionLines, usesAlbamonLayout, BASELINE_FRAME_JOB_IDS } from './jobQuyenLoi.ts'
import { detailSections } from './jobDetailSections.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }
// ADTEK(2026-10-29) 원문 줄 모양 그대로 — 4칸 틀: 급여 아래·복리후생에 복사, 상세요강 원문은 그대로
const sections = [
  { key: '01' as const, label: 'Nội dung công việc', lines: ['Ngành nghề: Công nhân'] },
  { key: '02' as const, label: 'Yêu cầu ứng viên', lines: ['Nam/nữ, tuổi từ 18 đến 45', 'Sức khỏe tốt, chịu được ca và tăng ca'] },
  { key: '03' as const, label: 'Thời gian', lines: ['Tăng ca thường xuyên, làm thêm cả Chủ nhật'] },
  { key: '04' as const, label: 'Thu nhập', lines: ['Hình thức trả lương: Theo tháng'] },
  { key: '05' as const, label: 'Phúc lợi', lines: ['Có ký túc xá cho công nhân', 'Chế độ bữa ca: 2 bữa/ca', 'Khích lệ: 6.000.000 VNĐ/6 tháng', 'Đóng BHXH đầy đủ'] },
]
const a = albamonConditionLines(sections)
assert(a.salary.includes('Hình thức trả lương: Theo tháng') && a.salary.includes('Khích lệ: 6.000.000 VNĐ/6 tháng'), 'pay and incentive under salary, verbatim')
assert(a.insurance[0] === 'Đóng BHXH đầy đủ', 'insurance only when source names it')
assert(!a.salary.includes('Tăng ca thường xuyên, làm thêm cả Chủ nhật'), 'overtime without money is a working condition, not a benefit')
assert(quyenLoiKeyOf('Tăng ca 45k/1h') === 'overtime', 'overtime with pay amount is a benefit')
assert(!a.salary.includes('Ngành nghề: Công nhân'), 'job content (01) never copied')
assert(BASELINE_FRAME_JOB_IDS.has('sb-4824') && !usesAlbamonLayout('sb-4824'), 'KDA baseline keeps the approved frame')
assert(usesAlbamonLayout('sb-4879'), 'former Quyền lợi job (ADTEK) uses 4-section frame')
// #5876 ZHAN AN(Lee 2026-11-10 "Mức lương 왜케 지저분해", 글 모형 #647): 급여 칸은 위 금액 반복·제목 줄·대문자 홍보 줄을 빼고 3줄까지
{
  const zhan = detailSections(['Thu nhập', 'LƯƠNG & PHỤ CẤP 7.300.000Đ/THÁNG – CHƯA TÍNH TĂNG CA!', 'THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ', '1. CHẾ ĐỘ LƯƠNG & THƯỞNG',
    'Lương và phụ cấp khi làm đủ công chuẩn: 7.300.000đ/tháng.', 'Tiền tăng ca được tính riêng theo quy định.', 'Thưởng gắn bó dành cho nhân viên mới:',
    'Làm đủ 30 ngày: Thưởng 500.000đ.', 'Làm đủ 90 ngày: Thưởng thêm 1.000.000đ.', 'Tổng thưởng gắn bó: 1.500.000đ (thưởng một lần theo từng mốc).'].join('\n'))
  const c = albamonConditionLines(zhan.sections, '7.300.000Đ/THÁNG')
  assert(JSON.stringify(c.salary) === JSON.stringify(['Làm đủ 30 ngày: Thưởng 500.000đ.', 'Làm đủ 90 ngày: Thưởng thêm 1.000.000đ.', 'Tổng thưởng gắn bó: 1.500.000đ (thưởng một lần theo từng mốc).']), 'salary cell: ' + JSON.stringify(c.salary))
  assert(c.overtimeNote === 'chưa tính tăng ca', 'overtime note from the repeated amount line')
  assert(!zhan.sections.flatMap((x) => x.lines).includes('1. CHẾ ĐỘ LƯƠNG & THƯỞNG'), 'numbered source heading dropped from ④')
  assert(zhan.sections.flatMap((x) => x.lines).includes('THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ'), '④ keeps the source lines')
}
console.log('jobQuyenLoi: verbatim copies, baseline exempt, two frames only')
