// Shared by the administrator MAP-R1 action and scheduled worker. No database or browser globals.
import { ADDRESS_STRATEGY, parseStreetAddress, hasConflictingProvinces, pickAddressHit, judgeAddressPois } from './addressLocate'
import { COMPANY_STRATEGY, districtOf, type LocateStrategy } from './chototAutoLocate'
import { goongAddressHits, goongPlace, insideParkOutline, pickGoongCompany } from './goongLocate'
import { findIndustrialPark } from './industrialPark'
import { wardUnitForAddresses, type WardUnit } from './wardArea'
import { pickWardHit, checkWardPlace } from './wardLocate'
import { parkNameFromAddresses, pickParkHit, parkPlaceOk } from './parkLocate'
import { validPoint, type LocatedPoint } from './mapR1'
import type { PoiCandidate } from './locationCandidateMatch'
import { companySearchText, googleSearchText, goongPredictionHits, googlePlaceHits, pickCompanyPlace, googleCacheKeys } from './companyPlaceSearch'

export interface ResolverJob { id: number; company: string; location: string; targets: {address: string; workLocationId: number | null}[] }
export type LocationDecision = (Omit<LocatedPoint, 'workLocationId'> | {kind: 'unresolved'}) & { address?: string; resolvedAddress?: string; workLocationId?: number | null; evidence?: string; failed?: boolean; deferred?: boolean }
export interface ResolverDeps {
  withinAdministrativeArea?(addresses:string[],point:{lat:number;lng:number}): Promise<boolean>
  administrativeCenter?(addresses: string[]): Promise<{lat:number;lng:number;source:string;checkedAt:string} | null>
  remainingCalls?: number
  cached(key: string): Promise<unknown | null>
  cache(key: string, data: unknown): Promise<void>
  /** Durable job + daily budget reservation BEFORE every attempted upstream call. False means stop. */
  reserve(): Promise<boolean>
  request(action: 'search' | 'place', params: Record<string, string>): Promise<unknown>
  /** 두 번째 지도 자료 Goong(Lee 2026-10-29). 없으면(키 없음) 건너뛴다. VietMap 예산(reserve)과 따로, 한 번 판정에 최대 3번·같은 질문은 저장 결과 재사용. */
  goong?(action: 'geocode' | 'autocomplete' | 'detail', params: Record<string, string>): Promise<unknown>
  /** 세 번째 자료 Google Places Text Search(Lee 2026-11-03). 키(Vercel GOOGLE_PLACES_API_KEY)가 없으면 건너뛴다. 공고당 1번. */
  google?(text: string): Promise<unknown>
  /** 이미 저장된 동 중심 좌표(관리자 동 찾기 캐시). 있으면 VietMap을 부르지 않는다(2026-10-18). */
  wardCenter?(unit: WardUnit): Promise<{ lat: number; lng: number; at: string } | null>
}
export async function resolveAutoLocation(job: ResolverJob, providedDeps: ResolverDeps): Promise<LocationDecision> {
  // Share the original three-request cap across address, company and replay stages.
  let goongCalls = 0, googleCalls = 0
  const deps: ResolverDeps = { ...providedDeps, ...(providedDeps.goong ? { async goong(action, params) {
    if (goongCalls >= 3) return null
    goongCalls++
    return providedDeps.goong!(action, params)
  } } : {}), ...(providedDeps.google ? { async google(text) {
    if (googleCalls >= 1) return null
    googleCalls++
    return providedDeps.google!(text)
  } } : {}) }
  const result=await resolveEvidence(job,deps)
  if(result.kind==='unresolved')return result
  const targets=job.targets.length?job.targets:[{address:job.location,workLocationId:null}]
  const candidates=result.address?targets.filter(t=>t.address===result.address):result.workLocationId!=null?targets.filter(t=>t.workLocationId===result.workLocationId):targets
  for(const target of candidates) {
    if(!deps.withinAdministrativeArea||await deps.withinAdministrativeArea([target.address,job.location],result))return {...result,address:target.address,workLocationId:target.workLocationId}
  }
  for(const target of candidates) {
    const area=await deps.administrativeCenter?.([target.address,job.location])
    if(area&&validPoint(area))return {kind:'area',...area,address:target.address,workLocationId:target.workLocationId,failed:result.failed,deferred:result.deferred,evidence:[result.evidence,'administrative_boundary:mismatch'].filter(Boolean).join('\n')}
  }
  return {kind:'unresolved',failed:result.failed,deferred:result.deferred}
}

