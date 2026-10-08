// OSM way 하나의 윤곽을 받아 industrialParkOutlines.ts 형식(경도·위도, 소수 5자리, 약 6.5 m 단순화)으로 출력한다.
// 결과는 stdout에만 쓴다(PC 저장 없음). 사용: node scripts/ops/fetch_osm_outline.mjs way/1184113104 [way/...]
// 데이터 © OpenStreetMap contributors (ODbL).
const TOL_M = 6.5

function dpSimplify(pts, tolM) {
  const k = 111320
  const proj = (p) => [p[0] * k * Math.cos(p[1] * Math.PI / 180), p[1] * k]
  const P = pts.map(proj)
  const keep = new Array(P.length).fill(false)
  keep[0] = keep[P.length - 1] = true
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = dx * dx + dy * dy
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len))
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
  }
  const stack = [[0, P.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    let max = 0, idx = -1
    for (let i = s + 1; i < e; i++) { const d = dist(P[i], P[s], P[e]); if (d > max) { max = d; idx = i } }
    if (idx >= 0 && max > tolM) { keep[idx] = true; stack.push([s, idx], [idx, e]) }
  }
  return pts.filter((_, i) => keep[i])
}

const refs = process.argv.slice(2)
if (refs.length === 0) { console.error('usage: fetch_osm_outline.mjs way/<id> ...'); process.exit(1) }
for (const ref of refs) {
  const id = ref.replace(/^way\//, '')
  const q = `[out:json][timeout:60];way(${id});out tags geom;`
  let j = null
  for (let attempt = 0; attempt < 4 && !j; attempt++) {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'viecganban-ops/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) })
    if (r.ok) j = await r.json(); else await new Promise((res) => setTimeout(res, 4000))
  }
  if (!j?.elements?.[0]?.geometry) { console.error(ref, 'no geometry'); continue }
  const el = j.elements[0]
  let ring = el.geometry.map((g) => [g.lon, g.lat])
  const first = ring[0], last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first)
  ring = dpSimplify(ring, TOL_M).map(([x, y]) => [Number(x.toFixed(5)), Number(y.toFixed(5))])
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1])
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const c = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
  console.log(`// ${ref} ${el.tags?.name ?? ''} — vertices ${el.geometry.length} → ${ring.length}; bbox center lat ${c[1].toFixed(7)}, lng ${c[0].toFixed(7)}`)
  console.log(`  '${ref}': { bounds: [${bounds.join(', ')}], ring: [${ring.map((p) => `[${p[0]},${p[1]}]`).join(',')}] },`)
}
