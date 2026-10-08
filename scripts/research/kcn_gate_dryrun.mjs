// 박닌 주요 KCN 정문 좌표 dry-run — 출처 있는 것만(OSM gate·entrance node, KCN 관리사무소 POI). DB 쓰기 없음.
//   node scripts/research/kcn_gate_dryrun.mjs [--save-private]
// 출력은 stdout(JSON 요약)뿐이다. PC에 파일을 만들지 않는다. --save-private면 비공개 저장소(research_artifacts)에 저장(관리자 로그인 필요).
// 후보 등급(출처 id 필수):
//   A  공단 면(way)에 점으로 붙은(way 멤버) 태그 있는 node — barrier=gate|lift_gate|entrance 또는 entrance=*  (CLAUDE.md ① 기준)
//   B  공단 윤곽선에서 30 m 이내 barrier/entrance node (way 멤버는 아님 — 위성 확인 필수)
//   C  이름이 Cổng/Gate/Ban quản lý 로 시작하고 KCN 이 들어간 OSM 개체가 윤곽선 100 m 이내(셔틀 정류장·가게 등 일반 이름은 제외)
// 공장별 게이트·주거지 입구가 섞일 수 있어 A/B/C는 "후보"일 뿐이다 — 위성(VietMap Hybrid)으로 공단 정문이 맞는지 확인한 뒤에만 industrialParks.ts destination에 넣는다.
// VietMap POI/Search 출처는 서버 API(/api/admin-vietmap, 하루 250회)로만 — 이 스크립트는 호출하지 않는다.
import { distanceMeters } from '../../src/lib/locationCandidateMatch.ts'

const UA = 'viecganban-research/1.0 (internal dry-run; contact support@viecganban.vn)'
const BBOX = '20.95,105.85,21.45,106.5' // 박닌(+2025 통합된 박장) 일대
const OVERPASS = ['https://overpass-api.de/api/interpreter']

