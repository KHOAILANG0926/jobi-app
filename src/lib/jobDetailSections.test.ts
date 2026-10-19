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
