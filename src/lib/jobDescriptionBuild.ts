/**
 * 상세요강을 원문에서 기계가 만든다 — 2026-10-25 Lee 결정("AI가 글 고쳐 쓰기 금지, 하나의 흐름으로").
 *
 * 왜: 그동안 ① AI가 원문을 보고 상세요강 글을 새로 고쳐 쓰고 ② 단어 규칙으로 칸을 나누고 ③ 빠진 줄을 원문에서 다시 붙였다.
 *     ①이 글자를 바꾸면 ③이 "빠졌다"며 원문을 또 붙여 같은 내용이 두 번 나왔다(#4878 TEFAL 실측).
 * 이제: 원문(source_text) + 포스터 판독 글(ocr_text)이 있는 공고는 상세요강을 이 함수가 원문 글자 그대로 다시 만든다.
 *   1) 사이트 화면 글자 제거(Hiện số, 가려진 번호 "033 715 ****", Thông tin cơ bản, Cá nhân đăng tuyển …)
 *   2) "Lương tối đa:" + 다음 줄 "18 triệu" 처럼 이름표/값이 두 줄로 나뉜 것은 한 줄로 합침(글자는 그대로 이어 붙임)
 *   3) 줄마다 칸(01~07) 정하기 — 상세요강 화면과 같은 규칙(jobDetailSections·jobDetailFill)
 *   4) 위에 이미 보이는 정보(제목·전화·근무지·회사명·급여 총액)와 같은 내용 반복은 뺌
 *   5) 게시글·포스터에 같은 줄이 둘 다 있으면 한 번만
 * 글자는 바꾸지 않는다(빼거나 옮기거나 두 줄을 이어 붙이기만).
 */
import { bare, fold, type DetailTextKey, type ShownAbove } from './jobDetailSections.ts'
import { lineKey } from './aiClassifyGuard.ts'
import { classifySource, isCovered, FILL_HEADINGS, type FillContext, type FillLine, type FillSource } from './jobDetailFill.ts'
import { isOtherCapsHeading, isRoleHeading } from './jobRolePresentation.ts'

const ORDER: DetailTextKey[] = ['01', '02', '03', '04', '05', '06', '07']

/** 채용 사이트 화면에 붙어 있는 글자(공고 내용이 아님). bare() 기준. */
const SITE_CHROME = /^(?:hien so|an so|xem so|thong tin co ban|nha tuyen dung|ca nhan dang tuyen|doanh nghiep dang tuyen|lien he|xem them|thu gon|bao cao tin(?: dang)?|chia se|luu tin|tin da luu|ung tuyen ngay|nop don ngay|chat voi nha tuyen dung)$/
/** 가려진 전화번호(사이트가 일부를 *로 가린 것) — 위쪽 연락처에 진짜 번호가 따로 있다. */
const MASKED_PHONE = /\d[\d .]{2,}\*{2,}/

/** 이름표만 있는 줄 → 다음 줄이 값. 값 처리 규칙. */
const PAIR_LABELS: Record<string, 'keep' | 'drop' | 'drop_if_empty_value'> = {
  'nganh nghe': 'keep', 'loai hinh cong viec': 'keep', 'hinh thuc tra luong': 'keep',
  'luong toi thieu': 'keep', 'luong toi da': 'keep', 'kinh nghiem': 'keep', 'gioi tinh': 'keep',
  'do tuoi': 'keep', 'hoc van toi thieu': 'drop_if_empty_value',
  'ten cong ty': 'drop', 'nha tuyen dung': 'drop',
}
const labelOf = (line: string) => {
  const s = bare(line)
  return Object.prototype.hasOwnProperty.call(PAIR_LABELS, s) ? s : ''
}
/** "Học vấn tối thiểu: Khác"처럼 아무 뜻 없는 값. */
const EMPTY_VALUE = /^(?:khac|khong ro|chua cap nhat|-)$/

export type CleanDrop = 'site_chrome' | 'masked_phone' | 'label_without_value' | 'shown_above_company' | 'meaningless_value'
export interface CleanResult { text: string; dropped: Array<{ line: string; reason: CleanDrop }> }

