import { descriptionRows } from './jobDescriptionRows.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// #4682 추출 후 남은 본문 — 제목 반복·소제목 제거, 우대/기타 요건/환경 행
const T = 'TUYỂN DỤNG QUẢN LÝ DỰ ÁN - KCN VSIP BẮC NINH'
const D = `[source:facebook] ${T}\nYÊU CẦU\nƯu tiên chuyên ngành kỹ thuật.\nNhanh nhẹn, chăm chỉ, nhiệt tình, linh hoạt.\nQUYỀN LỢI\nMôi trường năng động, sếp thoải mái.`
const rows = descriptionRows(D, T)
assert(same(rows.map((r) => r.key), ['preferred', 'otherReq', 'environment']), 'rows: preferred, other requirements, environment')
assert(same(rows[0].lines, ['Ưu tiên chuyên ngành kỹ thuật.']), 'preferred line kept as written')
assert(same(rows[1].lines, ['Nhanh nhẹn, chăm chỉ, nhiệt tình, linh hoạt.']), 'other requirement line')
assert(same(rows[2].lines, ['Môi trường năng động, sếp thoải mái.']), 'environment line')
const all = rows.flatMap((r) => r.lines).join('\n')
assert(!all.includes('KCN VSIP') && !all.includes('YÊU CẦU') && !all.includes('QUYỀN LỢI') && !all.includes('[source:'), 'title repeat, sub-headings and source tag are not shown')

// "## " 형식(수집 공고): 소제목은 맥락만, 불릿은 벗기고 행으로
const S = descriptionRows('## Mô tả công việc\n• Bán hàng tại cửa hàng\n• Tư vấn khách\n## Yêu cầu\n• Ưu tiên có kinh nghiệm\n• Chăm chỉ\n## Quyền lợi\n• Thưởng tháng 13', 'Nhân viên bán hàng')
assert(same(S.map((r) => r.key), ['duty', 'preferred', 'otherReq', 'environment']), 'structured description → rows in fixed order')
assert(same(S[0].lines, ['Bán hàng tại cửa hàng', 'Tư vấn khách']), 'bullets stripped')
assert(S[0].label === 'Nội dung công việc' && S[1].label === 'Ưu tiên' && S[2].label === 'Yêu cầu khác', 'labels')

// 비면 행 없음(호출부가 구역 숨김)
assert(descriptionRows('', 'x').length === 0 && descriptionRows(null, 'x').length === 0, 'empty → no rows')
assert(descriptionRows('https://example.com/x', 'x').length === 0, 'url-only description → no rows')
assert(descriptionRows(`[source:facebook] ${T}\nYÊU CẦU`, T).length === 0, 'only title + headings → no rows')
// 소제목 없는 본문은 "Thông tin khác"
assert(same(descriptionRows('Làm việc vui vẻ', 'x').map((r) => r.key), ['unclassified']), 'unheaded text → unclassified info')
// 같은 문장 중복 제거
assert(descriptionRows('Chăm chỉ\nChăm chỉ', 'x')[0].lines.length === 2, 'repeated non-heading lines preserved')

console.log('jobDescriptionRows.test.ts: all assertions passed')

// Expected outcomes were specified independently of the previous buggy classifier.
// Synthetic text and non-dialable numbers only: never commit real contacts into this public repo.
const fixture = [
  'Lương và phúc lợi',
  'Lương 8tr + chuyên cần 500k',
  'Liên hệ',
  'SĐT: 000 000 0000',
  'Địa điểm làm việc',
  'KCN Quế Võ, Bắc Ninh',
  'CHƯA PHÂN LOẠI',
].join('\n')
const classified = descriptionRows(fixture, 'Synthetic job', {
  salaryText: '8tr', contactPhone: '0000000000', locationText: 'KCN Quế Võ, Bắc Ninh',
})
assert(classified.some((r) => r.key === 'salary' && r.lines.includes('Lương 8tr + chuyên cần 500k')), 'mixed salary + attendance survives in salary section')
assert(!classified.some((r) => r.lines.includes('SĐT: 000 000 0000')), 'same normalized phone may be omitted')
assert(!classified.some((r) => r.lines.includes('KCN Quế Võ, Bắc Ninh')), 'identical accent-sensitive address may be omitted')
assert(classified.some((r) => r.key === 'workplace' && r.lines.includes('CHƯA PHÂN LOẠI')), 'unrecognised content stays visible in current section')

const neverLose = descriptionRows([
  'Lương thưởng', '8tr', 'Phụ cấp nhà ở 500k', 'Liên hệ',
  'SĐT: 000 111 2222', 'Địa điểm làm việc', 'KCN Quế Võ, cổng B',
].join('\n'), 'Another job', {
  salaryText: '8tr', contactPhone: '0009999999', locationText: 'KCN Quế Võ',
})
const shown = neverLose.flatMap((r) => r.lines)
assert(!shown.includes('8tr'), 'exact pure salary line is hidden')
assert(shown.includes('Phụ cấp nhà ở 500k'), 'allowance preserved')
assert(shown.includes('SĐT: 000 111 2222'), 'different source contact preserved')
assert(shown.includes('KCN Quế Võ, cổng B'), 'similar but distinct worksite preserved')
const unknown = descriptionRows('LƯƠNG KHÔNG RÕ\nCÓ XE ĐƯA ĐÓN', 'x')
assert(unknown.flatMap((r) => r.lines).length === 2, 'unknown uppercase lines must not vanish')
// Every non-empty data line appears in a section, except recognized headings, title repeats,
// and three explicitly approved verified duplicate categories.
const raw = ['Mô tả công việc', 'Lắp ráp linh kiện', 'Yêu cầu tuyển dụng', 'Chăm chỉ', 'Lương và phúc lợi', 'Lương 8tr + chuyên cần 500k', 'Thông tin chưa rõ']
const result = descriptionRows(raw.join('\n'), 'Synthetic job')
const visible = result.flatMap((r) => r.lines)
for (const line of raw.filter((v) => !['Mô tả công việc','Yêu cầu tuyển dụng','Lương và phúc lợi'].includes(v))) {
  assert(visible.includes(line), 'lossless source line: ' + line)
}
