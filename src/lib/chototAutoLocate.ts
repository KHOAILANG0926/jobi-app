// 관리자 Vị trí 탭 "Tìm vị trí tự động (chotot)" 버튼의 실행 로직 (2026-10-08).
// chotot 공고(ID 4685~4784)의 근무 회사를 VietMap Search/Place(서버 API 경유)로 찾고,
// 자동 승인 기준(회사명 정확 일치 + 주소의 구·KCN 안, 법인 등록 주소형 POI 제외)에 맞는 1곳만 승인 좌표로 반영한다.
// 나머지는 핀 없음 — 아무것도 저장하지 않는다(관리자 예외 처리는 기존 Vị trí 화면).
// 하루 250회 상한은 서버가 센다. 한도에 닿으면(DailyLimitError) 지금까지의 응답 캐시를 비공개 저장소에 남기고 멈춘다 —
// 다음 날 같은 버튼을 누르면 캐시된 질의는 다시 부르지 않고 이어서 진행한다.
import {
  AUTO_APPROVAL_NOTE, MIN_NAME_SIMILARITY, buildCandidateEvidence, distanceMeters, evaluateAutoApproval, isDuplicateCandidate,
  isExactCompanyName, nameSimilarity, normalizePlaceText, pointInRing, type AdminUnits, type AutoApprovalReason, type PoiCandidate,
} from './locationCandidateMatch'
import { findIndustrialPark } from './industrialPark'
import { INDUSTRIAL_PARK_OUTLINES } from '../data/industrialParkOutlines'
import { DailyLimitError } from './adminVietmapClient'

export const CHOTOT_ID_MIN = 4685
export const CHOTOT_ID_MAX = 4784
/** 처리해야 할 chotot 공고 수. 이보다 적게 읽혔으면 "끝"이 아니라 "chưa xử lý"로 센다. */
export const CHOTOT_EXPECTED_TOTAL = 100
const MAX_PLACES_PER_QUERY = 2
const CACHE_SAVE_EVERY = 10

export interface AutoLocateTarget { workLocationId: number | null; address: string; focus: { lat: number; lng: number } | null }
export interface ExistingCandidate { id: number; address_snapshot: string; lat: number; lng: number; status: string }
export interface AutoLocateJob { id: number; company: string; location: string; targets: AutoLocateTarget[]; existing: ExistingCandidate[] }

export interface SearchedPlaces { hits: number; pois: PoiCandidate[] }
export type SearchCache = Record<string, SearchedPlaces>

export interface AutoLocateDeps {
  search(body: { action: 'search'; text: string; focus?: { lat: number; lng: number } | null }): Promise<{ data: unknown; used: number; limit: number }>
  place(body: { action: 'place'; refId: string }): Promise<{ data: unknown; used: number; limit: number }>
  addCandidate(input: { jobId: number; address: string; lat: number; lng: number; evidence: string; workLocationId: number | null }): Promise<{ id: number }>
  approve(candidateId: number, note: string): Promise<void>
  loadCache(): Promise<SearchCache | null>
  saveCache(cache: SearchCache): Promise<void>
  pause?(): Promise<void>
}

export type NoPinReason =
  | 'no_company' | 'no_address' | 'no_search_result' | 'name_not_exact' | 'outside_kcn' | 'address_not_inside'
  | 'registered_address_like' | 'multiple_exact' | 'previously_rejected' | 'lookup_failed'

export const NO_PIN_LABEL: Record<NoPinReason, string> = {
  no_company: 'Không có tên công ty',
  no_address: 'Không có địa chỉ làm việc',
  no_search_result: 'VietMap không có điểm trùng tên',
  name_not_exact: 'Tên công ty không khớp chính xác',
  outside_kcn: 'Nằm ngoài khu công nghiệp trong địa chỉ',
  address_not_inside: 'Không nằm trong quận/huyện của địa chỉ',
  registered_address_like: 'Giống địa chỉ đăng ký pháp nhân',
  multiple_exact: 'Nhiều điểm khớp chính xác (nhiều chi nhánh)',
  previously_rejected: 'Quản trị viên đã từ chối vị trí này trước đó',
  lookup_failed: 'Lỗi khi tra cứu',
}

