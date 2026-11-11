// #560 시험(Lee 2026-11-09 승인 "200건 시험 수집과 기존 방식·새 4단계 방식 비교"). 시험 전용 — 운영 공고·DB에 아무것도 쓰지 않는다.
// 입력: Facebook 미리 보기(저장 없음) 결과 파일들. 공고마다 위치 확인을 두 번 돌려 비교한다.
//   A(현재 방식): Google Text Search Pro 1번 → 같은 이름 규칙(pickCompanyPlace) → VietMap·Goong
//   B(4단계):     ① 시험 안 장부(앞에서 확정한 Place ID) ② Text Search IDs Only(무료)로 장부 대조
//                 ③ Autocomplete(후보 이름) → 같은 이름 규칙이 1곳을 고르면 Place Details Essentials(주소·좌표)
//                 ④ ③이 못 고르면 현재 방식(Pro) — A와 같은 검색어라 A가 받은 응답을 그대로 쓴다(시험에서 추가 호출 없음)
// 판정 규칙은 둘 다 운영과 같은 함수(resolveAutoLocation·precheckVerdict). 다른 점은 Google 후보를 어떻게 받느냐뿐.
// 캐시는 메모리만(운영 research_artifacts를 읽지도 쓰지도 않는다). 동 중심 캐시도 쓰지 않는다(공개 여부 판정에 영향 없음).
// 로그(공개 저장소)에는 건수만. 공고별 내용은 결과 파일(1일 보관 비공개 artifact)에만. 키·응답 본문은 출력하지 않는다.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolveAutoLocation } from '../../src/lib/autoLocationResolver.ts'
import { administrativeAreaForTarget, withinOriginalProvince } from '../../src/lib/administrativeArea.ts'
import { precheckCompany, precheckJob, precheckVerdict } from '../../src/lib/locationPrecheck.ts'
import { googlePlaceHits, pickCompanyPlace, sameCoreName } from '../../src/lib/companyPlaceSearch.ts'
import { normalizePlaceText } from '../../src/lib/locationCandidateMatch.ts'
import { vietmapRequest, goongRequest } from '../../api/_lib/auto-location-runtime.mjs'

// 1,000건당 USD(공식 가격표 첫 유료 구간, 2026-11-09 확인) ÷ 1000. 무료 한도는 집계에서 따로 뺀다.
export const PRICE = { pro: 0.032, ids: 0, autocomplete: 0.00283, details: 0.005 }
export const FREE = { pro: 5000, ids: Infinity, autocomplete: 10000, details: 10000 }
const GOOGLE = 'https://places.googleapis.com/v1'

/** Google Places(New) 호출 묶음. fetchImpl은 시험용으로 바꿔 넣는다. 호출 수를 센다. cap을 넘으면 부르지 않는다.
 *  reservePro: 운영과 같은 월 한도 예약(external_api_reserve('google_text_search')) — 시험 호출도 운영 카운터에 들어간다(Codex #608 P1). */
/*  reserveTest: 시험 몫 예약(external_api_reserve('google_text_search_test'), Lee 2026-11-09 시험·운영 분리). Pro·IDs Only 모두 같은
 *  Google SearchText 한도를 쓰므로 둘 다 시험 몫을 먼저 예약한다. searchCap: 한 번 실행의 SearchText(Pro+IDs) 합계 상한. */
