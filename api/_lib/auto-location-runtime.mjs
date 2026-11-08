import { createHash, randomUUID } from 'node:crypto'
import { resolveAutoLocation } from '../../src/lib/autoLocationResolver.ts'
import { administrativeAreaForTarget, areaContains } from '../../src/lib/administrativeArea.ts'
import { findWardCenter } from '../../src/lib/wardArea.ts'
import { locationVerdict } from '../../src/lib/locationLevel.ts'
import { agencyByPhone, precheckCompany, precheckJob, precheckLocationText, precheckVerdict } from '../../src/lib/locationPrecheck.ts'
import { companyIdentity, phoneKeys } from '../../src/lib/jobIdentity.ts'
import { readWorkplace } from '../../src/lib/companyReader.ts'
import { cachedGooglePlaceId, needsLogoLookup, websiteDomain } from '../../src/lib/logoLookup.ts'
import { assembleBrands } from '../../src/lib/brandRows.ts'
export { hasLocationClue } from '../../src/lib/locationReviewClue.ts'

export async function runLocationBatch(db, request, limit = 10, goong = null, google = null) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_batch', {p_limit:limit,p_lease:lease}), goong, google)
}

/** 공고 한 건만(저장 즉시 위치 찾기, api/location-hook). 규칙·한도는 일괄 처리와 같다. */
export async function runLocationJob(db, request, jobId, force = false, goong = null, google = null) {
  return runClaimed(db, request, (rpc, lease) => rpc('map_r1_claim_job_v2', {p_id:jobId,p_lease:lease,p_force:force}), goong, google)
}

/** 결정 0006(2026-10-20 Lee 수정): 찾음 → 숨김 해제(원래 공개였으면 다시 공개) / 원문에 위치 정보 없음 → 바로 삭제
 *  / 주소는 있는데 못 찾음 → 비공개 + 저녁 8시 목록(삭제하지 않음) / 판정 보류 → 그대로. */
export async function applyLocationVerdict(db, jobId) {
  const [{data:job,error:e1},{data:wl,error:e2},{data:st,error:e3},{data:exact,error:e4}] = await Promise.all([
    db.from('local_jobs').select('location,source_text').eq('id',jobId).maybeSingle(),
    db.from('job_work_locations').select('raw_address,industrial_park').eq('job_id',jobId),
    db.from('map_r1_location_jobs').select('state,failures,calls,source_points,provider_result').eq('job_id',jobId).maybeSingle(),
    db.rpc('map_r1_has_exact',{p_id:jobId}),
  ])
  if (e1||e2||e3||e4) throw new Error('location_storage_unavailable')
  if (!job) return 'missing'
  const verdict = locationVerdict({
    hasExact: exact === true,
    state: st ? {state:st.state, failures:st.failures, calls:st.calls, kind:canonicalVerdictKind(st)} : null,
    texts: [job.location, ...(wl ?? []).flatMap((w) => [w.raw_address, w.industrial_park])],
    sourceText: job.source_text,
  })
  if (verdict === 'located') { const {error} = await db.rpc('map_r1_mark_located',{p_id:jobId}); if (error) throw new Error('mark_failed') }
  if (verdict === 'our_miss') { const {error} = await db.rpc('map_r1_mark_unlocated',{p_id:jobId,p_reason:'our_miss'}); if (error) throw new Error('mark_failed') }
  // Lee 2026-10-28 (수집 입구 결정 ①): 위치 판정은 공고를 지우지 않는다. 원문에 성/시 이름뿐이어도
  // 공고는 그대로 두고, 핀은 canonical writer의 성/시 대략 위치 + chưa xác minh로 남는다.
  // (map_r1_delete_no_info는 더 이상 부르지 않는다.)
  return verdict
}

/** 중복 판정(Lee 2026-11-07 4단계): 위치가 정해진 뒤 회사 코드를 붙이고(job_identity_attach) DB 판정(job_duplicate_check)을 부른다.
 * 확실한 중복 → 비공개(버림), 애매 → 비공개 + 관리자 게시판, 다르면 그대로. 판정 규칙은 DB 한 곳(20261107070000_job_duplicate_check.sql). */
