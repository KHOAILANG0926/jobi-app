// 공고 원문(description)에서 구조화 항목을 뽑는다 (2026-10-07, docs/JOB_FIELDS_AND_DETAIL_DESIGN.md).
// 원칙: **원문에 적힌 값만** — 추정·보정·번역 금지. 한 줄이 아니라 한 "조각"씩 규칙에 맞을 때만 뽑고,
// 규칙에 안 맞는 문장은 그대로 남긴다. 뽑은 값이 문장 전체를 대신할 때만(whole) 상세요강에서 빼고,
// 일부만 대신하면(partial) 남은 부분만 남긴다.
// 이 파일은 순수 함수 — DB를 읽거나 쓰지 않는다(적용은 별도 승인 후 스크립트가 한다).

export type ExtractField = 'hours' | 'workDays' | 'benefitTags' | 'genderRequirement' | 'education' | 'preference' | 'contactZalo' | 'languageRequirement' | 'businessTrip'

export interface ExtractedFields {
  hours?: string
  workDays?: string
  benefitTags?: string[]
  genderRequirement?: string
  education?: string
  preference?: string
  contactZalo?: string
  /** 언어 조건(원문 문장 그대로) — local_jobs.language_requirement */
  languageRequirement?: string
  /** 출장 가능 — local_jobs.business_trip. 원문이 명시한 경우만("Sẵn sàng đi công tác"=true, "Không đi công tác"=false) */
  businessTrip?: boolean
}

export interface ExtractItem {
  /** 원문 한 줄 */
  line: string
  /** 뽑은 항목(여러 개 가능). */
  picked: { field: ExtractField; value: string | string[] | boolean }[]
  /** whole=문장 전체 대체(상세요강에서 제거) / partial=남은 부분만 유지 / kept=그대로 유지 */
  action: 'whole' | 'partial' | 'kept'
  remainder?: string
  note?: string
}

export interface ExtractResult {
  fields: ExtractedFields
  items: ExtractItem[]
  /** 상세요강에 남길 본문(출처 태그 제거, 뽑힌 문장 제외) */
  remaining: string
  /** 원문 맨 앞 `[source:xxx]` 태그 — jobRows가 source로 읽으므로 DB에 쓸 때는 반드시 다시 붙인다 */
  sourceTag?: string
}

export interface ExtractContext {
  /** DB에 이미 있는 값 — 같은 정보를 다시 쓰는 줄만 제거 대상으로 본다 */
  salary?: string | null
  employerPhone?: string | null
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
const digits = (s: string) => s.replace(/\D/g, '')
const stripTrailingDot = (s: string) => s.trim().replace(/[.;]+$/, '').trim()
const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

const SEP = '[–—-]'
const HOURS_SEG = new RegExp(`^\\d{1,2}\\s*[h:]\\s*\\d{0,2}\\s*${SEP}\\s*\\d{1,2}\\s*[h:]\\s*\\d{0,2}$`, 'i')
const DAY = '(?:T[2-7]|CN|Thứ\\s*[2-7]|Chủ nhật)'
const DAYS_SEG = new RegExp(`^${DAY}\\s*${SEP}\\s*${DAY}(?:\\s*\\+\\s*[^.]+)?\\.?$`, 'i')
const GENDER_RE = /^(Nam|Nữ)(\s*\/\s*(Nam|Nữ))?\s*(,|$)/i
const EDU_RE = /(CĐ\s*\/\s*ĐH|ĐH\s*\/\s*CĐ|Cao đẳng|Đại học|Trung cấp|Tốt nghiệp THPT|THPT|CĐ|ĐH)/i
const EXPERIENCE_RE = /(?:[≥>]=?\s*)?\d+\s*năm\s+kinh nghiệm|kinh nghiệm\s+(?:từ\s+)?\d+\s*năm/i
const LANGUAGE_RE = /tiếng\s+(trung|anh|hàn|nhật|đài)|\bhsk\b|\btoeic\b|\bielts\b|\btopik\b|\bjlpt\b/i
const TRIP_YES_RE = /^(sẵn sàng|có thể|chấp nhận)\s+(đi\s+)?công tác$|^đi công tác$/i
const TRIP_NO_RE = /^không\s+(phải\s+)?(đi\s+)?công tác$/i
const INSURANCE_RE = /\b(BHXH|BHYT|BHTN)\b/g
const SALARY_LABEL_RE = /^\s*(lương|mức lương|thu nhập)\s*:/i
const CONTACT_RE = /^\s*(ứng tuyển|liên hệ|zalo|sđt|hotline)[^:]*:\s*([0-9][0-9 .\-]{7,})\s*$/i
const HEADING_RE = /^[A-ZÀ-Ỹ0-9 /&:-]{3,40}$/u

/** 복리후생 키워드 → 고정 라벨(원문에 그 단어가 있을 때만) */
const BENEFIT_PHRASES: { re: RegExp; label: string }[] = [
  { re: /thưởng\s+lễ|\btết\b/i, label: 'Thưởng lễ, Tết' },
  { re: /du lịch/i, label: 'Du lịch hằng năm' },
]
const BENEFIT_LINE_RE = /^(đóng|được|hưởng|có)?\s*(đầy đủ\s*)?(bhxh|bhyt|bhtn|thưởng)|^thưởng\b/i
const INSURANCE_FILLER = /đóng|đầy đủ|theo quy định|đầy đủ|đủ|được hưởng|hưởng|full|\band\b|,|\//gi

function splitLines(text: string): string[] {
  return text.replace(/^\s*\[source:[^\]]*\]\s*/i, '').split(/\r?\n/).map((l) => l.trim())
}

