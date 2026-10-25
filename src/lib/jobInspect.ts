/**
 * 공고 1개 자동 검사표 — 2026-10-25 Lee 결정("하나씩 올리면서 문제를 다 찾고, 크롤링 땐 문제가 나오면 안 된다").
 * 공고를 올리면 기계가 이 항목을 전부 보고 Lee에게 보낸다(scripts/ops/job-inspect.mjs).
 * 크롤링 시작 조건: 새 공고 연속 10개가 전부 통과.
 * 여기 항목은 "Lee가 화면에서 보고 문제라고 할 것"을 기계가 먼저 찾는 것이다. 새 문제를 찾으면 항목을 하나 더한다.
 */
import { bare, coveredByAbove, detailSections, isSalaryTotalRepeat, salaryAmounts, type ShownAbove } from './jobDetailSections.ts'
import { cleanSourceText, sameLine } from './jobDescriptionBuild.ts'

export interface InspectInput extends ShownAbove {
  id: number
  description?: string | null
  source_text?: string | null
  category?: string | null
  occupation_code?: string | null
  active?: boolean | null
  admin_hidden?: boolean | null
  image_count?: number
  ocr_status?: string | null
  /** 지도 핀: 'exact' | 'gate' | 'area' | null(없음) */
  pin?: string | null
  unlocated_reason?: string | null
  shuttle_bus?: boolean | null
  dormitory?: boolean | null
  meal_provided?: boolean | null
  unclassified_lines?: string[]
}
export interface InspectItem { key: string; label: string; ok: boolean; detail?: string }
export interface InspectResult { ok: boolean; items: InspectItem[] }

const SITE_JUNK = /^(?:hien so|thong tin co ban|ca nhan dang tuyen|nha tuyen dung)$/
// 원문에 복리후생이 있는데 위쪽 표시(아이콘)가 꺼져 있는지 찾는 용도(표시 자체는 이 단어 목록을 쓰지 않는다).
const BENEFIT_HINTS: Array<{ key: 'shuttle_bus' | 'dormitory' | 'meal_provided'; label: string; re: RegExp }> = [
  { key: 'shuttle_bus', label: 'Xe đưa đón', re: /\b(?:xe dua don|xe dua ruoc|xe don|dua don)\b/ },
  { key: 'dormitory', label: 'Ký túc xá', re: /\b(?:ky tuc xa|ktx|cho o mien phi|bo tri (?:cho )?an o|cho o)\b/ },
  { key: 'meal_provided', label: 'Ăn ca', re: /\b(?:an ca|bua ca|bua an|com trua|ho tro an|bao an|an trua)\b/ },
]
const NEGATED = /\b(?:khong|ko|k co|tu tuc)\b/

