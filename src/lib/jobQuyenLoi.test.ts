import { splitQuyenLoi, takeRequirementLines, quyenLoiKeyOf, BASELINE_FRAME_JOB_IDS } from './jobQuyenLoi.ts'
function assert(v: unknown, m: string) { if (!v) throw new Error(m) }
// ADTEK(2026-10-29) 원문 줄 모양 그대로
const sections = [
  { key: '01' as const, label: 'Nội dung công việc', lines: ['Ngành nghề: Công nhân'] },
  { key: '02' as const, label: 'Yêu cầu ứng viên', lines: ['Nam/nữ, tuổi từ 18 đến 45', 'Sức khỏe tốt, chịu được ca và tăng ca'] },
  { key: '03' as const, label: 'Thời gian', lines: ['Tăng ca thường xuyên, làm thêm cả Chủ nhật'] },
  { key: '04' as const, label: 'Thu nhập', lines: ['Hình thức trả lương: Theo tháng'] },
  { key: '05' as const, label: 'Phúc lợi', lines: ['Có ký túc xá cho công nhân', 'Chế độ bữa ca: 2 bữa/ca', 'Khích lệ: 6.000.000 VNĐ/6 tháng', 'Đóng BHXH đầy đủ'] },
]
const q = splitQuyenLoi(sections, { periodLabel: 'Lương tháng' })
const row = (k: string) => q.rows.find((r) => r.key === k)?.lines ?? []
assert(row('pay')[0] === 'Hình thức trả lương: Theo tháng', 'pay line copied verbatim from source')
assert(row('bonus')[0] === 'Khích lệ: 6.000.000 VNĐ/6 tháng', 'incentive goes to Thưởng · Phụ cấp')
assert(row('insurance')[0] === 'Đóng BHXH đầy đủ', 'insurance only when source names it')
assert(!row('overtime').length, 'overtime without money is a working condition, not a benefit')
assert(quyenLoiKeyOf('Tăng ca 45k/1h') === 'overtime', 'overtime with pay amount is a benefit')
const rest = q.sections.flatMap((s) => s.lines)
assert(!rest.includes('Khích lệ: 6.000.000 VNĐ/6 tháng') && !rest.includes('Hình thức trả lương: Theo tháng'), 'moved lines are not repeated below')
assert(rest.includes('Chế độ bữa ca: 2 bữa/ca') && rest.includes('Có ký túc xá cho công nhân'), 'meal/dorm details stay in description (icons above)')
assert(rest.includes('Tăng ca thường xuyên, làm thêm cả Chủ nhật'), 'working-time line stays')
assert(q.sections.find((s) => s.key === '01')?.lines[0] === 'Ngành nghề: Công nhân', 'job content untouched')
const r = takeRequirementLines(q.sections)
assert(r.lines.length === 2 && !r.sections.some((s) => s.key === '02'), '02 moves to recruitment')
const none = splitQuyenLoi([{ key: '05' as const, label: 'x', lines: ['Môi trường thân thiện'] }], { periodLabel: 'Lương tháng' })
assert(none.rows.length === 1 && none.rows[0].lines[0] === 'Lương tháng', 'no source line → structured pay period only, nothing invented')
assert(BASELINE_FRAME_JOB_IDS.has('sb-4824'), 'KDA baseline keeps the approved frame')
console.log('jobQuyenLoi: verbatim moves, no duplicates, baseline exempt')
