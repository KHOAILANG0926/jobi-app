// chotot 100건 근무 회사 ↔ (VietMap 타일 POI + OSM 이름 있는 공장) 좌표 후보 dry-run. DB 쓰기·외부 요청 없음(모두 out/ 파일 입력).
// 입력: out/chotot_jobs.json, chotot_geo.json(광고 대략 좌표 — 탐색 범위 지정용, 후보 좌표로 쓰지 않음), poi_plan2.json, vm_poi.json, osm_named_industrial.json
// 출력: out/chotot_poi_candidates.csv, out/chotot_poi_candidates.json, 콘솔 요약
// 실행: node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_poi_match.mjs
import fs from 'node:fs'
import { companyTokens, nameSimilarity, normalizePlaceText } from '../../src/lib/locationCandidateMatch.ts'
import { INDUSTRIAL_PARK_OUTLINES } from '../../src/data/industrialParkOutlines.ts'
import { INDUSTRIAL_PARKS } from '../../src/data/industrialParks.ts'

const OUT = 'scripts/research/out/'
const J = f => JSON.parse(fs.readFileSync(OUT + f, 'utf8'))
const jobs = J('chotot_jobs.json'), geo = J('chotot_geo.json'), plan = J('poi_plan2.json'), vm = Object.values(J('vm_poi.json')), osm = J('osm_named_industrial.json')
const planBy = Object.fromEntries(plan.perJob.map(p => [p.jid, p]))