/** 1)·2) 사이트 화면 글자 제거 + 두 줄로 나뉜 이름표/값 합치기. */
export function cleanSourceText(text: string | null | undefined): CleanResult {
  const lines = String(text ?? '').split(/\r\n|\n|\r/).map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  const dropped: CleanResult['dropped'] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // A leading + is a continuation, not a new salary/benefit condition.
    if (/^\+\s*(?:thưởng|thuong|tip)\b/iu.test(line) && out.length && /(?:lương|luong|thu nhập|thu nhap|\d[\d.,]*\s*(?:k|đ|vnd|triệu|trieu)\b)/iu.test(out[out.length - 1])) {
      out[out.length - 1] += ' ' + line
      continue
    }
    if (MASKED_PHONE.test(line)) { dropped.push({ line, reason: 'masked_phone' }); continue }
    const label = labelOf(line)
    if (label) {
      const next = lines[i + 1]
      const nextIsValue = next !== undefined && !labelOf(next) && !SITE_CHROME.test(bare(next)) && !MASKED_PHONE.test(next)
      if (!nextIsValue) { dropped.push({ line, reason: 'label_without_value' }); continue }
      i++
      const rule = PAIR_LABELS[label]
      const merged = `${line.replace(/\s*:?\s*$/, '')}: ${next}`
      if (rule === 'drop') { dropped.push({ line: merged, reason: 'shown_above_company' }); continue }
      if (rule === 'drop_if_empty_value' && EMPTY_VALUE.test(bare(next))) { dropped.push({ line: merged, reason: 'meaningless_value' }); continue }
      out.push(merged)
      continue
    }
    if (SITE_CHROME.test(bare(line))) { dropped.push({ line, reason: 'site_chrome' }); continue }
    out.push(line)
  }
  return { text: out.join('\n'), dropped }
}

export interface BuildContext extends FillContext, Pick<ShownAbove, 'values' | 'valueGroups'> {
  salary?: string | null
  /** Explicit reviewer decision, never inferred from an industrial-park address alone. */
  dutiesUnspecified?: boolean
  /** Lee 2026-11-01: 업종으로 큰 분류를 정한 공고의 업무 칸 한 줄(예: "Nhân viên cửa hàng"). */
  dutyLine?: string
  /** 저장된 줄 번호표(detail_line_kinds): lineKey → 칸. Lee가 정한 것 + AI가 정한 것. 단어 규칙이 못 정한 줄에 쓴다(Lee가 정한 줄은 항상). */
  lineKinds?: Record<string, { section: DetailTextKey; by: 'ai' | 'lee' }>
}

export interface BuildResult {
  description: string
  lines: Array<FillLine & { role?: string }>
  unclassified: FillLine[]
  dropped: Array<{ line: string; reason: CleanDrop | 'salary_total_repeat' | 'shown_above' | 'duplicate' | 'ocr_check_only' | 'promo' }>
  /** Lee-approved disclosures, kept distinct from verbatim source lines. */
  annotations: Array<{ key: DetailTextKey; line: string }>
}

export const UNSPECIFIED_DUTIES_NOTICE = 'Công việc cụ thể: chưa ghi trong tin gốc'
export const CONTRACTOR_NOTICE = 'Tuyển qua nhà thầu'

/** Lee 2026-11-04 "상세 페이지는 중요한 내용을 상세하게 — 안 중요한 내용도 적는 공간이 아니다".
 * 걸러내는 것 3가지(애매하면 남김, 뺀 줄은 detail_fill.dropped와 검사표에 남는다):
 *   ① 포스터 글자 읽기(OCR) — 원문 글이 있으면 화면에 넣지 않는다(사진 글자 대조 R7에만 쓴다)
 *   ② 반복 — 숫자·띄어쓰기만 다른 같은 전화·이메일 줄
 *   ③ 홍보·인사말 — 기타 칸에서 "!"/"?"로 끝나고 숫자·주소·회사·연락처·이름표(:)가 없는 줄
 */