async function overpass(query) {
  let lastErr
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const url of OVERPASS) {
      try {
        const res = await fetch(`${url}?data=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(200_000) })
        const text = await res.text()
        if (res.ok && text.startsWith('{')) return JSON.parse(text)
        lastErr = `HTTP ${res.status} ${text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 120)}`
      } catch (e) { lastErr = String(e.cause?.code ?? e.message) }
      console.error(`[overpass] ${new URL(url).host}: ${lastErr}`)
    }
    await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)))
  }
  throw new Error(`Overpass 실패: ${lastErr}`)
}

const parksQ = `[out:json][timeout:180];way["landuse"="industrial"]["name"~"KCN|Khu c.ng nghi.p|Khu ch. xu.t|C.m c.ng nghi.p",i](${BBOX});out tags geom;`
const parks = (await overpass(parksQ)).elements.filter((e) => e.geometry?.length > 3)

const memberQ = `[out:json][timeout:180];way["landuse"="industrial"]["name"~"KCN|Khu c.ng nghi.p|Khu ch. xu.t|C.m c.ng nghi.p",i](${BBOX})->.p;(node(w.p)["barrier"~"^(gate|lift_gate|entrance|toll_booth)$"];node(w.p)["entrance"];);out tags;`
const members = (await overpass(memberQ)).elements

const nearQ = `[out:json][timeout:180];(node["barrier"~"^(gate|lift_gate|toll_booth)$"](${BBOX});node["entrance"](${BBOX}););out;`
const nearNodes = (await overpass(nearQ)).elements

const namedQ = `[out:json][timeout:180];nwr["name"~"^(C.ng |Gate |Ban qu.n l.)",i]["name"~"KCN|Khu c.ng nghi.p|Khu ch. xu.t",i](${BBOX});out tags center;`
const named = (await overpass(namedQ)).elements

// 점 → 윤곽선(링) 최단거리(m). 지역이 작아 평면 근사.
function distToRing(lat, lng, ring) {
  const k = Math.cos((lat * Math.PI) / 180), toXY = (p) => [(p.lon - lng) * 111320 * k, (p.lat - lat) * 110540]
  let best = Infinity
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = toXY(ring[i]), [bx, by] = toXY(ring[i + 1])
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

// 박닌(2025 박장 통합 포함) 주요 KCN — 이름으로 거른다. 그 밖(CCN·타 성)은 참고용 'other'로만 센다.
const MAIN = /VSIP B.c Ninh|Qu. V. |Qu. V.$|Qu. V. (I|II|III)|Yên Phong|Y.n Phong|Ti.n S.n|Đ.i Đ.ng|Hanaka|Nam S.n|Thu.n Th.nh|Gia B.nh|Quang Ch.u|V.n Trung|Đ.nh Tr.m|Vi.t H.n/i
const memberIds = new Set(members.map((n) => n.id))
const result = []
for (const park of parks) {
  const wayIds = new Set(park.nodes ?? [])
  const mine = { parkRef: `way/${park.id}`, parkName: park.tags.name, main: MAIN.test(park.tags.name) && !/^C.m/i.test(park.tags.name), A: [], B: [], C: [] }
  for (const n of members) if (wayIds.has(n.id)) mine.A.push({ ref: `node/${n.id}`, tags: pickTags(n.tags) })
  // geometry 순서와 nodes 순서가 같다 — 멤버 node 좌표는 geometry에서 찾는다
  const coordById = new Map((park.nodes ?? []).map((id, i) => [id, park.geometry[i]]))
  for (const a of mine.A) { const c = coordById.get(Number(a.ref.slice(5))); if (c) { a.lat = c.lat; a.lng = c.lon } }
  for (const n of nearNodes) {
    if (wayIds.has(n.id)) continue
    const lat = n.lat, lng = n.lon
    if (lat < park.bounds.minlat - 0.001 || lat > park.bounds.maxlat + 0.001 || lng < park.bounds.minlon - 0.001 || lng > park.bounds.maxlon + 0.001) continue
    const d = distToRing(lat, lng, park.geometry)
    if (d <= 30) mine.B.push({ ref: `node/${n.id}`, lat, lng, distM: Math.round(d), tags: pickTags(n.tags) })
  }
  for (const e of named) {
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon
    if (lat == null) continue
    if (lat < park.bounds.minlat - 0.002 || lat > park.bounds.maxlat + 0.002 || lng < park.bounds.minlon - 0.002 || lng > park.bounds.maxlon + 0.002) continue
    const d = distToRing(lat, lng, park.geometry)
    if (d <= 100) mine.C.push({ ref: `${e.type}/${e.id}`, lat, lng, distM: Math.round(d), name: e.tags.name })
  }
  result.push(mine)
}
function pickTags(t) { const o = {}; for (const k of ['barrier', 'entrance', 'name', 'access', 'operator']) if (t?.[k]) o[k] = t[k]; return o }

const cnt = (k) => result.filter((r) => r.main && r[k].length).length
const summary = {
  checkedAt: new Date().toISOString().slice(0, 10), bbox: BBOX, source: 'OpenStreetMap Overpass (ODbL)', db쓰기: '없음',
  parks: result.length,
  mainParks: result.filter((r) => r.main).length,
  main후보: { A: cnt('A'), B: cnt('B'), C: cnt('C'), 하나라도: result.filter((r) => r.main && (r.A.length || r.B.length || r.C.length)).length },
  전체후보: { A: result.filter((r) => r.A.length).length, B: result.filter((r) => r.B.length).length, C: result.filter((r) => r.C.length).length },
  vietmapPoi: '미조회 — 서버 키(Vercel)·관리자 API 필요', 위성확인: '후보별로 별도 수행',
}
const out = { summary, parks: result.sort((a, b) => (b.A.length - a.A.length) || a.parkName.localeCompare(b.parkName)) }
console.log(JSON.stringify(out))
if (process.argv.includes('--save-private')) {
  const { saveArtifact } = await import('./lib/privateStore.mjs')
  await saveArtifact('bn_research', `kcn_gate_dryrun_${summary.checkedAt}.json`, out, { parks: summary.parks })
  console.error('비공개 저장소에 저장함')
}
