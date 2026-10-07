// chotot 100건 → 근무 회사 POI 탐색 계획(어느 공단 윤곽/어느 타일을 읽을지). 외부 요청 없음.
// 실행: node --import ./scripts/ts-extensionless-register.mjs scripts/research/bn_poi_plan.mjs
import fs from 'node:fs'
import { findIndustrialPark } from '../../src/lib/industrialPark.ts'
import { INDUSTRIAL_PARKS } from '../../src/data/industrialParks.ts'
import { INDUSTRIAL_PARK_OUTLINES } from '../../src/data/industrialParkOutlines.ts'

const OUT = 'scripts/research/out/'
const jobs = JSON.parse(fs.readFileSync(OUT + 'chotot_jobs.json', 'utf8'))
const Z = 15
const tileOf = (lat, lng) => { const n = 2 ** Z; return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n) } }
const parkOf = j => findIndustrialPark(j.addr + ' ' + j.title, j.kcn)
const plan = { parks: {}, jobs: [] }
for (const j of jobs) {
  const p = parkOf(j)
  plan.jobs.push({ jid: j.jid, ad: j.ad, park: p?.id ?? null })
  if (p && !plan.parks[p.id]) {
    const o = INDUSTRIAL_PARK_OUTLINES[p.source.ref]
    const b = o ? o.bounds : [p.lng - 0.004, p.lat - 0.004, p.lng + 0.004, p.lat + 0.004]
    const a = tileOf(b[3], b[0]), c = tileOf(b[1], b[2])
    const tiles = []
    for (let x = a.x; x <= c.x; x++) for (let y = a.y; y <= c.y; y++) tiles.push([x, y])
    plan.parks[p.id] = { name: p.name, ref: p.source.ref, bounds: b, tiles, center: [p.lng, p.lat] }
  }
}
fs.writeFileSync(OUT + 'poi_plan.json', JSON.stringify(plan))
const rows = Object.entries(plan.parks).map(([id, v]) => `${id}: tiles=${v.tiles.length}`)
console.log('jobs with park:', plan.jobs.filter(j => j.park).length, '| parks:', rows.length)
console.log(rows.join('\n'))
const all = new Set(Object.values(plan.parks).flatMap(v => v.tiles.map(t => t.join('/'))))
console.log('unique z15 tiles for parks:', all.size)