export function inspectJob(j: InspectInput): InspectResult {
  const items: InspectItem[] = []
  const add = (key: string, label: string, ok: boolean, detail?: string) => items.push({ key, label, ok, detail })
  const above: ShownAbove = { title: j.title, phones: j.phones, addresses: j.addresses, salary: j.salary, values: j.values, valueGroups: j.valueGroups }
  const view = detailSections(j.description, above)
  const shown = view.sections.flatMap((s) => s.lines)

  // 1. 지도 핀
  add('pin', '지도 핀', !!j.pin, j.pin ? ({ exact: '정확한 위치', gate: '공단 입구', area: '동·공단 대략 위치' } as Record<string, string>)[j.pin] ?? j.pin
    : j.unlocated_reason ? '위치를 못 찾음(원문엔 주소 있음)' : '근무지 정보 없음')
  // 2. 상세요강 칸 나누기 성공(원문 통째로 기타란에 떨어지지 않음)
  add('sections', '상세요강 칸 나누기', !view.usedFallback && shown.length > 0, view.usedFallback ? '칸을 못 나눠 전부 기타란' : shown.length ? undefined : '상세요강 비어 있음')
  // 3. 같은 줄 두 번
  const dups: string[] = []
  shown.forEach((a, i) => shown.forEach((b, k) => { if (k > i && sameLine(a, b)) dups.push(a) }))
  add('duplicate', '상세요강 같은 줄 반복 없음', !dups.length, dups.length ? dups.slice(0, 3).join(' / ') : undefined)
  // 4. 사이트 화면 글자·가려진 번호·값 없는 이름표
  const junk = shown.filter((l) => SITE_JUNK.test(bare(l)) || /\d[\d .]{2,}\*{2,}/.test(l) || /[:：]\s*$/.test(l))
  add('junk', '사이트 글자·빈 이름표 없음', !junk.length, junk.length ? junk.slice(0, 3).join(' / ') : undefined)
  // 5. 위쪽 칸과 같은 내용 반복(급여 총액 포함)
  const rep = shown.filter((l) => isSalaryTotalRepeat(l, j.salary) || coveredByAbove(l, above))
  add('repeat_above', '위쪽 칸 내용 반복 없음', !rep.length, rep.length ? rep.slice(0, 3).join(' / ') : undefined)
  // 6. 급여 칸: 원문에 급여가 있는데 위쪽 급여가 비어 있음
  const srcSalary = cleanSourceText(j.source_text).text.split(/\r?\n/).some((l) => /\b(?:luong|thu nhap|muc luong)\b/.test(bare(l)) && salaryAmounts(l).length > 0)
  add('salary', '급여 칸', !!String(j.salary ?? '').trim() || !srcSalary, !String(j.salary ?? '').trim() && srcSalary ? '원문엔 급여가 있는데 위쪽 급여 칸이 비어 있음' : undefined)
  // 7. 복리후생 표시: 원문에 있는데 위쪽 표시가 꺼짐
  const text = bare([j.source_text, j.description].filter(Boolean).join('\n'))
  const missed = BENEFIT_HINTS.filter((b) => {
    const m = text.match(b.re)
    if (!m || j[b.key] === true) return false
    const before = text.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0)
    return !NEGATED.test(before)
  })
  add('benefits', '복리후생 표시', !missed.length, missed.length ? '원문에 있는데 표시 안 됨: ' + missed.map((b) => b.label).join(', ') : undefined)
  // 8. 직업분류·업종 메뉴
  const classified = !!j.occupation_code && !!j.category && !['khac', 'other'].includes(String(j.category))
  add('occupation', '직업분류·업종 메뉴', classified, classified ? undefined : !j.occupation_code ? '직업 코드 없음' : '업종이 기타(khac)')
  // 9. 포스터 글자 대조
  if ((j.image_count ?? 0) > 0) add('ocr', '포스터 글자 대조', j.ocr_status === 'ok', j.ocr_status ? `결과: ${j.ocr_status}` : '아직 안 읽음')
  // 10. 칸을 못 정한 새 종류 줄
  const unc = j.unclassified_lines ?? []
  add('new_kind', '칸 못 정한 줄 없음', !unc.length, unc.length ? unc.slice(0, 3).join(' / ') : undefined)
  // 11. 공개 상태
  add('public', '공개됨', !!j.active && !j.admin_hidden, j.admin_hidden ? '관리자가 숨김' : !j.active ? '비공개' : undefined)

  return { ok: items.every((i) => i.ok), items }
}

/** Lee에게 보낼 쉬운 말 검사표. */
export function inspectReport(j: { id: number; title?: string | null }, r: InspectResult): string {
  const bad = r.items.filter((i) => !i.ok)
  const head = r.ok ? `✅ 공고 #${j.id} 전부 통과` : `❌ 공고 #${j.id} 문제 ${bad.length}개`
  const lines = r.items.map((i) => `${i.ok ? '✅' : '❌'} ${i.label}${i.detail ? ` — ${i.detail}` : ''}`)
  return [`${head} (${j.title ?? ''})`, ...lines].join('\n')
}
