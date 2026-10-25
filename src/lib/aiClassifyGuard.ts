/**
 * AI 칸·복리후생 판정의 안전장치 — 2026-10-25 Lee 결정("단어 규칙으로는 끝이 없다 → AI가 뜻을 보고 정해진 번호표 중에서만 고른다").
 * AI는 ① 단어 규칙이 칸을 못 정한 줄의 칸(01~07)과 ② 원문에 있는 복리후생 번호표만 고른다. 글자는 절대 바꾸지 않는다.
 * 이 파일은 AI 답을 프로그램이 검사한다: 목록 밖 칸·번호표, 우리가 준 적 없는 줄, 원문에 없는 근거, "không/không có" 부정 문장은 버린다.
 */
import { bare } from './jobDetailSections.ts'

export const SECTION_KEYS = ['01', '02', '03', '04', '05', '06', '07'] as const
export type SectionKey = typeof SECTION_KEYS[number]
export const SECTION_MEANING: Record<SectionKey, string> = {
  '01': 'job duties / what the work is',
  '02': 'candidate requirements (gender, age, education, experience, health, skills)',
  '03': 'working time, shifts, days, contract/employment type',
  '04': 'pay, salary, wage rates, allowances paid in money, bonuses, how/when paid',
  '05': 'benefits and work environment (insurance, dormitory, meals, shuttle, training, environment)',
  '06': 'how to apply, documents, interview, recruitment process',
  '07': 'other: company intro, slogans, hiring banners, multi-location lists, referral programs',
}
/** 복리후생 번호표. 앞 3개는 공고 칸(shuttle_bus·dormitory·meal_provided), 뒤 4개는 benefit_tags에 표시 이름으로 넣는다. */
export const BENEFIT_CODES = {
  shuttle_bus: { label: 'Xe đưa đón', meaning: 'employer provides commute bus/shuttle' },
  dormitory: { label: 'Ký túc xá', meaning: 'employer provides dormitory or free accommodation' },
  meal_provided: { label: 'Ăn ca', meaning: 'employer provides meals or meal allowance during shift' },
  fuel: { label: 'Xăng xe', meaning: 'fuel / petrol / commuting transport money support' },
  housing: { label: 'Nhà ở', meaning: 'cash housing / rent allowance (not a dormitory)' },
  attendance: { label: 'Chuyên cần', meaning: 'attendance / diligence bonus' },
  productivity: { label: 'Năng suất', meaning: 'productivity / output / KPI bonus' },
} as const
export type BenefitCode = keyof typeof BENEFIT_CODES

const NEG_BEFORE = /\b(?:khong|ko|k|chua|tu tuc)\b(?:\s+\S+){0,2}\s*$/
const norm = (s: string) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
/** AI가 목록 표시("- ")를 붙여 돌려줘도 같은 줄로 본다(2026-10-25 실측 #4824). */
const normLine = (s: string) => norm(s).replace(/^-\s+(?=\S)/, '')

export interface GuardInput { lines: string[]; source: string }
export interface GuardOutput {
  kinds: Array<{ line: string; section: SectionKey }>
  benefits: Array<{ code: BenefitCode; evidence: string }>
  rejected: string[]
}

/** AI 답(JSON)을 검사해 쓸 수 있는 것만 남긴다. */
export function guardAiResult(raw: unknown, input: GuardInput): GuardOutput {
  const out: GuardOutput = { kinds: [], benefits: [], rejected: [] }
  const obj = (raw && typeof raw === 'object' ? raw : {}) as { kinds?: unknown; benefits?: unknown }
  const given = new Map(input.lines.flatMap((l) => [[normLine(l), l], [norm(l), l]] as Array<[string, string]>))
  for (const k of Array.isArray(obj.kinds) ? obj.kinds : []) {
    const asked = String((k as { line?: string })?.line ?? '')
    const line = given.get(norm(asked)) ?? given.get(normLine(asked))
    const section = String((k as { section?: string })?.section ?? '') as SectionKey
    if (!line) { out.rejected.push('준 적 없는 줄: ' + String((k as { line?: string })?.line).slice(0, 80)); continue }
    if (!SECTION_KEYS.includes(section)) { out.rejected.push(`목록 밖 칸 ${section}: ${line}`); continue }
    if (!out.kinds.some((x) => x.line === line)) out.kinds.push({ line, section })
  }
  const src = norm(input.source)
  const srcBare = bare(src)
  for (const b of Array.isArray(obj.benefits) ? obj.benefits : []) {
    const code = String((b as { code?: string })?.code ?? '') as BenefitCode
    const evidence = norm((b as { evidence?: string })?.evidence ?? '')
    if (!(code in BENEFIT_CODES)) { out.rejected.push('목록 밖 복리후생: ' + code); continue }
    if (!evidence || !src.includes(evidence)) { out.rejected.push(`원문에 없는 근거(${code}): ${evidence.slice(0, 80)}`); continue }
    const at = srcBare.indexOf(bare(evidence))
    if (at >= 0 && NEG_BEFORE.test(srcBare.slice(Math.max(0, at - 20), at))) { out.rejected.push(`부정 문장(${code}): ${evidence}`); continue }
    if (/^(?:khong|ko|chua)\b/.test(bare(evidence))) { out.rejected.push(`부정 문장(${code}): ${evidence}`); continue }
    if (!out.benefits.some((x) => x.code === code)) out.benefits.push({ code, evidence })
  }
  return out
}

/** 같은 줄을 다음에도 알아보도록 저장하는 열쇠(성조·기호 무시). */
export const lineKey = (line: string) => bare(line).replace(/[^a-z0-9]+/g, ' ').trim()

export function buildPrompt(lines: string[], source: string): string {
  return `You classify lines of a Vietnamese job advertisement. Never rewrite text.
Task 1 — For each LINE below, choose exactly one section key:
${SECTION_KEYS.map((k) => `${k} = ${SECTION_MEANING[k]}`).join('\n')}
Task 2 — From the FULL AD, list benefits the employer actually provides, choosing only these codes:
${Object.entries(BENEFIT_CODES).map(([k, v]) => `${k} = ${v.meaning}`).join('\n')}
For each benefit give "evidence": an exact substring copied from the FULL AD. Skip benefits that are negated (không có…) or only possible/conditional on the worker paying.
Return ONLY JSON: {"kinds":[{"line":"<exact line>","section":"01"}],"benefits":[{"code":"dormitory","evidence":"<exact substring>"}]}

LINES (JSON array; copy each string exactly into "line"):
${JSON.stringify(lines)}

FULL AD:
${source}`
}
