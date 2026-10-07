// 박닌 bbox의 이름 있는 공장·산업 건물(OSM) 1회 조회 → out/osm_named_industrial.json. 요청 1회(공개 Overpass, 캐시 파일 있으면 재요청 안 함).
import fs from 'node:fs'
const OUT = 'scripts/research/out/osm_named_industrial.json'
if (fs.existsSync(OUT)) { console.log('cache exists, no request'); process.exit(0) }
const bbox = '20.95,105.85,21.35,106.45'
const q = `[out:json][timeout:180];(nwr["building"="industrial"]["name"](${bbox});nwr["landuse"="industrial"]["name"](${bbox});nwr["man_made"="works"]["name"](${bbox});nwr["industrial"]["name"](${bbox});nwr["office"="company"]["name"](${bbox});nwr["building"="warehouse"]["name"](${bbox}););out center tags;`
const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'viecganban-research/1.0 (internal dry-run)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) })
console.log('status', r.status)
const j = await r.json()
const items = j.elements.map(e => ({ id: `${e.type}/${e.id}`, name: e.tags.name, lat: e.center?.lat ?? e.lat, lng: e.center?.lon ?? e.lon, kind: e.tags.building || e.tags.landuse || e.tags.man_made || e.tags.office || e.tags.industrial || '' })).filter(x => x.lat && x.lng)
fs.writeFileSync(OUT, JSON.stringify(items))
console.log('elements', j.elements.length, 'with coords', items.length)
