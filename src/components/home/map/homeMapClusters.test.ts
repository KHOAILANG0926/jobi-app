import { planHomeMapMarkers } from './homeMapClusters.ts'

function assert(value: boolean, label: string) { if (!value) throw new Error(label) }

// 1 degree = 1000 px in this fake projection; viewport 500x500 px.
const project = (lat: number, lng: number) => ({ x: (lng - 106) * 1000, y: (21 - lat) * 1000 })
const viewport = { width: 500, height: 500 }
const m = (id: string, lat: number, lng: number) => ({ id, lat, lng, label: id })

const markers = [
  m('a', 20.9, 106.1), m('b', 20.9, 106.1), // shared workplace point
  m('c', 20.899, 106.101), // 1 px away → same cell at low zoom
  m('d', 20.6, 106.4),
  m('far', 25, 110), // outside viewport
]

const low = planHomeMapMarkers(markers, { project, viewport, zoom: 11, selectedId: null })
assert(!low.some((i) => i.markers.some((x) => x.id === 'far')), 'off-screen jobs are not rendered')
const cluster = low.find((i) => i.kind === 'cluster')
assert(cluster?.kind === 'cluster' && cluster.count === 3, 'nearby workplaces cluster at low zoom, counting every job')
assert(low.some((i) => i.kind === 'group' && i.markers[0].id === 'd'), 'isolated job stays a single pin')

const high = planHomeMapMarkers(markers, { project, viewport, zoom: 15, selectedId: null })
assert(high.every((i) => i.kind === 'group'), 'no clustering at workplace zoom')
const shared = high.find((i) => i.markers.length === 2)
assert(shared !== undefined && shared.markers.map((x) => x.id).join() === 'a,b', 'exact same point stays one shared pin')

const selected = planHomeMapMarkers(markers, { project, viewport, zoom: 11, selectedId: 'c' })
assert(selected.some((i) => i.kind === 'group' && i.markers.some((x) => x.id === 'c')), 'selected job is never hidden inside a cluster')
const selFar = planHomeMapMarkers(markers, { project, viewport, zoom: 11, selectedId: 'far' })
assert(selFar.some((i) => i.markers.some((x) => x.id === 'far')), 'selected job stays rendered even off-screen')

const many = Array.from({ length: 5000 }, (_, k) => m(`j${k}`, 21 - (k % 100) / 250, 106 + Math.floor(k / 100) / 250))
const t0 = Date.now()
const plan = planHomeMapMarkers(many, { project, viewport, zoom: 10, selectedId: null })
assert(Date.now() - t0 < 200, '5000 jobs planned quickly')
assert(plan.length <= 100, `5000 jobs collapse to a bounded number of DOM markers (${plan.length})`)
assert(plan.reduce((s, i) => s + i.markers.length, 0) === 5000, 'no job lost by clustering')

console.log('homeMapClusters.test.ts: viewport filtering / clustering / shared pin assertions passed')
