// 새 공고 근무지 → VietMap 상가·회사(POI) 좌표 후보 자동 생성 (2026-10-06).
//
//   node scripts/generate-location-candidates.ts [--since=2026-10-06T00:00:00Z] [--limit=50] [--apply] [--auto-approve]
//
// - 키는 이 PC에 없다: VietMap 호출은 관리자 전용 서버 API(api/admin-vietmap, Vercel 환경변수 VIETMAP_SERVICE_KEY, 하루 250회 상한)가 한다.
//   DB 접근도 서비스 키가 아니라 관리자 로그인 세션(터미널 입력 또는 ADMIN_ACCESS_TOKEN, 저장 안 함)과 관리자 RPC로만 한다.
// - 기본은 dry-run(조회·출력만). --apply일 때만 admin_add_location_candidate RPC로 status='pending' 후보를 넣는다.
//   --auto-approve(--apply와 함께)일 때만 "회사명 정확 일치 + 구·KCN 안" 후보 1곳을 자동 승인해 핀을 만든다(evaluateAutoApproval).
//   그 밖은 핀 없음(pending) — 관리자 Vị trí 화면은 예외 처리용이다.
// - 대상: --since 이후 새로 등록된 공고(기본 최근 2일). 기존 공고 backfill은 하지 않는다(사용자 결정).
// - 같은 공고·같은 주소에 30 m 안 후보가 이미 있으면(거절 포함) 다시 만들지 않는다.
// - 비용: 근무지 1곳당 Search 1회 + 상위 후보 Place 최대 3회(1회 = 1 transaction). 서버 상한(250/일)에 닿으면 중단한다.
import { adminSession, vietmapCall } from './research/lib/privateStore.mjs'
import {
  AUTO_APPROVAL_NOTE, MIN_NAME_SIMILARITY, buildCandidateEvidence, distanceMeters, evaluateAutoApproval, isDuplicateCandidate, nameSimilarity, pointInRing, type PoiCandidate,
} from '../src/lib/locationCandidateMatch.ts'
import { findIndustrialPark } from '../src/lib/industrialPark.ts'
import { INDUSTRIAL_PARK_OUTLINES } from '../src/data/industrialParkOutlines.ts'

const MAX_PLACES_PER_LOCATION = 3

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] as const }))
const apply = args.get('apply') === 'true'
const autoApprove = apply && args.get('auto-approve') === 'true'
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
  let searched = 0, created = 0, skipped = 0, approved = 0
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
      // 자동 승인 핀: 회사명 정확 일치 + 구·KCN 안을 통과한 후보가 정확히 1곳일 때만(지점 여럿이면 자동 승인 없음).
      const park = findIndustrialPark(t.address, job.location)
      const ring = park ? INDUSTRIAL_PARK_OUTLINES[park.source.ref]?.ring ?? null : null
      const verdicts = pois.map((poi) => evaluateAutoApproval({
        company: job.company, poiName: poi.name, jobAddress: t.address, poiUnits: poi.units,
        insideKcn: ring ? pointInRing(poi.lat, poi.lng, ring) : null,
      }))
      const autoIndexes = verdicts.flatMap((v, i) => (v.approve ? [i] : []))
      const autoIndex = autoIndexes.length === 1 ? autoIndexes[0] : -1
      for (const [i, poi] of pois.entries()) {
        if (isDuplicateCandidate(known, { address: t.address, lat: poi.lat, lng: poi.lng })) { skipped++; continue }
        const evidence = buildCandidateEvidence({
          company: job.company, jobAddress: t.address, poi, similarity: nameSimilarity(job.company, poi.name),
          distanceM: t.focus ? distanceMeters(t.focus, poi) : null,
        })
        const willApprove = autoApprove && i === autoIndex
        log(`job ${job.id} · ${poi.name} (${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}) ${i === autoIndex ? '[자동 승인 기준 통과] ' : ''}${apply ? (willApprove ? '→ 후보 저장 + 자동 승인' : '→ 후보 저장(핀 없음)') : '(dry-run)'}`)
        if (apply) {
          const { data: added, error: e } = await db.rpc('admin_add_location_candidate', {
            p_job_id: job.id, p_address: t.address, p_lat: poi.lat, p_lng: poi.lng, p_precision: 'building',
            p_source: 'map_listing', p_evidence: evidence, p_evidence_urls: [], p_work_location_id: t.id,
          })
          if (e) { log(`job ${job.id}: 저장 실패 ${e.message}`); continue }
          if (willApprove) {
            const r = await db.rpc('admin_review_location_candidate', { p_candidate_id: (added as { id: number }).id, p_action: 'approve', p_note: AUTO_APPROVAL_NOTE[verdicts[i].reason] })
            if (r.error) log(`job ${job.id}: 자동 승인 실패(후보는 pending으로 남음) ${r.error.message}`)
            else approved++
          }
        }
        known.push({ address_snapshot: t.address, lat: poi.lat, lng: poi.lng })
        created++
      }
    }
  }
  log(`완료: 공고 ${jobs?.length ?? 0} · 검색 ${searched} · 후보 ${created}${apply ? ' 저장' : ' (dry-run, 저장 안 함)'} · 자동 승인 ${approved} · 건너뜀 ${skipped}`)
}

main().catch((e) => { console.error(`[location-candidates] 실패: ${(e as Error).message}`); process.exitCode = 1 })
