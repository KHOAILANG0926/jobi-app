import { extractJobFields } from './jobDescriptionExtract.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// 실제 공고 #4682 원문 (Facebook 수집)
const D4682 = '[source:facebook] TUYỂN DỤNG QUẢN LÝ DỰ ÁN - KCN VSIP BẮC NINH\n LƯƠNG: upto 30 TRIỆU/THÁNG\n YÊU CẦU\nNam, CĐ/ĐH, ưu tiên chuyên ngành kỹ thuật.\nTiếng Trung HSK4/5 – 4 kỹ năng, giao tiếp tốt.\n≥1 năm kinh nghiệm phiên dịch kỹ thuật/sản xuất hoặc đi làm dự án, quản lý dự án.\nNhanh nhẹn, chăm chỉ, nhiệt tình, linh hoạt.\nSẵn sàng đi công tác.\n QUYỀN LỢI\n 8h00–17h00 | T2–T6 + 2 T7/tháng.\nĐóng đầy đủ BHXH, BHYT, BHTN theo quy định.\nThưởng lễ, Tết, du lịch hằng năm.\nMôi trường năng động, sếp thoải mái.\n ỨNG TUYỂN/ZALO: 0344 849 982'
const r = extractJobFields(D4682, { salary: '30 TRIỆU/THÁNG', employerPhone: '0344849982' })

assert(r.fields.hours === '8h00–17h00', 'hours')
assert(r.fields.workDays === 'T2–T6 + 2 T7/tháng', 'work days')
assert(same(r.fields.benefitTags, ['BHXH', 'BHYT', 'BHTN', 'Thưởng lễ, Tết', 'Du lịch hằng năm']), 'benefit tags only from the text')
assert(r.fields.genderRequirement === 'Nam', 'gender')
assert(r.fields.education === 'CĐ/ĐH', 'education')
assert(r.fields.preference === '≥1 năm kinh nghiệm phiên dịch kỹ thuật/sản xuất hoặc đi làm dự án, quản lý dự án', 'experience')
assert(r.fields.contactZalo === '0344849982', 'zalo')

// 언어·출장 → 전용 항목(local_jobs.language_requirement / business_trip), 문장은 상세요강에서 이동
assert(r.fields.languageRequirement === 'Tiếng Trung HSK4/5 – 4 kỹ năng, giao tiếp tốt', 'language requirement keeps the original wording')
assert(r.fields.businessTrip === true, 'business trip = true only because the text says "Sẵn sàng đi công tác"')
assert(!r.remaining.includes('Tiếng Trung HSK4/5') && !r.remaining.includes('đi công tác'), 'language/trip sentences moved out of the description')
assert(extractJobFields('Không đi công tác').fields.businessTrip === false, 'explicit "no business trip" = false')
assert(extractJobFields('Công tác phí theo quy định công ty').fields.businessTrip === undefined, 'other business-trip mentions are not guessed')
assert(extractJobFields('Công tác phí theo quy định công ty').remaining === 'Công tác phí theo quy định công ty', 'unmatched business-trip mention stays')

// 뽑힌 문장은 빠지고, 부분 대체는 남은 말만 남는다
for (const gone of ['LƯƠNG:', '8h00–17h00', 'BHXH', 'Thưởng lễ', '≥1 năm', 'ZALO:', 'Nam,', 'HSK', 'công tác']) assert(!r.remaining.includes(gone), `removed: ${gone}`)
assert(r.remaining.includes('Ưu tiên chuyên ngành kỹ thuật.'), 'partial sentence keeps the remainder')
assert(r.remaining.includes('Nhanh nhẹn, chăm chỉ') && r.remaining.includes('Môi trường năng động'), 'unmatched sentences stay')
assert(r.remaining.includes('YÊU CẦU') && r.remaining.includes('QUYỀN LỢI') && !r.remaining.includes('[source:'), 'headings stay, source tag stripped')

// 추정 금지: 규칙에 안 맞으면 아무것도 뽑지 않는다
const none = extractJobFields('Cần tuyển nhân viên bán hàng\nLàm việc vui vẻ, môi trường tốt')
assert(Object.keys(none.fields).length === 0, 'nothing extracted when nothing matches')
assert(none.remaining === 'Cần tuyển nhân viên bán hàng\nLàm việc vui vẻ, môi trường tốt', 'text unchanged when nothing matches')
// 급여 줄은 DB 값과 다르면 유지
const diff = extractJobFields('LƯƠNG: 12 triệu', { salary: '30 TRIỆU/THÁNG' })
assert(diff.remaining.includes('LƯƠNG: 12 triệu'), 'salary line kept when it differs from the stored salary')
// BHXH 문장에 다른 내용이 있으면 문장 유지
const mix = extractJobFields('Đóng BHXH, được cấp xe đưa đón từ trung tâm')
assert(mix.remaining.includes('xe đưa đón'), 'sentence with extra content is kept')

console.log('jobDescriptionExtract.test.ts: all assertions passed')

