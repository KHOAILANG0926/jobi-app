// 새 공고 근무지 → VietMap 상가·회사(POI) 좌표 후보 자동 생성 (2026-10-06).
//
//   node scripts/generate-location-candidates.ts [--since=2026-10-06T00:00:00Z] [--limit=50] [--apply]
//
// - VIETMAP_SERVICE_KEY(서버용, Search v4·Place v4 허용 키)가 없으면 아무것도 하지 않고 정상 종료한다.
//   (2026-10-06 기존 Tilemap 키로 Search v4 시험 → HTTP 423 "Your request is limited")
// - 기본은 dry-run(조회·출력만). --apply일 때만 job_location_candidates에 status='pending' 후보를 넣는다.
//   자동 승인은 하지 않는다 — 관리자가 AdminLocations에서 지도·위성으로 대조해 승인·거절한다.
// - 대상: --since 이후 새로 등록된 공고(기본 최근 2일). 기존 공고 backfill은 하지 않는다(사용자 결정).
// - 같은 공고·같은 주소에 30 m 안 후보가 이미 있으면(거절 포함) 다시 만들지 않는다.
// - 비용: 근무지 1곳당 Search 1회 + 상위 후보 Place 최대 3회(1회 = 1 transaction).
// 필요 env: VIETMAP_SERVICE_KEY, SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js'
import {
  MIN_NAME_SIMILARITY, buildCandidateEvidence, distanceMeters, isDuplicateCandidate, nameSimilarity, type PoiCandidate,
} from '../src/lib/locationCandidateMatch.ts'

const SEARCH_URL = 'https://maps.vietmap.vn/api/search/v4'
const PLACE_URL = 'https://maps.vietmap.vn/api/place/v4'
const MAX_PLACES_PER_LOCATION = 3
const REQUEST_TIMEOUT_MS = 10_000

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] as const }))
const apply = args.get('apply') === 'true'
const since = args.get('since') ?? new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
const limit = Number(args.get('limit') ?? 50)

const serviceKey = process.env.VIETMAP_SERVICE_KEY?.trim() ?? ''
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''

function log(line: string) { console.log(`[location-candidates] ${line}`) }

async function getJson(url: string, params: Record<string, string>): Promise<unknown> {
  const res = await fetch(`${url}?${new URLSearchParams({ ...params, apikey: serviceKey })}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 80)}`)
  return JSON.parse(text)
}

interface SearchHit { ref_id: string; name?: string; address?: string; display?: string }
interface PlaceDetail { name?: string; display?: string; address?: string; lat?: number; lng?: number; ward?: string; district?: string; city?: string }

async function findPois(company: string, address: string, focus: { lat: number; lng: number } | null): Promise<PoiCandidate[]> {
  const params: Record<string, string> = { text: `${company} ${address}`.trim(), display_type: '1', layers: 'POI' }
  if (focus) params.focus = `${focus.lat},${focus.lng}`
  const hits = (await getJson(SEARCH_URL, params)) as SearchHit[]
  const named = (Array.isArray(hits) ? hits : [])
    .filter((h) => h.ref_id && h.name && nameSimilarity(company, h.name) >= MIN_NAME_SIMILARITY)
    .slice(0, MAX_PLACES_PER_LOCATION)
  const pois: PoiCandidate[] = []
  for (const h of named) {
    const p = (await getJson(PLACE_URL, { refid: h.ref_id })) as PlaceDetail
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
    pois.push({
      name: p.name || h.name || '', address: p.display || p.address || h.address || '', lat: p.lat, lng: p.lng, refId: h.ref_id,
      units: { ward: p.ward, district: p.district, province: p.city },
    })
  }
  return pois
}

async function main() {
  if (!serviceKey) { log('VIETMAP_SERVICE_KEY 없음 — 자동 후보 생성을 건너뜀(정상 종료).'); return }
  if (!supabaseUrl || !supabaseKey) { log('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 없음 — 건너뜀(정상 종료).'); return }
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  log(`${apply ? 'APPLY' : 'DRY-RUN'} · since=${since} · limit=${limit}`)

  const { data: jobs, error } = await db.from('local_jobs').select('id,company,location,created_at').gte('created_at', since).order('created_at').limit(limit)
  if (error) throw new Error(`local_jobs: ${error.message}`)
  let searched = 0, created = 0, skipped = 0
  for (const job of jobs ?? []) {
    const [{ data: locs }, { data: existing }] = await Promise.all([
      db.from('job_work_locations').select('id,raw_address,lat,lng').eq('job_id', job.id),
      db.from('job_location_candidates').select('address_snapshot,lat,lng').eq('job_id', job.id),
    ])
    const targets = (locs && locs.length > 0)
      ? locs.map((l) => ({ id: l.id as number | null, address: String(l.raw_address ?? ''), focus: typeof l.lat === 'number' && typeof l.lng === 'number' ? { lat: l.lat, lng: l.lng } : null }))
      : [{ id: null, address: String(job.location ?? ''), focus: null }]
    const known = [...(existing ?? [])] as Array<{ address_snapshot: string; lat: number; lng: number }>
    for (const t of targets) {
      if (!t.address.trim() || !String(job.company ?? '').trim()) { skipped++; continue }
      let pois: PoiCandidate[] = []
      try { pois = await findPois(job.company, t.address, t.focus); searched++ } catch (e) { log(`job ${job.id}: VietMap 오류 ${(e as Error).message} — 건너뜀`); skipped++; continue }
      for (const poi of pois) {
        if (isDuplicateCandidate(known, { address: t.address, lat: poi.lat, lng: poi.lng })) { skipped++; continue }
        const evidence = buildCandidateEvidence({
          company: job.company, jobAddress: t.address, poi, similarity: nameSimilarity(job.company, poi.name),
          distanceM: t.focus ? distanceMeters(t.focus, poi) : null,
        })
        log(`job ${job.id} · ${poi.name} (${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}) ${apply ? '→ 후보 저장' : '(dry-run)'}`)
        if (apply) {
          const { error: e } = await db.from('job_location_candidates').insert({
            job_id: job.id, work_location_id: t.id, company_snapshot: job.company, address_snapshot: t.address,
            lat: poi.lat, lng: poi.lng, place_precision: 'building', source: 'map_listing', evidence, evidence_urls: [],
          })
          if (e) { log(`job ${job.id}: 저장 실패 ${e.message}`); continue }
        }
        known.push({ address_snapshot: t.address, lat: poi.lat, lng: poi.lng })
        created++
      }
    }
  }
  log(`완료: 공고 ${jobs?.length ?? 0} · 검색 ${searched} · 후보 ${created}${apply ? ' 저장' : ' (dry-run, 저장 안 함)'} · 건너뜀 ${skipped}`)
}

main().catch((e) => { console.error(`[location-candidates] 실패: ${(e as Error).message}`); process.exitCode = 1 })