export function googleClient(key, fetchImpl = fetch, cap = { pro: 250, ids: 250, autocomplete: 250, details: 750 }, reservePro = async () => true, reserveTest = async () => true, searchCap = Infinity) {
  const calls = { pro: 0, ids: 0, autocomplete: 0, details: 0 }
  const headers = (mask) => ({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, Referer: 'https://viecganban.vn/', 'X-Goog-FieldMask': mask })
  async function call(sku, url, init) {
    if (calls[sku] >= cap[sku]) throw new Error('test_cap_reached')
    if (sku === 'pro' || sku === 'ids') {
      if (calls.pro + calls.ids >= searchCap) throw new Error('test_cap_reached')
      if (!(await reserveTest())) throw new Error('test_quota_exhausted')
      if (sku === 'pro' && !(await reservePro())) throw new Error('quota_exhausted') // 시험 몫 다음에 운영 몫(헛 예약 없게)
    }
    calls[sku]++
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15000) })
    // 실패 이유는 Google 오류 코드만(예: PERMISSION_DENIED/API_KEY_HTTP_REFERRER_BLOCKED). 메시지 본문·키는 남기지 않는다.
    if (!res.ok) {
      let code = ''
      try { const e = (await res.json())?.error; code = [e?.status, e?.details?.find?.((d) => d?.reason)?.reason].filter(Boolean).join('/') } catch { /* 본문 없음 */ }
      throw new Error(`upstream_failed_${res.status}${code ? `_${code}` : ''}`)
    }
    return res.json()
  }
  const searchBody = (text) => JSON.stringify({ textQuery: text, languageCode: 'vi', regionCode: 'VN', pageSize: 10 })
  return {
    calls,
    // 현재 운영과 같은 요청(auto-location-runtime googlePlacesRequest와 같은 칸)
    pro: async (text) => { return call('pro', `${GOOGLE}/places:searchText`, { method: 'POST', headers: headers('places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType'), body: searchBody(text) }) },
    ids: async (text) => ((await call('ids', `${GOOGLE}/places:searchText`, { method: 'POST', headers: headers('places.id'), body: searchBody(text) }))?.places ?? []).map((p) => String(p.id)),
    autocomplete: async (text) => ((await call('autocomplete', `${GOOGLE}/places:autocomplete`, { method: 'POST', headers: headers('suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat'),
      body: JSON.stringify({ input: text, languageCode: 'vi', includedRegionCodes: ['vn'] }) }))?.suggestions ?? [])
      .map((s) => s.placePrediction).filter((p) => p?.placeId)
      .map((p) => ({ id: String(p.placeId), name: String(p.structuredFormat?.mainText?.text ?? ''), address: String(p.structuredFormat?.secondaryText?.text ?? '') })),
    details: (id) => call('details', `${GOOGLE}/places/${encodeURIComponent(id)}`, { method: 'GET', headers: headers('id,formattedAddress,location') }),
  }
}

/** B 방식의 Google 단계. 반환값은 Text Search 응답 모양({places:[…]}) — 운영 판정 함수가 그대로 읽는다. trace에 어느 단계에서 끝났는지 남긴다. */
export function ladderGoogle({ g, registry, proFor, company, address, trace }) {
  return async (text) => {
    const ids = await g.ids(text)
    trace.idsCount = ids.length
    // 장부 재사용은 같은 사업장일 때만(Codex #608 P2): 같은 이름 장부 후보가 1곳이고, 그 장부의 원문 주소가 지금 공고와 같을 때.
    // 같은 이름 지점이 여럿이거나 주소가 다르면 다음 단계로(다른 지점 좌표를 붙이지 않는다).
    const same = ids.map((id) => registry.get(id)).filter((r) => r && sameCoreName(company, r.place.displayName.text))
    if (same.length === 1 && same[0].siteKey === siteKeyOf(address)) { trace.step = 'registry'; return { places: [same[0].place] } }
    if (same.length) trace.registrySkipped = same.length
    const preds = await g.autocomplete(text)
    trace.acCount = preds.length
    trace.acSame = preds.filter((p) => sameCoreName(company, p.name)).length
    // 같은 이름 규칙을 Autocomplete 후보에 먼저 적용 — 1곳으로 정해질 때만 상세(주소·좌표)를 묻는다. 아니면 현재 방식으로.
    const pick = pickCompanyPlace(company, address, preds)
    if (pick.hit) {
      const d = await g.details(pick.hit.id)
      const lat = d?.location?.latitude, lng = d?.location?.longitude
      if (typeof lat === 'number' && typeof lng === 'number') {
        trace.step = 'autocomplete'
        return { places: [{ id: pick.hit.id, displayName: { text: pick.hit.name }, formattedAddress: String(d.formattedAddress ?? ''), location: { latitude: lat, longitude: lng } }] }
      }
    }
    trace.step = 'pro'
    return proFor(text)
  }
}

/** 사업장 열쇠 = 원문 주소(정규화). 같은 회사라도 주소가 다르면 다른 사업장. */
export const siteKeyOf = (address) => normalizePlaceText(String(address ?? ''))

