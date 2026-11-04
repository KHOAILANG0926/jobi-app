import type { DetailSection, DetailTextKey } from './jobDetailSections.ts'

export interface RoleGroup { role?: string; lines: string[] }
export interface RoleSection { key: DetailTextKey; label: string; groups: RoleGroup[] }
/** 직무 제목 줄: "CÔ RỬA BÁT FULL TIME"(끝에 full/part time) 또는 "1. FULL-TIME CA TỐI: 02 NHÂN VIÊN"(번호 + full/part time으로 시작, #5247 Wallace 2026-11-01). */
export function isRoleHeading(line: string): boolean {
  const t = line.trim()
  return /^.+\s+(?:full|part)[ -]?time$/i.test(t) || /^\d+[.)]\s*(?:full|part)[ -]?time\b.{0,60}$/i.test(t)
    // 2026-11-03 #5342 Joy Thái(공고 번호 전용 아님): "CÁC VỊ TRÍ" 아래 대문자 직무 제목 줄 "NHÂN VIÊN PHỤC VỤ".
    // 대문자만, "NHÂN VIÊN "으로 시작, 숫자·콜론 없음, 짧은 줄만(제목 "TUYỂN NHÂN VIÊN …"·설명 문장은 해당 없음).
    || (t.length <= 40 && /^NHÂN VIÊN\s+\S/u.test(t) && t === t.toLocaleUpperCase('vi') && !/[\d:]/.test(t))
}
/** 직무 묶음을 끝내는 다른 대문자 제목 줄(예: "GIA NHẬP JOY THÁI, BẠN NHẬN ĐƯỢC GÌ?") — 그 아래 복리후생을 마지막 직무 것으로 붙이지 않는다. */
export function isOtherCapsHeading(line: string): boolean {
  const t = line.trim()
  return !isRoleHeading(t) && t.length >= 8 && /\p{L}{3}/u.test(t) && t === t.toLocaleUpperCase('vi') && !/\d/.test(t)
}
export function splitRoleLine(line: string): { role?: string; line: string } {
  const at=line.indexOf(' — ')
  if (at>0 && isRoleHeading(line.slice(0,at))) return { role:line.slice(0,at),line:line.slice(at+3) }
  return isRoleHeading(line) ? {role:line,line:''} : {line}
}
const continuation=(line:string)=>/^\+\s*(?:thưởng|thuong|tip)\b/i.test(line)

/** Display-only grouping also understands persisted role-prefixed descriptions.
 * Never changes the stored original or claims that a role-specific benefit is global. */
export function descriptionRoleGroups(sections: DetailSection[]): RoleSection[] {
  const records=sections.flatMap(section=>section.lines.map(raw=>({...splitRoleLine(raw),key:section.key,label:section.label})))
  for (let i=0;i<records.length;i++) {
    const part=records[i]
    if (!continuation(part.line)) continue
    const salary=records.slice(0,i).reverse().find(r=>r.key==='04'&&r.role===part.role&&r.line&&!continuation(r.line))
    if (salary && (part.role || records[i-1]===salary)) { salary.line+=' '+part.line; part.line=''; part.role=undefined }
  }
  return sections.map(section=> {
    const groups:RoleGroup[]=[]
    for (const item of records.filter(r=>r.key===section.key)) {
      if (!item.line && !item.role) continue
      let group=groups.find(g=>g.role===item.role)
      if (!group) {group={role:item.role,lines:[]};groups.push(group)}
      if (item.line) group.lines.push(item.line)
    }
    return {key:section.key,label:section.label,groups:groups.filter(g=>g.lines.length||g.role)}
  }).filter(section=>section.groups.length)
}

/** Return exclusive role owners only when the original description has no shared meal promise. */
export function roleScopedMeals(description: string | null | undefined): string[] {
  const records=String(description??'').split(/\r?\n/).map(splitRoleLine)
  if (new Set(records.map(r=>r.role).filter(Boolean)).size<2) return []
  const meal=(line:string)=> {
    const normalized=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase()
    const match=normalized.match(/\b(?:bao an|an ca|bua an|com trua)\b/)
    return !!match && !/\b(?:khong|ko|tu tuc)\s*$/.test(normalized.slice(0,match.index))
  }
  const meals=records.filter(r=>meal(r.line))
  if (!meals.length||meals.some(r=>!r.role)) return []
  return [...new Set(meals.map(r=>r.role!))]
}

