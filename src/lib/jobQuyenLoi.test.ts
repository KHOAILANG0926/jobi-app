import { quyenLoiKeyOf, albamonConditionLines, albamonCompose, usesAlbamonLayout, BASELINE_FRAME_JOB_IDS } from './jobQuyenLoi.ts'
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
// Codex #653: "không bao gồm tăng ca"(제외)를 "đã gồm tăng ca"로 읽지 않는다
{
  const neg = albamonConditionLines(detailSections('Thu nhập\nLương 7 triệu, không bao gồm tăng ca').sections, '7 triệu')
  assert(neg.overtimeNote === 'chưa tính tăng ca', 'negated overtime: ' + neg.overtimeNote)
  const pos = albamonConditionLines(detailSections('Thu nhập\nLương 7 triệu, đã bao gồm tăng ca').sections, '7 triệu')
  assert(pos.overtimeNote === 'đã gồm tăng ca', 'positive overtime: ' + pos.overtimeNote)
}
// 10-30 확정 구성(Lee 2026-11-10 "세부구성"): 원문 줄을 ①②④ 확정 자리로 — 지우지 않고 옮김, 위쪽에 있는 줄만 ④에서 뺌
{
  const desc = ['Công việc', '2. CÔNG VIỆC', 'Vận hành, hỗ trợ sản xuất tại bộ phận ép nhựa.', 'Yêu cầu', '3. YÊU CẦU', 'Không yêu cầu kinh nghiệm, được hướng dẫn công việc.', 'Chăm chỉ, có trách nhiệm, nghiêm túc trong công việc.',
    'Thu nhập', 'LƯƠNG & PHỤ CẤP 7.300.000Đ/THÁNG – CHƯA TÍNH TĂNG CA!', 'Tiền tăng ca được tính riêng theo quy định.', 'Làm đủ 30 ngày: Thưởng 500.000đ.',
    'Quyền lợi', 'Tham gia BHXH, BHYT, BHTN theo quy định.', 'Quy trình tuyển dụng', '5. LIÊN HỆ ỨNG TUYỂN', 'Điện thoại: 0969 661 314', 'Email: zhanan@zhan-an.com', 'Các bạn có nhu cầu tìm việc vui lòng liên hệ trực tiếp.',
    'Thông tin khác', 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', 'Công ty TNHH ZHAN AN cần tuyển công nhân sản xuất làm việc tại khu vực Khắc Niệm.', '4. ĐỊA ĐIỂM LÀM VIỆC', 'CÔNG TY TNHH ZHAN AN', 'Khu vực Khắc Niệm, phường Hạp Lĩnh, Bắc Ninh.'].join('\n')
  const c = albamonCompose(detailSections(desc).sections, { title: 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', company: 'CÔNG TY TNHH ZHAN AN',
    addresses: ['Khu vực Khắc Niệm, phường Hạp Lĩnh, Bắc Ninh, Bắc Ninh'], salary: '7.300.000Đ/THÁNG', hasHours: false, preference: 'Không yêu cầu kinh nghiệm, được hướng dẫn công việc.' })
  const by = (l: string) => c.detail.find((x) => x.label === l)?.lines ?? []
  assert(JSON.stringify(c.detail.map((x) => x.label)) === JSON.stringify(['Nội dung công việc', 'Tăng ca', 'Môi trường làm việc', 'Quy trình tuyển dụng', 'Liên hệ']), 'labels ' + JSON.stringify(c.detail.map((x) => x.label)))
  assert(by('Nội dung công việc')[0].startsWith('Công ty TNHH ZHAN AN cần tuyển') && by('Nội dung công việc')[1].startsWith('Vận hành'), 'intro then duties')
  assert(by('Tăng ca')[0] === 'Tiền tăng ca được tính riêng theo quy định.', 'overtime line')
  assert(JSON.stringify(by('Liên hệ')) === JSON.stringify(['Điện thoại: 0969 661 314', 'Email: zhanan@zhan-an.com']), 'contact')
  assert(JSON.stringify(c.otherRequirements) === JSON.stringify(['Chăm chỉ, có trách nhiệm, nghiêm túc trong công việc.']), 'other requirements without the preference repeat')
  assert(c.allowance[0] === 'Làm đủ 30 ngày: Thưởng 500.000đ.' && c.overtimeNote === 'chưa tính tăng ca', 'allowance + note')
  assert(by('Môi trường làm việc').includes('Tham gia BHXH, BHYT, BHTN theo quy định.'), 'Codex #653: insurance sentence kept for mobile')
  assert(!c.detail.flatMap((x) => x.lines).some((l) => l === 'CÔNG TY TNHH ZHAN AN' || l.startsWith('Khu vực Khắc Niệm') || l.startsWith('CÔNG TY TNHH ZHAN AN –')), 'lines shown above are not repeated in ④')
}
// Codex #653: 위 금액과 같은 금액이 하나 들어 있어도 다른 금액(내역)이 있으면 지우지 않는다
{
  const c = albamonCompose(detailSections('Thu nhập\nLương cơ bản 7 triệu + phụ cấp 1 triệu').sections, { salary: '7 triệu' })
  const all = [...c.allowance, ...c.detail.flatMap((x) => x.lines)].join('|')
  assert(all.includes('phụ cấp 1 triệu'), 'breakdown with extra amount kept: ' + all)
}
// #653(Lee 2026-11-10 적용) "위쪽에 이미 있는 … 주소 … 줄만 ④에서 뺌" — 이름표(Địa điểm:)가 붙은 주소 줄도 같은 줄이다(5157). 주소가 아닌 이름표 줄은 그대로 둔다.
{
  const desc = ['Thông tin khác', 'HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI', 'Địa điểm:  Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh', 'Địa điểm: Nhà xưởng số 3'].join('\n')
  const c = albamonCompose(detailSections(desc).sections, { title: 'Highlands Coffee tuyển nhân viên', company: 'Highlands Coffee', addresses: ['Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh'] })
  const all = c.detail.flatMap((x) => x.lines)
  assert(!all.some((l) => l.includes('Số 395')), 'label+address line shown above is not repeated in ④: ' + JSON.stringify(all))
  assert(all.includes('Địa điểm: Nhà xưởng số 3'), 'a label line that is not the shown address stays')
}
console.log('jobQuyenLoi: verbatim copies, baseline exempt, two frames only')