/** 공개 로그용 가림(Codex #615 P1): 링크·이메일, 그리고 숫자 6개 이상이 글자 아닌 구분자(공백 여러 개·점·대시·괄호 등, 사이 3자 이내)로 이어진 덩어리. */
export function maskContacts(text) {
  return String(text ?? '')
    .replace(/https?:\/\/\S+|\b\S+@\S+\.\S+/g, '[link]')
    .replace(/\d(?:[^\p{L}\d\n]{0,3}\d){5,}/gu, '[số]')
}

function deps({ vietmap, goong, google, shared, prodGoogle }) {
  const own = new Map()
  // VietMap·Goong 응답은 A·B가 같이 쓴다(같은 질문 두 번 안 함). Google 응답은 방식마다 따로.
  const store = (key) => (key.includes('"google"') ? own : shared)
  // FROM_CACHE(Lee 2026-11-11 "7일 뒤 같은 방법이면 무슨 의미야, 지금 원인 찾아"): Google 답은 운영이 저장해 둔 것만 읽는다(새 호출 없음).
  const isGoogle = (key) => key.startsWith('[') && key.includes('"google"')
  return {
    async withinAdministrativeArea(addresses, point) { return withinOriginalProvince(addresses[0], addresses[1] || '', point) },
    async administrativeCenter(addresses) { const a = administrativeAreaForTarget(addresses[0], addresses[1] || ''); return a ? { lat: a.lat, lng: a.lng, source: `Original administrative area ${a.key}`, checkedAt: new Date().toISOString() } : null },
    async cached(key) { if (prodGoogle && isGoogle(key)) return prodGoogle(key); return store(key).get(key) ?? null },
    async cache(key, data) { store(key).set(key, data) },
    async wardCenter() { return null },
    remainingCalls: 2,
    reserve: (() => { let used = 0; return async () => used++ < 2 })(),
    request: vietmap,
    ...(goong ? { goong } : {}),
    google,
  }
}

const placeOf = (decision) => /^Google (\S+) \(company\)$/.exec(String(decision?.source ?? ''))?.[1]
  ?? (/Tìm địa chỉ theo tên công ty/.test(String(decision?.evidence ?? '')) ? `exact:${String(decision?.source ?? '')}` : null)
const why = (decision) => (String(decision?.evidence ?? '').match(/google:[a-z_]+/g) ?? []).join(',')
const meters = (a, b) => {
  const r = 6371000, rad = (d) => d * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  return Math.round(2 * r * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2)))
}

/** 미리 보기 공고 1건 → 수집기가 위치 확인에 보내는 것과 같은 입력(crawler/ingest_gateway.precheck_input). */
export function precheckInputOf(job) {
  const company = job._company_from_text ? '' : String(job.company ?? '')
  const addresses = (Array.isArray(job.work_locations) ? job.work_locations : []).map((w) => String(w?.raw_address ?? '').trim()).filter(Boolean).slice(0, 5)
  return { company, location: String(job.location ?? ''), addresses, source_text: String(job.source_text ?? ''), poster_text: '' }
}