export interface AutoLocateOutcome {
  jobId: number
  company: string
  address: string
  status: 'approved' | 'already_approved' | 'no_pin'
  reason?: NoPinReason
  poiName?: string
}

export interface AutoLocateSummary {
  /** 처리해야 하는 전체 공고 수(기대값). 읽어 온 수가 아니다. */
  jobsTotal: number
  /** 실제로 읽어 온 공고 수 */
  jobsFound: number
  /** 이번 실행에서 모든 근무지의 판정을 끝낸 공고 수 — 캐시 응답으로 판정한 것 포함 */
  searched: number
  autoApproved: number
  alreadyApproved: number
  noPin: number
  /** jobsTotal - searched: 읽지 못한 공고·한도/중단으로 남은 공고를 모두 포함 */
  notProcessed: number
  callsThisRun: number
  /** 서버가 알려준 오늘 남은 호출 수. 이번 실행에서 호출이 없으면 null */
  remainingToday: number | null
  stopped: 'done' | 'incomplete' | 'daily_limit' | 'user' | 'error'
  errorMessage?: string
  outcomes: AutoLocateOutcome[]
}

export interface JobLoadReport {
  expected: number
  found: number
  hidden: number
  visible: number
  /** ID 범위 안에서 읽히지 않은 ID(최대 20개) — 없거나 읽기 권한이 없는 공고 */
  missingIds: number[]
  missingCount: number
}

/** 읽어 온 공고 행으로 "기대한 chotot 100건 중 몇 건을 읽었는지"를 요약한다(완료 표시 전에 반드시 보여준다). */
export function reportJobLoad(rows: Array<{ id: number; admin_hidden?: boolean | null }>, expected = CHOTOT_EXPECTED_TOTAL): JobLoadReport {
  const ids = new Set(rows.map((r) => r.id))
  const missing: number[] = []
  let missingCount = 0
  for (let id = CHOTOT_ID_MIN; id <= CHOTOT_ID_MAX; id++) {
    if (!ids.has(id)) { missingCount++; if (missing.length < 20) missing.push(id) }
  }
  const hidden = rows.filter((r) => r.admin_hidden === true).length
  return { expected, found: rows.length, hidden, visible: rows.length - hidden, missingIds: missing, missingCount }
}

export function districtOf(address: string): string {
  return address.split(',').map((s) => s.trim()).filter(Boolean).slice(-3).join(', ')
}

export function queryKey(company: string, address: string): string {
  return `${normalizePlaceText(company)}|${normalizePlaceText(districtOf(address))}`
}

interface SearchHit { ref_id?: string; name?: string; address?: string; display?: string }
interface PlaceDetail { name?: string; display?: string; address?: string; lat?: number; lng?: number; ward?: string; district?: string; city?: string }

/** 이름이 정확히 같은 후보를 먼저, 그다음 유사도 순으로 최대 MAX_PLACES_PER_QUERY곳만 Place 조회 대상으로 고른다. */
export function pickHitsToResolve(company: string, hits: unknown): SearchHit[] {
  const list = (Array.isArray(hits) ? hits : []) as SearchHit[]
  return list
    .filter((h) => h.ref_id && h.name && nameSimilarity(company, h.name) >= MIN_NAME_SIMILARITY)
    .map((h, i) => ({ h, i, exact: isExactCompanyName(company, h.name as string), sim: nameSimilarity(company, h.name as string) }))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.sim - a.sim || a.i - b.i)
    .slice(0, MAX_PLACES_PER_QUERY)
    .map((x) => x.h)
}

