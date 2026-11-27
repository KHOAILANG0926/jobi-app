// 복수 직무 공고의 모집 직무 코드(2026-11-27 Lee 승인 설계): 공식 직업코드·category 체계는 그대로 두고, 확인된 모든 모집 직무로 검색하게 한다.
//  - 직무 목록은 상세요강의 직무 줄에서 읽고(jobRolePresentation.roleTitles), 코드는 수집기·작성 화면과 같은 규칙 파일(occupationReader)로 직무 이름마다 찾는다.
//  - 대표 직무 = 인원이 많은 직무 → 같으면 나열 순서. 직무가 1개뿐이면 저장된 occupation_code 그대로(이 파일은 아무것도 바꾸지 않는다).
//  - category 메뉴 검색은 직무 코드마다 category_for_occupation(같은 규칙 파일 data/occupations/category_rules.json, 가장 긴 앞자리 일치)으로 찾는다.
//  - 저장하지 않는다(읽을 때 계산). DB 칸·공고 번호·지원 기록·원문은 그대로.
import { classifyOccupation } from './occupationReader.mjs'
import { roleTitles } from './jobRolePresentation.ts'
import categoryRules from '../../data/occupations/category_rules.json' with { type: 'json' }

export interface JobRoleInfo { roleCodes: string[]; primaryRoleCode?: string }

/** DB `category_for_occupation`과 같은 규칙: 가장 긴 앞자리 일치. 규칙 없으면 undefined. */
export function categoryForOccupation(code: string | null | undefined): string | undefined {
  const rules = categoryRules as Record<string, string>
  for (let n = String(code ?? '').length; n > 0; n--) {
    const hit = rules[String(code).slice(0, n)]
    if (hit) return hit
  }
  return undefined
}

export function jobRoleInfo(job: { description?: string | null; occupationCode?: string | null }): JobRoleInfo {
  const stored = job.occupationCode || undefined
  const roles = roleTitles(job.description)
  if (roles.length < 2) return { roleCodes: stored ? [stored] : [], primaryRoleCode: stored }
  const coded = roles.flatMap((r) => { const hit = classifyOccupation(r.title); return hit ? [{ code: hit.occupation_code as string, count: r.count }] : [] })
  const roleCodes = [...new Set(coded.map((c) => c.code))]
  if (stored && !roleCodes.includes(stored)) roleCodes.push(stored)
  const primary = coded.reduce<{ code: string; count: number } | undefined>((best, c) => (!best || c.count > best.count ? c : best), undefined)
  return { roleCodes, primaryRoleCode: primary?.code ?? stored }
}

/** 공고가 걸리는 category 전부(대표 category + 모집 직무마다의 category). 같은 공고는 한 번만. */
export function jobCategories(job: { category: string; roleCodes?: string[] }): string[] {
  const set = new Set<string>([job.category])
  // 코드 '5'(업무 미기재 가게 공고, 11-01 예외)의 category는 업체 종류(business_type)로 정해지므로 코드만으로 다시 계산하지 않는다 — 저장된 category 그대로.
  for (const code of job.roleCodes ?? []) { if (code === '5') continue; const c = categoryForOccupation(code); if (c) set.add(c) }
  return [...set]
}