export interface RoleConditionSummary {
  roleCount:number; salary:string; hours?:string; workPeriod?:string; workDays?:string; numHires:string; mealBenefit?:string
}
export const shortRole=(role:string)=>role.replace(/^\d+[.)]\s*/,'').replace(/\s*:\s*\d+\s*nhân viên$/iu,'').replace(/\s+(?:full|part)[ -]?time$/i,'').replace(/^(?:cô\s+|nhân viên\s+(?:nam\s*\/\s*nữ\s+)?)/iu,'').toLocaleLowerCase('vi')
export const capitalize=(text:string)=>text.charAt(0).toLocaleUpperCase('vi')+text.slice(1)
/** Values approved by Lee, derived from role-labelled text rather than a job ID. */
export function roleConditionSummary(description:string|null|undefined):RoleConditionSummary|null {
  const records=String(description??'').split(/\r?\n/).map(splitRoleLine)
  const roles=[...new Set(records.map(r=>r.role).filter((r):r is string=>!!r))]
  if (roles.length<2) return null
  // 직무 제목에 근무 형태가 적힌 경우만(대문자 직무 제목 "NHÂN VIÊN PHỤC VỤ"에는 없음 → 공고 칸 값 사용).
  const kinds=[...new Set(roles.flatMap(role=>/full[ -]?time/i.test(role)?['Full time']:/part[ -]?time/i.test(role)?['Part time']:[]))]
  const dayOf=(role:string)=>records.filter(r=>r.role===role).map(r=>r.line).join('\n').match(/Tháng nghỉ\s+(\d+)\s+ngày/iu)
  const anyDay=roles.some(role=>dayOf(role))
  const days=roles.map(role=> {
    const day=dayOf(role)
    return `${shortRole(role)}: ${day?`nghỉ ${day[1]} ngày/tháng`:'chưa nêu'}`
  }).join('; ')
  // 직무 줄에 시간이 하나도 없으면 "직무마다 다름"이라고 하지 않는다(없는 것을 있다고 하지 않음).
  const anyHours=records.some(r=>r.role&&/\d{1,2}\s*(?:h|giờ|:\d{2})|\(tg:/iu.test(r.line)&&!/đ\s*\/\s*giờ|vnd\s*\/\s*giờ|\/\s*h\b/iu.test(r.line))
  const mealOwners=roleScopedMeals(description)
  const mealRecord=mealOwners.length===1?records.find(r=>r.role===mealOwners[0]&&/Bao ăn\s+\d+\s+bữa/iu.test(r.line)):undefined
  const meals=mealRecord?.line.match(/Bao ăn\s+(\d+)\s+bữa/iu)?.[1]
  return {
    roleCount:roles.length, salary:`Theo từng vị trí (${roles.length} vị trí) — xem chi tiết`,
    hours:anyHours?`Khác nhau theo ${roles.length} vị trí — xem chi tiết`:undefined,
    workPeriod:kinds.length?kinds.join(' / '):undefined,workDays:anyDay?capitalize(days):undefined,
    numHires:`${roles.length} vị trí; số người chưa nêu`,
    mealBenefit:mealOwners.length?`Ăn ca: chỉ ${mealOwners.map(shortRole).join(', ')}${meals?`, ${meals} bữa`:''}`:undefined,
  }
}

/** Lee 2026-10-30: 여러 직무 공고의 메인 카드 급여 — 직무별 급여 줄을 원문 글자 그대로(숫자 합치지 않음). 직무 2개 미만이면 빈 배열. */
export function roleSalaryLines(description:string|null|undefined):string[] {
  const records=String(description??'').split(/\r?\n/).map(splitRoleLine)
  const roles=[...new Set(records.map(r=>r.role).filter((r):r is string=>!!r))]
  if (roles.length<2) return []
  return roles.flatMap(role=> {
    // 2026-11-03: "Full-time: 8.974.000 – 10.490.000đ/tháng"처럼 'lương' 글자 없이 금액만 있는 줄도 급여 줄.
    const line=records.find(r=>r.role===role&&(/\b(?:lương|luong)\b|\d+\s*k\s*\/|triệu/iu.test(r.line)||/\d[\d.,]{4,}\s*(?:đ|vn[dđ]|đồng)\s*\//iu.test(r.line)))?.line
    return line ? [`${capitalize(shortRole(role))}: ${line.replace(/^\s*[•·*-]\s*/u,'').replace(/^\s*(?:mức\s+)?lương\s*[:：]\s*/iu,'').trim()}`] : []
  })
}

/** 2026-11-04 Lee 승인 글 모형("차라리 저게 낫지"): 상세 근무조건 급여 칸 — 직무 | 금액 두 칸.
 *  정규직 금액이 기본이라 "Full-time:" 글자는 뺀다. 직무 안의 다른 이름(예: "Bếp phụ")은 그 이름을 쓴다.
 *  원문에 직무 공통 "Part-time:" 시급 줄이 있으면 맨 아래 한 줄. 금액은 합치지 않고 표기만 triệu로 줄인다. */
export interface RoleSalaryRow { label: string; amount: string }
const MONEY = /\d[\d.,]{4,}\s*(?:đ|vn[dđ]|đồng)\s*\//iu
export function shortAmount(text: string): string {
  const t = text.trim()
  if (!/\/\s*tháng/iu.test(t)) return t
  const nums = [...t.matchAll(/\d{1,3}(?:\.\d{3}){2,}/g)].map((m) => Number(m[0].replace(/\./g, '')))
  if (!nums.length || nums.some((n) => n < 1_000_000)) return t
  const fmt = (n: number) => String(Math.round(n / 10_000) / 100).replace('.', ',')
  return `${nums.map(fmt).join(' – ')} triệu/tháng`
}
export function roleSalaryRows(description: string | null | undefined): RoleSalaryRow[] {
  const records = String(description ?? '').split(/\r?\n/).map(splitRoleLine)
  const roles = [...new Set(records.map((r) => r.role).filter((r): r is string => !!r))]
  if (roles.length < 2) return []
  const rows: RoleSalaryRow[] = []
  for (const role of roles) {
    const line = records.find((r) => r.role === role && MONEY.test(r.line))?.line
    if (!line) continue
    const body = line.replace(/^\s*[•·*-]\s*/u, '').trim()
    const m = body.match(/^([^:：]{1,40})[:：]\s*(.+)$/u)
    const sub = m?.[1].trim() ?? ''
    const amount = (m?.[2] ?? body).trim()
    const label = !sub || /^(?:full[ -]?time|toàn thời gian|lương|mức lương)$/iu.test(sub) ? capitalize(shortRole(role)) : capitalize(sub.toLocaleLowerCase('vi'))
    rows.push({ label, amount: shortAmount(amount) })
  }
  const part = records.find((r) => !r.role && /^\s*[•·*-]?\s*part[ -]?time\s*[:：]/iu.test(r.line) && /\d/.test(r.line))?.line
  if (part && rows.length) rows.push({ label: 'Part-time', amount: shortAmount(part.replace(/^\s*[•·*-]?\s*part[ -]?time\s*[:：]\s*/iu, '')) })
  return rows
}
