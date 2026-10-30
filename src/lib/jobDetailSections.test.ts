import { detailSections, sourceLines, sourceRecruitmentEligibility, verifyDescriptionPreserved } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
const byKey = (r: ReturnType<typeof detailSections>) => Object.fromEntries(r.sections.map((s) => [s.key, s.lines]))

// ── 정답표(2026-10-14 Lee 결정 + 2026-10-19 Lee 확인). 실제 운영 원문(local_jobs.description, 2026-10-19 조회). ──
// 코드 결과가 이 표와 한 줄이라도 다르면 실패 → 병합 금지.
const kda = `Công việc
- Làm ngồi linh kiện tai nghe.

Yêu cầu
- Tuyển nam, nữ (14-50 tuổi).

Lương và phúc lợi
- Ca ngày: 310k/11h.
- Ca đêm: 360k/11h.
- Chuyên cần: 50k/tuần.
- Lương tính và thanh toán theo ngày.
- Có xe đưa đón.
- Được mang điện thoại vào xưởng.

Địa điểm làm việc
- KCN Yên Phong, Bắc Ninh.

Liên hệ
- NGOC ANH DUONG: 0877 880 756`
const kdaAbove = { title: 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', phones: ['0877880756'], addresses: ['KCN Yên Phong, Bắc Ninh', 'KCN YÊN PHONG'] }
const kdaR = detailSections(kda, kdaAbove)
assert(kdaR.preserved && !kdaR.usedFallback, '#4824: 칸 나누기 성공')
const kdaWant = {
  '01': ['- Làm ngồi linh kiện tai nghe.'],
  '02': ['- Tuyển nam, nữ (14-50 tuổi).'],
  '04': ['- Ca ngày: 310k/11h.', '- Ca đêm: 360k/11h.', '- Chuyên cần: 50k/tuần.', '- Lương tính và thanh toán theo ngày.'],
  '05': ['- Có xe đưa đón.', '- Được mang điện thoại vào xưởng.'],
}
assert(JSON.stringify(byKey(kdaR)) === JSON.stringify(kdaWant), `#4824 정답표와 다름: ${JSON.stringify(byKey(kdaR))}`)
assert(same(kdaR.dropped.map((d) => d.reason), ['heading', 'heading', 'heading', 'heading', 'shown_above', 'heading', 'shown_above']), '#4824: 뺀 줄은 소제목 5 + 위에 있는 주소·전화 2뿐')

const maoYen = `Công việc
- Sản xuất dây truyền dữ liệu, dây mạng.
Yêu cầu
- Nhanh nhẹn, chăm chỉ, chịu khó.
- Có tinh thần trách nhiệm trong công việc.
Thời gian làm việc
- Chuyên ca ngày.
- Tuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.
Lương và phúc lợi
- Lương cơ bản: 5.500.000đ/tháng.
- Phụ cấp: 1.200.000đ/tháng.
- Thâm niên sau 2 tháng: +200.000đ; sau 4 tháng: +300.000đ.
- Làm ngồi, thoải mái. Không bắt buộc tăng ca.
Địa điểm làm việc
- Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh.
Liên hệ
- Điện thoại: 0342017663.`
const myR = detailSections(maoYen, { title: 'Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng', phones: ['0342017663'], addresses: ['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'] })
const myWant = {
  '01': ['- Sản xuất dây truyền dữ liệu, dây mạng.'],
  '02': ['- Nhanh nhẹn, chăm chỉ, chịu khó.', '- Có tinh thần trách nhiệm trong công việc.'],
  '03': ['- Chuyên ca ngày.', '- Tuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.'],
  '04': ['- Lương cơ bản: 5.500.000đ/tháng.', '- Phụ cấp: 1.200.000đ/tháng.', '- Thâm niên sau 2 tháng: +200.000đ; sau 4 tháng: +300.000đ.'],
  '05': ['- Làm ngồi, thoải mái. Không bắt buộc tăng ca.'],
}
assert(myR.preserved && JSON.stringify(byKey(myR)) === JSON.stringify(myWant), `#4828 정답표와 다름: ${JSON.stringify(byKey(myR))}`)

// ── 지우면 안 되는 것 ──
// 위 정보와 다른 전화·주소는 남는다(07)
const other = detailSections('Liên hệ\n- Zalo khác: 0911222333\nĐịa điểm làm việc\n- Xưởng 2, Từ Sơn', { phones: ['0342017663'], addresses: ['Khu phố Mao Yên'] })
assert(JSON.stringify(byKey(other)) === JSON.stringify({ '07': ['- Zalo khác: 0911222333', '- Xưởng 2, Từ Sơn'] }), '다른 번호·다른 근무지는 지우지 않음')
// 전화가 위에 없으면(정보 없음) 연락 줄을 지우지 않음
assert(byKey(detailSections(kda))['07']?.includes('- NGOC ANH DUONG: 0877 880 756'), '위에 없는 연락처는 남김')
// 원문 줄이 예외 말고 하나라도 빠지거나 바뀌면 검사 실패
const lost = kdaR.sections.map((s) => ({ ...s, lines: s.lines.filter((l) => l !== '- Ca ngày: 310k/11h.') }))
assert(!verifyDescriptionPreserved(kda, lost, kdaR.dropped), '급여 줄이 빠지면 실패')
const edited = kdaR.sections.map((s) => ({ ...s, lines: s.lines.map((l) => l === '- Ca đêm: 360k/11h.' ? '- Ca đêm: 360k / 11 giờ.' : l) }))
assert(!verifyDescriptionPreserved(kda, edited, kdaR.dropped), '글자가 바뀌면 실패')
const repeated = detailSections('Chăm chỉ\nChăm chỉ')
assert(repeated.preserved && repeated.sections[0].lines.length === 2, '같은 문장 반복은 그대로 둠')
assert(sourceLines(kda).length === kdaR.sections.flatMap((s) => s.lines).length + kdaR.dropped.length, '줄 수 = 칸에 든 줄 + 뺀 줄')
console.log('jobDetailSections.test.ts: 정답표 #4824·#4828 + 지우면 안 되는 경우 검사 통과')

assert(sourceRecruitmentEligibility(kda) === '- Tuyển nam, nữ (14-50 tuổi).', 'KDA recruitment line appears unchanged in top recruitment card')
assert(sourceRecruitmentEligibility('Chăm chỉ') === undefined, 'No fabricated recruitment condition')


const tefalMetadata = `TUYỂN NHÂN VIÊN BÁN HÀNG SẢN PHẨM TEFAL
Thu nhập đến 18.000.000đ/tháng + hỗ trợ 1.000.000đ cho ứng viên đi làm trong tháng đầu.
Thời gian: Ca xoay 8 tiếng, nghỉ 1 ngày/tuần (không cố định cuối tuần).
Hiện số
Thông tin cơ bản
Cá nhân đăng tuyển
Ngành nghề:
Bán hàng tại quầy
Loại hình công việc:
Toàn thời gian
Hình thức trả lương:
8 triệu
18 triệu
< 1 năm
Giới tính:
Không yêu cầu
Tên công ty:
Độ tuổi:
22 - 35 tuổi
Học vấn tối thiểu:
Trung học`
const tefalResult = detailSections(tefalMetadata)
const tefalBuckets = byKey(tefalResult)
assert(tefalResult.preserved && !tefalResult.usedFallback, 'TEFAL source preserved')
assert(!(tefalBuckets['07'] ?? []).some(line => /^(?:8 triệu|18 triệu|22 - 35 tuổi|Trung học|Bán hàng tại quầy|Toàn thời gian)$/.test(line)), 'TEFAL classified facts must not remain in additional information')
assert((tefalBuckets['04'] ?? []).includes('18 triệu'), 'TEFAL salary maximum bucket')
assert((tefalBuckets['02'] ?? []).includes('22 - 35 tuổi'), 'TEFAL age bucket')
assert((tefalBuckets['01'] ?? []).includes('Bán hàng tại quầy'), 'TEFAL occupation bucket')

// ── 2026-10-25 Lee: 상단 급여 총액 반복은 빼고, 급여 구성(내역) 줄은 남긴다 ──
{
  const { isSalaryTotalRepeat, salaryAmounts } = await import('./jobDetailSections.ts')
  assert(JSON.stringify(salaryAmounts('8 - 18 triệu/tháng')) === JSON.stringify([8_000_000, 18_000_000]), 'range amounts')
  assert(JSON.stringify(salaryAmounts('18.000.000đ/tháng')) === JSON.stringify([18_000_000]), 'dotted amount')
  const top = '8 - 18 triệu/tháng'
  assert(isSalaryTotalRepeat('18 triệu', top), 'bare total repeat dropped')
  assert(isSalaryTotalRepeat('Lương tối đa: 18 triệu', top), 'labelled total repeat dropped')
  assert(isSalaryTotalRepeat('Lương tối thiểu:', top), 'empty salary label dropped')
  assert(isSalaryTotalRepeat('- Thu nhập đến 18.000.000đ/tháng.', top), 'same total in other notation dropped')
  assert(!isSalaryTotalRepeat('- Thu nhập đến 18.000.000đ/tháng + hỗ trợ 1.000.000đ tháng đầu.', top), 'line with breakdown kept')
  assert(!isSalaryTotalRepeat('- Lương cơ bản: 8 triệu', top), 'base salary breakdown kept')
  assert(!isSalaryTotalRepeat('- Phụ cấp: 1.200.000đ/tháng.', top), 'allowance kept')
  assert(!isSalaryTotalRepeat('- Thưởng 20 triệu cuối năm', top), 'bonus kept')
  assert(!isSalaryTotalRepeat('18 triệu', ''), 'no top salary → keep')
  assert(!isSalaryTotalRepeat('Ca đêm: 360k/11h', '310k - 360k/ngày'), 'shift rate is breakdown')
  const r = detailSections('Thu nhập\nLương tối thiểu:\n8 triệu\nLương tối đa:\n18 triệu\n- Phụ cấp xăng xe 500k', { salary: top })
  assert(r.preserved && !r.usedFallback, 'salary drop keeps preservation check')
  const lines04 = r.sections.find((s) => s.key === '04')?.lines ?? []
  assert(JSON.stringify(lines04) === JSON.stringify(['- Phụ cấp xăng xe 500k']), 'only breakdown remains: ' + JSON.stringify(lines04))
}
console.log('jobDetailSections salary-repeat assertions passed')

// ── 2026-10-25 Lee: 위쪽 칸에 보이는 값과 같은 줄은 아래에서 반복하지 않는다 + 새 소제목·줄 규칙 ──
{
  const { coveredByAbove, headingOf, lineBucket } = await import('./jobDetailSections.ts')
  const above = { values: ['22 - 35 tuổi', 'Không yêu cầu; nam cao trên 1m65, nữ cao trên 1m55'], valueGroups: [['Ca xoay 8 tiếng', 'Nghỉ 1 ngày/tuần (không cố định cuối tuần)']] }
  assert(coveredByAbove('Độ tuổi: 22 - 35 tuổi', above), 'age repeat')
  assert(coveredByAbove('- Nam cao >1m65, Nữ cao >1m55.', above), 'height repeat')
  assert(coveredByAbove('Thời gian: Ca xoay 8 tiếng, nghỉ 1 ngày/tuần (không cố định cuối tuần).', above), 'hours+days group repeat')
  assert(!coveredByAbove('- Tốt nghiệp THCS trở lên (9/12), tuổi từ 22 trở lên.', above), 'partly different kept')
  assert(!coveredByAbove('Ca', above), 'too short to judge')
  assert(headingOf('Quyền lợi chính') === '05' && headingOf('Yêu cầu cơ bản') === '02', 'new headings')
  assert(headingOf('YÊU CẦU CÔNG VIỆC:') === '02' && headingOf('CÁCH THỨC NỘP HỒ SƠ') === '06' && headingOf('Hình thức nộp hồ sơ') === '06', '#4826 headings')
  assert(lineBucket('Kinh nghiệm: < 1 năm', '07') === '02', 'experience → 02')
  assert(lineBucket('Ứng tuyển: Liên hệ qua Zalo', '05') === '06', 'apply → 06')
  assert(lineBucket('Chương trình cộng tác viên: 500.000đ', '05') === '07', 'referral program → 07')
  // 기존 정답표 공고(#4824·#4828)는 위쪽 값이 없으면 그대로
  const kda = detailSections('Lương và phúc lợi\n- Ca ngày: 310k/11h.', { values: [], valueGroups: [] })
  assert(kda.sections[0]?.lines.length === 1, 'no above values → unchanged')
}
console.log('jobDetailSections shown-above assertions passed')

// ── 2026-10-25: AI 번호표 도입 후에도 기준 공고(#4824) 줄이 같은 칸에 남는지(번호표는 단어 규칙이 못 정한 줄에만 쓰임) ──
{
  const kda = detailSections(`Lương và phúc lợi\n- Ca ngày: 310k/11h.\n- Có xe đưa đón.`)
  assert(kda.sections.find((s) => s.key === '04')?.lines.includes('- Ca ngày: 310k/11h.') === true, 'KDA 급여 줄 04 유지')
  assert(kda.sections.find((s) => s.key === '05')?.lines.includes('- Có xe đưa đón.') === true, 'KDA 셔틀 줄 05 유지')
}
console.log('jobDetailSections AI-kind regression assertions passed')

// Lee 2026-10-27: company/contractor bonuses and abbreviated base pay are pay details.
{
  const { lineBucket, isSalaryTotalRepeat } = await import('./jobDetailSections.ts')
  for (const line of ['CTY - ABC THƯỞNG 5.000.000Đ', 'Công ty thưởng 2 triệu', 'Nhà thầu thưởng 500k', 'LCB + PC: 6.000.000đ']) {
    assert(lineBucket(line, '07') === '04', 'bonus/base pay → 04: ' + line)
    assert(!isSalaryTotalRepeat(line, '5 - 6 triệu'), 'pay breakdown survives same-amount total: ' + line)
  }
  assert(lineBucket('Tuyển: Chính Thức và Thời Vụ', '07') === '03', 'employment type → 03')
  assert(lineBucket('Hỗ trợ hồ sơ', '07') === '06', 'documents support → 06')
  assert(lineBucket('Công việc: Làm ngồi, phòng thường', '07') === '05', 'work environment is not a specific duty')
  assert(lineBucket('Địa chỉ: KCN ABC (Có KTX và hỗ trợ tìm trọ)', '07') === '05', 'mixed address retains housing benefits')
  assert(lineBucket('Công việc cụ thể: chưa ghi trong tin gốc', '07') === '01', 'approved missing-duty notice → 01')
  assert(lineBucket('Tuyển qua nhà thầu', '07') === '06', 'contractor disclosure → 06')
  assert(lineBucket('Công việc: Lắp ráp tai nghe', '01') === '01', 'specific work not moved to benefits')
  assert(lineBucket('Cty ABC, phòng thường', '07') === '07', 'ordinary room is not a monetary bonus')
}

// Calls to apply are slogans, even when persisted under an old recruitment heading.
const calls = detailSections('Quy trình tuyển dụng\nGia nhập đội ngũ ngay thôi!\nỨng tuyển sớm để giữ chỗ!')
assert(calls.preserved && !calls.usedFallback, 'call lines preserved')
assert(calls.sections.find(s => s.key === '07')?.lines.length === 2, 'calls are supplementary, not recruitment steps')
assert(!calls.sections.some(s => s.key === '06'), 'no invented recruitment process')

// ── Lee 2026-10-29 새 구성: 상세요강 결과 → ② Quyền lợi / ④ Yêu cầu khác로 옮긴 뒤 같은 줄이 아래에 남지 않음 ──
{
  const { splitQuyenLoi, takeRequirementLines } = await import('./jobQuyenLoi.ts')
  const adtek = detailSections(`Yêu cầu ứng viên
- Nam/nữ, tuổi từ 18 đến 45
- Sức khỏe tốt, chịu được ca và tăng ca
Thời gian và hình thức làm việc
- Tăng ca thường xuyên, làm thêm cả Chủ nhật
Thu nhập và phụ cấp
- Hình thức trả lương: Theo tháng
Phúc lợi và môi trường làm việc
- Có ký túc xá cho công nhân
- Khích lệ: 6.000.000 VNĐ/6 tháng`)
  const q = splitQuyenLoi(adtek.sections, {})
  const r = takeRequirementLines(q.sections)
  const below = r.sections.flatMap((s) => s.lines).join('\n')
  assert(q.rows.some((x) => x.key === 'bonus' && x.lines.some((l) => l.includes('6.000.000'))), 'incentive shown in Quyền lợi')
  assert(!below.includes('6.000.000') && !below.includes('trả lương'), 'moved benefit lines not repeated in description')
  assert(r.lines.some((l) => l.includes('Sức khỏe tốt')) && !r.sections.some((s) => s.key === '02'), 'requirements moved to recruitment')
  assert(below.includes('Tăng ca thường xuyên') && below.includes('ký túc xá'), 'working-time and icon-backed lines stay')
}
console.log('jobDetailSections: new detail structure (Quyền lợi / Yêu cầu khác) regression passed')
{
  // Lee 2026-10-30 "알바몬처럼"(먼저 sb-4828): 원문은 상세요강에 그대로, 급여 아래·복리후생에는 같은 원문 줄을 복사
  const { albamonConditionLines, sourceAgeValue, ALBAMON_LAYOUT_JOB_IDS } = await import('./jobQuyenLoi.ts')
  const d = detailSections('Thu nhập và phụ cấp\n- Hình thức trả lương: Theo tháng\n- Thưởng chuyên cần 300k\nPhúc lợi\n- Đóng BHXH đầy đủ\n- Có nhà ăn\nYêu cầu\n- Độ tuổi: 18 - 40 tuổi')
  const a = albamonConditionLines(d.sections)
  assert(a.salary.length === 2 && a.insurance[0] === 'Đóng BHXH đầy đủ', 'pay/bonus under salary, insurance in benefits')
  assert(d.sections.flatMap((s) => s.lines).some((l) => l.includes('Thưởng chuyên cần')), 'description keeps the original line (not removed)')
  assert(sourceAgeValue(d.sections) === '18 - 40 tuổi' && ALBAMON_LAYOUT_JOB_IDS.has('sb-4828'), 'age value from source, pilot job only')
}
{
  // Lee 2026-10-30 신규부터: 새 공고 = 4칸 틀, 기존 공개 공고·KDA는 그대로.
  const { usesAlbamonLayout } = await import('./jobQuyenLoi.ts')
  assert(usesAlbamonLayout('sb-4828') && usesAlbamonLayout('sb-5100') && usesAlbamonLayout('sb-9999'), 'new jobs use 4-section layout')
  assert(!usesAlbamonLayout('sb-4824') && !usesAlbamonLayout('sb-4878') && !usesAlbamonLayout('sb-4879') && !usesAlbamonLayout('sb-4982'), 'baseline and existing jobs unchanged')
}
{
  // 2026-10-30 관리자 미리 보기: 비공개 공고 행도 같은 변환(rowToJob)으로 상세 화면을 그린다.
  const { rowToJob } = await import('./jobRows.ts')
  const j = rowToJob({ id: 5157, title: 'T', company: 'C', active: false, admin_hidden: false, occupation_code: null })
  assert(j.id === 'sb-5157' && j.active === false && !j.occupationCode, 'admin preview row maps to job')
}
{
  // 2026-10-30 움직이는 복리후생 아이콘 7종: 상단 아이콘 키와 1:1, 색이 서로 겹치지 않음.
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../components/AnimatedBenefitIcon.tsx', import.meta.url), 'utf8')
  for (const k of ['meal', 'bus', 'dorm', 'housing', 'fuel', 'attendance', 'performance']) assert(src.includes(`"${k}": "<svg`), 'animated icon for ' + k)
  const bgs = [...src.matchAll(/bg: '(#[0-9a-f]{6})'/g)].map((m) => m[1])
  assert(bgs.length === 7 && new Set(bgs).size === 7, 'seven distinct benefit colors')
}
console.log('jobDetailSections: albamon layout regression passed')
