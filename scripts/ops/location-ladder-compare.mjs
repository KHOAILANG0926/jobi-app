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
import { resolveAutoLocation } from '../../src/lib/autoLocationResolver.ts'
import { administrativeAreaForTarget, areaContains } from '../../src/lib/administrativeArea.ts'
import { precheckCompany, precheckJob, precheckVerdict } from '../../src/lib/locationPrecheck.ts'
import { googleSearchText, googlePlaceHits, pickCompanyPlace, sameCoreName } from '../../src/lib/companyPlaceSearch.ts'
import { vietmapRequest, goongRequest } from '../../api/_lib/auto-location-runtime.mjs'

// 1,000건당 USD(공식 가격표 첫 유료 구간, 2026-11-09 확인) ÷ 1000. 무료 한도는 집계에서 따로 뺀다.
export const PRICE = { pro: 0.032, ids: 0, autocomplete: 0.00283, details: 0.005 }
export const FREE = { pro: 5000, ids: Infinity, autocomplete: 10000, details: 10000 }
const GOOGLE = 'https://places.googleapis.com/v1'

/** Google Places(New) 호출 묶음. fetchImpl은 시험용으로 바꿔 넣는다. 호출 수를 센다. cap을 넘으면 부르지 않는다. */
export function googleClient(key, fetchImpl = fetch, cap = { pro: 250, ids: 250, autocomplete: 250, details: 750 }) {
  const calls = { pro: 0, ids: 0, autocomplete: 0, details: 0 }
  const headers = (mask) => ({ 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, Referer: 'https://viecganban.vn/', 'X-Goog-FieldMask': mask })
  async function call(sku, url, init) {
    if (calls[sku] >= cap[sku]) throw new Error('test_cap_reached')
    calls[sku]++
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`upstream_failed_${res.status}`)
    return res.json()
  }
  const searchBody = (text) => JSON.stringify({ textQuery: text, languageCode: 'vi', regionCode: 'VN', pageSize: 10 })
  return {
    calls,
    // 현재 운영과 같은 요청(auto-location-runtime googlePlacesRequest와 같은 칸)
    pro: (text) => call('pro', `${GOOGLE}/places:searchText`, { method: 'POST', headers: headers('places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType'), body: searchBody(text) }),
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
    const known = ids.map((id) => registry.get(id)).find((r) => r && sameCoreName(company, r.place.displayName.text))
    if (known) { trace.step = 'registry'; return { places: [known.place] } }
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

function deps({ vietmap, goong, google, shared }) {
  const own = new Map()
  // VietMap·Goong 응답은 A·B가 같이 쓴다(같은 질문 두 번 안 함). Google 응답은 방식마다 따로.
  const store = (key) => (key.includes('"google"') ? own : shared)
  return {
    async withinAdministrativeArea(addresses, point) { const a = administrativeAreaForTarget(addresses[0], addresses[1] || ''); return !!a && areaContains(a, point) },
    async administrativeCenter(addresses) { const a = administrativeAreaForTarget(addresses[0], addresses[1] || ''); return a ? { lat: a.lat, lng: a.lng, source: `Original administrative area ${a.key}`, checkedAt: new Date().toISOString() } : null },
    async cached(key) { return store(key).get(key) ?? null },
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
    try { const r = await ctx.g.pro(text); proResponses.set(text, r); traceA.proCount = googlePlaceHits(r).length; traceA.proSame = googlePlaceHits(r).filter((h) => sameCoreName(job.company, h.name)).length; return r }
    catch (e) { proResponses.set(text, e); throw e }
  }
  const decA = await resolveAutoLocation(job, deps({ ...ctx, google: googleA }))
  const traceB = {}
  // ④ 현재 방식: A와 같은 검색어면 A가 받은 응답을 그대로(운영에서는 이때 Pro 1번 = 비용에 넣는다)
  const proFor = async (text) => { traceB.proReused = true; const r = proResponses.get(text); if (r instanceof Error) throw r; return r ?? ctx.g.pro(text) }
  const googleB = ladderGoogle({ g: ctx.g, registry: ctx.registry, proFor, company: job.company, address, trace: traceB })
  let decB
  try { decB = await resolveAutoLocation(job, deps({ ...ctx, google: googleB })) } catch (e) { decB = { kind: 'unresolved', failed: true, evidence: String(e.message) } }
  const a = { ...precheckVerdict(decA), place: placeOf(decA), why: why(decA), ...traceA }
  const b = { ...precheckVerdict(decB), place: placeOf(decB), why: why(decB), ...traceB }
  const pa = 'lat' in decA ? decA : null, pb = 'lat' in decB ? decB : null
  // B가 같은 이름 1곳을 확정하면 시험 안 장부에 넣는다(다음 공고의 ① 단계에서 재사용되는지 보려고).
  const placeId = /^Google (\S+) \(company\)$/.exec(String(decB?.source ?? ''))?.[1]
  if (b.findable && placeId && pb) ctx.registry.set(placeId, { place: { id: placeId, displayName: { text: job.company }, formattedAddress: String(decB.resolvedAddress ?? ''), location: { latitude: pb.lat, longitude: pb.lng } } })
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
    acSameName: tally((r) => r.b?.acSame ?? null), companyRepeat: repeat, usage,
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
    `- 같은 회사+지역 반복: ${s.companyRepeat}건`, `- 호출: ${JSON.stringify(s.usage)}`,
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
  const g = googleClient(need('GOOGLE_PLACES_API_KEY'), fetch, { pro: limit, ids: limit, autocomplete: limit, details: limit * 3 })
  const ctx = { g, registry: new Map(), shared: new Map(), vietmap: vietmapRequest(need('VIETMAP_SERVICE_KEY')), goong: process.env.GOONG_API_KEY ? goongRequest(process.env.GOONG_API_KEY) : null }
  const rows = []
  for (const j of jobs.slice(0, limit)) {
    try { rows.push({ key: j.fb_post_key ?? null, title: String(j.title ?? '').slice(0, 120), ...(await compareOne(precheckInputOf(j), ctx)) }) }
    catch (e) { rows.push({ key: j.fb_post_key ?? null, title: String(j.title ?? '').slice(0, 120), a: { findable: false, reason: `error:${String(e.message).slice(0, 40)}` }, b: null, same: true }) }
  }
  const s = summarize(rows, g.calls)
  writeFileSync(out, JSON.stringify({ summary: s, rows }, null, 1))
  const md = markdown(s)
  console.log(md)
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n', { flag: 'a' })
}
