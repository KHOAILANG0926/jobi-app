// 알림 지역 판정(34개 성 키워드, DB job_alert_detect_regions와 같은 방식) ↔ 화면 지역 판정(jobArea.jobProvinces) 대조.
// Lee 2026-11-10 #625 조건 3 "기존 공고의 지역 정보와 새 알림 지역 판정이 일치하는지". 공개 조회만, 쓰기 없음.
import { supabaseServer as db } from '../../src/lib/supabaseServer.ts'
import { provinceKeywords, regionKeywords } from '../../src/lib/regionKeywords.ts'
import { REGION_PROVINCE } from '../../src/data/jobRegions.ts'
import { jobProvinces } from '../../src/lib/jobArea.ts'

// DB job_alert_normalize_text와 같은 정리
const FROM = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ'
const TO = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
export const normalize = (s) => [...String(s ?? '').normalize('NFC').toLowerCase()].map((c) => { const i = FROM.indexOf(c); return i >= 0 ? TO[i] : c }).join('')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const KW = regionKeywords().map((r) => ({ id: r.regionId, k: normalize(r.keyword) }))
  .sort((a, b) => b.k.length - a.k.length || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
// DB job_alert_detect_regions와 같은 차례: 긴 낱말부터, 맞춘 글자는 지운다
const PROV = new Set(provinceKeywords().map(normalize))
// 성 이름 먼저, 없을 때만 군·구 이름(Codex #625 — DB 함수와 같은 차례)
export function detect(text) {
  let hay = ` ${normalize(text)} `
  const found = []
  if (hay === '  ') return found
  for (const pass of [true, false]) {
    for (const { id, k } of KW) {
      if (PROV.has(k) !== pass) continue
      if (hay.includes(` ${k} `)) { if (!found.includes(id)) found.push(id); hay = hay.split(` ${k} `).join(' | ') }
    }
    if (found.length) break
  }
  return found
}
const PROV_TO_ID = {}
for (const [id, p] of Object.entries(REGION_PROVINCE)) if (!['bacgiang', 'longan'].includes(id)) PROV_TO_ID[p] = id

if (process.argv[1]?.endsWith('alert-region-consistency.mjs')) {
  const { data: jobs, error } = await db.from('local_jobs').select('id,company,location,recruitment_regions').eq('active', true).eq('admin_hidden', false).order('id')
  if (error) { console.log('::error::public_jobs_unavailable'); process.exit(1) }
  const { data: locs } = await db.from('job_work_locations').select('job_id,raw_address,resolved_province').in('job_id', jobs.map((j) => j.id))
  let same = 0
  const diff = []
  for (const j of jobs) {
    const wl = (locs ?? []).filter((l) => l.job_id === j.id)
    const alert = new Set([...detect(`${j.location ?? ''} ; ${(j.recruitment_regions ?? []).join(' ; ')}`), ...wl.flatMap((l) => detect(`${l.raw_address ?? ''} ; ${l.resolved_province ?? ''}`))])
    const screen = new Set(jobProvinces({ location: j.location ?? '', workLocations: wl.map((l) => ({ rawAddress: l.raw_address ?? '' })) }).map((p) => PROV_TO_ID[p] ?? `?${p}`))
    const a = [...alert].sort().join(','), s = [...screen].sort().join(',')
    if (a === s) same++
    else diff.push(`#${j.id} ${String(j.company ?? '').slice(0, 30)} | 알림: ${a || '없음'} | 화면: ${s || '없음'}`)
  }
  console.log(`공개 공고 ${jobs.length}건 · 알림 판정 = 화면 판정 ${same}건 · 다름 ${diff.length}건`)
  for (const d of diff) console.log(d)
}
