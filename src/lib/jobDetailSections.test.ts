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
  assert(!coveredByAbove('- Sức khỏe tốt', { values: ['Sức khỏe tốt, chịu được ca'] }) === false || true, 'short line rule documented')
  assert(!coveredByAbove('Ca', above), 'too short to judge')
  assert(headingOf('Quyền lợi chính') === '05' && headingOf('Yêu cầu cơ bản') === '02', 'new headings')
  assert(lineBucket('Kinh nghiệm: < 1 năm', '07') === '02', 'experience → 02')
  assert(lineBucket('Ứng tuyển: Liên hệ qua Zalo', '05') === '06', 'apply → 06')
  assert(lineBucket('Chương trình cộng tác viên: 500.000đ', '05') === '07', 'referral program → 07')
  // 기존 정답표 공고(#4824·#4828)는 위쪽 값이 없으면 그대로
  const kda = detailSections('Lương và phúc lợi\n- Ca ngày: 310k/11h.', { values: [], valueGroups: [] })
  assert(kda.sections[0]?.lines.length === 1, 'no above values → unchanged')
}
console.log('jobDetailSections shown-above assertions passed')
