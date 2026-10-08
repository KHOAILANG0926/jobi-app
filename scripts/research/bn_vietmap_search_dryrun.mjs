// chotot 100건 근무 회사 → VietMap Search v4 / Place v4 좌표 후보 dry-run (DB 쓰기 없음).
// 키: 이 PC에 없다. 서버 API(api/admin-vietmap, Vercel 환경변수 VIETMAP_SERVICE_KEY)가 호출하고 하루 250회를 센다.
// 입력·캐시·결과: PC 파일(out/)이 아니라 Supabase 비공개 테이블(research_artifacts, kind=bn_research)에서 읽고 쓴다.
//   (처음 한 번 `node scripts/research/migrate_out_to_private_store.mjs`로 기존 out/ 파일을 올린다)
// 인증: 관리자 로그인(터미널 입력, 저장 안 함) 또는 ADMIN_ACCESS_TOKEN 환경변수.
// 한도: 서버가 429(daily_limit)를 돌려주면 중단 — 내일 같은 명령으로 이어서 실행(응답은 비공개 캐시에 남아 같은 질의는 다시 부르지 않는다).
// 호출 수 줄이기: 같은 (회사명, 시/군·구) 질의는 한 번만. Place는 이름 유사도 ≥0.5 인 상위 2건만.
// 실행: node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_vietmap_search_dryrun.mjs [--dry-plan]
import { loadArtifact, saveArtifact, vietmapCall } from './lib/privateStore.mjs'
import { nameSimilarity, companyTokens, normalizePlaceText, MIN_NAME_SIMILARITY, addressMatch } from '../../src/lib/locationCandidateMatch.ts'
import { INDUSTRIAL_PARK_OUTLINES } from '../../src/data/industrialParkOutlines.ts'
import { INDUSTRIAL_PARKS } from '../../src/data/industrialParks.ts'

const KIND = 'bn_research'
const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true'] }))
const J = async name => { const v = await loadArtifact(KIND, name); if (v == null) throw new Error(`비공개 저장소에 ${name} 없음 — migrate_out_to_private_store.mjs를 먼저 실행하세요`); return v }
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)

const jobs = await J('chotot_jobs.json'), geo = await J('chotot_geo.json'), plan = await J('poi_plan2.json'), tiles = await J('chotot_poi_candidates.json')
const planBy = Object.fromEntries(plan.perJob.map(p => [p.jid, p])), tileBy = Object.fromEntries(tiles.map(r => [r.jid, r]))
const cache = (await loadArtifact(KIND, 'vietmap_search_cache.json')) ?? {}
let serverUsed = null, unsaved = 0
const save = async () => { await saveArtifact(KIND, 'vietmap_search_cache.json', cache, { entries: Object.keys(cache).length, day: today }); unsaved = 0 }

const R = 6371000, rad = d => d * Math.PI / 180
const dist = (a, b, c, d) => { const x = rad(c - a), y = rad(d - b); const h = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
const inRing = (lng, lat, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins } return ins }
const parkById = Object.fromEntries(INDUSTRIAL_PARKS.map(p => [p.id, p]))

class BudgetStop extends Error {}
// 캐시 키는 예전 로컬 캐시와 같은 형식(kind|url|params)이라, 기존 out/vietmap_search_cache.json을 올리면 그대로 재사용된다.
async function call(kind, url, params) {
  const ck = kind + '|' + url + '|' + JSON.stringify(params)
  if (cache[ck]) return cache[ck]
  const body = kind === 'search'
    ? { action: 'search', text: params.text, ...(params.focus ? { focus: { lat: Number(params.focus.split(',')[0]), lng: Number(params.focus.split(',')[1]) } } : {}) }
    : { action: 'place', refId: params.refid }
  let r
  for (let attempt = 0; attempt < 2; attempt++) { // 일시적 연결 오류는 1회만 재시도(재시도도 서버가 호출 수에 포함)
    try { r = await vietmapCall(body); break } catch (e) {
      if (e.code === 'DAILY_LIMIT') { await save(); throw new BudgetStop(`서버 하루 상한 도달(오늘 ${e.used}회)`) }
      if (attempt === 1) { await save(); throw e }
      await new Promise(res => setTimeout(res, 1500))
    }
  }
  serverUsed = r.used
  cache[ck] = r.data
  if (++unsaved >= 10) await save()
  await new Promise(res => setTimeout(res, 400)) // 천천히
  return cache[ck]
}

// 회사 단위 질의 목록(중복 제거)
const queries = new Map()
for (const j of jobs) {
  if (!j.work) continue
  const g = geo[j.ad], p = planBy[j.jid]
  const district = (j.addr.split(',').map(s => s.trim()).filter(Boolean).slice(-3).join(', ')) // 구·xã 수준만(번지 제외)
  const key = normalizePlaceText(j.work) + '|' + normalizePlaceText(district)
  if (!queries.has(key)) queries.set(key, { company: j.work, district, jobs: [], focus: null })
  const q = queries.get(key); q.jobs.push(j)
  if (!q.focus) q.focus = p.center ?? (p.park ? [parkById[p.park].lat, parkById[p.park].lng] : null) ?? ((+g.lat > 20.95 && +g.lat < 21.35 && +g.lng > 105.85 && +g.lng < 106.45) ? [+g.lat, +g.lng] : null)
}
console.log(`검색 대상 회사·지역 ${queries.size}건(공고 ${jobs.filter(j => j.work).length}건), 서버 상한 250회/일, 최대 예상 호출 ${queries.size}~${queries.size * 3}회`)
if (args.has('dry-plan')) process.exit(0)

