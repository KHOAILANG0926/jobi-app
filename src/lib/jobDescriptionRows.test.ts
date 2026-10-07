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
assert(same(descriptionRows('Làm việc vui vẻ', 'x').map((r) => r.key), ['other']), 'unheaded text → other info')
// 같은 문장 중복 제거
assert(descriptionRows('Chăm chỉ\nChăm chỉ', 'x')[0].lines.length === 1, 'duplicate lines removed')

console.log('jobDescriptionRows.test.ts: all assertions passed')
