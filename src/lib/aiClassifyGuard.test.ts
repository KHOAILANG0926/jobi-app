// AI 칸·복리후생 판정 안전장치 시험 — AI가 무엇을 답해도 목록·원문 밖은 버린다.
import { guardAiResult, lineKey, buildPrompt } from './aiClassifyGuard.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }

const source = 'NAM , NỮ (14-50t)\nLàm ngồi linh kiện tai nghe\nCó xe đưa đón\nKhông có ký túc xá\nHỗ trợ tiền xăng xe máy 300k/tháng'
const lines = ['NAM , NỮ (14-50t)', 'Làm ngồi linh kiện tai nghe']
const g = guardAiResult({
  kinds: [
    { line: 'NAM , NỮ (14-50t)', section: '02' },
    { line: 'Làm ngồi linh kiện tai nghe', section: '01' },
    { line: 'Dòng AI tự bịa', section: '01' },          // 준 적 없는 줄 → 버림
    { line: 'NAM , NỮ (14-50t)', section: '99' },        // 목록 밖 칸 → 버림
  ],
  benefits: [
    { code: 'shuttle_bus', evidence: 'Có xe đưa đón' },
    { code: 'fuel', evidence: 'Hỗ trợ tiền xăng xe máy 300k/tháng' }, // 단어 목록에 없던 표현도 뜻으로 잡힘
    { code: 'dormitory', evidence: 'ký túc xá' },        // 앞에 "Không có" → 부정이라 버림
    { code: 'meal_provided', evidence: 'Có bữa ăn miễn phí' }, // 원문에 없음 → 버림
    { code: 'free_money', evidence: 'Có xe đưa đón' },   // 목록 밖 → 버림
  ],
}, { lines, source })
assert(JSON.stringify(g.kinds) === JSON.stringify([{ line: 'NAM , NỮ (14-50t)', section: '02' }, { line: 'Làm ngồi linh kiện tai nghe', section: '01' }]), 'kinds: ' + JSON.stringify(g.kinds))
assert(JSON.stringify(g.benefits.map((b) => b.code)) === JSON.stringify(['shuttle_bus', 'fuel']), 'benefits: ' + JSON.stringify(g.benefits))
assert(g.rejected.length === 5, 'rejected 5: ' + JSON.stringify(g.rejected))
assert(guardAiResult('not json', { lines, source }).kinds.length === 0, '엉뚱한 답은 아무것도 안 씀')
assert(buildPrompt(lines, source).includes('"NAM , NỮ (14-50t)"'), 'prompt lists lines as JSON')
// AI가 "- "를 붙여 돌려줘도 같은 줄(#4824 실측)
assert(guardAiResult({ kinds: [{ line: '- NAM , NỮ (14-50t)', section: '02' }] }, { lines, source }).kinds.length === 1, 'dash prefix tolerated')

// 저장된 번호표는 단어 규칙이 못 정한 줄에 쓰이고, Lee가 정한 것은 항상 이긴다
const kinds = { [lineKey('NAM , NỮ (14-50t)')]: { section: '02' as const, by: 'ai' as const }, [lineKey('Có xe đưa đón')]: { section: '07' as const, by: 'lee' as const } }
const b = buildDescriptionFromSources([{ name: 'source_text', text: 'NAM , NỮ (14-50t)\nCó xe đưa đón' }], { lineKinds: kinds })
const at = (line: string) => b.lines.find((l) => l.line === line)?.key
assert(at('NAM , NỮ (14-50t)') === '02', 'AI 번호표 → 02')
assert(at('Có xe đưa đón') === '07', 'Lee 번호표가 단어 규칙(05)을 이김')
assert(b.unclassified.length === 0, '번호표가 있으면 칸 못 정한 줄 없음')
console.log('aiClassifyGuard.test.ts: 목록·원문 밖 답 버림, 부정 문장, 저장된 번호표·Lee 우선 검사 통과')

const housingSource = 'Có KTX và hỗ trợ tìm trọ'
const housingResult = guardAiResult({ benefits: [
  { code: 'dormitory', evidence: 'Có KTX' },
  { code: 'housing_search', evidence: 'hỗ trợ tìm trọ' },
] }, { lines: [], source: housingSource })
assert(housingResult.benefits.map(b => b.code).join(',') === 'dormitory,housing_search', 'room search is distinct from cash rent support')
