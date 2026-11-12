import { contactHostFor, balanceConditionColumns, detailSections, lineBucket, sourceLines, sourceRecruitmentEligibility, verifyDescriptionPreserved } from './jobDetailSections.ts'
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
  // 2026-11-01 Lee "빠짐 0"(10-30 ④ 원문 전체): 위쪽과 같은 주소·연락 줄도 보여 준다.
  '07': ['- KCN Yên Phong, Bắc Ninh.', '- NGOC ANH DUONG: 0877 880 756'],
}
assert(JSON.stringify(byKey(kdaR)) === JSON.stringify(kdaWant), `#4824 정답표와 다름: ${JSON.stringify(byKey(kdaR))}`)
assert(same(kdaR.dropped.map((d) => d.reason), ['heading', 'heading', 'heading', 'heading', 'heading']), '#4824: 뺀 줄은 소제목 5개뿐(빠짐 0)')

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
  '07': ['- Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh.', '- Điện thoại: 0342017663.'],
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
  // 2026-11-01 Lee "빠짐 0"(10-30 ④ 원문 전체): 급여 총액 줄도 지우지 않는다(isSalaryTotalRepeat는 판정용으로만 남음).
  assert(JSON.stringify(lines04) === JSON.stringify(['Lương tối thiểu:', '8 triệu', 'Lương tối đa:', '18 triệu', '- Phụ cấp xăng xe 500k']), 'all salary lines shown: ' + JSON.stringify(lines04))
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
  // 2026-11-02 #5299 원문 "QUYỀN LỢI HẤP DẪN:", Lee 제공 포스터 "PHÚC LỢI CỰC TỐT"·"THU NHẬP HẤP DẪN": 꾸밈말 붙은 소제목.
  assert(headingOf('QUYỀN LỢI HẤP DẪN:') === '05' && headingOf('🎁 PHÚC LỢI CỰC TỐT') === '05' && headingOf('THU NHẬP HẤP DẪN') === '04', 'praise headings')
  assert(headingOf('Môi trường làm việc tốt') === undefined && headingOf('Thử việc hưởng 100% lương') === undefined && headingOf('Lương tốt') === undefined, 'praise headings keep content lines')
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