const R = 6371000, rad = d => d * Math.PI / 180
const dist = (a, b, c, d) => { const x = rad(c - a), y = rad(d - b); const h = Math.sin(x / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
const inRing = (lng, lat, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins } return ins }
const parkById = Object.fromEntries(INDUSTRIAL_PARKS.map(p => [p.id, p]))
const ringOf = id => INDUSTRIAL_PARK_OUTLINES[parkById[id].source.ref]?.ring

// 후보 풀: VietMap POI(주로 회사·공장·상점) + OSM 이름 있는 공장
const pool = [
  ...vm.map(p => ({ src: 'vietmap', name: p.n, cls: [p.c, p.s].filter(Boolean).join('/'), lat: p.lat, lng: p.lng })),
  ...osm.map(o => ({ src: 'osm', name: o.name, cls: o.kind, lat: o.lat, lng: o.lng, ref: o.id })),
]
const STOP_EXTRA = new Set(['bac', 'ninh', 'industrial', 'park', 'factory', 'kcn', 'khu', 'nghiep', 'cong', 'nha', 'may', 'xuong', 'kho'])
const keyTokens = n => companyTokens(n).filter(t => !STOP_EXTRA.has(t))
const sameSet = (a, b) => a.length > 0 && a.length === b.length && a.every(t => b.includes(t))

const rows = []
for (const j of jobs) {
  const p = planBy[j.jid], g = geo[j.ad]
  const company = j.work // 대행사 KCN-only 공고는 근무 회사가 없다 → 후보 탐색 안 함
  const row = { jid: j.jid, ad: j.ad, company, poster: j.poster, addr: j.addr, kcn: j.kcn, basis: p.basis.split(':')[0], park: p.park || '', status: '없음', reason: '', cands: [] }
  if (!company) { row.reason = '근무 회사 없음(대행사 게시·KCN 근거만)'; rows.push(row); continue }
  const ckeys = keyTokens(company)
  if (ckeys.length === 0 || ckeys.join('').length < 3) { row.reason = '회사명에서 구별 가능한 단어 없음'; rows.push(row); continue }
  const ring = p.park ? ringOf(p.park) : null
  const center = p.center || (p.park ? [parkById[p.park].lat, parkById[p.park].lng] : null)
  const near = ({ lat, lng }) => {
    if (ring) { if (inRing(lng, lat, ring)) return { ok: true, inside: true, d: 0 }; if (center) { const d = dist(lat, lng, center[0], center[1]); return { ok: d <= 8000, inside: false, d } } return { ok: false } }
    if (!center) return { ok: false }
    const d = dist(lat, lng, center[0], center[1]); return { ok: d <= 8000, inside: false, d }
  }
  const seen = new Set()
  for (const c of pool) {
    const loc = near(c); if (!loc.ok) continue
    const pk = keyTokens(c.name); if (pk.length === 0) continue
    const exact = sameSet(ckeys, pk) || normalizePlaceText(company) === normalizePlaceText(c.name)
    const sim = nameSimilarity(company, c.name)
    const sub = pk.every(t => ckeys.includes(t)) && pk.join('').length >= 4  // POI 이름이 회사명의 일부(예: 'Getac' ⊂ 'Getac Technology')
    const cont = !exact && ckeys.length > 0 && ckeys.every(t => pk.includes(t)) && ckeys.join('').length >= 5  // 회사명이 POI 이름에 통째로 들어 있음(예: GOERTEK ⊂ 'Công ty … Goertek Vina')
    if (!exact && !cont && !(sim >= 0.5 && loc.d <= 2500) && !(sub && loc.d <= 2500)) continue
    const key = c.name + '|' + c.lat.toFixed(4) + '|' + c.lng.toFixed(4); if (seen.has(key)) continue; seen.add(key)
    row.cands.push({ ...c, exact, cont, sim: +sim.toFixed(2), sub, inside: !!loc.inside, d: Math.round(loc.d ?? 0) })
  }
  row.cands.sort((a, b) => (b.exact - a.exact) || (b.cont - a.cont) || (b.sim - a.sim) || (a.d - b.d))
  const ex = row.cands.filter(c => c.exact)
  const exLoc = ex.filter(c => ring ? c.inside : c.d <= (p.basis === 'ad-coord' ? 1500 : 2500))
  if (exLoc.length === 1) { row.status = '자동 승인 후보'; row.reason = ring ? '이름 정확 일치 + 공단 윤곽 안 1곳' : `이름 정확 일치 + 광고 대략 위치 ${exLoc[0].d} m 이내 1곳` }
  else if (exLoc.length > 1) { row.status = '검토 필요'; row.reason = `이름 정확 일치 ${exLoc.length}곳(지점 여럿 — 주소로 확인)` }
  else if (ex.length) { row.status = '검토 필요'; row.reason = `이름은 정확히 같지만 위치 조건 불충족(가장 가까운 ${ex[0].d} m, 공단 밖/1.5km 초과)` }
  else if (row.cands.some(c => c.cont)) { row.status = '검토 필요'; row.reason = '회사명이 POI 이름에 포함됨(정확 일치 아님)' }
  else if (row.cands.length) { row.status = '검토 필요'; row.reason = '이름이 비슷한 후보만 있음' }
  else row.reason = '범위 안에 일치·유사 POI 없음'
  rows.push(row)
}

const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
const head = ['local_jobs ID', '근무 회사', '게시자', '근무지(주소)', 'KCN', '탐색 기준', '상태', '사유', '후보1 이름', '후보1 출처', '후보1 분류', '후보1 위도', '후보1 경도', '후보1 거리(m)', '후보1 공단안', '후보2 이름', '후보2 출처', '후보2 위도', '후보2 경도', '후보 수']
const lines = rows.map(r => { const a = r.cands[0] || {}, b = r.cands[1] || {}; return [r.jid, r.company, r.poster, r.addr, r.kcn, r.basis + (r.park ? ':' + r.park : ''), r.status, r.reason, a.name, a.src, a.cls, a.lat, a.lng, a.d, a.inside ? 'Y' : '', b.name, b.src, b.lat, b.lng, r.cands.length].map(esc).join(',') })
fs.writeFileSync(OUT + 'chotot_poi_candidates.csv', '﻿' + [head.join(','), ...lines].join('\r\n'))
fs.writeFileSync(OUT + 'chotot_poi_candidates.json', JSON.stringify(rows, null, 1))
const cnt = {}; rows.forEach(r => cnt[r.status] = (cnt[r.status] || 0) + 1)
console.log('pool: vietmap', vm.length, 'osm', osm.length, '| jobs', rows.length)
console.log(cnt)
const reasons = {}; rows.forEach(r => reasons[r.status + ' · ' + r.reason.replace(/\d+/g, 'N')] = (reasons[r.status + ' · ' + r.reason.replace(/\d+/g, 'N')] || 0) + 1)
console.log(reasons)
console.log('auto:', rows.filter(r => r.status === '자동 승인 후보').map(r => `${r.jid} ${r.company} -> ${r.cands[0].name} (${r.cands[0].src}, ${r.cands[0].d}m)`).join('\n  '))