const PHONE_RE = /(?:\+?84|0)(?:[\s.\-–]?\d){8,10}/g
export function phonesIn(line: string): string[] {
  return [...String(line).matchAll(PHONE_RE)].map((m) => m[0].replace(/\D/g, '').replace(/^84/, '0'))
}
const emailsIn = (line: string) => [...String(line).toLowerCase().matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)].map((m) => m[0])
const CONTACT_WORDS = new Set(['hotline', 'zalo', 'sdt', 'so', 'dien', 'thoai', 'lien', 'he', 'lh', 'email', 'mail', 'goi', 'call', 'phone', 'tel', 'hoac', 'va'])
/** ② 이 줄의 전화·이메일이 이미 보인 줄에 다 있고, 나머지가 연락처 이름표뿐인가. */
export function contactDuplicate(line: string, shown: string[]): boolean {
  const phones = phonesIn(line), emails = emailsIn(line)
  if (!phones.length && !emails.length) return false
  const seenPhones = new Set(shown.flatMap(phonesIn)), seenEmails = new Set(shown.flatMap(emailsIn))
  if (!phones.every((p) => seenPhones.has(p)) || !emails.every((e) => seenEmails.has(e))) return false
  let rest = String(line).toLowerCase()
  for (const e of emailsIn(line)) rest = rest.split(e).join(' ')
  rest = rest.replace(PHONE_RE, ' ')
  return fold(rest).split(/[^a-z]+/).filter(Boolean).every((w) => CONTACT_WORDS.has(w))
}
// 주소·회사 낱말은 성조가 있는 원문 그대로 본다("đi đâu xa"의 xa ≠ "xã").
const ADDRESS_HINT = /(?:^|[^\p{L}])(?:tầng|đường|phố|phường|xã|huyện|quận|thị trấn|thành phố|tp|kcn|khu công nghiệp|ccn|thôn|ngõ|ngách|số nhà|tòa|plaza|chi nhánh|cơ sở)(?![\p{L}])/u
// 근무 조건·지원 방법 낱말이 있으면 "!"로 끝나도 정보다(#4824 "Công việc lâu dài!", #5438 "Ứng viên vui lòng gửi CV …!").
const JOB_FACT_HINT = /(?:^|[^\p{L}])(?:lâu dài|ổn định|chính thức|thời vụ|bao ăn|bao ở|ăn ở|ký túc|ktx|xe đưa đón|đưa đón|bảo hiểm|bhxh|thưởng|phụ cấp|tăng ca|nghỉ|ca ngày|ca đêm|xoay ca|part[ -]?time|full[ -]?time|kinh nghiệm|đào tạo|lương|thu nhập|tuổi|nam|nữ|cv|hồ sơ|phỏng vấn)(?![\p{L}])/u
const COMPANY_HINT = /(?:^|[^\p{L}])(?:công ty|tnhh|cổ phần|tập đoàn|đơn vị|văn phòng)(?![\p{L}])/u
/** 해시태그만 있는 줄(#TuyenDung #ViecLam …) — 어느 칸에 있든 뺀다. */
export const isHashtagLine = (line: string) => /^(?:#[\p{L}\p{N}_]+[\s,]*)+$/u.test(String(line).trim())
/** ③ 홍보·인사말 줄인가(기타 칸에서만 쓴다). 해시태그만 있는 줄도 포함. */
export function isPromoLine(line: string): boolean {
  const t = String(line).trim()
  if (isHashtagLine(t)) return true
  if (!/[!?]\s*$/.test(t) || /\d/.test(t) || /[:：]/.test(t) || /@|https?:\/\/|zalo|hotline/i.test(t)) return false
  const low = t.normalize('NFC').toLowerCase()
  return !ADDRESS_HINT.test(low) && !COMPANY_HINT.test(low) && !JOB_FACT_HINT.test(low)
}

/** 같은 줄인가: 서로가 서로를 거의 다 덮을 때만(긴 소개 문단이 짧은 다른 줄을 '덮는다'고 지우지 않게 — #4879 '- Nam/nữ, tuổi từ 18 đến 45'). */
export function sameLine(a: string, b: string): boolean {
  if (bare(a) === bare(b)) return true
  return isCovered(a, [b]) && isCovered(b, [a])
}

/** 줄 속 근무시간 범위(정규화: "6:30-14:30"). "06h30 – 14h30", "14h - 22h", "7h00-11h00" 모두 같은 형식으로. */
export function timeRanges(line: string): string[] {
  const t = (h: string, m?: string) => `${Number(h)}:${m ?? '00'}`
  return [...fold(line).matchAll(/(\d{1,2})\s*[h:g]\s*(\d{2})?\s*[-–~]\s*(\d{1,2})\s*[h:g]\s*(\d{2})?/g)].map((m) => t(m[1], m[2]) + '-' + t(m[3], m[4]))
}
/** "Ca A: 06h30 – 14h30", "✓ CA 1: 6h30 - 14h30"처럼 교대 이름표 + 시간만 있는 줄인가. */
export function shiftOnlyLine(line: string): boolean {
  if (!timeRanges(line).length) return false
  const rest = fold(line).replace(/(\d{1,2})\s*[h:g]\s*(\d{2})?\s*[-–~]\s*(\d{1,2})\s*[h:g]\s*(\d{2})?/g, ' ')
    .split(/[^a-z0-9]+/).filter((w) => w && !/^(?:ca|kip|shift|[a-z]|\d)$/.test(w))
  return rest.length === 0
}

/** Explicit role+employment headings only; never infer roles from company or job ID.
 * Labels annotate presentation; the original item.line and source_text stay unchanged. */
function roleBlocks(text: string): Array<{ role?: string; text: string }> {
  const rows = text.split('\n')
  const isRole = isRoleHeading
  if (rows.filter(isRole).length < 2) return [{ text }]
  const blocks: Array<{ role?: string; text: string }> = []
  let role: string | undefined
  for (const line of rows) {
    if (isRole(line)) role = line
    else if (/^(?:quyen loi|phuc loi|lien he|dia chi|yeu cau|mo ta cong viec)\s*:?$/i.test(bare(line))) role = undefined
    else if (isOtherCapsHeading(line)) role = undefined
    const last = blocks[blocks.length - 1]
    if (last && last.role === role) last.text += '\n' + line
    else blocks.push({ role, text: line })
  }
  return blocks
}

const LIST_BULLET = /^\s*(?:[•·\-–*+✓✔☑️👉🔹🔸▪◦○●]|\d+[.)])/u
/**
 * 원문 묶음 유지(Lee 2026-11-06, #5506): "~:"로 끝나는 제목 줄과 바로 아래 이어지는 글머리 줄은 한 덩어리다.
 * 줄마다 칸을 정하면(규칙·AI 줄 칸) 목록이 제목에서 떨어져 화면에 빈 제목이 남으므로, 덩어리 전체를 한 칸에 넣는다.
 * 칸은 덩어리 안에서 규칙으로 정해진 첫 줄의 칸, 없으면 제목 줄의 칸. 같은 원문·같은 직무 묶음 안에서만 묶는다.
 */