export async function applyDuplicateVerdict(db, jobId) {
  const { data: job, error } = await db.from('local_jobs')
    .select('id,company,category,subcategory,employer_phone,contact_zalo,duplicate_status').eq('id', jobId).maybeSingle()
  if (error) throw new Error('duplicate_storage_unavailable')
  if (!job) return 'missing'
  const identity = companyIdentity(job)
  if (!identity) return 'no_identity'
  const { error: attachError } = await db.rpc('job_identity_attach', {
    p_job: jobId, p_core: identity.core, p_kind: identity.kind, p_kind_category: identity.kindCategory,
    p_branch: identity.branch, p_name: job.company ?? '', p_phones: identity.phones,
  })
  if (attachError) throw new Error('identity_attach_failed')
  const { data: result, error: checkError } = await db.rpc('job_duplicate_check', { p_job: jobId })
  if (checkError) throw new Error('duplicate_check_failed')
  return result
}

// Display/located evidence comes only from the source-derived projection.
// The retained provider response explains an unsuccessful lookup, never a
// second coordinate authority that can restore a revoked or stale point.
export function canonicalVerdictKind(state) {
  const point = (state.source_points ?? []).find(p =>
    ['exact','gate','area'].includes(p.kind) && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= 8 && p.lat <= 24 && p.lng >= 102 && p.lng <= 110)
  return point?.kind ?? (state.provider_result?.kind === 'unresolved' ? 'unresolved' : null)
}

/** 수집 첫 단계 위치 확인(Lee 2026-11-06). 지도와 같은 resolveAutoLocation·같은 저장 결과(research_artifacts)를 쓴다 —
 * 등록 뒤 위치 찾기(location-hook)는 같은 질문을 저장 결과로 다시 쓰므로 호출이 늘지 않는다. DB에 공고·위치를 쓰지 않는다. */
export async function precheckLocation(db, request, input, goong = null, google = null) {
  // 회사 이름 규정(Lee 2026-11-07): 회사 이름이 없으면 수집하지 않는다(포스터 글자까지 본 뒤). 수수료 받는 소개소도 수집하지 않는다.
  const company = precheckCompany(input)
  if (company.name && !company.agency) company.agency = await phoneSaysAgency(db, company.name, input)
  // 소개소면 실제 근무 공장·공단 열쇠(중복 판정에만, Lee 2026-11-07)
  const workplace_key = company.agency ? readWorkplace(`${input?.source_text ?? ''}\n${input?.poster_text ?? ''}`.slice(0, 40000)) : ''
  const who = { company: company.name, agency: company.agency, company_from: company.from, workplace_key }
  if (!company.name) return { findable: false, kind: 'unresolved', reason: input?.poster_text ? 'no_company' : 'no_company_text', location: '', ...who }
  if (company.agency && company.fee) return { findable: false, kind: 'unresolved', reason: 'agency_fee', location: '', ...who }
  const job = precheckJob(input)
  if (!job) return { findable: false, kind: 'unresolved', reason: 'no_location_text', location: '', ...who }
  let used = 0
  const result = await resolveAutoLocation(job, resolverDeps(db, async (action, params) => request(action, params), {
    remainingCalls: 2, reserve: async () => used++ < 2,
  }, goong, google))
  // location: 확인에 쓴 위치 글자(원문에서 읽은 주소 + 지역). 수집기는 이 글자를 공고 위치로 저장한다(주소를 따로 읽지 않음).
  return { ...precheckVerdict(result), location: job.location, ...who }
}

/** 전화번호 기록으로 소개소 보기(Lee 2026-11-07 5번 B, 읽기만). 조회 실패는 소개소 아님으로 둔다(등록을 막지 않음). */
async function phoneSaysAgency(db, name, input) {
  const phones = phoneKeys(String(input?.source_text ?? '').slice(0, 20000), String(input?.poster_text ?? '').slice(0, 20000)).slice(0, 5)
  if (!phones.length || !db?.from) return false
  try {
    const { data, error } = await db.from('job_company_phones').select('phone, job_companies(core)').in('phone', phones)
    if (error || !Array.isArray(data)) return false
    return agencyByPhone(name, data.map((r) => ({ core: r?.job_companies?.core ?? null })))
  } catch { return false }
}

/** 원문 주소 읽기만(외부 지도 조회 없음). 이미 올라간 공고 다시 수집이 같은 기준으로 위치 글자를 받는다. */
export function readLocationOnly(input) {
  const c = precheckCompany(input || {})
  return { location: precheckLocationText(input || {}, false), company: c.name, agency: c.agency, fee: c.fee,
    workplace_key: c.agency ? readWorkplace(`${input?.source_text ?? ''}\n${input?.poster_text ?? ''}`.slice(0, 40000)) : '' }
}

