// 업종으로 큰 분류 정하기 실행기 — Lee 2026-11-01 (#5247 Wallace). 규칙: src/lib/businessType.ts
// 대상: 기준 시각 이후 수집 공고 중 직업 코드가 없는 공고, 또는 업종 종류(kind) 기록 없이 코드 5가 된 공고(관리자 숨김 제외). 같은 원문으로 이미 시도했으면 다시 하지 않는다.
// 기록: 직업 코드·근거는 ingest_job 한 입구로, 판단 출처(이름/검색 URL·인용문)는 ocr_check.business_type에.
// 순서(Lee 2026-11-08): ① 업체 이름 → ② 위치 확인이 저장해 둔 Google 결과의 장소 종류(새 Google 검색 없음) → ③ Google이 장소를 모를 때만 AI 인터넷 검색.
// 필요 환경변수: SUPABASE_DB_URL (검색에는 ANTHROPIC_API_KEY — 없으면 이름·Google 단계만)
import pg from 'pg'
import { createHash } from 'node:crypto'
import { businessFromName, businessFromGoogle, buildWebPrompt, guardWebAnswer, streetOf, WEB_PROMPT_VERSION } from '../../src/lib/businessType.ts'
import { cachedGooglePlace } from '../../src/lib/logoLookup.ts'
import { administrativeAreaForTarget, areaContains } from '../../src/lib/administrativeArea.ts'
import { autoScope } from '../ops/auto-cutoff.mjs'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY } = process.env
const MODEL = process.env.BUSINESS_AI_MODEL || 'claude-sonnet-5-5'  // 인터넷 검색 판정은 Haiku 비교 시험을 안 했으므로 그대로(PR #546은 칸·복리후생만 시험)
// Google 단계를 붙인 판(2026-11-08). 이미 시도한 공고도 이 단계로 한 번 다시 본다. 이 단계 규칙을 바꾸면 올린다.
const GOOGLE_STEP_VERSION = 'google-types-v1'
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }

async function webLookup(job) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: buildWebPrompt(job) }] }),
  })
  if (!r.ok) throw new Error(`검색 AI ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const body = await r.json()
  const texts = body.content.filter((b) => b.type === 'text')
  const citations = texts.flatMap((b) => b.citations ?? []).map((c) => ({ url: c.url, cited_text: c.cited_text }))
  const joined = texts.map((b) => b.text).join('')
  const m = joined.match(/\{[^{}]*\}(?![\s\S]*\{)/)
  let answer = null
  try { answer = m ? JSON.parse(m[0]) : null } catch { answer = null }
  return { answer, citations }
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()

/** 위치 확인이 저장한 Google 결과(research_artifacts map-r1-query, auto-location-runtime과 같은 열쇠)만 읽는다. Google을 새로 부르지 않는다. */
async function googlePlaceFor(job) {
  const st = (await client.query('select snapshot from public.map_r1_location_jobs where job_id = $1', [job.id])).rows[0]?.snapshot ?? {}
  const resolverJob = { id: job.id, company: String(st.company ?? job.company ?? ''), location: String(st.location ?? job.location ?? ''),
    targets: (Array.isArray(st.targets) ? st.targets : []).map((t) => ({ address: String(t?.address ?? ''), workLocationId: null })) }
  const cached = async (key) => {
    const name = createHash('sha256').update(key).digest('hex')
    return (await client.query("select payload from public.research_artifacts where kind = 'map-r1-query' and name = $1", [name])).rows[0]?.payload?.data ?? null
  }
  const within = async (addresses, point) => { const area = administrativeAreaForTarget(addresses[0], addresses[1] || ''); return !!area && areaContains(area, point) }
  return cachedGooglePlace(resolverJob, cached, within)
}

let set = 0, none = 0
try {
  const { rows } = await client.query(`
    select id, title, company, location, source_text, images, md5(coalesce(source_text,'') || '|' || coalesce(company,'') || '|' || coalesce(location,'') || '|' || $1::text) as src_hash,
           ocr_check->'business_type'->>'src_hash' as tried
    from public.local_jobs
    where origin = 'crawler' and not admin_hidden and (occupation_code is null or (occupation_code = '5' and ocr_check->'business_type'->>'kind' is null)) and coalesce(source_text,'') <> ''
      and ${autoScope()}
    order by id`, [`${WEB_PROMPT_VERSION}|${GOOGLE_STEP_VERSION}`])
  console.log(`업종 확인 대상 ${rows.length}건`)
  for (const job of rows) {
    if (job.tried === job.src_hash) continue
    let found = businessFromName(job)
    let note = found ? 'name' : 'name:none'
    let place = null
    if (!found) {
      try { place = await googlePlaceFor(job) } catch (e) { note += ' google:error ' + String(e.message).slice(0, 80) }
      // 예전에 저장된 Google 결과에는 장소 종류가 없다 → 종류를 모르면 Google이 모르는 것과 같이 본다(AI 검색으로).
      if (place && !place.primaryType && !place.types.length) { note += ' google:no-types'; place = null }
      else {
        found = businessFromGoogle(job, place)
        note = found ? `google(${found.google_types?.join(',')})` : place ? `${note} google:not-shop(${[place.primaryType, ...place.types].filter(Boolean).slice(0, 4).join(',')})` : `${note} google:no-place`
      }
    }
    // Google이 장소를 알면(가게가 아니라고 나와도) 그 판정을 따르고 AI 검색을 하지 않는다. Google이 모를 때만 AI 검색.
    if (!found && !place && ANTHROPIC_API_KEY && streetOf(job.location)) {
      try {
        const { answer, citations } = await webLookup(job)
        found = guardWebAnswer(job, answer, citations)
        note = found ? 'web' : `web:none(${answer?.type ?? 'no-answer'}, 인용 ${citations.length}: ${citations.slice(0, 3).map((c) => String(c.cited_text ?? '').slice(0, 80)).join(' / ')})`
      } catch (e) { note = 'web:error ' + String(e.message).slice(0, 120) }
    } else if (!found && !place) note += streetOf(job.location) ? ' web:no-key' : ' web:no-street'
    const record = { src_hash: job.src_hash, at: new Date().toISOString(), result: note, ...(found ?? {}) }
    if (found) {
      const payload = { channel: 'crawler_other', job_id: job.id, refresh: true, update_fields: ['occupation_code', 'occupation_evidence'],
        source_text: job.source_text, images: job.images, occupation_code: found.code, occupation_evidence: found.evidence }
      const w = await client.query('select public.ingest_job($1::jsonb) as job_id', [JSON.stringify(payload)])
      if (Number(w.rows[0]?.job_id) !== Number(job.id)) throw new Error('ingest_job returned wrong id')
      set++
    } else none++
    await client.query(`update public.local_jobs set ocr_check = coalesce(ocr_check,'{}'::jsonb) || jsonb_build_object('business_type', $2::jsonb) where id = $1`,
      [job.id, JSON.stringify(record)])
    console.log(`#${job.id} 업종: ${note}${found ? ` → ${found.code} (${found.duty})${found.url ? ' ' + found.url : ''}` : ''}`)
  }
  console.log(`업종 확인: 정함 ${set} · 못 정함 ${none}`)
} finally { await client.end() }
