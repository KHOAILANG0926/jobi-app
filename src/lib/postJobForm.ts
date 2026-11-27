// Lee 2026-10-30: 고용주 공고 등록 화면을 확정 체크리스트(CLAUDE.md "공고 상세페이지 구성·공고 작성 체크리스트") 순서로.
// 화면 입력 → 기존 local_jobs 칸으로 옮기는 순수 함수만 둔다(DB·서버 변경 없음). 값을 지어내지 않는다.

/** 베트남 전화번호: 휴대폰 0(3|5|7|8|9)+8자리, 유선 02+9자리. +84/84는 0으로. 틀리면 null. */
export function normalizeVnPhone(raw: string): string | null {
  let d = String(raw ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+84')) d = '0' + d.slice(3)
  else if (/^84\d{9,10}$/.test(d)) d = '0' + d.slice(2)
  d = d.replace(/\D/g, '')
  if (/^0[35789]\d{8}$/.test(d)) return d
  if (/^02\d{9}$/.test(d)) return d
  return null
}

export type PayUnit = 'hour' | 'day' | 'month'
const UNIT_TEXT: Record<PayUnit, string> = { hour: 'giờ', day: 'ngày', month: 'tháng' }

/** 급여 칸: 금액+단위(대표 1개) 또는 "Thỏa thuận". 금액이 비면 null. */
export function composeSalary(amount: string, unit: PayUnit, negotiable: boolean): { salary: string; salaryPeriod?: PayUnit } | null {
  if (negotiable) return { salary: 'Thỏa thuận' }
  const a = amount.trim()
  if (!a) return null
  return { salary: /\/\s*\S+$/.test(a) ? a : `${a}/${UNIT_TEXT[unit]}`, salaryPeriod: unit }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
/** 근무시간: 시작~끝 필수, 휴게는 선택. */
export function composeHours(start: string, end: string, breakMinutes: string): string | null {
  if (!TIME.test(start) || !TIME.test(end)) return null
  const b = breakMinutes.trim()
  return `${start} - ${end}${/^\d{1,3}$/.test(b) && Number(b) > 0 ? ` (nghỉ ${Number(b)} phút)` : ''}`
}

/** 나이 범위 1개(한 번만). 둘 다 비면 undefined, 잘못된 범위는 null. */
export function composeAge(min: string, max: string): string | undefined | null {
  const a = min.trim(), b = max.trim()
  if (!a && !b) return undefined
  const lo = a ? Number(a) : null, hi = b ? Number(b) : null
  if ((lo !== null && !(lo >= 15 && lo <= 70)) || (hi !== null && !(hi >= 15 && hi <= 70)) || (lo !== null && hi !== null && lo > hi)) return null
  if (lo !== null && hi !== null) return `${lo} - ${hi} tuổi`
  return lo !== null ? `Từ ${lo} tuổi` : `Đến ${hi} tuổi`
}

export type GenderChoice = '' | 'Nam' | 'Nữ' | 'Nam/nữ'
/** 모집인원: 숫자 또는 미정. 남녀 모두 + 성별 인원이 있으면 그대로 적는다. 비면 null(필수). */
export function composeHires(count: string, undecided: boolean, gender: GenderChoice, male: string, female: string): string | null {
  const split = gender === 'Nam/nữ' && (/^\d+$/.test(male.trim()) || /^\d+$/.test(female.trim()))
    ? [male.trim() && `Nam ${male.trim()}`, female.trim() && `nữ ${female.trim()}`].filter(Boolean).join(', ') : ''
  if (undecided) return split ? `Chưa xác định (${split})` : 'Chưa xác định'
  const c = count.trim()
  if (!/^\d{1,4}$/.test(c) || Number(c) < 1) return null
  return split ? `${c} người (${split})` : `${c} người`
}

/** 주소: 번지·도로 + 동 + 성(2025 개편 2단계). 셋 다 있어야 한다. 공단·공장 이름은 앞에 붙인다. */
export function composeLocation(street: string, ward: string, province: string, park: string): string | null {
  const s = street.trim(), w = ward.trim(), p = province.trim()
  if (!s || !w || !p) return null
  return [park.trim(), s, w, p].filter(Boolean).join(', ')
}

/** 상세요강: 고용주가 쓴 글을 기존 상세 칸 제목(jobDetailSections HEADINGS)으로 묶는다. 빈 칸은 쓰지 않는다. */
export function composeDescription(parts: { work: string; overtime: string; environment: string; process: string; benefitOther: string }): string | null {
  const work = parts.work.trim()
  if (!work) return null
  const block = (heading: string, lines: string[]) => {
    const body = lines.map((l) => l.trim()).filter(Boolean)
    return body.length ? `${heading}\n${body.join('\n')}` : ''
  }
  return [
    block('Nội dung công việc', [work]),
    block('Thời gian làm việc', [parts.overtime && `Tăng ca: ${parts.overtime.trim()}`]),
    block('Phúc lợi', [parts.benefitOther, parts.environment]),
    block('Quy trình tuyển dụng', [parts.process]),
  ].filter(Boolean).join('\n\n')
}

/** 복리후생 아이콘 7개 중 benefit_tags에 들어가는 4개(aiClassifyGuard BENEFIT_CODES 표시 이름과 같게). */
export const BENEFIT_TAG_OPTIONS = ['Chuyên cần', 'Nhà ở', 'Xăng xe', 'Năng suất'] as const
