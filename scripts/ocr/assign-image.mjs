// 대표 이미지 고정 배정 실행기 — Lee 2026-11-27 (직무 중심 대표 이미지 3단계). 규칙: src/lib/cardPhoto.ts(assignManagedId — 선택과 같은 ①→③ 단계).
// 대상: 기준 시각 이후 공고 중 representative_image_id가 아직 없는 공고(관리자 숨김 제외). 기존 공고는 자동으로 건드리지 않고(autoScope), 한 번 정해진 번호는 다시 바꾸지 않는다.
// 같은 단계 후보 중 가장 적게 배정된 이미지를 순서대로 고른다. 배정할 이미지가 없으면(기존 선택·중립 기본) 비워 둔다 — 화면이 지금처럼 계산한다.
// 이 파일은 업종 단계(business-type.mjs)가 같은 DB 연결로 부른다(새 워크플로·새 단계 없음). 직접 실행도 가능: SUPABASE_DB_URL=… node … scripts/ocr/assign-image.mjs
import { assignManagedId, jobPhotoInputs, photoManifestData } from '../../src/lib/cardPhoto.ts'
import { jobRoleInfo } from '../../src/lib/jobRoles.ts'
import { stripSourceTags } from '../../src/lib/sourceTag.ts'
import { autoScope } from '../ops/auto-cutoff.mjs'

export async function assignRepresentativeImages(client, { log = console.log, manifest = photoManifestData } = {}) {
  const usage = new Map((await client.query('select representative_image_id as id, count(*)::int as n from public.local_jobs where representative_image_id is not null group by 1')).rows.map((r) => [r.id, Number(r.n)]))
  const { rows } = await client.query(`
    select id, title, company, category, subcategory, occupation_code, description
    from public.local_jobs
    where representative_image_id is null and not admin_hidden and ${autoScope()}
    order by id`)
  let set = 0, noCandidate = 0, missed = 0
  for (const j of rows) {
    // 화면(jobRows.parseDescription)과 같은 설명 — 출처 표시 글자만 뗀다(jobRows는 브라우저 연결을 끌어와 Node 도구가 못 쓴다).
    const raw = j.description ?? ''
    const description = /\[\s*source\s*:[^\]]+\]/i.test(raw) ? stripSourceTags(raw) : raw
    const info = jobRoleInfo({ description, occupationCode: j.occupation_code || undefined })
    const input = jobPhotoInputs({ category: j.category, subcategory: j.subcategory, company: j.company, title: j.title, description, occupationCode: j.occupation_code || undefined, ...info })
    const id = assignManagedId(manifest, usage, input.category, input.roleCode, input.env)
    if (!id) { noCandidate++; continue }
    // 이미 다른 실행이 정했으면(null 아님) 덮어쓰지 않는다.
    const w = await client.query('update public.local_jobs set representative_image_id = $2 where id = $1 and representative_image_id is null', [j.id, id])
    if (w.rowCount) { usage.set(id, (usage.get(id) ?? 0) + 1); set++; log(`#${j.id} 대표 이미지 배정: ${id}`) } else missed++
  }
  log(`대표 이미지 배정: 대상 ${rows.length}건 · 배정 ${set}건 · 배정할 이미지 없음 ${noCandidate}건 · 이미 정해져 건너뜀 ${missed}건`)
  return { targets: rows.length, assigned: set }
}

if (process.argv[1]?.endsWith('/assign-image.mjs')) {
  const { SUPABASE_DB_URL } = process.env
  if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
  await client.connect()
  try { await assignRepresentativeImages(client) } finally { await client.end() }
}