/** 공고 1건을 A·B 두 방식으로. */
export async function compareOne(input, ctx) {
  const company = precheckCompany(input)
  const row = { company: company.name, from: company.from }
  if (!company.name) return { ...row, a: { findable: false, reason: 'no_company_text' }, b: null, same: true }
  if (company.agency && company.fee) return { ...row, a: { findable: false, reason: 'agency_fee' }, b: null, same: true }
  const job = precheckJob(input)
  if (!job) return { ...row, a: { findable: false, reason: 'no_location_text' }, b: null, same: true }
  row.location = job.location
  const address = job.targets[0]?.address ?? job.location
  const proResponses = new Map()
  const traceA = {}
  const googleA = async (text) => {
    try { const r = await ctx.g.pro(text); proResponses.set(text, r); traceA.proCount = googlePlaceHits(r).length; traceA.names = googlePlaceHits(r).slice(0, 4).map((h) => `${h.name} @ ${h.address}`.slice(0, 110)); traceA.proSame = googlePlaceHits(r).filter((h) => sameCoreName(job.company, h.name)).length; return r }
    catch (e) { proResponses.set(text, e); traceA.error = String(e.message).slice(0, 80); throw e }
  }
  const prodGoogle = ctx.fromCache ? async (key) => {
    const r = await ctx.fromCache(key)
    if (r) { const h = googlePlaceHits(r); traceA.cached = true; traceA.proCount = h.length; traceA.proSame = h.filter((x) => sameCoreName(job.company, x.name)).length; traceA.names = h.slice(0, 4).map((x) => `${x.name} @ ${x.address}`.slice(0, 110)) }
    return r
  } : null
  const googleFallback = ctx.fromCache ? async () => { traceA.cached = false; throw new Error('not_in_cache') } : googleA
  const decA = await resolveAutoLocation(job, deps({ ...ctx, google: googleFallback, prodGoogle }))
  if (ctx.fromCache) return { ...row, a: { ...precheckVerdict(decA), place: placeOf(decA), why: why(decA), ...traceA, evidence: String(decA?.evidence ?? '').split('\n').filter((l) => /google:|Cách chọn|mismatch|Không|reason/i.test(l)).slice(0, 4).join(' / ').slice(0, 300) }, b: null, same: true }
  const traceB = {}
  // ④ 현재 방식: A와 같은 검색어면 A가 받은 응답을 그대로(운영에서는 이때 Pro 1번 = 비용에 넣는다)
  const proFor = async (text) => { traceB.proReused = true; const r = proResponses.get(text); if (r instanceof Error) throw r; return r ?? ctx.g.pro(text) }
  const ladder = ladderGoogle({ g: ctx.g, registry: ctx.registry, proFor, company: job.company, address, trace: traceB })
  const googleB = async (text) => { try { return await ladder(text) } catch (e) { traceB.error = String(e.message).slice(0, 80); throw e } }
  let decB
  try { decB = await resolveAutoLocation(job, deps({ ...ctx, google: googleB })) } catch (e) { decB = { kind: 'unresolved', failed: true, evidence: String(e.message) } }
  const a = { ...precheckVerdict(decA), place: placeOf(decA), why: why(decA), ...traceA }
  const b = { ...precheckVerdict(decB), place: placeOf(decB), why: why(decB), ...traceB }
  const pa = 'lat' in decA ? decA : null, pb = 'lat' in decB ? decB : null
  // B가 같은 이름 1곳을 확정하면 시험 안 장부에 넣는다(다음 공고의 ① 단계에서 재사용되는지 보려고).
  const placeId = /^Google (\S+) \(company\)$/.exec(String(decB?.source ?? ''))?.[1]
  if (b.findable && placeId && pb) ctx.registry.set(placeId, { siteKey: siteKeyOf(address), place: { id: placeId, displayName: { text: job.company }, formattedAddress: String(decB.resolvedAddress ?? ''), location: { latitude: pb.lat, longitude: pb.lng } } })
  return { ...row, a, b, same: a.findable === b.findable && a.place === b.place, distanceM: pa && pb ? meters(pa, pb) : null }
}

/** 결과 → 건수·비용 집계(공고 내용 없음). */
export function summarize(rows, calls) {
  const n = rows.length
  const count = (f) => rows.filter(f).length
  const tally = (f) => rows.reduce((m, r) => { const k = f(r); if (k != null) m[k] = (m[k] ?? 0) + 1; return m }, {})
  const companyKeys = rows.filter((r) => r.company).map((r) => `${r.company.toLowerCase()}|${r.location ?? ''}`)
  const repeat = companyKeys.length - new Set(companyKeys).size
  // 운영에서 B를 쓰면: Pro는 ④까지 간 건만, 나머지는 IDs(무료)+Autocomplete+Details.
  const bPro = count((r) => r.b?.step === 'pro')
  const usage = { a: { pro: calls.pro }, b: { ids: calls.ids, autocomplete: calls.autocomplete, details: calls.details, pro: bPro } }
  const per = (u) => Object.entries(u).reduce((s, [k, v]) => s + v * PRICE[k], 0)
  return {
    n, findableA: count((r) => r.a.findable), findableB: count((r) => (r.b ?? r.a).findable),
    disagree: count((r) => !r.same), bOnly: count((r) => r.b?.findable && !r.a.findable), aOnly: count((r) => r.a.findable && r.b && !r.b.findable),
    samePlaceFar: count((r) => r.same && r.distanceM != null && r.distanceM > 50),
    reasonsA: tally((r) => (r.a.findable ? null : r.a.reason)), whyA: tally((r) => (r.a.findable ? null : r.a.why || null)),
    stepB: tally((r) => r.b?.step ?? null), proCandidates: tally((r) => r.a.proCount ?? null), proSameName: tally((r) => r.a.proSame ?? null),
    acSameName: tally((r) => r.b?.acSame ?? null), errors: tally((r) => r.a.error ?? r.b?.error ?? null), companyRepeat: repeat, usage,
    // 시험 건수 기준 1건당 비용(무료 한도 빼기 전). 월 비용 = 건당 × 월 건수 − 무료 한도는 보고서에서 계산.
    perJobUSD: { a: n ? per(usage.a) / n : 0, b: n ? per(usage.b) / n : 0 },
  }
}

