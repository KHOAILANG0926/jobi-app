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
