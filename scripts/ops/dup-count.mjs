// 공개 공고 중복 세기 — 읽기 전용 (Lee 2026-11-06 1단계: "같은 회사·같은 일·같은 위치"면 중복).
// 사용: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ops/dup-count.mjs
//   공개 조회(anon, 사이트 번들에 공개된 키)로 공개 공고와 근무지 점을 읽어 src/lib/jobIdentity.ts 기준으로 묶는다.
//   쓰기·숨김·합치기 없음. 비공개(숨김·보류) 공고는 공개 조회로 안 보이므로 범위 밖(결과에 적는다).
import { appendFileSync, readFileSync } from 'node:fs'
import { duplicateGroups, companyCore, businessKind } from '../../src/lib/jobIdentity.ts'

const src = readFileSync(new URL('../../src/lib/supabase.ts', import.meta.url), 'utf8')
const URL_ = src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
const ANON = src.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]
if (!URL_ || !ANON) { console.error('공개 조회 주소·키를 못 찾음'); process.exit(2) }
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }

async function all(path) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    if (!r.ok) throw new Error(`${path} HTTP ${r.status} ${await r.text()}`)
    const rows = await r.json(); out.push(...rows)
    if (rows.length < 1000) return out
  }
}

const jobs = await all('local_jobs?select=id,title,company,category,subcategory,occupation_code,employer_phone,contact_zalo,location&active=eq.true&admin_hidden=eq.false&order=id')
const byId = new Map(jobs.map((j) => [j.id, { ...j, points: [] }]))
const ids = [...byId.keys()]
for (let i = 0; i < ids.length; i += 100) {
  const pts = await all(`job_work_locations?select=job_id,lat,lng,point_kind,industrial_park,raw_address&job_id=in.(${ids.slice(i, i + 100).join(',')})`)
  for (const p of pts) byId.get(p.job_id)?.points.push(p)
}
const list = [...byId.values()]
const { duplicates, unknownLocation } = duplicateGroups(list)

const site = 'https://viecganban.vn/viec-lam/sb-'
const line = (id) => { const j = byId.get(id); const pt = j.points.find((p) => p.lat != null)
  return `  - sb-${id} | ${j.company ?? '(회사 없음)'} [핵심:${companyCore(j.company).core || '-'} 업종:${businessKind(j) || '-'}] | 직업 ${j.occupation_code ?? '-'} | ${j.title?.slice(0, 70) ?? ''} | 위치 ${pt ? `${pt.point_kind} ${pt.lat?.toFixed?.(5)},${pt.lng?.toFixed?.(5)}` : '없음'}${j.points[0]?.industrial_park ? ' ' + j.points[0].industrial_park : ''} | ${site}${id}` }

const out = []
out.push('## 공개 공고 중복 세기 (읽기 전용)', '')
out.push(`- 공개 공고: ${list.length}건 (숨김·보류 공고는 공개 조회로 안 보여 범위 밖)`)
out.push(`- 중복 묶음(회사·일·위치 모두 같음): ${duplicates.length}묶음 / ${duplicates.flat().length}건 → 남길 1건 빼면 ${duplicates.flat().length - duplicates.length}건이 중복`)
out.push(`- 위치 판단 불가(회사·일은 같고 한쪽이 대략 위치): ${unknownLocation.length}쌍`, '')
out.push('### 중복 묶음')
duplicates.forEach((g, i) => { out.push(`${i + 1}.`); g.forEach((id) => out.push(line(id))) })
out.push('', '### 위치 판단 불가 쌍')
unknownLocation.forEach(([a, b], i) => { out.push(`${i + 1}.`); out.push(line(a)); out.push(line(b)) })
const text = out.join('\n')
console.log(text)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