function resolverDeps(db, request, extra, goong, google) {
  return {
    async withinAdministrativeArea(addresses, point) {
      const area=administrativeAreaForTarget(addresses[0],addresses[1]||'')
      return !!area && areaContains(area,point)
    },
    async administrativeCenter(addresses) {
      const area=administrativeAreaForTarget(addresses[0],addresses[1]||'')
      return area ? {lat:area.lat,lng:area.lng,source:`Original administrative area ${area.key}`,checkedAt:new Date().toISOString()} : null
    },
    async cached(key) {
      const name = createHash('sha256').update(key).digest('hex')
      const {data,error} = await db.from('research_artifacts').select('payload').eq('kind','map-r1-query').eq('name',name).maybeSingle()
      if (error) throw new Error('cache_unavailable')
      return data?.payload?.data ?? null
    },
    async cache(key,data) {
      const name = createHash('sha256').update(key).digest('hex')
      const {error} = await db.from('research_artifacts').upsert({kind:'map-r1-query',name,payload:{data},meta:{}},{onConflict:'kind,name'})
      if (error) throw new Error('cache_unavailable')
    },
    async wardCenter(unit) {
      const {data,error} = await db.from('research_artifacts').select('payload').eq('kind','autolocate').eq('name','ward_centers').maybeSingle()
      if (error) return null
      const e = findWardCenter(data?.payload ?? null, unit.key)
      return e && typeof e.lat==='number' && typeof e.lng==='number' ? {lat:e.lat,lng:e.lng,at:e.at||''} : null
    },
    request,
    ...(goong ? { goong } : {}),
    ...(google ? { google } : {}),
    ...extra,
  }
}

async function runClaimed(db, request, claim, goong = null, google = null) {
  const lease = randomUUID()
  const rpc = async (name, args) => {
    const { data, error } = await db.rpc(name, args)
    if (error) throw new Error('location_storage_unavailable')
    return data
  }
  const claimed = await claim(rpc, lease)
  const summary = {processed:0,exact:0,representative:0,unresolved:0,apiCalls:0,failed:0,deferred:0}
  for (const row of claimed ?? []) {
    let calls = 0
    try {
      const result = await resolveAutoLocation(row.snapshot, resolverDeps(db, async (action,params) => { calls++; return request(action,params) }, {
        remainingCalls: Math.max(0,2-row.calls),
        reserve: () => rpc('map_r1_reserve_call',{p_id:row.job_id,p_lease:lease}),
      }, goong, google))
      const saved = await rpc('map_r1_complete',{p_id:row.job_id,p_lease:lease,p_result:result})
      if (!saved) { summary.failed++; continue }
      summary.processed++
      if (result.kind==='exact') summary.exact++
      else if (result.kind==='unresolved') summary.unresolved++
      else summary.representative++
      if (result.failed) summary.failed++
      if (result.deferred) summary.deferred++
    } catch { summary.failed++ }
    finally { summary.apiCalls += calls }
  }
  return summary
}
export function vietmapRequest(key) {
  return async (action, params) => {
    const query = new URLSearchParams({...params,apikey:key, ...(action==='search'?{display_type:'1'}:{})})
    const res = await fetch(`https://maps.vietmap.vn/api/${action}/v4?${query}`,{signal:AbortSignal.timeout(15000)})
    if (!res.ok) throw new Error('upstream_failed') // Never include URLs, keys, addresses or response bodies in logs.
    return res.json()
  }
}

/** 두 번째 지도 자료 Goong(Lee 2026-10-29). 키는 Vercel 환경변수 GOONG_API_KEY에만. 로그에 주소·키·응답을 쓰지 않는다. */
export function goongRequest(key) {
  const paths = { geocode: 'geocode', autocomplete: 'Place/AutoComplete', detail: 'Place/Detail' }
  return async (action, params) => {
    const path = paths[action]
    if (!path) throw new Error('upstream_failed')
    const query = new URLSearchParams({ ...params, ...(action === 'autocomplete' ? { limit: '10' } : {}), api_key: key })
    const res = await fetch(`https://rsapi.goong.io/${path}?${query}`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error('upstream_failed')
    return res.json()
  }
}

/** 외부 API 한 번 부르기 전 월 한도 예약(Lee 2026-11-07). DB(external_api_reserve)가 세고, 한도에 닿거나 DB를 못 물으면 부르지 않는다. */
export function apiReserve(db, api) {
  return async () => {
    const { data, error } = await db.rpc('external_api_reserve', { p_api: api })
    return !error && data === true
  }
}

/** 세 번째 자료 Google Places Text Search(New)(Lee 2026-11-03). 키는 Vercel 환경변수 GOOGLE_PLACES_API_KEY에만. 로그에 주소·키·응답을 쓰지 않는다.
 *  reserve: 월 한도 예약(apiReserve(db,'google_text_search')). 한도에 닿으면 Google을 부르지 않고 실패로 넘긴다(위치는 다음 단계로). */
export function googlePlacesRequest(key, reserve) {
  return async (text) => {
    if (!reserve || !(await reserve())) throw new Error('quota_exhausted')
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      // 기존 지도 키는 사이트 주소로 제한돼 있을 수 있어 우리 사이트 주소를 Referer로 보낸다(Lee 2026-11-03 "구글키는 있어").
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, Referer: 'https://viecganban.vn/', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType' },
      body: JSON.stringify({ textQuery: text, languageCode: 'vi', regionCode: 'VN', pageSize: 10 }),
    })
    if (!res.ok) throw new Error('upstream_failed')
    return res.json()
  }
}

