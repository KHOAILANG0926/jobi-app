/**
 * 공고 1개 자동 검사표 — 2026-10-25 Lee 결정("하나씩 올리면서 문제를 다 찾고, 크롤링 땐 문제가 나오면 안 된다").
 * 공고를 올리면 기계가 이 항목을 전부 보고 Lee에게 보낸다(scripts/ops/job-inspect.mjs).
 * 크롤링 시작 조건: 새 공고 연속 10개가 전부 통과.
 * 여기 항목은 "Lee가 화면에서 보고 문제라고 할 것"을 기계가 먼저 찾는 것이다. 새 문제를 찾으면 항목을 하나 더한다.
 */
import { bare, detailSections, salaryAmounts, type ShownAbove } from './jobDetailSections.ts'
import { cleanSourceText, contactDuplicate, isPromoLine, sameLine, timeRanges } from './jobDescriptionBuild.ts'
import { headingOf } from './jobDetailSections.ts'
import { isCovered } from './jobDetailFill.ts'
import { sourceRecruitmentRoles } from './sourceRecruitmentRoles.ts'
import { cardSalary } from './mainJobCards.ts'
import { MEAL_HINT } from './mealBenefit.ts'

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
  /** 회사명(원문 줄 빠짐 검사에서 회사명만 있는 줄은 위쪽에 보이므로 허용) */
  company?: string | null
  /** 담당자 이름(위쪽 연락 버튼에 보임) */
  contact_name?: string | null
  /** Explicit fields supplied by the publication worker. Missing values fail closed. */
  postingFields?: { hours?: string | null; employment_type?: string | null; application_deadline?: string | null; num_hires?: string | number | null; reviewOnly?: boolean }
}
/** 검사표 항목 키 전체. 규정 표(job_posting_rules.check_ref)의 inspect:<키>는 이 안에 있어야 한다(job-inspect가 매번 확인). */
export const INSPECT_KEYS = ['pin', 'sections', 'duplicate', 'junk', 'salary', 'benefits', 'occupation', 'ocr', 'new_kind',
  'roles', 'hours_twice', 'source_lost', 'promo_in_07', 'company', 'card', 'public', 'hours_review', 'required_fields'] as const
export interface InspectItem { key: string; label: string; ok: boolean; detail?: string; reviewOnly?: boolean }
export interface InspectResult { ok: boolean; items: InspectItem[] }

const SITE_JUNK = /^(?:hien so|thong tin co ban|ca nhan dang tuyen|nha tuyen dung)$/
// 원문에 복리후생이 있는데 위쪽 표시(아이콘)가 꺼져 있는지 찾는 용도(표시 자체는 이 단어 목록을 쓰지 않는다).
export const BENEFIT_HINTS: Array<{ key: 'shuttle_bus' | 'dormitory' | 'meal_provided'; label: string; re: RegExp }> = [
  { key: 'shuttle_bus', label: 'Xe đưa đón', re: /\b(?:xe dua don|xe dua ruoc|xe don|dua don)\b/ },
  { key: 'dormitory', label: 'Ký túc xá', re: /\b(?:ky tuc xa|ktx|cho o mien phi|bo tri (?:cho )?an o|cho o)\b/ },
  // 2026-11-02 Lee: 식비 수당(phụ cấp ăn uống 등)도 식사 혜택 — 낱말 규칙 한 곳(lib/mealBenefit.ts).
  { key: 'meal_provided', label: 'Ăn ca', re: MEAL_HINT },
]
const NEGATED = /\b(?:khong|ko|k co|tu tuc)\b/

