// 공고 등록 전 로고 확인 — Lee 2026-11-03 "로고 없으면 검색으로 가자는 프로세스를 만들어".
// 2026-11-03 Lee 정정 "멈추는 이유가 뭐야? 해결을 해야지": 등록은 절대 멈추지 않는다. 로고가 없으면 검색해서 찾고,
// 못 찾으면 업종에 맞는 사진(cardPhoto.ts)으로 채운다. 이 검사는 logo_check 기록이 빠졌거나 틀리면 경고만 낸다.
//   result:
//     "poster"         공고 포스터(images)가 있음 → 검색 불필요
//     "brand"          회사 이름 검색 → 등록 브랜드(job_brands, domain 있음)로 로고가 붙음. brand = 브랜드 slug
//     "found_unstored" 검색으로 공식 로고를 찾았지만 아직 저장 못 함(브랜드 기준 미달·등록 대기). official_url + note 필수
//     "not_found"      검색했지만 공식 로고 없음 → 업종 사진. searched(검색어 목록) 필수
// 실제 검색은 등록하는 작업자(Claude 등)가 한다. 이 검사는 "검색했는지·결과가 무엇인지"가 파일에 남았는지만 막는다.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RESULTS = ['poster', 'brand', 'found_unstored', 'not_found']
const nonEmptyText = (v) => typeof v === 'string' && v.trim() !== ''

/** migration에 등록된 브랜드 slug 중 domain(로고 주소)이 들어간 것. */
export function brandsWithLogo(dir = 'supabase/migrations') {
  const slugs = new Set()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8')
    // insert … values ('이름', 'slug', 'category', 'domain', …) 와 update … values ('slug', 'domain') 두 꼴만 읽는다.
    for (const m of sql.matchAll(/\(\s*'[^']*'\s*,\s*'([a-z0-9-]+)'\s*,\s*'(?:fastfood|restaurant|cafe|bakery|convenience|retail|delivery)'\s*,\s*'([a-z0-9.-]+\.[a-z]{2,})'/g)) slugs.add(m[1])
    if (/update\s+public\.job_brands\s+set\s+domain/i.test(sql)) {
      for (const m of sql.matchAll(/\(\s*'([a-z0-9-]+)'\s*,\s*'([a-z0-9.-]+\.[a-z]{2,})'\s*\)/g)) slugs.add(m[1])
    }
  }
  return slugs
}

/** 문제 목록을 돌려준다(빈 목록 = 통과). */
export function logoCheckProblems(payload, logoBrands = brandsWithLogo()) {
  const c = payload?.logo_check
  if (!c || typeof c !== 'object' || Array.isArray(c)) return ['logo_check 없음 — 로고가 없으면 회사 이름을 먼저 검색하고 결과를 적는다(Lee 2026-11-03)']
  if (!RESULTS.includes(c.result)) return [`logo_check.result는 ${RESULTS.join('/')} 중 하나`]
  const images = Array.isArray(payload.images) ? payload.images : []
  const p = []
  if (c.result === 'poster' && images.length === 0) p.push('logo_check=poster인데 images(포스터)가 없음')
  if (c.result === 'brand') {
    if (!nonEmptyText(c.brand)) p.push('logo_check=brand에는 brand(slug) 필요')
    else if (!logoBrands.has(c.brand)) p.push(`브랜드 "${c.brand}"가 로고 주소(domain)와 함께 등록돼 있지 않음 — 브랜드 등록 migration 먼저`)
  }
  if (c.result === 'found_unstored') {
    if (!nonEmptyText(c.official_url) || !/^https:\/\//.test(c.official_url)) p.push('logo_check=found_unstored에는 official_url(https) 필요')
    if (!nonEmptyText(c.note)) p.push('logo_check=found_unstored에는 note(왜 아직 저장 못 했는지) 필요')
  }
  if (c.result === 'not_found') {
    if (!Array.isArray(c.searched) || !c.searched.some(nonEmptyText)) p.push('logo_check=not_found에는 searched(실제 검색어 목록) 필요')
  }
  return p
}

/** 입구(ingest_job)로 보내기 전에 logo_check를 떼어 낸다(입구가 받는 칸이 아님). */
export function withoutLogoCheck(payload) {
  const { logo_check: _drop, ...rest } = payload
  return rest
}
