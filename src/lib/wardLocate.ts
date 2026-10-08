// 관리자 Vị trí 탭 "Tìm khu vực xã/phường" 버튼의 실행 로직 (2026-10-08).
// 핀·KCN 영역이 없고 행정구역(xã/phường)만 아는 공고용 — 그 xã/phường 이름이 VietMap에서 어디인지 서버 API로 한 번 찾아
// 비공개 저장소(research_artifacts)에 캐시한다. 같은 xã/phường은 다시 부르지 않는다(성공은 영구, 실패는 검색 방식이 바뀔 때만 재시도).
// 여기서 구한 좌표는 "그 동네가 보이는 지도"의 중심일 뿐 — 핀·길찾기·거리 계산에는 쓰지 않는다.
// 하루 250회 상한은 서버가 센다(chototAutoLocate와 같은 카운터). 한도에 닿으면 캐시를 저장하고 멈춘다.
import { normalizePlaceText } from './locationCandidateMatch'
import { DailyLimitError } from './adminVietmapClient'
import type { WardUnit } from './wardArea'

/** 검색 방식 버전 — 바꾸면 이전에 "못 찾음"으로 남은 항목만 다시 시도한다(찾은 항목은 그대로). */
export const WARD_SEARCH_VERSION = 1
/** xã/phường 1곳당 호출 상한: Search 최대 2회(전체 주소 → 구 단위를 뺀 주소) + Place 1회. */
export const MAX_CALLS_PER_WARD = 3
export const MAX_CONSECUTIVE_FAILURES = 5
const CACHE_SAVE_EVERY = 10

export type WardMissReason = 'no_search_result' | 'no_exact_name' | 'multiple_matches' | 'place_failed' | 'place_mismatch' | 'bad_coords'

export const WARD_MISS_LABEL: Record<WardMissReason, string> = {
  no_search_result: 'VietMap không có kết quả',
  no_exact_name: 'Không có kết quả trùng đúng tên xã/phường (và địa bàn)',
  multiple_matches: 'Nhiều kết quả trùng tên — không rõ là nơi nào',
  place_failed: 'Không lấy được tọa độ',
  place_mismatch: 'Tọa độ thuộc xã/phường hoặc tỉnh khác',
  bad_coords: 'Tọa độ nằm ngoài Việt Nam',
}

export type WardCenterEntry =
  | { status: 'found'; lat: number; lng: number; name: string; at: string }
  | { status: 'miss'; reason: WardMissReason; version: number; at: string }
export type WardCenterCache = Record<string, WardCenterEntry>

/** 비공개 저장소의 캐시 이름 — 공개 조회 API(api/ward-area.js)도 같은 곳을 읽는다. */
export const WARD_CACHE_KIND = 'autolocate'
export const WARD_CACHE_NAME = 'ward_centers'

interface SearchHit { ref_id?: string; name?: string; address?: string; display?: string }
interface PlaceDetail { name?: string; display?: string; address?: string; lat?: number; lng?: number; ward?: string; district?: string; city?: string }

export interface WardLocateDeps {
  search(body: { action: 'search'; text: string; any?: boolean }): Promise<{ data: unknown; used: number; limit: number }>
  place(body: { action: 'place'; refId: string }): Promise<{ data: unknown; used: number; limit: number }>
  loadCache(): Promise<WardCenterCache | null>
  saveCache(cache: WardCenterCache): Promise<void>
  pause?(): Promise<void>
}

const PREFIX = /^(phuong|xa|thi tran)\s+/
const KIND_WORD: Record<WardUnit['kind'], string> = { xa: 'xa', phuong: 'phuong', 'thi tran': 'thi tran' }

/** 검색 결과 중 "이름이 그 xã/phường과 정확히 같고 구·군 또는 성이 주소와 맞는" 1곳만 고른다. 여럿이면 어느 곳인지 구분할 수 없어 multiple. */
export function pickWardHit(unit: WardUnit, hits: unknown): { hit: SearchHit | null; multiple: boolean } {
  const list = (Array.isArray(hits) ? hits : []) as SearchHit[]
  const named = list.filter((h) => {
    if (!h.ref_id || !h.name) return false
    const n = normalizePlaceText(h.name)
    const prefix = n.match(PREFIX)?.[1]
    if (prefix && prefix !== KIND_WORD[unit.kind]) return false
    return n.replace(PREFIX, '').trim() === unit.ward
  })
  const scored = named.map((h) => {
    const text = ` ${normalizePlaceText(`${h.address ?? ''} ${h.display ?? ''}`)} `
    const inDistrict = text.includes(` ${unit.district} `)
    const inProvince = text.includes(` ${unit.province} `)
    return { h, score: (inDistrict ? 2 : 0) + (inProvince ? 1 : 0) }
  }).filter((x) => x.score > 0)
  if (scored.length === 0) return { hit: null, multiple: false }
  const best = Math.max(...scored.map((x) => x.score))
  const top = scored.filter((x) => x.score === best)
  return top.length === 1 ? { hit: top[0].h, multiple: false } : { hit: null, multiple: true }
}

/** Place 응답이 같은 xã/phường·같은 성의 좌표인지 확인한다(없는 필드는 판단 보류). */
export function checkWardPlace(unit: WardUnit, place: PlaceDetail): WardMissReason | null {
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return 'place_failed'
  if (place.lat < 8 || place.lat > 24 || place.lng < 102 || place.lng > 110) return 'bad_coords'
  if (place.ward) {
    const w = normalizePlaceText(place.ward).replace(PREFIX, '').trim()
    if (w && w !== unit.ward) return 'place_mismatch'
  }
  if (place.city) {
    const c = ` ${normalizePlaceText(place.city)} `
    if (!c.includes(` ${unit.province} `)) return 'place_mismatch'
  }
  return null
}