export function inspectJob(j: InspectInput): InspectResult {
  const items: InspectItem[] = []
  const add = (key: string, label: string, ok: boolean, detail?: string) => items.push({ key, label, ok, detail })
  const above: ShownAbove = { title: j.title, phones: j.phones, addresses: j.addresses, salary: j.salary, values: j.values, valueGroups: j.valueGroups }
  const view = detailSections(j.description, above)
  const shown = view.sections.flatMap((s) => s.lines)
  if (j.postingFields) {
    const filled = (v: unknown) => v != null && String(v).trim() !== ''
    const p = j.postingFields
    const mandatory: Array<[string, boolean]> = [
      ['급여', filled(j.salary)], ['근무시간', filled(p.hours)], ['고용형태', filled(p.employment_type)],
      ['업직종', filled(j.occupation_code) && filled(j.category)], ['모집마감', filled(p.application_deadline)],
      ['모집인원', filled(p.num_hires)], ['주소', (j.addresses ?? []).some(filled)],
      ['업무 내용', (view.sections.find(s => s.key === '01')?.lines.length ?? 0) > 0], ['연락처', (j.phones ?? []).some(filled)],
    ]
    const missing = mandatory.filter(([, ok]) => !ok).map(([name]) => name)
    add('required_fields', '필수 9개 항목', missing.length === 0, missing.length ? `누락: ${missing.join(', ')} — 원문에 없으면 확인 필요(추정 입력 금지)` : undefined)
    if (p.reviewOnly) items[items.length - 1].reviewOnly = true
  }

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
  // 2026-11-04(#5405 "NHÀ HÀNG … TUYỂN GẤP:"): '… tuyển (gấp/dụng):'는 아래 직무 줄을 여는 소개 줄 — 빈 이름표가 아니다.
  // 2026-11-03: ':'로 끝나는 긴 소개 문장("Công ty … đang cần tuyển … khu vực Bắc Ninh:")은 이름표가 아니다 — 짧은 줄만 빈 이름표로 본다.
  const junk = shown.filter((l) => SITE_JUNK.test(bare(l)) || /\d[\d .]{2,}\*{2,}/.test(l) || (/[:：]\s*$/.test(l) && bare(l).length <= 60 && !/\btuyen\b/.test(bare(l))))
  add('junk', '사이트 글자·빈 이름표 없음', !junk.length, junk.length ? junk.slice(0, 3).join(' / ') : undefined)
  // 5. (폐지 2026-11-01 Lee "빠짐 0": 10-30 확정 ④ 원문 전체 — 위쪽 칸과 겹치는 줄도 보여 준다)
  // 6. 급여 칸: 원문에 급여가 있는데 위쪽 급여가 비어 있음
  const srcSalary = cleanSourceText(j.source_text).text.split(/\r?\n/).some((l) => /\b(?:luong|thu nhap|muc luong)\b/.test(bare(l)) && salaryAmounts(l).length > 0)
  add('salary', '급여 칸', !!String(j.salary ?? '').trim() || !srcSalary, !String(j.salary ?? '').trim() && srcSalary ? '원문엔 급여가 있는데 위쪽 급여 칸이 비어 있음' : undefined)
  // 7. 복리후생 표시: 원문에 있는데 위쪽 표시가 꺼짐
  const text = bare([j.source_text, j.description].filter(Boolean).join('\n'))
  const missed = BENEFIT_HINTS.filter((b) => {
    const m = text.match(b.re)
    if (!m || j[b.key] === true) return false
    // A benefit shown with its explicit role is not a promise to every role.
    const scopedBenefit = view.sections.find(s => s.key === '05')?.lines.some(line =>
      /(?:full|part)[ -]?time\s*—/i.test(line) && b.re.test(bare(line)))
    if (j[b.key] == null && scopedBenefit) return false
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
  // 12~14 (2026-11-01 Lee: 규정 R10·10-30 확정 구성이 실제로 지켜졌는지 원문과 대조)
  const srcLines = cleanSourceText(j.source_text).text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // 12. 원문 직무 목록(Vị trí tuyển dụng 아래 줄)이 전부 업무 칸(01)에 있는가 — R10
  const roles: string[] = []
  let inRoles = false
  for (const line of srcLines) {
    const b = bare(line.replace(/^[^\p{L}\p{N}]+/u, ''))
    if (/^vi tri (?:tuyen dung|can tuyen)$/.test(b)) { inRoles = true; continue }
    if (headingOf(line) || /[:：]\s*$/.test(line)) { inRoles = false; continue }
    if (inRoles && b) roles.push(line)
  }
  // 직무는 업무 칸(01) 또는 모집조건의 'Vị trí tuyển dụng' 행(sourceRecruitmentRoles)에 보이면 된다.
  const duty = [...(view.sections.find((s) => s.key === '01')?.lines ?? []), ...sourceRecruitmentRoles(j.description).roles]
  const lostRoles = roles.filter((r) => !duty.some((d) => sameLine(d, r) || isCovered(d, [r])))
  add('roles', '원문 직무 전부 업무 칸에', !lostRoles.length, lostRoles.length ? '업무 칸에 없음: ' + lostRoles.slice(0, 3).join(' / ') : undefined)
  // 13. 같은 근무시간이 두 번 이상 보이는가(원문 글·포스터에서 같은 교대를 각각 옮긴 경우)
  const seen = new Map<string, string>()
  const twice: string[] = []
  for (const line of shown) {
    const role = line.includes(' — ') ? line.slice(0, line.indexOf(' — ')) : ''
    for (const range of timeRanges(line)) {
      const key = role + '|' + range
      if (seen.has(key) && seen.get(key) !== line) twice.push(line)
      else seen.set(key, line)
    }
  }
  add('hours_twice', '같은 근무시간 반복 없음', !twice.length, twice.length ? twice.slice(0, 3).join(' / ') : undefined)
  // 14. 원문 줄이 공고에서 빠졌는가 — 2026-11-01 Lee "빠짐 0": 예외는 원문 소제목뿐(사이트 글자·가려진 번호는 cleanSourceText가 이미 뺌)
  const lost = srcLines.filter((line) => {
    if (headingOf(line) || /[:：]\s*$/.test(line)) return false   // 소제목·값 없는 이름표(값 줄은 따로 검사)
    if (isPromoLine(line) || contactDuplicate(line, shown)) return false   // 2026-11-04 Lee: 걸러낸 홍보 문구·반복 연락처는 빠짐이 아님(뺀 줄 목록은 detail_fill.dropped)
    const b = bare(line)
    if (!b) return false
    return !shown.some((d) => sameLine(d, line) || isCovered(line, [d]))
  })
  add('source_lost', '원문 줄 빠짐 없음', !lost.length, lost.length ? lost.slice(0, 3).join(' / ') : undefined)
  // 15. R13: 권유 문구(Gia nhập đội ngũ…, Ứng tuyển sớm…)는 기타란(07)에 둔다
  const promo = view.sections.filter((sec) => sec.key !== '07').flatMap((sec) => sec.lines)
    .filter((l) => /^(?:gia nhap doi ngu|ung tuyen som)\b/.test(bare(l.includes(' — ') ? l.slice(l.indexOf(' — ') + 3) : l)))
  add('promo_in_07', '권유 문구는 기타란', !promo.length, promo.length ? promo.slice(0, 3).join(' / ') : undefined)
  // 16. 회사명이 항목 이름표("Vị trí", "Địa điểm" …)가 아닌가 — 2026-11-01 #5231 "Vị trí tuyển dụng:"의 "Vị trí"를 회사명으로 잡음
  const companyLabel = /^(?:vi tri|dia diem|muc luong|thoi gian|yeu cau|lien he|quyen loi|bang tin)$/.test(bare(String(j.company ?? '')))
  add('company', '회사명 정상', !companyLabel, companyLabel ? `회사명이 항목 이름표: ${j.company}` : undefined)
  // 2026-11-01 #5231·#5247: 공개돼도 메인 화면 카드가 급여를 못 읽으면 목록에서 빠진다 → 검사에서 잡는다(공개는 막지 않고 알림만 — REVIEW_ONLY: 지도·검색에는 보이므로).
  const card = !!cardSalary({ salary: j.salary ?? '', salaryPeriod: null, description: j.description ?? '' } as never)
  add('card', '메인 화면 카드에 보임', card, card ? undefined : `메인 카드가 급여를 못 읽음: ${j.salary}`)
  // 11. 공개 상태
  add('public', '공개됨', !!j.active && !j.admin_hidden, j.admin_hidden ? '관리자가 숨김' : !j.active ? '비공개' : undefined)

  // Same start/end is ambiguous, not evidence of a 12-hour or overnight shift.
  const equalHours = [...String(j.source_text ?? '').matchAll(/\b(\d{1,2})\s*h\s*[-–]\s*\1\s*h\b/gi)].map(m => m[0])
  if (equalHours.length) add('hours_review', '근무시간 관리자 확인', false, '원문 그대로 보존: ' + equalHours.join(' / '))

  return { ok: items.every((i) => i.ok), items }
}

/**
 * 검사 결과로 공개 여부를 정한다(2026-11-01 Lee: 규정 위반 공고가 화면에 나가지 않게).
 * - publishable: 'public'(공개 상태 자체)을 뺀 모든 항목 통과.
 * - 통과 못 하면 비공개. 통과하면 이미 공개 중인 공고는 유지하고, 검사 대기로 막혔던 공고(hold)만 되살린다.
 *   관리자가 숨긴 공고·마감 지난 공고는 되살리지 않는다. 다른 공개 규정(R4·R7·R8)은 DB 트리거가 따로 강제한다.
 */
/** 검사표엔 실패로 남기되 공개는 막지 않는 항목(R11: 10h-10h 같은 근무시간은 관리자 확인 대상, 공개 차단과 구분). */
export const REVIEW_ONLY = ['hours_review', 'card']

export function publishDecision(
  r: InspectResult,
  j: { active?: boolean | null; admin_hidden?: boolean | null; hold?: boolean | null; application_deadline?: string | Date | null },
  today = new Date().toISOString().slice(0, 10),
): { publishable: boolean; active: boolean } {
  const publishable = r.items.every((i) => i.key === 'public' || REVIEW_ONLY.includes(i.key) || i.ok)
  if (!publishable) {
    // Preserve an existing public posting during rollout, but do not issue a
    // reusable publication proof: hiding it later must require a strict pass.
    const keepExisting = j.active === true && !j.admin_hidden && r.items.every((i) =>
      i.key === 'public' || REVIEW_ONLY.includes(i.key) || (i.key === 'required_fields' && i.reviewOnly === true) || i.ok)
    return { publishable, active: keepExisting }
  }
  if (j.active) return { publishable, active: true }
  const deadline = j.application_deadline instanceof Date ? j.application_deadline.toISOString() : j.application_deadline
  const open = !deadline || String(deadline).slice(0, 10) >= today
  return { publishable, active: !!j.hold && !j.admin_hidden && open }
}

/** Lee에게 보낼 쉬운 말 검사표. */
export function inspectReport(j: { id: number; title?: string | null }, r: InspectResult): string {
  const bad = r.items.filter((i) => !i.ok)
  const head = r.ok ? `✅ 공고 #${j.id} 전부 통과` : `❌ 공고 #${j.id} 문제 ${bad.length}개`
  const lines = r.items.map((i) => `${i.ok ? '✅' : '❌'} ${i.label}${i.detail ? ` — ${i.detail}` : ''}`)
  return [`${head} (${j.title ?? ''})`, ...lines].join('\n')
}
