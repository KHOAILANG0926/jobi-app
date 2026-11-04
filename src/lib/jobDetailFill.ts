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
export interface FillContext { title?: string | null; company?: string | null; contactName?: string | null; phones?: Array<string | null | undefined>; addresses?: Array<string | null | undefined> }
export type FillHow = 'heading' | 'line' | 'kind_rule' | 'unclassified'
export interface FillLine { line: string; key: DetailTextKey; how: FillHow; from: FillSource['name']; rule?: string }
export interface FillResult { description: string; added: FillLine[]; unclassified: FillLine[]; stillMissing: string[] }

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

/** 전화번호와 연락 이름표(Hotline·Zalo·SĐT·Liên hệ)만 있는 줄인가. */
export function phoneOnly(line: string, contactName?: string | null): boolean {
  const name = new Set(fold(String(contactName ?? '')).split(/[^a-z]+/).filter(Boolean))
  const rest = fold(line.replace(/[\d.\s+()-]{8,}/g, ' ')).split(/[^a-z]+/)
    .filter((t) => t.length >= 2 && !/^(?:sdt|so|dt|hotline|zalo|lien|he|tel|phone|goi|call)$/.test(t) && !name.has(t))
  return rest.length < 2
}

/**
 * 칸 정하는 순서 — 2026-11-01 Lee "판단은 한 곳". 줄 하나의 칸은 아래 순서로 처음 걸리는 것 하나로만 정한다.
 * 화면(detailSections)은 이렇게 만든 글의 소제목을 그대로 따르고 줄을 다시 판단·삭제하지 않는다.
 *   0) Lee가 정한 줄 종류(detail_line_kinds, by=lee) — 아래 모두보다 우선(buildDescriptionFromSources)
 *   1) 원문 소제목 줄 → 칸 문맥만 바꾸고 줄 자체는 우리 소제목으로 대체
 *   2) 연락 줄(공고 전화) → 06, 근무지 주소·회사명·제목과 같은 줄 → 07
 *   3) KIND_RULES(Lee 결정 규칙)
 *   4) 문맥 없는 줄: lineBucket 줄 규칙, 못 정하면 07 + unclassified
 *   5) 소제목 아래 줄: lineBucket(줄 규칙이 분명하면 옮김) / 아니면 소제목 칸
 *   6) AI가 정한 줄 종류(by=ai) — 4)에서 못 정한(unclassified) 줄에만
 */
/** 원문 한 개를 줄마다 칸으로 나눈다(상세요강과 같은 소제목·줄 규칙 + Lee의 새 종류 규정). */
export function classifySource(text: string | null | undefined, from: FillSource['name'], ctx: FillContext = {}): FillLine[] {
  const out: FillLine[] = []
  const titleBare = ctx.title ? bare(ctx.title) : ''
  const companyBare = ctx.company ? bare(ctx.company) : ''
  const phones = (ctx.phones ?? []).map((p) => String(p ?? '').replace(/\D/g, '')).filter((d) => d.length >= 8)
  const addresses = (ctx.addresses ?? []).map((a) => bare(a ?? '')).filter(Boolean)
  let context: DetailTextKey | 'address' | 'contact' | 'none' = 'none'
  for (const raw of String(text ?? '').split(/\r\n|\n|\r/)) {
    const line = raw.trim()
    if (!line || line.includes('[?]')) continue                       // 판독 불가 표시 줄은 쓰지 않는다
    const heading = headingOf(line)
    if (heading) { context = heading; continue }                      // ① 소제목
    const s = bare(line)
    if (!s) continue
    // 2026-11-01 Lee "빠짐 0": 제목·전화·주소·회사명과 같은 줄도 버리지 않는다(10-30 확정 ④ 원문 전체, Liên hệ 필수).
    // 이런 줄은 칸이 정해져 있다(새 종류로 묻지 않음): 연락 줄 → 06 채용 절차, 주소·회사명·제목 줄 → 07.
    const d = line.replace(/\D/g, '')
    if (phones.some((p) => d.includes(p))) { out.push({ line, key: '06', how: 'kind_rule', from, rule: 'contact_line' }); continue }
    if (addresses.some((a) => a === s || a.startsWith(s) || s.startsWith(a))) { out.push({ line, key: '07', how: 'kind_rule', from, rule: 'address_line' }); continue }
    if ((companyBare && (s === companyBare || s === `cty ${companyBare}` || s === `cong ty ${companyBare}`)) || (titleBare && s === titleBare)) {
      out.push({ line, key: '07', how: 'kind_rule', from, rule: 'company_title_line' }); continue
    }
    // 2026-11-04 Lee "다 고치고"(#5437): "DOOKKI ĐANG TUYỂN:"처럼 ':'로 끝나는 모집 소개 줄 아래는 직무 목록 → 업무 칸(01). 줄 자체도 01에 남긴다.
    if (/[:：]\s*$/.test(line) && /(?:^|\s)(?:dang tuyen|can tuyen|tuyen dung|tuyen gap|vi tri tuyen dung|vi tri can tuyen)$/.test(s)) {
      context = '01'; out.push({ line, key: '01', how: 'kind_rule', from, rule: 'hiring_intro_heading' }); continue
    }
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