{
  // Lee 2026-10-30 "알바몬처럼"(먼저 sb-4828): 원문은 상세요강에 그대로, 급여 아래·복리후생에는 같은 원문 줄을 복사
  const { albamonConditionLines, sourceAgeValue, ALBAMON_LAYOUT_JOB_IDS } = await import('./jobQuyenLoi.ts')
  const d = detailSections('Thu nhập và phụ cấp\n- Hình thức trả lương: Theo tháng\n- Thưởng chuyên cần 300k\nPhúc lợi\n- Đóng BHXH đầy đủ\n- Có nhà ăn\nYêu cầu\n- Độ tuổi: 18 - 40 tuổi')
  const a = albamonConditionLines(d.sections)
  assert(a.salary.length === 2 && a.insurance[0] === 'Đóng BHXH đầy đủ', 'pay/bonus under salary, insurance in benefits')
  assert(d.sections.flatMap((s) => s.lines).some((l) => l.includes('Thưởng chuyên cần')), 'description keeps the original line (not removed)')
  assert(sourceAgeValue(d.sections) === '18 - 40 tuổi' && ALBAMON_LAYOUT_JOB_IDS.has('sb-4828'), 'age value from source, pilot job only')
  // 2026-11-03 #5299 실제 원문: 급여 아래 작은 글씨 줄(상여·수당)과 복리후생(보험)이 나뉜다(상세 화면 급여 칸 스타일 수정의 회귀 시험).
  const v = albamonConditionLines(detailSections('Thu nhập và phụ cấp\n- Thu nhập: 8 – 12 triệu/tháng\n- Thưởng Lễ, Tết, lương tháng 13\nQUYỀN LỢI HẤP DẪN:\n- Thử việc hưởng 100% lương\n- Được đóng BHXH, ký HĐLĐ đầy đủ\n- Có phụ cấp ăn uống').sections)
  assert(v.salary.includes('Thưởng Lễ, Tết, lương tháng 13') && v.salary.includes('Có phụ cấp ăn uống') && v.insurance[0] === 'Được đóng BHXH, ký HĐLĐ đầy đủ', '#5299 salary sub lines and insurance')
}
{
  // 틀 2가지(Lee 2026-11-09): KDA 기준 공고만 기존 틀, 나머지(예전 Quyền lợi 3건 포함)는 모두 4칸 틀.
  const { usesAlbamonLayout } = await import('./jobQuyenLoi.ts')
  assert(usesAlbamonLayout('sb-4828') && usesAlbamonLayout('sb-5100') && usesAlbamonLayout('sb-9999'), 'new jobs use 4-section layout')
  assert(usesAlbamonLayout('sb-4878') && usesAlbamonLayout('sb-4879') && usesAlbamonLayout('sb-4982'), 'former Quyền lợi jobs now use 4-section layout')
  assert(!usesAlbamonLayout('sb-4824'), 'KDA baseline unchanged')
}
{
  // 2026-10-30 관리자 미리 보기: 비공개 공고 행도 같은 변환(rowToJob)으로 상세 화면을 그린다.
  const { rowToJob } = await import('./jobRows.ts')
  const j = rowToJob({ id: 5157, title: 'T', company: 'C', active: false, admin_hidden: false, occupation_code: null })
  assert(j.id === 'sb-5157' && j.active === false && !j.occupationCode, 'admin preview row maps to job')
}
{
  // 2026-10-30 움직이는 복리후생 아이콘 7종: 상단 아이콘 키와 1:1, 색이 서로 겹치지 않음.
  const { SVG, BENEFIT_ICON_COLORS } = await import('./benefitIconArt.ts')
  for (const k of ['meal', 'bus', 'dorm', 'housing', 'fuel', 'attendance', 'performance']) assert(SVG[k]?.startsWith('<svg'), 'animated icon for ' + k)
  const bgs = Object.values(BENEFIT_ICON_COLORS).map((c) => c.bg)
  assert(bgs.length === 7 && new Set(bgs).size === 7, 'seven distinct benefit colors')
}
console.log('jobDetailSections: albamon layout regression passed')


// 2026-10-31 Highlands: labels are headings, not publishable content. Preserve all non-heading source lines.
{
  const raw = `🔎 Vị trí tuyển dụng:
• Nhân viên Pha chế (Barista) Fulltime- partime
📩 Cách nộp hồ sơ:
Hotline/Zalo:
ĐỊA CHỈ LÀM VIỆC:
Pha chế thức uống
Chăm sóc khách hàng`
  const sections = detailSections(raw)
  assert(sections.preserved && !sections.usedFallback, 'Highlands headings preserved as documented drops')
  const lines = sections.sections.flatMap((s) => s.lines)
  assert(!lines.some((s) => /^(Hotline\/Zalo:|ĐỊA CHỈ LÀM VIỆC:|📩 Cách nộp hồ sơ:)$/.test(s)), 'no empty labels in detail')
  assert(lines.includes('Pha chế thức uống') && lines.includes('Chăm sóc khách hàng'), 'actual duties preserved without fabricated role details')
  assert(!!sections.sections.find(s => s.key === '01')?.lines.includes('Pha chế thức uống') && !!sections.sections.find(s => s.key === '01')?.lines.includes('Chăm sóc khách hàng'), 'actual duties in work description subsection')
}

// 2026-11-01 결정 0007: 상세 상단 회사명 줄 — 기준 공고 KDA(sb-4824)는 제목에 회사명이 다 있어 줄 없음, #5157은 지점명만.
{
  const { companyLine } = await import('./companyBranch.ts')
  assert(companyLine('CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', 'KDA') === undefined, 'KDA company line hidden (title shows company)')
  assert(companyLine('Highlands Coffee tuyển nhân viên bán hàng, pha chế và phục vụ', 'Highlands Coffee Mường Thanh Bắc Ninh') === 'Mường Thanh Bắc Ninh', '#5157 branch only')
  console.log('jobDetailSections: decision 0007 company line regression passed')
}