/** 사진 없는 공고의 회사 로고 찾기(Lee 2026-11-07). 위치 확인이 저장한 Google 결과에서 같은 회사 1곳의 장소 번호를 꺼내
 *  웹사이트만 한 번 묻는다(월 한도 google_place_website). 결과는 job_logo_lookup_record 한 곳으로 기록한다.
 *  돌려주는 값: done(이미 기록) / has_logo(브랜드·공고 사진 있음) / found / none / excluded / no_place / quota. */
export async function applyLogoLookup(db, jobId, googleKey, fetchImpl = fetch) {
  const { data: job, error } = await db.from('local_jobs').select('id,company,title,image_url,images,logo_lookup').eq('id', jobId).maybeSingle()
  if (error) throw new Error('logo_storage_unavailable')
  if (!job) return 'missing'
  if (job.logo_lookup) return 'done'
  const { data: brandRows, error: be } = await db.from('job_brands').select('id,name,slug,category,domain,logo_url,initial,color,active,featured').eq('active', true)
  const { data: aliasRows, error: ae } = await db.from('job_brand_aliases').select('brand_id,alias,is_primary').eq('active', true)
  if (be || ae) throw new Error('logo_storage_unavailable')
  const images = Array.isArray(job.images) ? job.images.map((x) => (typeof x === 'string' ? x : x?.url ?? x?.path ?? '')).filter(Boolean) : []
  if (!needsLogoLookup({ company: job.company ?? '', title: job.title ?? '', imageUrl: job.image_url ?? undefined, images }, assembleBrands(brandRows ?? [], aliasRows ?? []))) return 'has_logo'
  const record = async (result, domain = null, placeId = null) => {
    const { data, error: re } = await db.rpc('job_logo_lookup_record', { p_job: jobId, p_result: result, p_domain: domain, p_place_id: placeId })
    if (re) throw new Error('logo_record_failed')
    return data
  }
  const { data: st, error: se } = await db.from('map_r1_location_jobs').select('snapshot').eq('job_id', jobId).maybeSingle()
  if (se) throw new Error('logo_storage_unavailable')
  const snap = st?.snapshot ?? {}
  const resolverJob = { id: jobId, company: String(snap.company ?? job.company ?? ''), location: String(snap.location ?? ''),
    targets: (Array.isArray(snap.targets) ? snap.targets : []).map((t) => ({ address: String(t?.address ?? ''), workLocationId: null })) }
  const deps = resolverDeps(db, null, {}, null, null)
  const placeId = await cachedGooglePlaceId(resolverJob, (k) => deps.cached(k), (a, p) => deps.withinAdministrativeArea(a, p))
  if (!placeId) return record('no_place')
  const cacheKey = JSON.stringify(['place-website-v1', placeId])
  let site = await deps.cached(cacheKey)
  if (site === null) {
    if (!googleKey || !(await apiReserve(db, 'google_place_website')())) return record('quota', null, placeId)
    const res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      signal: AbortSignal.timeout(15000),
      headers: { 'X-Goog-Api-Key': googleKey, Referer: 'https://viecganban.vn/', 'X-Goog-FieldMask': 'websiteUri' },
    })
    if (!res.ok) throw new Error('upstream_failed')
    site = { websiteUri: (await res.json())?.websiteUri ?? null }
    await deps.cache(cacheKey, site)
  }
  const domain = websiteDomain(site?.websiteUri)
  if (!domain) return record('none', null, placeId)
  // 사이트 아이콘이 없는 도메인(기본 지구본 그림)은 로고로 쓰지 않는다.
  const icon = await fetchImpl(`https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`, { signal: AbortSignal.timeout(10000) }).catch(() => null)
  if (!icon || icon.status !== 200) return record('none', null, placeId)
  return record('found', domain, placeId)
}
