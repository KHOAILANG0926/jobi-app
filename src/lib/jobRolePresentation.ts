import type { DetailSection, DetailTextKey } from './jobDetailSections.ts'

export interface RoleGroup { role?: string; lines: string[] }
export interface RoleSection { key: DetailTextKey; label: string; groups: RoleGroup[] }
export function splitRoleLine(line: string): { role?: string; line: string } {
  const match=line.match(/^(.+\s+(?:full|part)[ -]?time)\s+—\s+(.*)$/i)
  if (match) return { role:match[1],line:match[2] }
  return /^.+\s+(?:full|part)[ -]?time$/i.test(line) ? {role:line,line:''} : {line}
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
  roleCount:number; salary:string; hours:string; workPeriod:string; workDays:string; numHires:string; mealBenefit?:string
}
export const shortRole=(role:string)=>role.replace(/\s+(?:full|part)[ -]?time$/i,'').replace(/^(?:cô\s+|nhân viên\s+(?:nam\s*\/\s*nữ\s+)?)/iu,'').toLocaleLowerCase('vi')
export const capitalize=(text:string)=>text.charAt(0).toLocaleUpperCase('vi')+text.slice(1)
/** Values approved by Lee, derived from role-labelled text rather than a job ID. */
export function roleConditionSummary(description:string|null|undefined):RoleConditionSummary|null {
  const records=String(description??'').split(/\r?\n/).map(splitRoleLine)
  const roles=[...new Set(records.map(r=>r.role).filter((r):r is string=>!!r))]
  if (roles.length<2) return null
  const kinds=[...new Set(roles.map(role=>/full[ -]?time$/i.test(role)?'Full time':'Part time'))]
  const days=roles.map(role=> {
    const day=records.filter(r=>r.role===role).map(r=>r.line).join('\n').match(/Tháng nghỉ\s+(\d+)\s+ngày/iu)
    return `${shortRole(role)}: ${day?`nghỉ ${day[1]} ngày/tháng`:'chưa nêu'}`
  }).join('; ')
  const mealOwners=roleScopedMeals(description)
  const mealRecord=mealOwners.length===1?records.find(r=>r.role===mealOwners[0]&&/Bao ăn\s+\d+\s+bữa/iu.test(r.line)):undefined
  const meals=mealRecord?.line.match(/Bao ăn\s+(\d+)\s+bữa/iu)?.[1]
  return {
    roleCount:roles.length, salary:`Theo từng vị trí (${roles.length} vị trí) — xem chi tiết`,
    hours:`Khác nhau theo ${roles.length} vị trí — xem chi tiết`,
    workPeriod:kinds.join(' / '),workDays:capitalize(days),
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
    const line=records.find(r=>r.role===role&&/\b(?:lương|luong)\b|\d+\s*k\s*\/|triệu/iu.test(r.line))?.line
    return line ? [`${capitalize(shortRole(role))}: ${line.replace(/^\s*(?:mức\s+)?lương\s*[:：]\s*/iu,'').trim()}`] : []
  })
}