// 2026-11-01 Lee: 모집조건 왼쪽 칸이 PC에서 비면 오른쪽 항목을 왼쪽으로(#5157: 직무 행만 있음).
{
  const { recruitOrdered } = await import('./recruitColumns.ts')
  assert(recruitOrdered([{ key: 'category' }, { key: 'roles' }])[0].key === 'roles', '#5157 roles first (left)')
  console.log('jobDetailSections: recruit column no-empty-left regression passed')
}

// 2026-11-01 #5231: 천 단위 점 표기 시급도 금액으로 읽는다(위쪽 급여 칸 자동 채움·검사의 기준)
{
  const { salaryAmounts } = await import('./jobDetailSections.ts')
  const a = salaryAmounts('Mức lương: 23.000 – 25.000 VNĐ/giờ')
  assert(JSON.stringify(a) === '[23000,25000]', 'hourly dot-thousands amounts: ' + JSON.stringify(a))
  console.log('jobDetailSections: hourly salary amount regression passed')
}

// 2026-11-03 포스터식 소제목: 꾸밈말(ổn định·đặc biệt·cực kỳ đơn giản)·끝 괄호 설명이 붙어도 같은 칸 제목(Bảo An VCC 같은 꼴, 공고 번호 전용 아님)
{
  const { headingOf } = await import('./jobDetailSections.ts')
  const cases: Array<[string, string | undefined]> = [
    ['💰 MỨC THU NHẬP ỔN ĐỊNH (Trả lương đúng hạn):  ', '04'],
    ['🎁 QUYỀN LỢI ĐẶC BIỆT:  ', '05'],
    ['✅ YÊU CẦU CỰC KỲ ĐƠN GIẢN:  ', '02'],
    ['📲 ĐĂNG KÝ NHẬN VIỆC NGAY:', '06'],
    ['LÀM VIỆC TẠI:', 'address'],
    ['Nơi làm việc:', 'address'],
    ['QUYỀN LỢI HẤP DẪN:', '05'],
    // 내용 줄(소제목 모양 아님)은 그대로
    ['Môi trường làm việc ổn định', undefined],
    ['Thu nhập ổn định, đúng thời hạn', undefined],
  ]
  for (const [line, want] of cases) assert(headingOf(line) === want, `headingOf(${line}) = ${headingOf(line)} ≠ ${want}`)
  console.log('jobDetailSections: poster heading praise/parenthesis regression passed')
}

// 2026-11-03 Lee "숫자 합치지 말라는 게 아예 안 넣으라는 말은 아닌데"(#440): 여러 직무 공고 상세 근무조건 급여 칸은 직무별 금액 줄(원문 그대로, 합치지 않음).
{
  const { roleSalaryLines, roleConditionSummary } = await import('./jobRolePresentation.ts')
  // 상세요강에 저장되는 모양("직무 — 원문 줄", 공고 #5342 같은 꼴)
  const desc = ['NHÂN VIÊN PHỤC VỤ — • Full-time: 8.974.000 – 10.490.000đ/tháng', 'NHÂN VIÊN PHA CHẾ — • Full-time: 8.500.000 – 10.000.000đ/tháng',
    'NHÂN VIÊN BẾP / PHỤ BẾP — • Bếp phụ: 8.000.000 – 11.200.000đ/tháng'].join('\n')
  const lines = roleSalaryLines(desc)
  assert(roleConditionSummary(desc)?.roleCount === 3, 'three roles')
  assert(lines.length === 3 && lines.every((l) => /\d[\d.]+ – [\d.]+đ\/tháng/.test(l)), 'role salary lines keep source amounts: ' + JSON.stringify(lines))
  assert(!lines.some((l) => /8\.000\.000 – 10\.490\.000/.test(l)), 'no merged range across roles')
  console.log('jobDetailSections: multi-role salary lines (amounts, not merged) passed')
}

