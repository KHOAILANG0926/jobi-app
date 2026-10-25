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
import { bare, coveredByAbove, isSalaryTotalRepeat, type DetailTextKey, type ShownAbove } from './jobDetailSections.ts'
import { classifySource, isCovered, FILL_HEADINGS, type FillContext, type FillLine, type FillSource } from './jobDetailFill.ts'

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

export interface BuildContext extends FillContext, Pick<ShownAbove, 'values' | 'valueGroups'> { salary?: string | null }
export interface BuildResult {
  description: string
  lines: FillLine[]
  unclassified: FillLine[]
  dropped: Array<{ line: string; reason: CleanDrop | 'salary_total_repeat' | 'shown_above' | 'duplicate' }>
}

/** 같은 줄인가: 서로가 서로를 거의 다 덮을 때만(긴 소개 문단이 짧은 다른 줄을 '덮는다'고 지우지 않게 — #4879 '- Nam/nữ, tuổi từ 18 đến 45'). */
export function sameLine(a: string, b: string): boolean {
  if (bare(a) === bare(b)) return true
  return isCovered(a, [b]) && isCovered(b, [a])
}

/** 원문들로 상세요강 글 전체를 만든다. 원문이 비어 있으면 description은 ''. */
export function buildDescriptionFromSources(sources: FillSource[], ctx: BuildContext = {}): BuildResult {
  const lines: FillLine[] = []
  const dropped: BuildResult['dropped'] = []
  for (const src of sources) {
    const clean = cleanSourceText(src.text)
    dropped.push(...clean.dropped)
    for (const item of classifySource(clean.text, src.name, ctx)) {
      if (isSalaryTotalRepeat(item.line, ctx.salary)) { dropped.push({ line: item.line, reason: 'salary_total_repeat' }); continue }
      if (coveredByAbove(item.line, ctx)) { dropped.push({ line: item.line, reason: 'shown_above' }); continue }
      if (lines.some((l) => sameLine(l.line, item.line))) { dropped.push({ line: item.line, reason: 'duplicate' }); continue }
      lines.push(item)
    }
  }
  const description = ORDER.filter((key) => lines.some((l) => l.key === key))
    .map((key) => [FILL_HEADINGS[key], ...lines.filter((l) => l.key === key).map((l) => l.line)].join('\n'))
    .join('\n')
  return { description, lines, unclassified: lines.filter((l) => l.how === 'unclassified'), dropped }
}
