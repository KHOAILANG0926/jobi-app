// 새 공고 근무지 → VietMap 상가·회사(POI) 좌표 후보 자동 생성 (2026-10-06).
//
//   node scripts/generate-location-candidates.ts [--since=2026-10-06T00:00:00Z] [--limit=50] [--apply]
//
// - 키는 이 PC에 없다: VietMap 호출은 관리자 전용 서버 API(api/admin-vietmap, Vercel 환경변수 VIETMAP_SERVICE_KEY, 하루 250회 상한)가 한다.
//   DB 접근도 서비스 키가 아니라 관리자 로그인 세션(터미널 입력 또는 ADMIN_ACCESS_TOKEN, 저장 안 함)과 관리자 RPC로만 한다.
// - 기본은 dry-run(조회·출력만). --apply일 때만 admin_add_location_candidate RPC로 status='pending' 후보를 넣는다.
//   자동 승인은 하지 않는다 — 관리자가 AdminLocations에서 지도·위성으로 대조해 승인·거절한다.
// - 대상: --since 이후 새로 등록된 공고(기본 최근 2일). 기존 공고 backfill은 하지 않는다(사용자 결정).
// - 같은 공고·같은 주소에 30 m 안 후보가 이미 있으면(거절 포함) 다시 만들지 않는다.
// - 비용: 근무지 1곳당 Search 1회 + 상위 후보 Place 최대 3회(1회 = 1 transaction). 서버 상한(250/일)에 닿으면 중단한다.
import { adminSession, vietmapCall } from './research/lib/privateStore.mjs'
import {
  MIN_NAME_SIMILARITY, buildCandidateEvidence, distanceMeters, isDuplicateCandidate, nameSimilarity, type PoiCandidate,
} from '../src/lib/locationCandidateMatch.ts'

const MAX_PLACES_PER_LOCATION = 3

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] as const }))
const apply = args.get('apply') === 'true'
const since = args.get('since') ?? new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
const limit = Number(args.get('limit') ?? 50)

function log(line: string) { console.log(`[location-candidates] ${line}`) }

class DailyLimit extends Error {}
async function viaServer(body: Record<string, unknown>): Promise<unknown> {
  try { return (await vietmapCall(body)).data } catch (e) {
    if ((e as { code?: string }).code === 'DAILY_LIMIT') throw new DailyLimit('서버 하루 상한 도달')
    throw e
  }
}

interface SearchHit { ref_id: string; name?: string; address?: string; display?: string }
interface PlaceDetail { name?: string; display?: string; address?: string; lat?: number; lng?: number; ward?: string; district?: string; city?: string }

async function findPois(company: string, address: string, focus: { lat: number; lng: number } | null): Promise<PoiCandidate[]> {
  const hits = (await viaServer({ action: 'search', text: `${company} ${address}`.trim(), ...(focus ? { focus } : {}) })) as SearchHit[]
  const named = (Array.isArray(hits) ? hits : [])
    .filter((h) => h.ref_id && h.name && nameSimilarity(company, h.name) >= MIN_NAME_SIMILARITY)
    .slice(0, MAX_PLACES_PER_LOCATION)
  const pois: PoiCandidate[] = []
  for (const h of named) {
    const p = (await viaServer({ action: 'place', refId: h.ref_id })) as PlaceDetail
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue
    pois.push({
      name: p.name || h.name || '', address: p.display || p.address || h.address || '', lat: p.lat, lng: p.lng, refId: h.ref_id,
      units: { ward: p.ward, district: p.district, province: p.city },
    })
  }
  return pois
}

async function main() {
  const { db } = await adminSession()
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
      try { pois = await findPois(job.company, t.address, t.focus); searched++ } catch (e) {
        if (e instanceof DailyLimit) { log('서버 하루 상한(250회) 도달 — 중단. 내일 같은 명령으로 이어서 실행하세요.'); log(`중단 시점: 공고 ${searched} 검색 · 후보 ${created}`); return }
        log(`job ${job.id}: VietMap 오류 ${(e as Error).message} — 건너뜀`); skipped++; continue }
      for (const poi of pois) {
        if (isDuplicateCandidate(known, { address: t.address, lat: poi.lat, lng: poi.lng })) { skipped++; continue }
        const evidence = buildCandidateEvidence({
          company: job.company, jobAddress: t.address, poi, similarity: nameSimilarity(job.company, poi.name),
          distanceM: t.focus ? distanceMeters(t.focus, poi) : null,
        })
        log(`job ${job.id} · ${poi.name} (${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}) ${apply ? '→ 후보 저장' : '(dry-run)'}`)
        if (apply) {
          const { error: e } = await db.rpc('admin_add_location_candidate', {
            p_job_id: job.id, p_address: t.address, p_lat: poi.lat, p_lng: poi.lng, p_precision: 'building',
            p_source: 'map_listing', p_evidence: evidence, p_evidence_urls: [], p_work_location_id: t.id,
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