// 2026-11-04 최신 틀 근무조건 복리후생 칸: 보험 원문 줄 대신 짧은 표시(원문에 적힌 것만)
{
  const { insuranceTags } = await import('./jobQuyenLoi.ts')
  const t = insuranceTags(['Tham gia đầy đủ BHXH, BHYT, BHTN theo quy định.', 'Tham gia đầy đủ BHXH, BHYT theo quy định.'])
  assert(JSON.stringify(t) === JSON.stringify(['BHXH', 'BHYT', 'BHTN']), 'insurance tags from source lines: ' + JSON.stringify(t))
  assert(insuranceTags([]).length === 0, 'no insurance line → no tag (nothing invented)')
  console.log('jobDetailSections: condition insurance short tags passed')
}

// 2026-11-04 Lee 승인: 여러 직무 급여 칸 — 직무 | 금액(Full-time 글자 없음, 파트타임 공통 한 줄, triệu 표기, 합치지 않음)
{
  const { roleSalaryRows } = await import('./jobRolePresentation.ts')
  const desc = ['• Part-time: 25.000 – 31.000đ/giờ', 'NHÂN VIÊN PHỤC VỤ — • Full-time: 8.974.000 – 10.490.000đ/tháng', 'NHÂN VIÊN PHA CHẾ — • Full-time: 8.500.000 – 10.000.000đ/tháng',
    'NHÂN VIÊN BẾP / PHỤ BẾP — • Bếp phụ: 8.000.000 – 11.200.000đ/tháng'].join('\n')
  const rows = roleSalaryRows(desc)
  assert(JSON.stringify(rows) === JSON.stringify([{ label: 'Phục vụ', amount: '8,97 – 10,49 triệu/tháng' }, { label: 'Pha chế', amount: '8,5 – 10 triệu/tháng' },
    { label: 'Bếp phụ', amount: '8 – 11,2 triệu/tháng' }, { label: 'Part-time', amount: '25.000 – 31.000đ/giờ' }]), 'role salary rows: ' + JSON.stringify(rows))
  console.log('jobDetailSections: role salary rows (label | amount) passed')
}

// 2026-11-04 Lee "다 고치고"(#5437·#5438·#5421): 줄 규칙 — 직무 줄은 업무, 근무지 줄은 복리후생이 아님, 신청 방법은 채용 절차, 근무 형태는 시간·형태.
{
  const r = byKey(detailSections('Phúc lợi và môi trường làm việc\nVị trí: TRỢ LÝ NHÂN SỰ – 02 NGƯỜI\nĐịa điểm: Nhà xưởng NX 2-2, KCN Yên Phong\nỨng viên vui lòng gửi CV để được trao đổi chi tiết!\nQuét QR trên hình hoặc đăng ký tại: https://forms.gle/x\nEmail: hr@divina.vn\nCách thức ứng tuyển:\nFULL-TIME | PART-TIME'))
  assert((r['01'] ?? []).includes('Vị trí: TRỢ LÝ NHÂN SỰ – 02 NGƯỜI'), 'Vị trí → 업무')
  assert(!(r['05'] ?? []).some((l: string) => l.startsWith('Địa điểm')) && (r['07'] ?? []).some((l: string) => l.startsWith('Địa điểm')), 'Địa điểm → 기타')
  for (const t of ['Ứng viên vui lòng gửi CV', 'Quét QR', 'Email:', 'Cách thức ứng tuyển:']) assert((r['06'] ?? []).some((l: string) => l.startsWith(t)), t + ' → 채용 절차')
  assert((r['03'] ?? []).includes('FULL-TIME | PART-TIME'), 'FULL-TIME | PART-TIME → 시간·형태')
  console.log('jobDetailSections: 2026-11-04 줄 규칙(Vị trí·Địa điểm·신청 방법·근무 형태) passed')
}

