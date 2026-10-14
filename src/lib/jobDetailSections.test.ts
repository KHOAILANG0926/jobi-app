import { detailSections, sourceLines, sourceRecruitmentEligibility, verifyDescriptionPreserved } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
// Production read-only source: local_jobs.id=4824, checked 2026-10-14.
// Deliberately exact punctuation, diacritics, headings, and duplicates are preserved.
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
const result = detailSections(kda)
assert(result.preserved && !result.usedFallback, 'KDA PASS: preservation verified')
assert(verifyDescriptionPreserved(kda, result.sections), 'KDA PASS: every source line preserved')
assert(result.sections.flatMap(s => s.lines).length === sourceLines(kda).length, 'KDA PASS: number of original lines unchanged')
assert(result.sections.some(s => s.key === '04' && s.lines.includes('- Ca ngày: 310k/11h.')), 'KDA PASS: combined pay/time term retained')
assert(result.sections.some(s => s.key === '07' && s.lines.includes('- NGOC ANH DUONG: 0877 880 756')), 'KDA PASS: contact is not dropped')
// FAIL case: deleting or rewriting a single line MUST be rejected.
const dropped = result.sections.map(s => ({ ...s, lines: s.lines.filter(l => l !== '- Ca ngày: 310k/11h.') }))
assert(!verifyDescriptionPreserved(kda, dropped), 'KDA FAIL CASE: missing salary term detected')
const edited = result.sections.map(s => ({ ...s, lines: s.lines.map(l => l === '- Ca đêm: 360k/11h.' ? '- Ca đêm: 360k / 11 giờ.' : l) }))
assert(!verifyDescriptionPreserved(kda, edited), 'KDA FAIL CASE: rewritten text detected')
const repeated = detailSections('Chăm chỉ\nChăm chỉ')
assert(repeated.preserved && repeated.sections[0].lines.length === 2, 'duplicate sentences preserved')
console.log('jobDetailSections.test.ts: KDA PASS and negative FAIL cases verified')

assert(sourceRecruitmentEligibility(kda) === '- Tuyển nam, nữ (14-50 tuổi).', 'KDA recruitment line appears unchanged in top recruitment card')
assert(sourceRecruitmentEligibility('Chăm chỉ') === undefined, 'No fabricated recruitment condition')
