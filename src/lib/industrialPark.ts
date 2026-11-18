// 공고 근무지 텍스트 → 공단(KCN/KCX) 중심 좌표 (src/data/industrialParks.ts의 출처 있는 좌표만).
// 표에 없는 공단·이름만 비슷한 다른 공단·같은 이름이 다른 지역에 있는 경우는 매칭하지 않는다(추정 금지).
import { INDUSTRIAL_PARKS, type IndustrialPark } from '../data/industrialParks.ts'

/** 성조 제거·소문자·기호를 공백으로 */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// 2026-10-25: "Nhà máy Quế Võ III"처럼 공장 이름이 공단 이름인 경우(#4879 ADTEK)도 공단 표 이름과 정확히 맞으면 그 공단.
// 표에 있는 이름(aliases)과만 맞추므로 "Nhà máy Samsung" 같은 회사 이름은 공단이 되지 않는다.
// "Khu CN"·"Cụm CN" 줄임도 같은 공단 낱말(#560 Codex #616: 줄임을 못 읽어 순번 확인을 건너뛰었음)
const KCN_TOKEN = /(?:^| )(?:kcn|kcx|ccn|khu cong nghiep|khu che xuat|cum cong nghiep|khu cn|cum cn|nha may)(?: cn)?(?= |$)/g
const NUMBERING = /^(?:\d+|i|ii|iii|iv|v|vi)$/

export function findIndustrialPark(...texts: (string | null | undefined)[]): IndustrialPark | undefined {
  // `requires`(같은 이름의 다른 지역 공단 구분)는 이 글자뿐 아니라 같은 공고의 다른 주소 글자(구·시)에서도 찾는다 —
  // 공단 이름과 지역이 서로 다른 칸에 적힌 공고("KCN VSIP" + "Phường Từ Sơn, Bắc Ninh")를 위해.
  const context = foldText(texts.filter(Boolean).join(' '))
  for (const raw of texts) {
    if (!raw) continue
    const folded = foldText(raw)
    let best: { park: IndustrialPark; len: number } | undefined
    for (const m of folded.matchAll(KCN_TOKEN)) {
      const after = folded.slice((m.index ?? 0) + m[0].length).trim()
      for (const park of INDUSTRIAL_PARKS) {
        if (park.requires && !park.requires.test(folded) && !park.requires.test(context)) continue
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

/** 글에 공단(KCN·khu công nghiệp·nhà máy 낱말 또는 공단 표의 VSIP 계열 이름)이 나오는가 — 공단 안 공고인지 '확정'하는 것이 아니라(Lee: 공단 이름만으로 공장 여부를 확정하지 않는다)
 *  가게 업종을 장소 유형·검색 결과로 확정하지 말아야 할 공장 맥락이 있는지 보는 용도(R2 #753). 같은 낱말 규칙(KCN_TOKEN)·표를 그대로 쓴다. */
const PARK_BRANDS = INDUSTRIAL_PARKS.filter((p) => p.id.startsWith('vsip')).flatMap((p) => p.aliases.filter((a) => a.split(' ').length === 1))
export function mentionsIndustrialPark(...texts: (string | null | undefined)[]): boolean {
  const folded = foldText(texts.filter(Boolean).join(' \n '))
  return folded.search(KCN_TOKEN) >= 0 || PARK_BRANDS.some((b) => new RegExp(`(?:^| )${b}(?: |$)`).test(folded))
}

/** 공단 길찾기("Đến cổng KCN") — 출처 있는 KCN 정문(gate) 좌표(`destination`)로만 만든다(2026-10-08 사용자 지시).
 *  영역 중심(lat/lng)은 절대 쓰지 않는다(빈 부지로 안내됨, 2026-10-07). 관리사무소(office)는 정문이 아니므로 쓰지 않는다.
 *  목적지가 없으면 null → 3단계(Gọi hỏi đường)로 넘어간다.
 *  링크는 반드시 좌표(destination=lat,lng)이고 이름 검색은 쓰지 않는다. */
export function industrialParkDirectionsUrl(park: Pick<IndustrialPark, 'destination'>): string | null {
  const d = park.destination
  if (!d || d.kind !== 'gate' || !Number.isFinite(d.lat) || !Number.isFinite(d.lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`
}

/** 길찾기 버튼 아래 한 줄 안내 — 목적지 종류별(공장 정문이 아님을 항상 밝힌다) */
export function industrialParkDirectionsNote(d: NonNullable<IndustrialPark['destination']>): string {
  const src = d.source.provider === 'OpenStreetMap' ? 'OpenStreetMap' : 'VietMap'
  return d.kind === 'gate'
    ? `Điểm đến là cổng khu công nghiệp theo ${src}, chưa phải cổng nhà máy bạn sẽ làm việc.`
    : `Điểm đến là văn phòng Ban quản lý khu công nghiệp theo ${src}, không phải cổng nhà máy.`
}
