/**
 * 상세요강 빠진 줄 자동 보충 — 2026-10-20 Lee 결정.
 * - 원문(게시글 source_text, AI 판독 포스터 글자 ocr_text)에 있는데 공고 글(description)에 없는 줄을 찾는다.
 * - 빠진 줄은 막지 않고 원문 글자 그대로 맞는 칸(01~06)에 자동으로 넣는다. 칸을 못 정하면 07에 넣는다(내용은 버리지 않음).
 * - 지금 규칙에 없는 종류(07에 들어간 줄)는 unclassified로 돌려준다 → Lee에게 알리고 칸을 정해 새 규정(KIND_RULES)으로 추가한다.
 * - 빼도 되는 줄은 상세요강과 같은 예외뿐: 원문 소제목 · 제목 반복 · 화면 위에 이미 있는 정보(전화·근무지 주소·회사명).
 */
import { bare, fold, headingOf, lineBucket, type DetailTextKey } from './jobDetailSections.ts'

/** 보충 줄을 붙일 때 쓰는 소제목. 모두 jobDetailSections HEADINGS가 같은 칸으로 읽는 글자다(시험으로 확인). */
export const FILL_HEADINGS: Record<DetailTextKey, string> = {
  '01': 'Công việc',
  '02': 'Yêu cầu',
  '03': 'Thời gian làm việc',
  '04': 'Thu nhập',
  '05': 'Quyền lợi',
  '06': 'Quy trình tuyển dụng',
  '07': 'Thông tin khác',
}
const ORDER: DetailTextKey[] = ['01', '02', '03', '04', '05', '06', '07']

/**
 * Lee가 정한 "새 종류" 규정. 줄 글자(성조 무시)로 칸을 정한다.
 * 새 종류가 나오면 Lee와 상의해 여기에 한 줄씩 추가하고, 결정 문서와 시험(jobDetailFill.test.ts)에도 같이 넣는다.
 */
export const KIND_RULES: Array<{ id: string; re: RegExp; key: DetailTextKey; decided: string }> = [
  // Lee 2026-10-28: restaurant poster conditions; role ownership is retained by the builder.
  { id: 'restaurant_banner', key: '07', decided: '2026-10-28 Lee', re: /^(?:nha hang nuong|tuyen nhan su(?: nha hang)?|ban dang tim mot cong viec\b.*|chung toi dang can ban)$/ },
  { id: 'rest_break_days', key: '03', decided: '2026-10-28 Lee', re: /^(?:thang nghi\b|nghi trua\b|het khach som\b)/ },
  { id: 'meals_provided', key: '05', decided: '2026-10-28 Lee', re: /^bao an\b/ },
  { id: 'holiday_bonus', key: '04', decided: '2026-10-28 Lee', re: /^(?:duoc thuong vao cac ngay le|\+\s*thuong\s*\+\s*tip)$/ },
  { id: 'explicit_candidate_requirements', key: '02', decided: '2026-10-28 Lee', re: /^(?:yeu cau\s*:|uu tien ung vien\b)/ },
  { id: 'join_team_call', key: '07', decided: '2026-10-28 Lee', re: /^gia nhap doi ngu\b/ },

  { id: 'early_apply_call', key: '07', decided: '2026-10-28 Lee', re: /^ung tuyen som\b/ },
  // 2026-10-20 Lee: "두루뭉술하게 쓴 거잖아… 저런 거는 그냥 기타란으로 넣어야지 넣을 데가 없잖아" → 07, 묻지 않음
  { id: 'vague_slogan', key: '07', decided: '2026-10-20 Lee',
    re: /^(?:gan bo lau dai|cong viec lau dai|viec lam lau dai|viec lam on dinh|cong viec on dinh|thu nhap (?:tot|on dinh|cao)|moi truong(?: lam viec)? (?:thoai mai|sach se|than thien|chuyen nghiep)|quy trinh ro rang)$/ },
  { id: 'closing_call', key: '07', decided: '2026-10-20 Lee',
    re: /^(?:ai co nhu cau|moi nguoi chia se|nhanh tay ung tuyen|lien he ngay|ib ngay|inbox ngay)\b/ },
  { id: 'hiring_banner', key: '07', decided: '2026-10-20 Lee', re: /^tuyen full$/ },
]

export interface FillSource { name: 'source_text' | 'ocr_text'; text: string | null | undefined }
export interface FillContext { title?: string | null; company?: string | null; phones?: Array<string | null | undefined>; addresses?: Array<string | null | undefined> }
export type FillHow = 'heading' | 'line' | 'kind_rule' | 'unclassified'
export interface FillLine { line: string; key: DetailTextKey; how: FillHow; from: FillSource['name']; rule?: string }
export interface FillResult { description: string; added: FillLine[]; unclassified: FillLine[]; stillMissing: string[] }