function toPoi(place: PlaceDetail, hit: SearchHit): PoiCandidate | null {
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return null
  const units: AdminUnits = { ward: place.ward, district: place.district, province: place.city }
  return { name: place.name || hit.name || '', address: place.display || place.address || hit.address || '', lat: place.lat, lng: place.lng, refId: hit.ref_id as string, units }
}

export interface Judgement { approvePoi: PoiCandidate | null; reason: NoPinReason | null; approvalReason?: AutoApprovalReason }

/** 한 근무지의 POI 후보들에서 자동 승인 1곳 또는 핀 없음 사유를 정한다(순수 함수). */
export function judgePois(company: string, job: { address: string; location: string }, found: SearchedPlaces): Judgement {
  if (found.pois.length === 0) return { approvePoi: null, reason: 'no_search_result' }
  const park = findIndustrialPark(job.address, job.location)
  const ring = park ? INDUSTRIAL_PARK_OUTLINES[park.source.ref]?.ring ?? null : null
  const verdicts = found.pois.map((poi) => ({
    poi,
    v: evaluateAutoApproval({ company, poiName: poi.name, jobAddress: job.address, poiUnits: poi.units, insideKcn: ring ? pointInRing(poi.lat, poi.lng, ring) : null }),
  }))
  const passed = verdicts.filter((x) => x.v.approve)
  if (passed.length === 1) return { approvePoi: passed[0].poi, reason: null, approvalReason: passed[0].v.reason }
  if (passed.length > 1) return { approvePoi: null, reason: 'multiple_exact' }
  const priority: AutoApprovalReason[] = ['registered_address_like', 'outside_kcn', 'address_not_inside', 'name_not_exact']
  const best = priority.find((r) => verdicts.some((x) => x.v.reason === r)) ?? 'name_not_exact'
  return { approvePoi: null, reason: best as NoPinReason }
}

