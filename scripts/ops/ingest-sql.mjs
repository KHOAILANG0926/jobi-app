#!/usr/bin/env node
// 공고 내용 파일(scripts/ops/jobs/<name>.json) → 입구 함수 ingest_job 한 번만 부르는 SQL을 출력한다.
// 직접 local_jobs·job_work_locations에 쓰는 SQL을 만들지 않는다(입구 전환 1단계, Lee 2026-10-28 순서).
// 사용: node scripts/ops/ingest-sql.mjs <file.json> [storage_path] | psql ... -v ON_ERROR_STOP=1 -1
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const fail = (msg) => { console.error(`::error::${msg}`); process.exit(1) }

// 입구가 받는 칸 목록은 운영에 적용된 최신 ingest_job 정의에서 읽는다(목록을 따로 베끼지 않음).
export function gatewayFields(dir = 'supabase/migrations') {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  let body = null
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
    if (/create\s+(or\s+replace\s+)?function\s+public\.ingest_job\s*\(/i.test(sql)) body = sql
  }
  if (!body) throw new Error('ingest_job 정의 migration 없음')
  const m = body.match(/where\s+key\s+in\s*\(([^)]*)\)/i)
  if (!m) throw new Error('ingest_job 허용 칸 목록을 찾지 못함')
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

export function buildSql(payload, storagePath, fields = gatewayFields()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('공고 내용은 JSON 객체여야 함')
  if (typeof payload.source_text !== 'string' || payload.source_text.trim() === '') throw new Error('source_text(원문) 필요')
  // 경로 이름은 작업이 정한다(sql_file). 위치는 다른 등록 경로와 같이 저장 훅이 canonical writer로 기록한다.
  const extra = Object.keys(payload).filter((k) => !fields.includes(k))
  if (extra.length) throw new Error(`입구가 받지 않는 칸: ${extra.join(', ')} (판정·위치 칸은 넣지 않음)`)
  const images = payload.images ?? []
  if (!Array.isArray(images) || images.some((p) => typeof p !== 'string')) throw new Error('images는 저장 경로 글자 목록이어야 함')
  if (storagePath ? !images.includes(storagePath) : images.length) throw new Error('images와 올린 포스터 경로(storage_path)가 다름')
  const json = JSON.stringify({ ...payload, channel: 'sql_file' })
  let tag = 'ingest'
  while (json.includes(`$${tag}$`)) tag += '_x'
  return [
    `select public.ingest_job($${tag}$${json}$${tag}$::jsonb) as job_id \\gset`,
    `select step, outcome from public.job_ingest_log where raw_id = (select max(id) from public.job_ingest_raw where job_id = :job_id) order by array_position(array['preserve','dedup','occupation','location','publication'], step);`,
    `\\echo 공고 번호 :job_id`,
    '',
  ].join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, storagePath] = process.argv.slice(2)
  if (!file) fail('사용: ingest-sql.mjs <file.json> [storage_path]')
  let payload
  try { payload = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { fail(`JSON 읽기 실패: ${e.message}`) }
  try { process.stdout.write(buildSql(payload, storagePath || undefined)) } catch (e) { fail(e.message) }
}