const digits = (s: string) => s.replace(/\D/g, '')
function tokens(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 2 || /\d/.test(t))
}
/** 이 줄의 낱말이 공고 글의 어느 한 줄에 거의 다 있으면(85% 이상) 이미 들어 있는 것으로 본다. 표기 차이(50t/50 tuổi, 줄 합침)를 허용. */
export function isCovered(line: string, targetLines: string[]): boolean {
  const need = tokens(line)
  if (!need.length) return true
  return targetLines.some((target) => {
    const have = tokens(target)
    const hit = need.filter((t) => have.some((u) => u === t || (t.length >= 2 && u.length >= 2 && (u.startsWith(t) || t.startsWith(u))))).length
    return hit / need.length >= 0.85
  })
}

/** 원문 한 개를 줄마다 칸으로 나눈다(상세요강과 같은 소제목·줄 규칙 + Lee의 새 종류 규정). */
export function classifySource(text: string | null | undefined, from: FillSource['name'], ctx: FillContext = {}): FillLine[] {
  const out: FillLine[] = []
  const titleBare = ctx.title ? bare(ctx.title) : ''
  const companyBare = ctx.company ? bare(ctx.company) : ''
  const phones = (ctx.phones ?? []).map((p) => digits(p ?? '')).filter((d) => d.length >= 8)
  const addresses = (ctx.addresses ?? []).map((a) => bare(a ?? '')).filter(Boolean)
  let context: DetailTextKey | 'address' | 'contact' | 'none' = 'none'
  for (const raw of String(text ?? '').split(/\r\n|\n|\r/)) {
    const line = raw.trim()
    if (!line || line.includes('[?]')) continue                       // 판독 불가 표시 줄은 쓰지 않는다
    const heading = headingOf(line)
    if (heading) { context = heading; continue }                      // ① 소제목
    const s = bare(line)
    if (!s) continue
    if (titleBare && s === titleBare) continue                        // ② 제목 반복
    const d = digits(line)
    if (phones.some((p) => d.includes(p))) continue                   // ③ 위에 있는 전화
    if (addresses.some((a) => a === s || a.startsWith(s) || s.startsWith(a))) continue // ③ 위에 있는 근무지 주소
    if (companyBare && (s === companyBare || s === `cty ${companyBare}` || s === `cong ty ${companyBare}`)) continue // ③ 위에 있는 회사명
    const rule = KIND_RULES.find((r) => r.re.test(s))
    if (rule) { out.push({ line, key: rule.key, how: 'kind_rule', from, rule: rule.id }); continue }
    if (context === 'none' || context === 'address' || context === 'contact') {
      const byLine = lineBucket(line, '07')
      out.push(byLine !== '07' ? { line, key: byLine, how: 'line', from } : { line, key: '07', how: 'unclassified', from })
      continue
    }
    const key = lineBucket(line, context)
    // 급여 소제목 아래라도 숫자가 없는 줄(장점 문구 등)은 급여라고 확신할 수 없다 → 새 종류로 보고 Lee에게 묻는다.
    if (key === '04' && context === '04' && !/\d/.test(line)) { out.push({ line, key: '07', how: 'unclassified', from }); continue }
    out.push({ line, key, how: 'heading', from })
  }
  return out
}

/** 빠진 줄을 찾아 원문 글자 그대로 공고 글 끝에 칸별 소제목과 함께 붙인다. 빠진 줄이 없으면 공고 글을 그대로 돌려준다. */
export function fillMissingLines(description: string | null | undefined, sources: FillSource[], ctx: FillContext = {}): FillResult {
  const base = String(description ?? '')
  const descLines = base.split(/\r\n|\n|\r/).filter((l) => l.trim())
  const added: FillLine[] = []
  for (const src of sources) {
    for (const item of classifySource(src.text, src.name, ctx)) {
      if (isCovered(item.line, descLines)) continue
      if (isCovered(item.line, added.map((a) => a.line))) continue    // 게시글·포스터에 같은 줄이 둘 다 있으면 한 번만
      added.push(item)
    }
  }
  if (!added.length) return { description: base, added, unclassified: [], stillMissing: [] }
  const blocks = ORDER.filter((key) => added.some((a) => a.key === key))
    .map((key) => [FILL_HEADINGS[key], ...added.filter((a) => a.key === key).map((a) => a.line)].join('\n'))
  const filled = `${base.replace(/\s+$/, '')}\n${blocks.join('\n')}`
  // 붙인 뒤 다시 비교: 그래도 빠진 줄이 있으면 우리 코드 문제(기록 → 코드 수정 후 재처리)
  const filledLines = filled.split(/\r\n|\n|\r/).filter((l) => l.trim())
  const stillMissing = sources.flatMap((src) => classifySource(src.text, src.name, ctx)).map((x) => x.line).filter((l) => !isCovered(l, filledLines))
  return { description: filled, added, unclassified: added.filter((a) => a.how === 'unclassified'), stillMissing }
}
