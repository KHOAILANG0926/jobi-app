// Shared by the administrator MAP-R1 action and scheduled worker. No database or browser globals.
import { ADDRESS_STRATEGY, parseStreetAddress, hasConflictingProvinces, pickAddressHit, judgeAddressPois } from './addressLocate'
import { COMPANY_STRATEGY, districtOf, type LocateStrategy } from './chototAutoLocate'
import { goongAddressHits, goongPlace, insideParkOutline, pickGoongCompany } from './goongLocate'
import { findIndustrialPark } from './industrialPark'
import { validPoint, type LocatedPoint } from './mapR1'
import type { PoiCandidate } from './locationCandidateMatch'
import { precheckVerdict } from './locationPrecheck'
import { hasProvince } from './addressReader'
import { companySearchText, googleSearchText, goongPredictionHits, googlePlaceHits, pickCompanyPlace, googleCacheKeys } from './companyPlaceSearch'

export interface ResolverJob { id: number; company: string; location: string; targets: {address: string; workLocationId: number | null}[] }
export type LocationDecision = (Omit<LocatedPoint, 'workLocationId'> | {kind: 'unresolved'}) & { address?: string; resolvedAddress?: string; workLocationId?: number | null; evidence?: string; failed?: boolean; deferred?: boolean
  /** 다른 매장 핀(찾은 매장만, 2026-11-11). DB map_r1_complete가 매장마다 같은 위치 쓰기 함수로 기록한다. */
  others?: LocationDecision[] }
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
  /** 보류함 '못 찾음' 7일 뒤 다시 확인(Codex #619): 저장된 Google 결과를 쓰지 않고 새로 묻는다(새 결과는 같은 열쇠에 저장). */
  refreshGoogle?: boolean
}
/** 매장(근무지)이 여러 곳이면(Lee 2026-11-11 KRIK·MediaMart) 매장 구분 없이 매장마다 같은 위치 찾기를 한 번씩 돌리고,
 *  수집 기준으로 '찾음'(번지·공단 정문·회사 장소, precheckVerdict)인 매장만 남긴다 — 맨 앞 찾은 매장이 대표 핀, 나머지는 others.
 *  위치를 모르는 매장에는 핀을 찍지 않는다(Lee 2026-11-11 절대 원칙). 지도 호출 수는 매장마다 따로(월 한도·DB 예약은 그대로).
 *  찾은 매장이 없으면 예전처럼 첫 매장 결과(한도 초과 기록 등)를 그대로 돌려준다. 최대 5곳. */
export async function resolveAutoLocation(job: ResolverJob, providedDeps: ResolverDeps): Promise<LocationDecision> {
  return onlyFound(await resolveAllStores(job, providedDeps))
}

/** 지도 위치 절대 원칙(Lee 2026-11-11 "위치를 모르면 마음대로 찍지 마"): 수집 기준으로 '찾음'(번지·공단 정문·회사 장소)이 아닌 결과
 *  (동·시·거리 가운데·공단 중심 같은 대략 위치)는 좌표 없이 '못 찾음'으로 돌려준다 — 핀을 찍지 않는다. 실패·한도 기록(evidence)은 남긴다. */
function onlyFound(r: LocationDecision): LocationDecision {
  if (r.kind === 'unresolved' || precheckVerdict(r).findable) return r
  return { kind: 'unresolved', failed: r.failed, deferred: r.deferred || /google:quota/.test(String(r.evidence ?? '')),
    evidence: [r.evidence, `approximate_not_pinned:${'source' in r ? r.source : ''}`].filter(Boolean).join('\n') }
}

async function resolveAllStores(job: ResolverJob, providedDeps: ResolverDeps): Promise<LocationDecision> {
  if (job.targets.length <= 1) return resolveStore(job, providedDeps)
  const results: LocationDecision[] = []
  for (const t of job.targets.filter((x) => x.address).slice(0, 5)) {
    // 매장 주소에 성 이름이 없으면 공고 위치 글자(지역)를 뒤에 붙여 원래 성 안 검사 근거를 지킨다(Codex #697)
    results.push(await resolveStore({ ...job, location: hasProvince(t.address) ? t.address : [t.address, job.location].filter(Boolean).join(', '), targets: [t] }, providedDeps))
  }
  const found = results.filter((r) => r.kind !== 'unresolved' && precheckVerdict(r).findable)
  // 한 매장이라도 Google 한도에 걸렸으면 공고 전체를 기존 보류(한도 초과 → 다음에 다시)로 — 매장을 빠뜨린 채 등록하지 않는다(Codex #697).
  const quota = results.find((r) => !found.includes(r) && /google:quota/.test(String(r.evidence ?? '')))
  if (quota) return { kind: 'unresolved', failed: false, deferred: true, evidence: [quota.evidence, 'stores:quota_retry'].filter(Boolean).join('\n') }
  // 찾은 매장이 없으면 좌표 없이 '못 찾음'(대략 위치 핀 금지, Lee 2026-11-11 절대 원칙) — 실패 기록은 남긴다.
  if (!found.length) {
    return { kind: 'unresolved', failed: results.some((r) => r.failed), deferred: results.some((r) => r.deferred),
      evidence: [results[0]?.evidence, 'stores:none_found'].filter(Boolean).join('\n') }
  }
  return found.length > 1 ? { ...found[0], others: found.slice(1) } : found[0]
}

/** 매장 하나의 위치 찾기(예전 resolveAutoLocation 그대로) — Google 1번·Goong 3번은 매장마다. */
async function resolveStore(job: ResolverJob, providedDeps: ResolverDeps): Promise<LocationDecision> {
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
  return resolveMain(job, deps)
}

async function resolveMain(job: ResolverJob, deps: ResolverDeps): Promise<LocationDecision> {
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
    // 공단 중심·동 중심·시 중심 같은 대략 위치 단계는 없앴다(지도 위치 절대 원칙, Lee 2026-11-11).
    // 못 찾으면 아래에서 '못 찾음' — 한도·실패 기록(reasons)은 그대로 남아 보류(google:quota)로 이어진다.
  } catch { failed = true } // Cache/reservation unavailable: fail closed; no more requests.
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
  // keys: 첫 열쇠에 저장, 읽을 때는 차례로(Google 열쇠는 googleCacheKeys 한 곳 — 검색 글자 완전 일치).
  const ask = async (key: unknown[] | string[], call: () => Promise<unknown>, provider = String(key[1])) => {
    const keys = provider === 'google' && key.every((x) => typeof x === 'string' && x.startsWith('[')) ? key as string[] : [JSON.stringify(key)]
    try {
      for (const k of provider === 'google' && deps.refreshGoogle ? [] : keys) {
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
      // 검색 글자가 완전히 같으면 저장된 결과를 다시 쓴다(googleCacheKeys 한 곳).
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