async function resolveEvidence(job: ResolverJob, deps: ResolverDeps): Promise<LocationDecision> {
  let calls = 0
  let failed = false
  let deferred = false
  const reasons: string[] = []
  const at = new Date().toISOString()
  const query = async (action: 'search' | 'place', params: Record<string, string>) => {
    const key = JSON.stringify(['map-r1-v1', action, params])
    const cached = await deps.cached(key)
    if (cached !== null) return cached
    if (failed || deferred || calls >= Math.min(2, deps.remainingCalls ?? 2)) return null
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
  // Google이 알려 준 주소를 VietMap(·Goong)으로 번지까지 확인 — 맞으면 정확한 위치(exact).
  const verifyAddress = async (address: string, target: ResolverJob['targets'][number]): Promise<LocationDecision | null> => {
    if (!parseStreetAddress(address).searchable || hasConflictingProvinces(address)) return null
    const hits = await query('search', { text: ADDRESS_STRATEGY.searchText(job.company, address) })
    const pick = pickAddressHit(address, hits)
    if (pick.hit?.ref_id && !pick.multiple) {
      const place = await query('place', { refid: pick.hit.ref_id }) as Record<string, unknown> | null
      if (place && validPoint({ lat: place.lat as number, lng: place.lng as number }) && pickAddressHit(address, [{ ...place, ref_id: pick.hit.ref_id }]).hit) {
        const poi: PoiCandidate = { name: String(place.name || ''), address: String(place.display || place.address || ''), lat: place.lat as number, lng: place.lng as number, refId: pick.hit.ref_id,
          units: { ward: place.ward as string, district: place.district as string, province: place.city as string } }
        if (judgeAddressPois({ address }, { hits: 1, pois: [poi] }).approvePoi) return { kind: 'exact', lat: poi.lat, lng: poi.lng, source: `VietMap ${poi.refId}`, checkedAt: at }
      }
    }
    // This replay uses the same cached address question and matching rules.
    return deps.goong ? resolveWithGoong({ ...job, location: address }, [{ ...target, address }], deps, at) : null
  }
  try {
    // Lee 2026-11-06 "VietMap하고 Goong 하지 말고 바로 구글로": 회사 이름이 있으면 Google(상세 Google 버튼과 같은 검색어)부터.
    // Google이 같은 이름 1곳을 알면 그 자리 — 주소가 VietMap·Goong에서 번지까지 맞으면 exact, 아니면 Google 좌표(area·chưa xác minh).
    // Google이 모르면 아래 기존 단계(번지·공단 입구·대략 위치)로 핀만 정한다(수집 여부는 locationPrecheck가 판정).
    if (job.company.trim() && deps.google) {
      const found = await resolveByCompanyName(job, sorted, deps, at, reason => reasons.push(reason), verifyAddress, { goong: false })
      if (found) return found
    }
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
    // Goong(두 번째 자료): VietMap이 ①번지·②회사+공단을 못 찾았을 때만, 같은 판정 규칙으로.
    if (deps.goong) {
      const found = await resolveWithGoong(job, sorted, deps, at)
      if (found) return found
    }
    const park = findIndustrialPark(...targets.map(t => t.address), job.location)
    // Company lookup also applies after an industrial-park lookup failed.
    // Google supplies address text only; the existing address rules determine the pin.
    if (job.company.trim()) {
      reasons.push(failed ? 'vietmap:provider_failed' : deferred ? 'vietmap:budget_deferred' : 'vietmap:no_verified_match', 'goong:no_verified_match')
      if (!deps.google) reasons.push('google:not_configured')
      const found = await resolveByCompanyName(job, sorted, deps, at, reason => reasons.push(reason), verifyAddress, { google: false })
      if (found) return found
    }
    const gate = park?.destination
    if (gate?.kind === 'gate' && gate.source.ref && gate.satelliteChecked && validPoint(gate)) return {kind:'gate',lat:gate.lat,lng:gate.lng,source:`${gate.source.provider} ${gate.source.ref}`,checkedAt:gate.satelliteChecked,failed,deferred,evidence:reasons.join('\n')}
    // 공단 표에 있는 공단인데 확인된 입구가 없으면 공단 중심(출처 OSM)을 대략 위치 핀으로 — 상세 화면 지도와 같은 점(2026-10-20 Lee)
    if (park && validPoint({lat:park.lat,lng:park.lng})) return {kind:'area',lat:park.lat,lng:park.lng,source:`${park.source.provider} ${park.source.ref}`,checkedAt:at,evidence:reasons.join('\n')}
    // A known industrial park without a verified gate must not silently become a ward pin.
    // 공단 표에 없는 공단(예: "KCN Yên Phong"): VietMap에서 같은 이름의 공단 1곳을 찾아 대략 위치 핀(2026-10-20, Lee 10-13 '핀은 무조건').
    const unlisted = !park ? parkNameFromAddresses([...targets.map(t => t.address), job.location]) : null
    if (unlisted && !failed) {
      const hits = await query('search', {text:unlisted.searchText})
      const pick = pickParkHit(unlisted, hits)
      if (pick.hit?.ref_id && !pick.multiple) {
        const place = await query('place', {refid:pick.hit.ref_id}) as {lat?:number;lng?:number;city?:string} | null
        if (parkPlaceOk(unlisted, place) && validPoint({lat:place!.lat!,lng:place!.lng!})) return {kind:'area',lat:place!.lat!,lng:place!.lng!,source:`VietMap ${pick.hit.ref_id} (KCN)`,checkedAt:at}
      }
    }
    if (!park) {
      const unit = wardUnitForAddresses(targets.map(t => t.address))
      if (unit && !failed) {
        const saved = await deps.wardCenter?.(unit)
        if (saved && validPoint(saved)) return {kind:'area',lat:saved.lat,lng:saved.lng,source:`VietMap ward cache ${unit.key}`,checkedAt:saved.at || at,evidence:reasons.join('\n')}
        const hits = await query('search', {text:unit.searchText})
        const pick = pickWardHit(unit, hits)
        if (pick.hit?.ref_id && !pick.multiple) {
          const place = await query('place', {refid:pick.hit.ref_id}) as Parameters<typeof checkWardPlace>[1] | null
          if (place && checkWardPlace(unit,place) === null && validPoint({lat:place.lat!,lng:place.lng!})) return {kind:'area',lat:place.lat!,lng:place.lng!,source:`VietMap ${pick.hit.ref_id}`,checkedAt:at}
        }
      }
    }
  } catch { failed = true } // Cache/reservation unavailable: fail closed; no more requests.
  // Administrative fallback survives provider failure/budget exhaustion. It is
  // unverified evidence persisted by the same canonical writer as every tier.
  for(const target of targets) {
    const area=await deps.administrativeCenter?.([target.address,job.location])
    if(area&&validPoint(area))return {kind:'area',...area,address:target.address,workLocationId:target.workLocationId,failed,deferred,evidence:reasons.join('\n')}
  }
  return {kind:'unresolved',failed,deferred,evidence:reasons.join('\n')}
}

/** ① 번지: 번지·도로명이 결과에 그대로 + 원문 동/구 일치 / ② 회사+공단: 회사명 정확 일치 1곳 + 공단 경계 안. 실패는 조용히 다음 단계로. */
async function resolveWithGoong(job: ResolverJob, targets: ResolverJob['targets'], deps: ResolverDeps, at: string): Promise<LocationDecision | null> {
  let calls = 0
  const ask = async (action: 'geocode' | 'autocomplete' | 'detail', params: Record<string, string>) => {
    const key = JSON.stringify(['goong-v1', action, params])
    try {
      const cached = await deps.cached(key)
      if (cached !== null) return cached
      if (calls >= 3) return null
      calls++
      const data = await deps.goong!(action, params)
      await deps.cache(key, data)
      return data
    } catch { return null }
  }
  for (const target of targets) {
    const address = target.address.trim()
    if (!address || hasConflictingProvinces(address)) continue
    if (parseStreetAddress(address).searchable) {
      const hits = goongAddressHits(await ask('geocode', { address: ADDRESS_STRATEGY.searchText(job.company, address) }))
      const pick = pickAddressHit(address, hits)
      const hit = pick.hit ? hits.find(h => h.ref_id === pick.hit!.ref_id) : null
      if (hit && validPoint(hit)) {
        const poi: PoiCandidate = { name: hit.name, address: hit.address, lat: hit.lat, lng: hit.lng, refId: hit.ref_id, units: hit.units }
        const verdict = judgeAddressPois({ address }, { hits: hits.length, pois: [poi] })
        if (verdict.approvePoi) return { kind: 'exact', lat: poi.lat, lng: poi.lng, source: `Goong ${poi.refId}`, checkedAt: at, address, workLocationId: target.workLocationId,
          evidence: [`[Tự động] Tìm theo địa chỉ chi tiết trên Goong: ${poi.address}`, `Địa chỉ trong tin: ${address}`, `Goong place: ${poi.refId}`].join('\n') }
      }
      continue
    }
    const park = findIndustrialPark(address, job.location)
    if (job.company.trim() && park) {
      const pick = pickGoongCompany(job.company, await ask('autocomplete', { input: `${job.company} ${districtOf(address)}`.trim() }))
      if (!pick.placeId) continue
      const place = goongPlace(await ask('detail', { place_id: pick.placeId }))
      if (place && validPoint(place) && insideParkOutline(park, place)) return { kind: 'exact', lat: place.lat, lng: place.lng, source: `Goong ${pick.placeId}`, checkedAt: at, address,
        workLocationId: target.workLocationId,
        evidence: [`[Tự động] Tên công ty khớp chính xác trên Goong: ${place.name}`, `Nằm trong ranh giới ${park.name} (OpenStreetMap ${park.source.ref})`, `Địa chỉ trong tin: ${address}`, `Goong place: ${pick.placeId}`].join('\n') }
    }
  }
  return null
}

/** Company-name fallback, including industrial parks. Google address text verified by VietMap/Goong → exact;
 * otherwise Google's single same-name place itself → area (Lee 2026-11-06). Google not knowing → no company pin. */
async function resolveByCompanyName(job: ResolverJob, targets: ResolverJob['targets'], deps: ResolverDeps, at: string,
  reason: (reason: string) => void,
  verifyAddress: (address: string, target: ResolverJob['targets'][number]) => Promise<LocationDecision | null>,
  use: { goong?: boolean; google?: boolean } = {}): Promise<LocationDecision | null> {
  // keys: 첫 열쇠에 저장, 읽을 때는 차례로(Google은 사업장 열쇠 → 예전 검색 글자 열쇠, googleCacheKeys 한 곳).
  const ask = async (key: unknown[] | string[], call: () => Promise<unknown>, provider = String(key[1])) => {
    const keys = provider === 'google' && key.every((x) => typeof x === 'string' && x.startsWith('[')) ? key as string[] : [JSON.stringify(key)]
    try {
      for (const k of keys) {
        const cached = await deps.cached(k)
        if (cached !== null) return cached
      }
      const data = await call()
      await deps.cache(keys[0], data)
      return data
    } catch (e) {
      // 한도(우리 월 한도 또는 Google 429)는 '못 찾음'이 아니다 → 따로 표시해 공고를 버리지 않고 보류한다(#560).
      reason(`${provider}:${/quota_exhausted|upstream_failed_429/.test(String((e as Error)?.message)) ? 'quota' : 'provider_failed'}`)
      return null
    }
  }
  for (const target of targets.slice(0, 2)) {
    const address = target.address.trim() || job.location
    if (!address || hasConflictingProvinces(address)) continue
    const text = companySearchText(job.company, address)
    if (deps.goong && use.goong !== false) {
      const hits = goongPredictionHits(await ask(['company-v1', 'goong', text], () => deps.goong!('autocomplete', { input: text })))
      const pick = pickCompanyPlace(job.company, address, hits)
      if (!pick.hit) reason(`goong:${pick.reason}`)
      if (pick.hit) {
        const place = goongPlace(await ask(['company-v1', 'goong-detail', pick.hit.id], () => deps.goong!('detail', { place_id: pick.hit!.id })))
        if (place && validPoint(place)) return { kind: 'area', lat: place.lat, lng: place.lng, source: `Goong ${pick.hit.id} (company)`, checkedAt: at, address, workLocationId: target.workLocationId,
          evidence: [`[Tự động] Tìm theo tên công ty trên Goong: ${place.name}`, `Địa chỉ Goong: ${place.address}`, `Địa chỉ trong tin: ${address}`, `Cách chọn: ${pick.reason}`].join('\n') }
      }
    }
    if (deps.google && use.google !== false) {
      // Ask Google exactly what the detail-page Google button asks (company, full address).
      const gText = googleSearchText(job.company, address)
      // 같은 사업장(회사+번지/공단+성)이면 표기가 달라도 한 번만 묻는다. 사업장을 못 정하면 예전처럼 검색 글자로(googleCacheKeys 한 곳).
      const hits = googlePlaceHits(await ask(googleCacheKeys(job.company, address), () => deps.google!(gText), 'google'))
      const pick = pickCompanyPlace(job.company, address, hits)
      if (!pick.hit) reason(`google:${pick.reason}`)
      const hit = pick.hit ? hits.find((h) => h.id === pick.hit!.id) : null
      if (hit) {
        const verified = await verifyAddress(hit.address, target)
        if (verified && verified.kind === 'exact') return { ...verified, address, resolvedAddress: hit.address, workLocationId: target.workLocationId,
          evidence: [verified.evidence, `[Tự động] Tìm địa chỉ theo tên công ty: ${hit.name}`, `Địa chỉ tìm được: ${hit.address}`, `Địa chỉ trong tin: ${address}`, `Cách chọn: ${pick.reason}`, 'Google: address verified by VietMap/Goong'].filter(Boolean).join('\n') }
        // Lee 2026-11-06: when Google knows the company (one same-name place), follow Google's place itself.
        // Unverified (area) like the Goong company step; the original-province check in resolveAutoLocation still applies
        // (outside → administrative area + boundary mismatch, i.e. Google picked a same-name company elsewhere).
        if (validPoint(hit)) return { kind: 'area', lat: hit.lat, lng: hit.lng, source: `Google ${hit.id} (company)`, checkedAt: at, address, resolvedAddress: hit.address, workLocationId: target.workLocationId,
          evidence: [`[Tự động] Tìm theo tên công ty trên Google: ${hit.name}`, `Địa chỉ Google: ${hit.address}`, `Địa chỉ trong tin: ${address}`, `Cách chọn: ${pick.reason}`, 'Google: place location (same query as Google button)'].join('\n') }
        reason('google:invalid_point')
      }
    }
  }
  return null
}