function keepListBlocks(lines: Array<FillLine & { role?: string }>): void {
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i]
    // 직무 제목 줄(여러 직무 공고)은 직무 묶음 규칙이 따로 칸을 나눈다 — 건드리지 않는다.
    if (head.role === head.line || LIST_BULLET.test(head.line) || !/[:：]\s*$/.test(head.line)) continue
    let end = i + 1
    while (end < lines.length && lines[end].from === head.from && lines[end].role === head.role && LIST_BULLET.test(lines[end].line)) end++
    if (end === i + 1) continue
    const block = lines.slice(i, end)
    const key = (block.find((l) => l.how !== 'unclassified' && !String(l.rule ?? '').startsWith('kind:')) ?? head).key
    for (const l of block) l.key = key
    i = end - 1
  }
}

/** 원문들로 상세요강 글 전체를 만든다. 원문이 비어 있으면 description은 ''. */
export function buildDescriptionFromSources(sources: FillSource[], ctx: BuildContext = {}): BuildResult {
  const lines: BuildResult['lines'] = []
  const dropped: BuildResult['dropped'] = []
  const hasPost = sources.some((src) => src.name === 'source_text' && String(src.text ?? '').trim())
  for (const src of sources) {
    const clean = cleanSourceText(src.text)
    // ① 원문 글이 있으면 포스터 글자 읽기(OCR)는 화면에 넣지 않는다 — 조각난 글자·잘못 짝지은 주소가 섞인다(#5437).
    if (hasPost && src.name === 'ocr_text') {
      for (const line of clean.text.split('\n').filter(Boolean)) dropped.push({ line, reason: 'ocr_check_only' })
      continue
    }
    dropped.push(...clean.dropped)
    for (const block of roleBlocks(clean.text)) {
      for (const original of classifySource(block.text, src.name, ctx)) {
        const item: FillLine & { role?: string } = { ...original, role: block.role }
        if (item.role === item.line) { item.key = '01'; item.how = 'line'; item.rule = 'explicit_role_heading' }
        if (item.role && /^\(tg:/.test(bare(item.line))) { item.key = '03'; item.how = 'line'; item.rule = 'role_hours' }

        // 2026-11-01 Lee "빠짐 0": 급여 총액·위쪽 칸과 겹치는 줄도 뺀다 하지 않는다(10-30 확정 ④ 원문 전체).
        if (lines.some((l) => l.role === item.role && sameLine(l.line, item.line))) { dropped.push({ line: item.line, reason: 'duplicate' }); continue }
        // 2026-11-01 #5157: 게시글 "Ca A: 06h30 – 14h30"과 포스터 "CA 1: 6h30 - 14h30"은 같은 교대다(이름표만 다름).
        if (shiftOnlyLine(item.line) && timeRanges(item.line).every((r) => lines.some((l) => l.role === item.role && timeRanges(l.line).includes(r)))) {
          dropped.push({ line: item.line, reason: 'duplicate' }); continue
        }
        // ② 숫자·띄어쓰기만 다른 같은 연락처 줄
        if (contactDuplicate(item.line, lines.map((l) => l.line))) { dropped.push({ line: item.line, reason: 'duplicate' }); continue }
        const kind = ctx.lineKinds?.[lineKey(item.line)]
        // ③ 홍보·인사말(칸과 관계없이 — 모집 소개 줄 아래로 이어진 인사말도, 2026-11-04) — Lee가 칸을 정한 줄은 그대로
        if ((!kind || kind.by !== 'lee') && (isHashtagLine(item.line) || isPromoLine(item.line))) { dropped.push({ line: item.line, reason: 'promo' }); continue }
        if (kind && (kind.by === 'lee' || item.how === 'unclassified')) { lines.push({ ...item, key: kind.section, how: 'line', rule: `kind:${kind.by}` }); continue }
        lines.push(item)
      }
    }
  }
  keepListBlocks(lines)
  const annotations: BuildResult['annotations'] = []
  if (ctx.dutiesUnspecified && !lines.some(l => l.line === UNSPECIFIED_DUTIES_NOTICE)) {
    annotations.push({ key: '01', line: UNSPECIFIED_DUTIES_NOTICE })
  }
  // Lee 2026-11-01 (#5247): 업무가 원문에 없고 업종으로 큰 분류를 정한 공고는 업무 칸에 가게 직원 한 줄(원문 가게 낱말)을 보여 준다.
  if (ctx.dutyLine && !ctx.dutiesUnspecified && !lines.some(l => l.key === '01') && !lines.some(l => l.line === ctx.dutyLine)) {
    annotations.push({ key: '01', line: ctx.dutyLine })
  }
  // A contractor paying a joining bonus is a recruitment intermediary, not a candidate fee.
  // Do not interpret negated mentions ("không qua môi giới") as intermediary recruitment.
  const throughContractor = sources.some(src => String(src.text ?? '').split(/\r?\n/).some(line => {
    const text = bare(line)
    return [...text.matchAll(/\b(?:nha thau (?:thuong|tuyen)|tuyen qua (?:nha thau|moi gioi))\b/g)]
      .some(match => !/\b(?:khong|ko|chua)(?:\s+qua)?\s*$/.test(text.slice(0, match.index)))
  }))
  if (throughContractor && !lines.some(l => l.line === CONTRACTOR_NOTICE)) {
    annotations.push({ key: '06', line: CONTRACTOR_NOTICE })
  }
  const display = [...lines, ...annotations]
  const description = ORDER.filter((key) => display.some((l) => l.key === key))
    .map((key) => [FILL_HEADINGS[key], ...display.filter((l) => l.key === key).map((l) => 'role' in l && l.role && l.line !== l.role ? `${l.role} — ${l.line}` : l.line)].join('\n'))
    .join('\n')
  return { description, lines, unclassified: lines.filter((l) => l.how === 'unclassified'), dropped, annotations }
}
