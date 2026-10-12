import { isVerifiedWorkLocation, workLocationExternalLinks } from './jobCoords'
import { findIndustrialPark, industrialParkDirectionsUrl, industrialParkDirectionsNote } from './industrialPark'
import { contactOf } from './jobDetailView'
import type { Job } from '../types/job'

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

export interface DirectionsLink { label: string; href: string; viewHref?: string }

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
  const links = input.approvedLinks.flatMap((link) => {
    const coordinates = googleDestination(link.href)
    return coordinates ? [{ ...link, viewHref: `https://www.google.com/maps/search/?api=1&query=${coordinates}` }] : []
  })
  if (links.length > 0) return { tier: 'approved', links }
  if (input.gateHref && googleDestination(input.gateHref)) return { tier: 'gate', link: { label: DIRECTIONS_LABEL.gate, href: input.gateHref }, note: input.gateNote }
  const digits = (input.phone ?? '').replace(/[^\d+]/g, '')
  if (digits.replace(/\D/g, '').length >= 8) {
    return { tier: 'call', label: DIRECTIONS_LABEL.call, href: `tel:${digits}`, phone: input.phone!.trim() }
  }
  return { tier: 'none' }
}

// Accept only coordinate directions URLs from the existing approval/gate helpers.
function googleDestination(href: string): string | null {
  try {
    const url = new URL(href)
    if (url.origin !== 'https://www.google.com' || url.pathname !== '/maps/dir/' || url.searchParams.get('api') !== '1') return null
    const value = url.searchParams.get('destination') ?? ''
    if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(value)) return null
    const [lat, lng] = value.split(',').map(Number)
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? value : null
  } catch { return null }
}

// Home and detail use the same approval helpers; map marker/region centers are never destinations.
export function planJobDirections(job: Job): DirectionsPlan {
  const approvedLinks = (job.workLocations ?? []).flatMap((loc) => {
    const links = isVerifiedWorkLocation(loc) ? workLocationExternalLinks(loc) : null
    return links?.viewKind === 'exact' && links.directions
      ? [{ label: (job.workLocations?.length ?? 0) > 1 ? `Chỉ đường — ${loc.rawAddress}` : DIRECTIONS_LABEL.approved, href: links.directions }] : []
  })
  const park = findIndustrialPark(job.rawLocation, ...(job.workLocations ?? []).flatMap((loc) => [loc.industrialPark, loc.rawAddress]))
  return planDirections({ approvedLinks, gateHref: park ? industrialParkDirectionsUrl(park) : null,
    gateNote: park?.destination ? industrialParkDirectionsNote(park.destination) : undefined, phone: contactOf(job).phone })
}
