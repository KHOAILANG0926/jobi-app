import { DEFAULT_FILTERS } from '../../lib/homeMapFilters.ts'
import { mapSearch, type MapBounds } from '../../lib/mapR1.ts'
import type { Job } from '../../types/job.ts'
import { EMPTY_APP_FILTERS } from '../filters/applyFilters.ts'
import { computeMapData } from './useMapData.ts'

// 웹·앱 지도 일치 시험(Lee 2026-11-28, #1031 (3)): 같은 공고·같은 조건이면 웹 지도(lib/mapR1.mapSearch + homeMapFilters)와 앱 지도(computeMapData)의 핀 수·위치·목록이 같다.
const assert = { eq(a: unknown, b: unknown, m: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) } }
const pt = (lat: number, lng: number) => ({ lat, lng, locationVerified: true, pointKind: 'exact' })
const job = (id: string, extra: Partial<Job> = {}) => ({ id, title: id, company: 'Fixture', salary: '12 triệu', category: 'dich_vu', workLocations: [pt(21.03, 105.85)], ...extra } as Job)
const jobs = [
  job('a', { dormitory: true, workLocations: [pt(21.03, 105.85)] }),
  job('b', { salary: '9 triệu', workLocations: [pt(21.04, 105.86)] }),
  job('c', { dormitory: true, salary: '20 triệu', workLocations: [pt(21.3, 106.2)] }),
  job('d', { workLocations: [] }), // 위치 모름 → 핀 없음(양쪽 모두)
  job('e', { workLocations: [pt(21.03, 105.85), pt(21.5, 106.5)] }), // 지점 여럿
]
const bounds: MapBounds = { west: 105.0, east: 107.0, south: 20.5, north: 22.0 }
const narrow: MapBounds = { west: 105.8, east: 105.9, south: 21, north: 21.1 }
const areas = new Map()
const same = (name: string, app: Partial<typeof EMPTY_APP_FILTERS>, web: Partial<typeof DEFAULT_FILTERS>, b: MapBounds | null, radius: number | null) => {
  const o = { lat: 21.03, lng: 105.85 }
  const a = computeMapData(jobs, areas, { ...EMPTY_APP_FILTERS, ...(radius !== null ? { radiusKm: radius } : {}), ...app }, o, radius !== null, b)
  const w = mapSearch(jobs, { ...DEFAULT_FILTERS, ...web, radiusKm: radius ?? DEFAULT_FILTERS.radiusKm }, o, radius, b, {})
  const key = (m: { jobId?: string; id?: string; lat: number; lng: number }[]) => m.map((x) => `${x.jobId ?? x.id}@${x.lat},${x.lng}`).sort()
  assert.eq(key(a.markers as never), key(w.markers as never), name + ' 핀(공고·좌표)')
  assert.eq([a.visibleCount, a.unresolvedCount, a.entries.length], [w.visibleCount, w.unresolvedCount, w.entries.length], name + ' 건수')
  return a.markers.length
}
const none = same('조건 없음', {}, {}, bounds, null)
if (none < 3) throw new Error('핀이 시험 자료에서 기대보다 적음 ' + none)
same('좁은 화면 범위', {}, {}, narrow, null)
same('숙소 제공 조건', { extras: ['dormitory'] }, { extras: ['dormitory'] }, bounds, null)
same('최소 월급', { minSalary: 10_000_000 }, { minSalary: 10_000_000 }, bounds, null)
same('반경 1km', {}, {}, bounds, 1)
same('반경+숙소', { extras: ['dormitory'] }, { extras: ['dormitory'] }, bounds, 5)
console.log('web/app map parity: pins, positions and counts match for the same conditions')