export async function runAutoLocate(
  jobs: AutoLocateJob[],
  deps: AutoLocateDeps,
  opts: { shouldStop?: () => boolean; onProgress?: (s: AutoLocateSummary) => void; expectedTotal?: number } = {},
): Promise<AutoLocateSummary> {
  const summary: AutoLocateSummary = {
    jobsTotal: opts.expectedTotal ?? jobs.length, jobsFound: jobs.length, searched: 0, autoApproved: 0, alreadyApproved: 0, noPin: 0, notProcessed: opts.expectedTotal ?? jobs.length,
    callsThisRun: 0, remainingToday: null, stopped: 'done', outcomes: [],
  }
  const cache: SearchCache = (await deps.loadCache().catch(() => null)) ?? {}
  let unsaved = 0
  const flush = async () => { if (unsaved > 0) { await deps.saveCache(cache).catch(() => undefined); unsaved = 0 } }
  const noteCall = (r: { used: number; limit: number }) => { summary.callsThisRun++; summary.remainingToday = Math.max(0, r.limit - r.used) }
  const emit = () => opts.onProgress?.({ ...summary, outcomes: [...summary.outcomes] })

  let jobOutcomes: AutoLocateOutcome[] = []
  const record = (o: AutoLocateOutcome) => {
    summary.outcomes.push(o)
    jobOutcomes.push(o)
  }
  // 공고 단위로 센다: 한 공고의 모든 근무지 판정이 끝났을 때만 "검색 완료"로 올린다(한도·중단으로 끊긴 공고는 chưa xử lý).
  const finishJob = () => {
    if (jobOutcomes.some((o) => o.status === 'approved')) summary.autoApproved++
    else if (jobOutcomes.some((o) => o.status === 'already_approved')) summary.alreadyApproved++
    else summary.noPin++
    summary.searched++
    summary.notProcessed = Math.max(0, summary.jobsTotal - summary.searched)
  }

  async function resolve(company: string, address: string, focus: AutoLocateTarget['focus']): Promise<SearchedPlaces> {
    const key = queryKey(company, address)
    if (cache[key]) return cache[key]
    const text = `${company} ${districtOf(address)}`.trim()
    const searchReply = await deps.search({ action: 'search', text, focus })
    noteCall(searchReply)
    const hits = Array.isArray(searchReply.data) ? searchReply.data : []
    const pois: PoiCandidate[] = []
    for (const hit of pickHitsToResolve(company, hits)) {
      const placeReply = await deps.place({ action: 'place', refId: hit.ref_id as string })
      noteCall(placeReply)
      const poi = toPoi((placeReply.data ?? {}) as PlaceDetail, hit)
      if (poi) pois.push(poi)
      await deps.pause?.()
    }
    cache[key] = { hits: hits.length, pois }
    unsaved++
    if (unsaved >= CACHE_SAVE_EVERY) await flush()
    await deps.pause?.()
    return cache[key]
  }

  try {
    outer: for (const job of jobs) {
      if (opts.shouldStop?.()) { summary.stopped = 'user'; break }
      jobOutcomes = []
      const company = (job.company ?? '').trim()
      for (const target of job.targets) {
        const address = target.address.trim()
        const base = { jobId: job.id, company, address }
        if (!company) { record({ ...base, status: 'no_pin', reason: 'no_company' }); continue }
        if (!address) { record({ ...base, status: 'no_pin', reason: 'no_address' }); continue }
        if (job.existing.some((c) => c.status === 'approved' && c.address_snapshot === address)) {
          record({ ...base, status: 'already_approved' }); continue
        }
        let found: SearchedPlaces
        try {
          found = await resolve(company, address, target.focus)
        } catch (e) {
          if (e instanceof DailyLimitError) {
            summary.stopped = 'daily_limit'
            summary.remainingToday = 0
            break outer
          }
          record({ ...base, status: 'no_pin', reason: 'lookup_failed' }); continue
        }
        const verdict = judgePois(company, { address, location: job.location }, found)
        if (!verdict.approvePoi) { record({ ...base, status: 'no_pin', reason: verdict.reason ?? 'no_search_result' }); continue }
        const poi = verdict.approvePoi

        // 같은 위치(30 m)의 기존 후보가 있으면 새로 만들지 않는다: 대기 중이면 그것을 승인, 거절·철회된 것은 존중, 승인된 것은 그대로.
        const dup = job.existing.find((c) => c.address_snapshot === address && isDuplicateCandidate([c], { address, lat: poi.lat, lng: poi.lng }))
        const note = AUTO_APPROVAL_NOTE[verdict.approvalReason ?? 'exact_name_in_district']
        try {
          if (dup) {
            if (dup.status === 'approved') { record({ ...base, status: 'already_approved', poiName: poi.name }); continue }
            if (dup.status !== 'pending') { record({ ...base, status: 'no_pin', reason: 'previously_rejected', poiName: poi.name }); continue }
            await deps.approve(dup.id, note)
            dup.status = 'approved'
          } else {
            const evidence = buildCandidateEvidence({
              company, jobAddress: address, poi, similarity: nameSimilarity(company, poi.name),
              distanceM: target.focus ? distanceMeters(target.focus, poi) : null,
            })
            const added = await deps.addCandidate({ jobId: job.id, address, lat: poi.lat, lng: poi.lng, evidence, workLocationId: target.workLocationId })
            job.existing.push({ id: added.id, address_snapshot: address, lat: poi.lat, lng: poi.lng, status: 'pending' })
            await deps.approve(added.id, note)
            job.existing[job.existing.length - 1].status = 'approved'
          }
          record({ ...base, status: 'approved', poiName: poi.name })
        } catch {
          record({ ...base, status: 'no_pin', reason: 'lookup_failed', poiName: poi.name })
        }
      }
      finishJob()
      emit()
    }
  } catch (e) {
    summary.stopped = 'error'
    summary.errorMessage = e instanceof Error ? e.message : 'error'
  }
  summary.notProcessed = Math.max(0, summary.jobsTotal - summary.searched)
  if (summary.stopped === 'done' && summary.notProcessed > 0) summary.stopped = 'incomplete'
  await flush()
  emit()
  return summary
}
