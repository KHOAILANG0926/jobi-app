// Shared by the administrator MAP-R1 action and scheduled worker. No database or browser globals.
import { ADDRESS_STRATEGY, parseStreetAddress, hasConflictingProvinces } from './addressLocate'
import { COMPANY_STRATEGY, type LocateStrategy } from './chototAutoLocate'
import { findIndustrialPark } from './industrialPark'
import { wardUnitForAddresses } from './wardArea'
import { pickWardHit, checkWardPlace } from './wardLocate'
import { validPoint, type LocatedPoint } from './mapR1'
import type { PoiCandidate } from './locationCandidateMatch'

export interface ResolverJob { id: number; company: string; location: string; targets: {address: string; workLocationId: number | null}[] }
export type LocationDecision = (LocatedPoint | {kind: 'unresolved'}) & { address?: string; workLocationId?: number | null; evidence?: string; failed?: boolean; deferred?: boolean }
export interface ResolverDeps {
  remainingCalls?: number
  cached(key: string): Promise<unknown | null>
  cache(key: string, data: unknown): Promise<void>
  /** Durable job + daily budget reservation BEFORE every attempted upstream call. False means stop. */
  reserve(): Promise<boolean>
  request(action: 'search' | 'place', params: Record<string, string>): Promise<unknown>
}
export async function resolveAutoLocation(job: ResolverJob, deps: ResolverDeps): Promise<LocationDecision> {
  let calls = 0
  let failed = false
  let deferred = false
  const at = new Date().toISOString()
  const query = async (action: 'search' | 'place', params: Record<string, string>) => {
    const key = JSON.stringify(['map-r1-v1', action, params])
    const cached = await deps.cached(key)
    if (cached !== null) return cached
    if (calls >= Math.min(2, deps.remainingCalls ?? 2)) return null
    if (!await deps.reserve()) { deferred = true; return null }
    calls++
    try {
      const data = await deps.request(action, params)
      await deps.cache(key, data)
      return data
    } catch { failed = true; return null }
  }
  const targets = job.targets.length ? job.targets : [{ address: job.location, workLocationId: null }]
  // Detailed street first across ALL workplaces. Max two actual requests across the whole job.
  const sorted = [...targets].sort((a,b) => Number(parseStreetAddress(b.address).searchable) - Number(parseStreetAddress(a.address).searchable))
  try {
    for (const target of sorted) {
      if (failed || calls >= 2) break
      const address = target.address.trim()
      if (!address || hasConflictingProvinces(address)) continue
      const park = findIndustrialPark(address, job.location)
      const strategy: LocateStrategy | null = parseStreetAddress(address).searchable ? ADDRESS_STRATEGY : job.company.trim() && park ? COMPANY_STRATEGY : null
      if (!strategy || strategy.precheck?.(address)) continue
      const hits = await query('search', { text: strategy.searchText(job.company, address), ...(strategy === COMPANY_STRATEGY ? {layers:'POI'} : {}) })
      const pick = strategy.pick(job.company, address, hits)
      if (!pick.hit || pick.multiple || !pick.hit.ref_id || failed) continue
      const place = await query('place', { refid: pick.hit.ref_id }) as Record<string, unknown> | null
      if (!place || !validPoint({ lat: place.lat as number, lng: place.lng as number })) continue
      const poi: PoiCandidate = { name: String(place.name || pick.hit.name || ''), address: String(place.display || place.address || ''), lat: place.lat as number, lng: place.lng as number, refId: pick.hit.ref_id,
        units: {ward: place.ward as string, district:place.district as string, province:place.city as string} }
      // Confirm the resolved Place still identifies the street; a correct search hit alone is insufficient.
      if (strategy === ADDRESS_STRATEGY && !strategy.pick(job.company, address, [{...place, ref_id:poi.refId}]).hit) continue
      const verdict = strategy.judge(job.company, {address, location:job.location}, {hits:Array.isArray(hits) ? hits.length : 0, pois:[poi]})
      if (verdict.approvePoi) return {kind:'exact', lat:poi.lat, lng:poi.lng, source:`VietMap ${poi.refId}`, checkedAt:at, address, workLocationId:target.workLocationId,
        evidence:strategy.evidence({company:job.company,address,poi,distanceM:null})}
    }
    const park = findIndustrialPark(...targets.map(t => t.address), job.location)
    const gate = park?.destination
    if (gate?.kind === 'gate' && gate.source.ref && gate.satelliteChecked && validPoint(gate)) return {kind:'gate',lat:gate.lat,lng:gate.lng,source:`${gate.source.provider} ${gate.source.ref}`,checkedAt:gate.satelliteChecked,failed,deferred}
    // A known industrial park without a verified gate must not silently become a ward pin.
    if (!park) {
      const unit = wardUnitForAddresses(targets.map(t => t.address))
      if (unit && !failed) {
        const hits = await query('search', {text:unit.searchText})
        const pick = pickWardHit(unit, hits)
        if (pick.hit?.ref_id && !pick.multiple) {
          const place = await query('place', {refid:pick.hit.ref_id}) as Parameters<typeof checkWardPlace>[1] | null
          if (place && checkWardPlace(unit,place) === null && validPoint({lat:place.lat!,lng:place.lng!})) return {kind:'area',lat:place.lat!,lng:place.lng!,source:`VietMap ${pick.hit.ref_id}`,checkedAt:at}
        }
      }
    }
  } catch { failed = true } // Cache/reservation unavailable: fail closed; no more requests.
  return {kind:'unresolved',failed,deferred}
}
