// R2(#753) 검사표 독립 검증: 독립 원문 기대값(r2Oracle.fixtures.ts)의 줄을 공고에서 일부러 뺐을 때 검사표가 실제로 잡는지 본다.
// 올바른 공고는 통과해야 하고(과잉 차단 없음), 줄을 뺀 공고는 '원문 줄 빠짐 없음(source_lost)'으로 실패해야 한다.
// 검사표가 만드는 쪽 규칙으로 "빠져도 되는 줄"을 정하면 이 시험이 실패한다(독립 읽기: inspectReading).
import { R2_ORACLE } from './r2Oracle.fixtures.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { inspectJob } from './jobInspect.ts'
import { isPromoLine } from './jobDescriptionBuild.ts'
import { promoLike, sourceLines, contactRepeat, cardReadableSalary } from './inspectReading.ts'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const failures: string[] = []
let checks = 0
const ok = (c: boolean, what: string, detail: string) => { checks++; if (!c) failures.push(`✗ ${what}\n    ${detail}`) }
const GUARDED = ['source_lost', 'roles', 'hours_twice', 'duplicate', 'junk']

for (const o of R2_ORACLE) {
  const description = buildDescriptionFromSources([{ name: 'source_text', text: o.source }], o.ctx).description
  const base = { id: 1, ...o.ctx, source_text: o.source }
  const run = (d: string) => inspectJob({ ...base, description: d } as Parameters<typeof inspectJob>[0])
  const bad = run(description).items.filter((i) => GUARDED.includes(i.key) && !i.ok)
  ok(bad.length === 0, `[${o.id}] 올바른 공고는 원문 대조 항목을 통과(과잉 차단 없음)`, bad.map((i) => `${i.key}: ${i.detail}`).join(' | '))
  const lines = description.split('\n')
  for (const f of o.facts) {
    const e = norm(f.evidence)
    const at = lines.findIndex((l) => norm(l).includes(e))
    if (at < 0) continue   // 10-30 ④가 거르는 줄(반복 연락처 등)은 기대값에 넣지 않았으므로 여기서는 해당 없음
    const without = lines.filter((_, i) => i !== at).join('\n')
    const lost = run(without).items.find((i) => i.key === 'source_lost')
    // 같은 내용이 공고의 다른 줄에 이미 있으면(예: 직무 목록과 업무 줄) 빠짐이 아니다 — 그 경우는 해당 없음
    const stillThere = without.split('\n').some((l) => norm(l).includes(e))
    if (!stillThere) ok(lost?.ok === false, `[${o.id}] "${f.evidence}" 줄을 뺀 공고를 검사표가 잡음`, `source_lost: ${JSON.stringify(lost)}`)
  }
}
// Codex #763 지적 사례: 정보 문장은 홍보로 안 빼고, 사이트 UI 글자·+84 반복 번호는 빼며, 카드 급여는 금액 단위·직무별 행이 있어야 읽힘.
ok(!promoLike('Công việc lâu dài!') && !promoLike('Ứng viên vui lòng gửi CV để được trao đổi chi tiết!') && promoLike('Nhanh tay ứng tuyển để có công việc tốt nhé!'), '홍보 판별', 'promoLike')
// 홍보 판별 두 함수(만드는 쪽 isPromoLine·검사 쪽 promoLike)는 일부러 따로 둔다(검사기 독립). 대신 같은 줄에 같은 답을 내는지 이 표로 계속 맞춘다.
// 만드는 쪽이 줄을 빼는데(true) 검사 쪽이 빠짐으로 잡는(false) 어긋남이 5342·5437 비공개의 원인이었다.
{
  const known = ['JOY THÁI', 'Bắc Ninh']
  const table: Array<[string, boolean]> = [
    ['Nhanh tay ứng tuyển để có công việc tốt nhé!', true],
    ['Cơ hội đang chờ bạn!', true],
    ['#TuyenDung #ViecLam', true],
    ['Công việc lâu dài!', false],
    ['Ứng viên vui lòng gửi CV để được trao đổi chi tiết!', false],
    ['Lương 10 triệu!', false],
    ['JOY THÁI – Nơi bạn phát triển và tỏa sáng!', false],
    ['Không cần đi đâu xa tìm việc — job xịn ngay tại Bắc Ninh đây rồi!', false],
  ]
  for (const [line, promo] of table) {
    ok(isPromoLine(line, known) === promo && promoLike(line) === promo, `홍보 판별 두 함수 일치: ${line}`, `isPromoLine=${isPromoLine(line, known)} promoLike=${promoLike(line)} 기대=${promo}`)
  }
  // 만드는 쪽 끝까지: 회사·주소 칸에서 이름을 모아 두 줄이 상세요강에 남는다(5342·5437).
  const built = buildDescriptionFromSources([{ name: 'source_text', text: 'Công việc lâu dài\nJOY THÁI – Nơi bạn phát triển và tỏa sáng!\nKhông cần đi đâu xa tìm việc — job xịn ngay tại Bắc Ninh đây rồi!\nCơ hội đang chờ bạn!' }],
    { company: 'JOY THÁI', addresses: ['KCN Tiên Sơn, Bắc Ninh'] })
  ok(built.description.includes('JOY THÁI – Nơi') && built.description.includes('ngay tại Bắc Ninh') && !built.description.includes('Cơ hội đang chờ bạn!'), '회사·지명 줄은 남고 순수 홍보 줄만 빠짐', built.description)
  ok(isPromoLine('JOY THÁI – Nơi bạn phát triển và tỏa sáng!', []), '회사 이름을 모르면(컨텍스트 없음) 예전처럼 홍보 판정', 'isPromoLine')
}
ok(sourceLines('Công việc\nẨn số\nXem thêm\nDoanh nghiệp đăng tuyển').length === 1, '사이트 UI 글자 제외', 'sourceLines')
ok(contactRepeat('Liên hệ: +84 901 234 567', ['Hotline: 0901234567']), '+84 반복 번호', 'contactRepeat')
ok(!cardReadableSalary('10000000') && !cardReadableSalary('Theo vị trí — xem chi tiết') && cardReadableSalary('10 triệu/tháng'), '카드 급여', 'cardReadableSalary')
console.log(`r2Inspect: 공고 ${R2_ORACLE.length}개, 검사 ${checks}건, 실패 ${failures.length}건`)
if (failures.length) { console.log(failures.join('\n')); throw new Error(`r2Inspect: 검사표가 못 잡은 항목 ${failures.length}건`) }
console.log('r2Inspect.test.ts: all assertions passed')