const found = {}
let stopped = ''
try {
  for (const [key, q] of queries) {
    const params = { text: `${q.company} ${q.district}`.trim(), display_type: '1', layers: 'POI' }
    if (q.focus) params.focus = `${q.focus[0]},${q.focus[1]}`
    const hits = await call('search', 'https://maps.vietmap.vn/api/search/v4', params)
    const named = (Array.isArray(hits) ? hits : []).filter(h => h.ref_id && h.name && nameSimilarity(q.company, h.name) >= MIN_NAME_SIMILARITY).slice(0, 2)
    found[key] = { hits: Array.isArray(hits) ? hits.length : 0, places: [] }
    for (const h of named) {
      const p = await call('place', 'https://maps.vietmap.vn/api/place/v4', { refid: h.ref_id })
      if (typeof p.lat === 'number' && typeof p.lng === 'number') found[key].places.push({ name: p.name || h.name, address: p.display || p.address || h.address || '', lat: p.lat, lng: p.lng, refId: h.ref_id, units: { ward: p.ward, district: p.district, province: p.city } })
    }
  }
} catch (e) { stopped = e instanceof BudgetStop ? e.message : `오류 중단: ${e.message}` }
await save()

// 판정: 타일 dry-run과 같은 기준(이름 정확 일치 + 공단 윤곽 안 | 광고 대략 위치 1.5 km 이내 + 후보 1곳)
const ckTokens = n => companyTokens(n).filter(t => !['bac', 'ninh', 'kcn', 'khu', 'nghiep', 'cong', 'nha', 'may', 'xuong', 'kho'].includes(t))
const rows = []
for (const j of jobs) {
  const row = { jid: j.jid, company: j.work, status: '없음', reason: '', cand: null }
  if (!j.work) { row.reason = '근무 회사 없음(대행사 게시)'; rows.push(row); continue }
  const key = normalizePlaceText(j.work) + '|' + normalizePlaceText(j.addr.split(',').map(s => s.trim()).filter(Boolean).slice(-3).join(', '))
  const f = found[key]
  if (!f) { row.reason = stopped ? '미조회(예산 소진·중단)' : '질의 없음'; row.status = '미조회'; rows.push(row); continue }
  const p = planBy[j.jid], park = p.park ? parkById[p.park] : null, ring = park ? INDUSTRIAL_PARK_OUTLINES[park.source.ref]?.ring : null
  const center = p.center ?? (park ? [park.lat, park.lng] : null)
  const scored = f.places.map(pl => {
    const exact = ckTokens(j.work).length > 0 && ckTokens(j.work).join(' ') === ckTokens(pl.name).join(' ')
    const inside = !!(ring && inRing(pl.lng, pl.lat, ring)), d = center ? Math.round(dist(pl.lat, pl.lng, center[0], center[1])) : null
    return { ...pl, exact, inside, d, sim: +nameSimilarity(j.work, pl.name).toFixed(2), addr: addressMatch(j.addr, pl.units).result }
  }).sort((a, b) => (b.exact - a.exact) || (b.sim - a.sim) || ((a.d ?? 1e9) - (b.d ?? 1e9)))
  row.cand = scored[0] ?? null
  const ok = scored.filter(s => s.exact && (ring ? s.inside : (s.d !== null && s.d <= 1500)) && s.addr !== 'mismatch')
  if (ok.length === 1) { row.status = '자동 승인 후보'; row.reason = '이름 정확 일치 + 위치 일치 1곳' }
  else if (scored.length) { row.status = '검토 필요'; row.reason = ok.length > 1 ? `정확 일치 ${ok.length}곳(지점 여럿)` : '이름이 비슷하거나 위치 조건 불충족' }
  else row.reason = f.hits ? '검색 결과는 있으나 이름 유사 POI 없음' : '검색 결과 없음'
  rows.push(row)
}
const cnt = r => rows.filter(x => x.status === r).length
const cmp = { 둘다자동: 0, 새로자동: 0, 타일자동만: 0, 둘다검토이상: 0, 새로생김: 0, 새로사라짐: 0 }
for (const r of rows) { const t = tileBy[r.jid]?.status ?? '없음'; if (r.status === '자동 승인 후보' && t === '자동 승인 후보') cmp.둘다자동++; else if (r.status === '자동 승인 후보') cmp.새로자동++; else if (t === '자동 승인 후보') cmp.타일자동만++; else if (r.status === '검토 필요' && t === '검토 필요') cmp.둘다검토이상++; else if (r.status === '검토 필요' && t === '없음') cmp.새로생김++; else if (r.status === '없음' && t === '검토 필요') cmp.새로사라짐++ }
const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
const head = ['local_jobs ID', '근무 회사', 'Search 상태', '사유', '후보 이름', '후보 refId', '위도', '경도', '이름 유사도', '정확 일치', '공단 안', '거리(m)', '주소 일치', '타일 dry-run 상태']
await saveArtifact(KIND, 'chotot_vietmap_search_candidates.csv', { text: '\ufeff' + [head.join(','), ...rows.map(r => [r.jid, r.company, r.status, r.reason, r.cand?.name, r.cand?.refId, r.cand?.lat, r.cand?.lng, r.cand?.sim, r.cand?.exact ? 'Y' : '', r.cand?.inside ? 'Y' : '', r.cand?.d, r.cand?.addr, tileBy[r.jid]?.status].map(esc).join(','))].join('\r\n') }, { rows: rows.length, day: today })
console.log(JSON.stringify({ 자동: cnt('자동 승인 후보'), 검토: cnt('검토 필요'), 없음: cnt('없음'), 미조회: cnt('미조회'), 서버오늘호출: serverUsed, 비교: cmp, 중단: stopped || null }))
