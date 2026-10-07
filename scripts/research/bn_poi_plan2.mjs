// 탐색 타일 계획 2단계: 공고별 중심점(공단 윤곽 / 광고 대략 좌표 / 같은 구·xã 중앙값) → z15 타일 집합. 외부 요청 없음.
import fs from 'node:fs'
const OUT = 'scripts/research/out/'
const jobs = JSON.parse(fs.readFileSync(OUT + 'chotot_jobs.json', 'utf8'))
const geo = JSON.parse(fs.readFileSync(OUT + 'chotot_geo.json', 'utf8'))
const plan = JSON.parse(fs.readFileSync(OUT + 'poi_plan.json', 'utf8'))
const Z = 15, n = 2 ** Z
const tileOf = (lat, lng) => ({ x: Math.floor((lng + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n) })
const inBN = (la, ln) => la >= 20.95 && la <= 21.35 && ln >= 105.85 && ln <= 106.45
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const wardKey = j => (geo[j.ad].ward || '').trim()
const byWard = {}
for (const j of jobs) { const g = geo[j.ad]; if (inBN(+g.lat, +g.lng)) (byWard[wardKey(j)] ??= []).push([+g.lat, +g.lng]) }
const wardCenter = w => byWard[w] ? [med(byWard[w].map(p => p[0])), med(byWard[w].map(p => p[1]))] : null
const tilesSet = new Map()
const add = (x, y, why) => { const k = `${x}/${y}`; if (!tilesSet.has(k)) tilesSet.set(k, why) }
const perJob = []
for (const j of jobs) {
  const p = plan.jobs.find(q => q.jid === j.jid)
  const g = geo[j.ad]; let center = null, basis = ''
  if (p.park) { basis = 'park:' + p.park; for (const [x, y] of plan.parks[p.park].tiles) add(x, y, basis) }
  else {
    if (inBN(+g.lat, +g.lng)) { center = [+g.lat, +g.lng]; basis = 'ad-coord' }
    else if (wardCenter(wardKey(j))) { center = wardCenter(wardKey(j)); basis = 'ward-median' }
    else basis = 'none'
    if (center) { const t = tileOf(center[0], center[1]); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) add(t.x + dx, t.y + dy, basis) }
  }
  perJob.push({ jid: j.jid, ad: j.ad, park: p.park, center, basis })
}
const tiles = [...tilesSet.keys()].map(k => k.split('/').map(Number))
fs.writeFileSync(OUT + 'poi_plan2.json', JSON.stringify({ perJob, tiles }))
const bc = {}; perJob.forEach(x => bc[x.basis.split(':')[0]] = (bc[x.basis.split(':')[0]] || 0) + 1)
console.log('basis counts', bc, '| unique z15 tiles', tiles.length)
