// 1회성 시험(2026-10-18 Lee 지시): Google에 넘긴 것과 같은 주소 글자를 VietMap 주소 검색에 그대로 넘겨 어디가 나오는지 확인.
// 호출: 검색 1번 + 1등 결과 상세 1번 = 최대 2번. 하루 사용량 장부(vietmap_usage_take)에 기록. 결과는 저장소 캐시에 저장해 재사용.
// 키·주소 URL은 로그에 쓰지 않는다. 결과는 GitHub 주석(::notice::)으로만 남긴다.
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VIETMAP_SERVICE_KEY, PROBE_TEXT } = process.env
if (!SUPABASE_SERVICE_ROLE_KEY || !VIETMAP_SERVICE_KEY || !PROBE_TEXT) { console.log('::error::secrets or text missing'); process.exit(1) }
const db = createClient(SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co', SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
async function call(action, params) {
  const key = JSON.stringify(['map-r1-v1', action, params])
  const name = createHash('sha256').update(key).digest('hex')
  const { data: hit } = await db.from('research_artifacts').select('payload').eq('kind', 'map-r1-query').eq('name', name).maybeSingle()
  if (hit?.payload?.data != null) { console.log(`::notice::${action}: 저장된 결과 사용(호출 0)`); return hit.payload.data }
  const { data: q, error } = await db.rpc('vietmap_usage_take', { p_day: today, p_limit: 250 })
  const ok = Array.isArray(q) ? q[0]?.ok : q?.ok
  if (error || !ok) { console.log('::error::하루 사용량 한도 또는 장부 오류 — 호출 안 함'); process.exit(1) }
  const qs = new URLSearchParams({ ...params, apikey: VIETMAP_SERVICE_KEY, ...(action === 'search' ? { display_type: '1' } : {}) })
  const res = await fetch(`https://maps.vietmap.vn/api/${action}/v4?${qs}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) { console.log(`::error::${action} HTTP ${res.status}`); process.exit(1) }
  const data = await res.json()
  await db.from('research_artifacts').upsert({ kind: 'map-r1-query', name, payload: { data }, meta: { probe: '2026-10-18' } }, { onConflict: 'kind,name' })
  console.log(`::notice::${action}: VietMap 호출 1번`)
  return data
}
const clean = (v) => String(v ?? '').replace(/[\r\n:]+/g, ' ').slice(0, 160)
const hits = await call('search', { text: PROBE_TEXT })
const list = Array.isArray(hits) ? hits : []
console.log(`::notice::검색 결과 ${list.length}건`)
list.slice(0, 5).forEach((h, i) => console.log(`::notice::후보${i + 1} name=${clean(h.name)} | address=${clean(h.address || h.display)} | ward=${clean(h.boundaries?.map?.((b) => b.full_name).join(' / '))}`))
if (list[0]?.ref_id) {
  const p = await call('place', { refid: list[0].ref_id })
  console.log(`::notice::1등 상세 name=${clean(p?.name)} | display=${clean(p?.display)} | ward=${clean(p?.ward)} | city=${clean(p?.city)} | lat=${p?.lat} lng=${p?.lng}`)
}