export function extractJobFields(description: string, ctx: ExtractContext = {}): ExtractResult {
  const lines = splitLines(description)
  const fields: ExtractedFields = {}
  const items: ExtractItem[] = []
  const out: string[] = []

  const salaryNorm = norm(ctx.salary ?? '')
  const phoneDigits = digits(ctx.employerPhone ?? '')

  for (const raw of lines) {
    if (!raw) { out.push(''); continue }
    if (HEADING_RE.test(raw) && !/\d/.test(raw) && raw.split(' ').length <= 4) { out.push(raw); continue }

    // 1) 급여 줄 — 이미 DB에 같은 금액 문구가 있을 때만 제거
    if (SALARY_LABEL_RE.test(raw)) {
      const body = norm(raw.replace(SALARY_LABEL_RE, '').trim().replace(/^(upto|up to|lên đến|tối đa)\s+/i, ''))
      if (salaryNorm && body && salaryNorm.includes(body)) {
        items.push({ line: raw, picked: [], action: 'whole', note: 'salary 컬럼에 이미 같은 값 — 중복이라 제거' })
        continue
      }
      items.push({ line: raw, picked: [], action: 'kept', note: 'salary 컬럼과 달라 유지' })
      out.push(raw); continue
    }

    // 2) 연락 줄 — Zalo 표기가 있을 때만 contact_zalo, 번호는 하단 버튼으로 노출되므로 줄 제거
    const c = raw.match(CONTACT_RE)
    if (c) {
      const num = digits(c[2])
      const isZalo = /zalo/i.test(raw.split(':')[0])
      const picked: ExtractItem['picked'] = []
      if (isZalo && num) { fields.contactZalo = num; picked.push({ field: 'contactZalo', value: num }) }
      const samePhone = !!phoneDigits && num === phoneDigits
      items.push({ line: raw, picked, action: samePhone || isZalo ? 'whole' : 'kept',
        note: samePhone ? 'employer_phone과 같은 번호 — 연락 버튼으로 노출' : isZalo ? 'Zalo 번호 추출' : undefined })
      if (!(samePhone || isZalo)) out.push(raw)
      continue
    }

    // 3) 근무시간 | 요일 — 조각 전부가 규칙에 맞을 때만 줄 제거
    const segs = raw.split('|').map((x) => x.trim()).filter(Boolean)
    if (segs.length > 0 && segs.every((x) => HOURS_SEG.test(x) || DAYS_SEG.test(x))) {
      const picked: ExtractItem['picked'] = []
      for (const sgm of segs) {
        if (HOURS_SEG.test(sgm)) { fields.hours = sgm; picked.push({ field: 'hours', value: sgm }) }
        else { const v = stripTrailingDot(sgm); fields.workDays = v; picked.push({ field: 'workDays', value: v }) }
      }
      items.push({ line: raw, picked, action: 'whole' })
      continue
    }

    // 4) 복리후생 — BHXH/BHYT/BHTN, 고정 키워드(thưởng lễ/Tết, du lịch)
    const tags: string[] = []
    const ins = [...new Set(raw.match(INSURANCE_RE) ?? [])]
    tags.push(...ins)
    if (/^thưởng\b/i.test(raw) || BENEFIT_LINE_RE.test(raw)) for (const b of BENEFIT_PHRASES) if (b.re.test(raw) && !tags.includes(b.label)) tags.push(b.label)
    if (tags.length > 0 && (ins.length > 0 || /^thưởng\b/i.test(raw))) {
      // 줄에 태그로 환원되지 않는 내용이 남으면 whole로 보지 않는다
      let rest = raw
      for (const t of ins) rest = rest.replace(new RegExp(`\\b${t}\\b`, 'g'), '')
      for (const b of BENEFIT_PHRASES) rest = rest.replace(new RegExp(b.re.source, 'gi'), '')
      rest = rest.replace(INSURANCE_FILLER, ' ').replace(/\b(thưởng|hằng năm|bảo hiểm)\b/gi, ' ').replace(/[.\s]+/g, ' ').trim()
      fields.benefitTags = [...new Set([...(fields.benefitTags ?? []), ...tags])]
      items.push({ line: raw, picked: [{ field: 'benefitTags', value: tags }], action: rest ? 'partial' : 'whole', remainder: rest ? raw : undefined,
        note: rest ? '태그로 대체되지 않는 내용이 남아 문장 유지' : '복리후생 태그로 대체(세부 문구 "theo quy định" 등은 사라짐 — 확인 필요)' })
      if (rest) out.push(raw)
      continue
    }

    // 5) 성별·학력 — "Nam, CĐ/ĐH, ưu tiên ..." 형태. 뽑고 남은 부분만 유지
    const g = raw.match(GENDER_RE)
    if (g) {
      const picked: ExtractItem['picked'] = []
      let rest = raw.replace(GENDER_RE, '')
      fields.genderRequirement = g[1][0].toUpperCase() + g[1].slice(1).toLowerCase()
      picked.push({ field: 'genderRequirement', value: fields.genderRequirement })
      const e = rest.match(EDU_RE)
      if (e) {
        fields.education = e[1].replace(/\s+/g, '')
        picked.push({ field: 'education', value: fields.education })
        rest = rest.replace(e[0], '')
      }
      rest = stripTrailingDot(rest.replace(/^[\s,;]+|[\s,;]+$/g, '').replace(/\s*,\s*,/g, ','))
      if (rest) {
        const keep = `${sentenceCase(rest)}.`
        items.push({ line: raw, picked, action: 'partial', remainder: keep })
        out.push(keep)
      } else items.push({ line: raw, picked, action: 'whole' })
      continue
    }

    // 6) 경력 — 문장 전체를 "Kinh nghiệm" 값으로
    if (EXPERIENCE_RE.test(raw)) {
      const v = stripTrailingDot(raw)
      fields.preference = v
      items.push({ line: raw, picked: [{ field: 'preference', value: v }], action: 'whole' })
      continue
    }

    // 7) 언어 조건 — 문장 전체를 그대로(번역·요약 금지)
    if (LANGUAGE_RE.test(raw)) {
      const v = stripTrailingDot(raw)
      fields.languageRequirement = fields.languageRequirement ? `${fields.languageRequirement}; ${v}` : v
      items.push({ line: raw, picked: [{ field: 'languageRequirement', value: v }], action: 'whole' })
      continue
    }
    // 8) 출장 — 문장 전체가 출장 가능/불가를 명시하는 경우만(그 외 "công tác" 언급은 그대로 둔다)
    const trip = TRIP_YES_RE.test(stripTrailingDot(raw)) ? true : TRIP_NO_RE.test(stripTrailingDot(raw)) ? false : undefined
    if (trip !== undefined) {
      fields.businessTrip = trip
      items.push({ line: raw, picked: [{ field: 'businessTrip', value: trip }], action: 'whole' })
      continue
    }

    items.push({ line: raw, picked: [], action: 'kept' })
    out.push(raw)
  }

  const remaining = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const sourceTag = description.match(/^\s*(\[source:[^\]]*\])/i)?.[1]
  return { fields, items, remaining, sourceTag }
}