// 2026-11-04 Lee "왼쪽 자리 왜 비운거지?": 최신 틀 근무조건 한쪽 칸이 비면 나눠 채움, 예전 틀·둘 다 찬 경우는 그대로.
{
  assert(same(balanceConditionColumns([[], ['category', 'workPeriod']], true).map((c) => c.join(',')), ['category', 'workPeriod']), '빈 왼쪽 칸 채움')
  assert(same(balanceConditionColumns([[], ['category', 'workPeriod']], false).map((c) => c.join(',')), ['', 'category,workPeriod']), '예전 틀은 그대로')
  assert(same(balanceConditionColumns([['salary'], ['category']], true).map((c) => c.join(',')), ['salary', 'category']), '둘 다 차 있으면 그대로')
  console.log('jobDetailSections: 근무조건 빈 칸 나눠 채우기 passed')
}

// 대표 사진 선택이 기준 공고의 상세 원문·사진 목록·상세요강 분류를 변경하지 않는다.
{
  const { jobRepresentativeImageUrl } = await import('./companyLogo')
  const photos = ['kda/kda-20261013.png', 'kda/workplace.png']
  const job = { company: 'CTY KDA', title: kdaAbove.title, description: kda, images: [...photos] }
  const before = JSON.stringify(job)
  assert(jobRepresentativeImageUrl(job, []).endsWith('/job-images/kda/kda-20261013.png'), 'detail representative uses first public photo')
  assert(JSON.stringify(job) === before, 'representative selection leaves every lower gallery image and description intact')
  assert(JSON.stringify(detailSections(job.description, kdaAbove)) === JSON.stringify(kdaR), 'representative selection preserves baseline detail sections')
}

// 상단 사진 확대 기능은 기존 기준 공고의 상세요강 구성을 변경하지 않는다.
assert(kdaR.preserved && same(byKey(kdaR)['01'], kdaWant['01']), 'header photo zoom preserves KDA work detail content')

// 2026-11-06 Lee: 4칸 중 한 칸이 통째로 빠지면 아래 칸이 올라오고, 연락 버튼은 위쪽 자리(남은 첫 상자 제목 줄) 그대로.
assert(contactHostFor({ conditions: 3, recruitKeys: ['age'] }) === 'conditions', 'contact host: ① 있으면 ①')
assert(contactHostFor({ conditions: 0, recruitKeys: ['age', 'category'] }) === 'recruit', 'contact host: ② 모집조건')
assert(contactHostFor({ conditions: 0, recruitKeys: ['category'] }) === 'location', 'contact host: 업직종만 있으면 ③')
// 2026-11-10 #5876: 번호 붙은 원문 소제목도 빼고, 우리 칸 제목 바로 뒤의 원문 소제목은 앞 칸을 유지한다
{
  const r = detailSections(['Công việc', '2. CÔNG VIỆC', 'Vận hành, hỗ trợ sản xuất tại bộ phận ép nhựa.', 'Quy trình tuyển dụng', '5. LIÊN HỆ ỨNG TUYỂN', 'Email: zhanan@zhan-an.com'].join('\n'))
  const at = (k: string) => r.sections.find((x) => x.key === k)?.lines ?? []
  if (!(at('01').length === 1 && at('01')[0].startsWith('Vận hành') && at('06').includes('Email: zhanan@zhan-an.com') && r.preserved)) throw new Error('numbered headings: ' + JSON.stringify(r.sections))
  console.log('jobDetailSections: 번호 소제목 통과')
}

// R2(#753): 문구 전체 예외 대신 한 규칙 — 자세·환경 낱말로만 된 줄은 05, 다른 낱말이 있으면 업무로 보는 쪽(07 미정 포함)에 둔다.
{
  const kind = (line: string) => lineBucket(line, '07')
  assert(kind('Công việc: Làm ngồi, phòng thường') === '05', 'FUSHAN decision line stays environment (05)')
  assert(kind('Làm ngồi, thoải mái.') === '05', 'posture/environment words only → 05 without a 04 context')
  assert(kind('Làm ngồi linh kiện tai nghe') !== '05', 'a duty with an object ("linh kiện tai nghe") is not an environment-only line')
  assert(kind('Làm ngồi, phòng thường, lắp ráp linh kiện') !== '05', 'one extra duty word makes it a duty line')
  console.log('jobDetailSections: 자세·환경 낱말뿐인 줄 한 규칙 통과')
}
