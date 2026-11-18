// R2(#753) 독립 원문 대조 시험: 원문 ↔ 확정 결과를 r2Oracle.fixtures.ts의 사람이 정한 기대값과 비교한다.
// 기대값은 생산 함수·낱말표로 만들지 않았고(그 자료 머리 참조), 이 시험은 생산 결과가 그것과 다르면 실패한다.
// 실패 목록을 모아서 한 번에 보여 준다(오류 재현 로그). 정답을 코드 출력에 맞춰 고치지 않는다 — 코드를 고친다.
import { R2_ORACLE } from './r2Oracle.fixtures.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { detailSections } from './jobDetailSections.ts'
import { inspectJob } from './jobInspect.ts'
import { ruleConfirmedFlags } from './aiClassifyGuard.ts'
import { readSalary } from './salaryReader.ts'

// 이 시험 전용 낱말 정규화(생산 bare()를 쓰지 않는다 — 같은 정규화에 기대지 않으려고)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const failures: string[] = []
const fail = (job: string, what: string, detail: string) => failures.push(`✗ [${job}] ${what}\n    ${detail}`)
let checks = 0
const ok = (cond: boolean, job: string, what: string, detail: string) => { checks++; if (!cond) fail(job, what, detail) }

for (const o of R2_ORACLE) {
  // 자료 자체 검사: 근거 글자는 반드시 원문에 있어야 한다(지어낸 근거 금지)
  const srcN = norm(o.source)
  for (const f of o.facts) ok(srcN.includes(norm(f.evidence)), o.id, '기대값 근거가 원문에 있음', `원문에 없는 근거: "${f.evidence}"`)
  for (const [k, b] of Object.entries(o.benefits)) if (b?.evidence) ok(srcN.includes(norm(b.evidence)), o.id, `복리후생 ${k} 근거가 원문에 있음`, `원문에 없는 근거: "${b.evidence}"`)

  // ① 칸 배치: 각 근거 줄이 확정 칸에 들어가 있나(어느 칸에도 없으면 '빠짐')
  const description = buildDescriptionFromSources([{ name: 'source_text', text: o.source }], o.ctx).description
  const sections = detailSections(description, {}).sections
  for (const f of o.facts) {
    const e = norm(f.evidence)
    const where = sections.filter((s) => s.lines.some((l) => norm(l).includes(e))).map((s) => s.key)
    const right = where.length === 1 && (where[0] === f.section || (f.ai === true && where[0] === '07'))
    ok(right, o.id, `"${f.evidence}" → 칸 ${f.section}${f.ai ? ' (AI 판정 줄: 07 미정 허용)' : ''}`, `실제 칸: ${where.length ? where.join(',') : '(빠짐)'}`)
  }

  // ② 복리후생: 검사 쪽 읽기(inspectJob benefits 항목)가 기대와 같은가 — 켜져야 하는 것을 꺼 두면 잡고, 꺼져야 하는 것은 잡지 않는다
  const base = { id: 1, title: o.ctx.title, company: o.ctx.company, salary: o.ctx.salary, description, source_text: o.source, phones: o.ctx.phones, addresses: o.ctx.addresses }
  const benefitsOk = (flags: Record<string, boolean | null>) => inspectJob({ ...base, ...flags } as Parameters<typeof inspectJob>[0]).items.find((i) => i.key === 'benefits')?.ok
  // 꺼짐 = DB의 null(공고 칸은 켜는 쪽만 쓴다, false로 쓰지 않음)
  const expectedFlags: Record<string, boolean | null> = {}
  for (const [k, b] of Object.entries(o.benefits)) if (b) expectedFlags[k] = b.on ? true : null
  ok(benefitsOk(expectedFlags) === true, o.id, '기대 복리후생 표시 상태를 검사표가 정상으로 봄', '검사표가 기대와 다르게 "원문에 있는데 표시 안 됨"으로 판정')
  for (const [k, b] of Object.entries(o.benefits)) if (b?.on) {
    ok(benefitsOk({ ...expectedFlags, [k]: null }) === false, o.id, `${k}를 꺼 두면 검사표가 잡음`, `원문 "${b.evidence}"인데 꺼짐을 검사표가 못 잡음`)
  }

  // ③ 복리후생: 만드는 쪽(AI 근거 → 공고 칸 확정)이 기대와 같은가
  for (const [k, b] of Object.entries(o.benefits)) if (b?.evidence) {
    const flags = ruleConfirmedFlags([{ code: k as 'dormitory', evidence: b.evidence }], description)
    ok(flags.includes(k as 'dormitory') === b.on, o.id, `AI 근거 "${b.evidence}" → ${k} ${b.on ? '켜짐' : '꺼짐'}`, `공고 칸 확정 결과: ${JSON.stringify(flags)}`)
  }

  // ④ 급여: 급여 읽기 결과에 원문 숫자가 들어 있나
  if (o.salaryTokens) {
    const sal = readSalary(o.source, null)
    ok(!!sal && o.salaryTokens.every((t) => String(sal.salary).includes(t)), o.id, `급여 읽기 결과에 ${o.salaryTokens.join(', ')}`, `읽은 급여: ${JSON.stringify(sal)}`)
  }
}
console.log(`r2Oracle: ${R2_ORACLE.length}개 공고, 검사 ${checks}건, 실패 ${failures.length}건`)
if (failures.length) { console.log(failures.join('\n')); throw new Error(`r2Oracle: 원문 대비 결과가 다른 항목 ${failures.length}건`) }
console.log('r2Oracle.test.ts: all assertions passed')