/**
 * 근무시간·교대 읽기(#622, Lee 2026-11-10 "전체 수정"): 원문(source_text·포스터 글자)에서
 * - 교대: "Ca ngày"+"Ca đêm" 둘 다 / "xoay ca·đảo ca·2 ca·3 ca" → rotating(2 ca·3 ca면 그 수), 하나만 → day/night
 * - 근무시간: 시계 범위(8h-17h, 08:00–17:00)가 있으면 원문 그대로 첫 범위들, 없고 "N tiếng"만 있으면 "Ca ngày / Ca đêm, N tiếng"
 * 원문에 없는 값은 만들지 않는다(빈칸). 쓰는 곳: scripts/ocr/detail-fill.mjs(급여 readSalary와 같은 자리, 빈칸일 때만).
 */
const CLOCK_RANGE = /\b\d{1,2}\s*(?:h|giờ|:)\s*\d{0,2}\s*(?:-|–|—|đến|~)\s*\d{1,2}\s*(?:h|giờ|:)\s*\d{0,2}\b/gi
export function readWorkTime(...texts: (string | null | undefined)[]): { shiftType?: 'day' | 'night' | 'rotating'; rotatingShifts?: number; hours?: string } {
  const text = texts.filter(Boolean).join('\n')
  if (!text.trim()) return {}
  const day = /\bca\s+ngày\b/i.test(text), night = /\bca\s+(?:đêm|tối)\b/i.test(text)
  // "2 ca/tuần"·"2 ca mỗi tuần" = 주당 근무 횟수(교대 종류 수 아님) → 제외. 베트남어 글자(đ 등)는 \b가 못 보므로 \p{L} 경계.
  const nShift = text.match(/(?<![\p{L}\d])([23])\s*ca(?![\p{L}\d])(?!\s*(?:\/|mỗi\s|một\s|trong\s)\s*(?:tuần|tháng|ngày|week))/iu)?.[1]
  const rotating = (day && night) || /(?<![\p{L}\d])(?:xoay\s+ca|ca\s+xoay|đảo\s+ca|làm\s+đảo\s+ca|luân\s+phiên\s+ca|ca\s+luân\s+phiên)(?![\p{L}\d])/iu.test(text) || !!nShift
  const out: { shiftType?: 'day' | 'night' | 'rotating'; rotatingShifts?: number; hours?: string } = {}
  if (rotating) { out.shiftType = 'rotating'; if (nShift) out.rotatingShifts = Number(nShift); else if (day && night) out.rotatingShifts = 2 }
  else if (day) out.shiftType = 'day'
  else if (night) out.shiftType = 'night'
  const clocks = [...new Set((text.match(CLOCK_RANGE) ?? []).map((s) => s.trim()))].slice(0, 3)
  if (clocks.length) out.hours = clocks.join(', ')
  else {
    // 교대별로 시간이 다르면(8 tiếng / 12 tiếng) 하나로 합치지 않고 비워 둔다(원문 없는 값 금지).
    const nums = [...new Set([...text.matchAll(/(?<![\p{L}\d])(\d{1,2})\s*tiếng(?![\p{L}\d])/giu)].map((m) => m[1]))]
    const n = nums.length === 1 ? nums[0] : undefined
    const labels = [day ? 'Ca ngày' : '', night ? 'Ca đêm' : ''].filter(Boolean).join(' / ')
    if (n && Number(n) >= 4 && Number(n) <= 14) out.hours = labels ? `${labels}, ${n} tiếng` : `${n} tiếng`
  }
  return out
}
