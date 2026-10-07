// 공고 근무지 텍스트 → 공단(KCN/KCX) 중심 좌표 (src/data/industrialParks.ts의 출처 있는 좌표만).
// 표에 없는 공단·이름만 비슷한 다른 공단·같은 이름이 다른 지역에 있는 경우는 매칭하지 않는다(추정 금지).
import { INDUSTRIAL_PARKS, type IndustrialPark } from '../data/industrialParks'

/** 성조 제거·소문자·기호를 공백으로 */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const KCN_TOKEN = /(?:^| )(?:kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep)(?: cn)?(?= |$)/g
const NUMBERING = /^(?:\d+|i|ii|iii|iv|v|vi)$/

export function findIndustrialPark(...texts: (string | null | undefined)[]): IndustrialPark | undefined {
  for (const raw of texts) {
    if (!raw) continue
    const folded = foldText(raw)
    let best: { park: IndustrialPark; len: number } | undefined
    for (const m of folded.matchAll(KCN_TOKEN)) {
      const after = folded.slice((m.index ?? 0) + m[0].length).trim()
      for (const park of INDUSTRIAL_PARKS) {
        if (park.requires && !park.requires.test(folded)) continue
        for (const alias of park.aliases) {
          if (after !== alias && !after.startsWith(`${alias} `)) continue
          // 이름 바로 뒤에 순번이 붙으면(예: "quế võ 2") 다른 공단이다. alias 자체가 순번으로 끝나면 해당 없음.
          const next = after.slice(alias.length).trim().split(' ')[0]
          if (next && NUMBERING.test(next) && !NUMBERING.test(alias.split(' ').pop() ?? '')) continue
          if (!best || alias.length > best.len) best = { park, len: alias.length }
        }
      }
    }
    if (best) return best.park
  }
  return undefined
}

/** 공단 길찾기 — 출처 있는 정문(gate)·관리사무소(office) 좌표(`destination`)로만 만든다.
 *  영역 중심(lat/lng)은 절대 쓰지 않는다(빈 부지로 안내됨, 2026-10-07). 목적지가 없으면 null → 버튼 숨김.
 *  링크는 반드시 좌표(destination=lat,lng)이고 이름 검색은 쓰지 않는다. */
export function industrialParkDirectionsUrl(park: Pick<IndustrialPark, 'destination'>): string | null {
  const d = park.destination
  if (!d || !Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
}

/** 길찾기 버튼 아래 한 줄 안내 — 목적지 종류별(공장 정문이 아님을 항상 밝힌다) */
export function industrialParkDirectionsNote(d: NonNullable<IndustrialPark['destination']>): string {
  const src = d.source.provider === 'OpenStreetMap' ? 'OpenStreetMap' : 'VietMap'
  return d.kind === 'gate'
    ? `Điểm đến là cổng khu công nghiệp theo ${src}, chưa phải cổng nhà máy bạn sẽ làm việc.`
    : `Điểm đến là văn phòng Ban quản lý khu công nghiệp theo ${src}, không phải cổng nhà máy.`
}