function markdown(s) {
  const t = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'
  return [`## #560 위치 확인 시험 (공고 ${s.n}건, 운영 DB 쓰기 없음)`, '',
    `- 찾음: 현재 방식 ${s.findableA} / 4단계 ${s.findableB} — 판정 다름 ${s.disagree} (4단계만 찾음 ${s.bOnly}, 현재만 찾음 ${s.aOnly})`,
    `- 현재 방식 못 찾은 이유: ${t(s.reasonsA)}`, `- Google 단계 세부: ${t(s.whyA)}`,
    `- 4단계가 끝난 단계: ${t(s.stepB)}`, `- Pro 후보 수: ${t(s.proCandidates)}`, `- Pro 같은 이름 수: ${t(s.proSameName)}`, `- Autocomplete 같은 이름 수: ${t(s.acSameName)}`,
    `- Google 오류: ${t(s.errors)}`, `- 같은 회사+지역 반복: ${s.companyRepeat}건`, `- 호출: ${JSON.stringify(s.usage)}`,
    `- 1건당 비용(무료 한도 전): 현재 $${s.perJobUSD.a.toFixed(4)} / 4단계 $${s.perJobUSD.b.toFixed(4)}`].join('\n')
}

// CLI: node … location-ladder-compare.mjs <결과.json> <미리보기1.json> [미리보기2.json …]
if (process.argv[1]?.endsWith('location-ladder-compare.mjs')) {
  const [out, ...files] = process.argv.slice(2)
  const need = (k) => { const v = process.env[k]; if (!v) { console.error(`::error::${k} 없음`); process.exit(1) } return v }
  const seen = new Set(), jobs = []
  for (const f of files) for (const j of JSON.parse(readFileSync(f, 'utf8')).jobs ?? []) {
    const k = j.fb_post_key || j.source_url || j.title
    if (!seen.has(k)) { seen.add(k); jobs.push(j) }
  }
  const limit = Number(process.env.MAX_JOBS || 250)
  // 운영 카운터 예약(서비스 키로 RPC). 한도에 닿으면 Pro를 부르지 않는다 — 운영과 같은 규칙.
  const supa = need('SUPABASE_URL'), sk = need('SUPABASE_SERVICE_ROLE_KEY')
  const reserve = (api) => async () => {
    const r = await fetch(`${supa}/rest/v1/rpc/external_api_reserve`, { method: 'POST', headers: { apikey: sk, Authorization: `Bearer ${sk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_api: api }) })
    return r.ok && (await r.json()) === true
  }
  // 시험 몫(600/월)을 먼저, Pro는 운영 몫에도 센다. 한 번 실행의 SearchText 합계는 TEST_SEARCH_CAP(기본 40)까지 — 운영 몫 보호(Lee 2026-11-09).
  const searchCap = Number(process.env.TEST_SEARCH_CAP || 40)
  const fromCache = process.env.FROM_CACHE === '1'
  const g = fromCache ? { calls: { pro: 0, ids: 0, autocomplete: 0, details: 0 } } : googleClient(need('GOOGLE_PLACES_API_KEY'), fetch, { pro: limit, ids: limit, autocomplete: limit, details: limit * 3 },
    reserve('google_text_search'), reserve('google_text_search_test'), searchCap)
  // 저장된 Google 답 읽기만(운영 위치 확인이 쓰는 research_artifacts map-r1-query, 이름 = 열쇠의 sha256). 쓰지 않는다.
  const readCache = async (key) => {
    const name = createHash('sha256').update(key).digest('hex')
    const r = await fetch(`${supa}/rest/v1/research_artifacts?select=payload&kind=eq.map-r1-query&name=eq.${name}`, { headers: { apikey: sk, Authorization: `Bearer ${sk}` } })
    if (!r.ok) throw new Error(`cache_read_${r.status}`)
    return (await r.json())[0]?.payload?.data ?? null
  }
  const ctx = { g, fromCache: fromCache ? readCache : null, registry: new Map(), shared: new Map(), vietmap: vietmapRequest(need('VIETMAP_SERVICE_KEY')), goong: process.env.GOONG_API_KEY ? goongRequest(process.env.GOONG_API_KEY) : null }
  const rows = []
  // 상한·한도에 닿은 호출은 측정이 아니다 — 그 공고는 집계에서 빼고 거기서 멈춘다(Codex #619 P1).
  const capped = (r) => [r?.a?.error, r?.b?.error].some((m) => /test_cap_reached|test_quota_exhausted|quota_exhausted/.test(String(m ?? '')))
  let stoppedAt = null
  for (const j of jobs.slice(0, limit)) {
    try {
      const row = { key: j.fb_post_key ?? null, title: String(j.title ?? '').slice(0, 120), ...(await compareOne(precheckInputOf(j), ctx)) }
      if (capped(row)) { stoppedAt = rows.length + 1; break }
      rows.push(row)
    }
    catch (e) { rows.push({ key: j.fb_post_key ?? null, title: String(j.title ?? '').slice(0, 120), a: { findable: false, reason: `error:${String(e.message).slice(0, 40)}` }, b: null, same: true }) }
  }
  if (stoppedAt) console.log(`::notice::SearchText 상한·한도에 닿아 ${stoppedAt}번째 공고에서 멈춤 — 그 공고부터는 집계에서 뺌(측정 ${rows.length}건)`)
  // 공고별 한 줄(분석용). 공개 저장소 로그라 원문·전화번호는 넣지 않는다 — 제목·회사·읽은 위치 글자(미리 보기 알림과 같은 수준)와 판정만.
  const cut = (v, n) => String(v ?? '').replace(/[\r\n|]+/g, ' ').slice(0, n)
  const v = (x) => (x ? `${x.findable ? 'O' : 'X'} ${x.reason}${x.why ? ` ${x.why}` : ''}${x.step ? ` step=${x.step}` : ''}${x.proCount != null ? ` pro=${x.proCount}/${x.proSame}` : ''}${x.acCount != null ? ` ac=${x.acCount}/${x.acSame}` : ''}${x.error ? ` err=${x.error}` : ''}${x.cached != null ? ` cache=${x.cached ? 'hit' : 'miss'}` : ''}${x.evidence ? ` ev=${cut(x.evidence, 220)}` : ''}` : '-')
  // Google 후보 이름·주소(업체 정보, 이름 비교 개선용)
  rows.forEach((r, i) => { if (r.a?.names?.length) console.log(`CAND ${i + 1} | ${r.a.names.join(' ;; ')}`) })
  rows.forEach((r, i) => console.log(`ROW ${i + 1} | ${cut(r.title, 60)} | ${cut(r.company, 50)} | ${cut(r.location, 80)} | A: ${v(r.a)} | B: ${v(r.b)} | ${r.same ? 'same' : 'DIFF'}${r.distanceM != null ? ` ${r.distanceM}m` : ''}`))
  // 시험 사례 만들기용(DUMP_TEXT=1): 원문 앞부분을 공고별로. 전화·Zalo 숫자(6자리 이상)와 링크는 가린다.
  if (process.env.DUMP_TEXT === '1') jobs.slice(0, limit).forEach((j, i) => {
    const t = maskContacts(String(j.source_text ?? ''))
    console.log(`TEXT ${i + 1} | ${t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20).join(' ⏎ ').slice(0, 1500)}`)
  })
  const s = summarize(rows, g.calls)
  writeFileSync(out, JSON.stringify({ summary: s, rows }, null, 1))
  const md = markdown(s)
  console.log(md)
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' })
}
