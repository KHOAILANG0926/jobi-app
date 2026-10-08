// 길찾기 3단계 (2026-10-08 사용자 지시) — 위에서부터 하나만 보여준다.
//   1) 승인 좌표가 있으면         "Chỉ đường"      — 사람이 승인한(또는 자동 승인 기준을 통과한) 근무지 좌표
//   2) 없고 KCN 정문 좌표가 있으면 "Đến cổng KCN"   — 출처 있는 KCN 정문 좌표(공장 정문 아님)
//   3) 둘 다 없으면               "Gọi hỏi đường"  — 공고 전화번호로 거는 전화 버튼(연락처 없으면 아무것도 안 보임)
// 링크는 좌표(destination=lat,lng)뿐이다. 이름·주소 글자 검색 링크는 만들지 않는다.

export const DIRECTIONS_LABEL = {
  approved: 'Chỉ đường',
  gate: 'Đến cổng KCN',
  call: 'Gọi hỏi đường',
} as const

export interface DirectionsLink { label: string; href: string }

export type DirectionsPlan =
  | { tier: 'approved'; links: DirectionsLink[] }
  | { tier: 'gate'; link: DirectionsLink; note?: string }
  | { tier: 'call'; label: string; href: string; phone: string }
  | { tier: 'none' }

export function planDirections(input: {
  approvedLinks: DirectionsLink[]
  gateHref: string | null
  gateNote?: string
  phone?: string | null
}): DirectionsPlan {
  if (input.approvedLinks.length > 0) return { tier: 'approved', links: input.approvedLinks }
  if (input.gateHref) return { tier: 'gate', link: { label: DIRECTIONS_LABEL.gate, href: input.gateHref }, note: input.gateNote }
  const digits = (input.phone ?? '').replace(/[^\d+]/g, '')
  if (digits.replace(/\D/g, '').length >= 8) {
    return { tier: 'call', label: DIRECTIONS_LABEL.call, href: `tel:${digits}`, phone: input.phone!.trim() }
  }
  return { tier: 'none' }
}