// #622 sb-5633: "Ca ngày: 320.000đ/12 tiếng · Ca đêm: 370.000đ/12 tiếng" → 교대 2 ca, 근무시간 "Ca ngày / Ca đêm, 12 tiếng"
{
  const { readWorkTime } = await import('./jobDescriptionExtract.ts')
  const a = readWorkTime('Ca ngày: 320.000đ/12 tiếng\nCa đêm: 370.000đ/12 tiếng')
  if (a.shiftType !== 'rotating' || a.rotatingShifts !== 2 || a.hours !== 'Ca ngày / Ca đêm, 12 tiếng') throw new Error('sb-5633 shift: ' + JSON.stringify(a))
  const b = readWorkTime('Thời gian: 8h - 17h, nghỉ trưa 1 tiếng')
  if (b.hours !== '8h - 17h' || b.shiftType) throw new Error('clock range kept verbatim, no shift guessed: ' + JSON.stringify(b))
  const c = readWorkTime('Làm ca đêm 22h-6h')
  if (c.shiftType !== 'night' || c.hours !== '22h-6h') throw new Error('night: ' + JSON.stringify(c))
  const d = readWorkTime('Làm 3 ca xoay')
  if (d.shiftType !== 'rotating' || d.rotatingShifts !== 3) throw new Error('3 ca: ' + JSON.stringify(d))
  const e = readWorkTime('Tuyển nhân viên bán hàng, lương 8 triệu')
  if (Object.keys(e).length) throw new Error('nothing in text → nothing: ' + JSON.stringify(e))
  // Codex #628: 어순 "Ca xoay"·"Làm đảo ca", 교대별 시간 다름, 주당 횟수
  const f = readWorkTime('Thời gian: Ca xoay 8 tiếng')
  if (f.shiftType !== 'rotating') throw new Error('Ca xoay: ' + JSON.stringify(f))
  const g = readWorkTime('Làm đảo ca')
  if (g.shiftType !== 'rotating') throw new Error('Làm đảo ca: ' + JSON.stringify(g))
  const h = readWorkTime('Ca ngày 8 tiếng; ca đêm 12 tiếng')
  if (h.hours) throw new Error('different hours per shift must not merge: ' + JSON.stringify(h))
  const i = readWorkTime('Yêu cầu làm tối thiểu 2 ca/tuần')
  if (i.shiftType || i.rotatingShifts) throw new Error('2 ca/tuần is frequency: ' + JSON.stringify(i))
  // Codex #628: 면접·휴게 시각은 근무시간 아님
  const j = readWorkTime('Phỏng vấn: 8h-17h. Làm ca đêm 12 tiếng.')
  if (j.shiftType !== 'night' || j.hours !== 'Ca đêm, 12 tiếng') throw new Error('interview hours excluded: ' + JSON.stringify(j))
  const k = readWorkTime('Làm việc 8h-17h, nghỉ trưa 12h-13h')
  if (k.hours !== '8h-17h') throw new Error('break hours excluded: ' + JSON.stringify(k))
  // Codex #628: 부정 교대·줄바꿈 숫자·휴게 tiếng
  const l = readWorkTime('Làm ca ngày, không làm ca đêm.')
  if (l.shiftType !== 'day') throw new Error('negated night shift: ' + JSON.stringify(l))
  const m = readWorkTime('Không xoay ca. Làm cố định 8h-17h.')
  if (m.shiftType) throw new Error('negated rotating: ' + JSON.stringify(m))
  const n = readWorkTime('Làm việc 8h-17h\n18 tuổi trở lên')
  if (n.hours !== '8h-17h') throw new Error('clock must not eat next line: ' + JSON.stringify(n))
  const o = readWorkTime('Làm ca ngày 8 tiếng, nghỉ trưa 1 tiếng')
  if (o.hours !== 'Ca ngày, 8 tiếng') throw new Error('break tiếng excluded: ' + JSON.stringify(o))
  const p = readWorkTime('Sáng: 7h-11h, nghỉ trưa 11h-12h, Chiều: 12h-16h')
  if (p.hours !== '7h-11h, 12h-16h') throw new Error('split schedule keeps afternoon: ' + JSON.stringify(p))
  const q = readWorkTime('Phục vụ: 8h-16h; Bảo vệ: 20h-6h')
  if (q.hours) throw new Error('per-role hours must not be flattened: ' + JSON.stringify(q))
  const r = readWorkTime('Ca 1: 6h-14h; Ca 2: 14h-22h')
  if (r.hours !== '6h-14h, 14h-22h') throw new Error('ca labels are not roles: ' + JSON.stringify(r))
  // Codex #628: 소수 시간·요일별 시간
  const s = readWorkTime('Làm việc 7,5 tiếng/ngày')
  if (s.hours) throw new Error('decimal hours must not be split: ' + JSON.stringify(s))
  const t = readWorkTime('Làm việc 8.5 tiếng/ngày')
  if (t.hours) throw new Error('decimal hours must not be split: ' + JSON.stringify(t))
  const u = readWorkTime('Thứ Hai – Thứ Sáu: 08:00 – 17:00; Thứ Bảy: 08:00 – 12:00')
  if (u.hours) throw new Error('weekday-specific hours must not be flattened: ' + JSON.stringify(u))
  const v = readWorkTime('Thứ Hai – Thứ Sáu: 08:00 – 17:00')
  if (v.hours !== '08:00 – 17:00') throw new Error('single weekday range kept: ' + JSON.stringify(v))
  const rng = readWorkTime('Ca ngày làm 8-10 tiếng')
  if (rng.hours !== 'Ca ngày, 8-10 tiếng') throw new Error('Codex #628 range kept: ' + JSON.stringify(rng))
  const gio = readWorkTime('Thời gian làm việc: 8 giờ - 17 giờ')
  if (gio.hours !== '8 giờ - 17 giờ') throw new Error('Codex #628 giờ boundary: ' + JSON.stringify(gio))
  const four = readWorkTime('Ca 1: 6h-10h; Ca 2: 10h-14h; Ca 3: 14h-18h; Ca 4: 18h-22h')
  if (four.hours !== '6h-10h, 10h-14h, 14h-18h, 18h-22h') throw new Error('Codex #628 4 ranges kept: ' + JSON.stringify(four))
  console.log('readWorkTime (#622) passed')
}