export interface WardOutcome { key: string; label: string; status: 'found' | 'miss' | 'cached_found' | 'cached_miss' | 'lookup_failed'; reason?: WardMissReason }

export interface WardLocateSummary {
  wardsTotal: number
  /** 이미 캐시에 있어 호출하지 않은 xã/phường 수 */
  fromCache: number
  found: number
  miss: number
  lookupFailed: number
  notProcessed: number
  callsThisRun: number
  serverCallsDelta: number | null
  remainingToday: number | null
  stopped: 'running' | 'done' | 'incomplete' | 'daily_limit' | 'user' | 'error'
  errorMessage?: string
  outcomes: WardOutcome[]
}

export async function runWardLocate(
  units: WardUnit[],
  deps: WardLocateDeps,
  opts: { shouldStop?: () => boolean; onProgress?: (s: WardLocateSummary) => void; usedAtStart?: number; now?: () => Date } = {},
): Promise<WardLocateSummary> {
  const now = opts.now ?? (() => new Date())
  const unique = [...new Map(units.map((u) => [u.key, u])).values()]
  const summary: WardLocateSummary = {
    wardsTotal: unique.length, fromCache: 0, found: 0, miss: 0, lookupFailed: 0, notProcessed: unique.length,
    callsThisRun: 0, serverCallsDelta: null, remainingToday: null, stopped: 'running', outcomes: [],
  }
  const cache: WardCenterCache = (await deps.loadCache().catch(() => null)) ?? {}
  let unsaved = 0
  const flush = async () => { if (unsaved > 0) { await deps.saveCache(cache).catch(() => undefined); unsaved = 0 } }
  const noteServer = (used: number, limit: number) => {
    summary.remainingToday = Math.max(0, limit - used)
    if (opts.usedAtStart !== undefined) summary.serverCallsDelta = Math.max(0, used - opts.usedAtStart)
  }
  async function counted<T extends { used: number; limit: number }>(send: () => Promise<T>): Promise<T> {
    summary.callsThisRun++
    try {
      const reply = await send()
      noteServer(reply.used, reply.limit)
      return reply
    } catch (e) {
      if (e instanceof DailyLimitError) { summary.callsThisRun--; noteServer(e.used, e.limit) }
      throw e
    }
  }
  const emit = () => opts.onProgress?.({ ...summary, outcomes: [...summary.outcomes] })
  const done = () => { summary.notProcessed = Math.max(0, summary.wardsTotal - summary.fromCache - summary.found - summary.miss) }

  async function lookup(unit: WardUnit): Promise<WardCenterEntry> {
    const at = now().toISOString()
    const miss = (reason: WardMissReason): WardCenterEntry => ({ status: 'miss', reason, version: WARD_SEARCH_VERSION, at })
    let sawAnyHit = false
    let multiple = false
    for (const text of [unit.searchText, unit.searchTextShort]) {
      const reply = await counted(() => deps.search({ action: 'search', text, any: true }))
      const hits = Array.isArray(reply.data) ? reply.data : []
      if (hits.length > 0) sawAnyHit = true
      const pick = pickWardHit(unit, hits)
      if (pick.hit) {
        const hit = pick.hit
        const placeReply = await counted(() => deps.place({ action: 'place', refId: hit.ref_id as string }))
        const place = (placeReply.data ?? {}) as PlaceDetail
        const bad = checkWardPlace(unit, place)
        if (bad) return miss(bad)
        return { status: 'found', lat: place.lat as number, lng: place.lng as number, name: place.display || place.name || hit.name || unit.label, at }
      }
      if (pick.multiple) { multiple = true; break }
    }
    if (multiple) return miss('multiple_matches')
    if (!sawAnyHit) return miss('no_search_result')
    return miss('no_exact_name')
  }

  let consecutiveFailures = 0
  try {
    for (const unit of unique) {
      if (opts.shouldStop?.()) { summary.stopped = 'user'; break }
      const cached = cache[unit.key]
      if (cached && (cached.status === 'found' || cached.version === WARD_SEARCH_VERSION)) {
        summary.fromCache++
        summary.outcomes.push({ key: unit.key, label: unit.label, status: cached.status === 'found' ? 'cached_found' : 'cached_miss', reason: cached.status === 'miss' ? cached.reason : undefined })
        done()
        continue
      }
      let entry: WardCenterEntry
      try {
        entry = await lookup(unit)
      } catch (e) {
        if (e instanceof DailyLimitError) { summary.stopped = 'daily_limit'; summary.remainingToday = 0; break }
        summary.lookupFailed++
        summary.outcomes.push({ key: unit.key, label: unit.label, status: 'lookup_failed' })
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          summary.stopped = 'error'
          summary.errorMessage = `VietMap lỗi ${MAX_CONSECUTIVE_FAILURES} lần liên tiếp (${e instanceof Error ? e.message : 'error'}) — dừng để không tốn thêm lượt. Thử lại sau.`
          break
        }
        emit()
        continue
      }
      consecutiveFailures = 0
      cache[unit.key] = entry
      unsaved++
      if (entry.status === 'found') { summary.found++; summary.outcomes.push({ key: unit.key, label: unit.label, status: 'found' }) }
      else { summary.miss++; summary.outcomes.push({ key: unit.key, label: unit.label, status: 'miss', reason: entry.reason }) }
      done()
      if (unsaved >= CACHE_SAVE_EVERY) await flush()
      emit()
      await deps.pause?.()
    }
  } catch (e) {
    summary.stopped = 'error'
    summary.errorMessage = e instanceof Error ? e.message : 'error'
  }
  done()
  if (summary.stopped === 'running') summary.stopped = summary.notProcessed > 0 ? 'incomplete' : 'done'
  await flush()
  emit()
  return summary
}
