import { isVerifiedWorkLocation, workLocationExternalLinks } from './jobCoords'
import { findIndustrialPark, industrialParkDirectionsUrl, industrialParkDirectionsNote } from './industrialPark'
import { contactOf } from './jobDetailView'
import type { Job } from '../types/job'

// 길찾기 3단계 (2026-10-08 사용자 지시) — 위에서부터 하나만 보여준다.
//   1) 승인 좌표가 있으면         "Chỉ đường"      — 사람이 승인한(또는 자동 승인 기준을 통과한) 근무지 좌표
//   2) 없고 KCN 정문 좌표가 있으면 "Đến cổng KCN"   — 출처 있는 KCN 정문 좌표(공장 정문 아님)
//   3) 둘 다 없고 정확한 거리 주소가 있으면 "Chỉ đường" — 주소 글자로 Google Maps에 넘김(2026-10-12 사용자 결정 A안,
//      VietMap 최신 반영이 늦어서). 번지+도로명 + 일치하는 동/구/성만. KCN·Lô·Khu 주소, 행정구역이 서로 다른 주소는 제외.
//   4) 그것도 없으면              "Gọi hỏi đường"  — 공고 전화번호로 거는 전화 버튼(연락처 없으면 아무것도 안 보임)
// 회사명·공단명·지역명만으로 만든 검색 링크는 여전히 금지(2026-09-29 KCN VSIP 오안내 재발 방지).

export const DIRECTIONS_LABEL = {
  approved: 'Chỉ đường',
  gate: 'Đến cổng KCN',
  call: 'Gọi hỏi đường',
} as const

export interface DirectionsLink { label: string; href: string; viewHref?: string }

export type DirectionsPlan =
  | { tier: 'approved'; links: DirectionsLink[] }
  | { tier: 'gate'; link: DirectionsLink; note?: string }
  | { tier: 'address'; links: DirectionsLink[]; note: string }
  | { tier: 'call'; label: string; href: string; phone: string }
  | { tier: 'none' }

export function planDirections(input: {
  approvedLinks: DirectionsLink[]
  gateHref: string | null
  gateNote?: string
  addressQuery?: string | null
  phone?: string | null
}): DirectionsPlan {
  const links = input.approvedLinks.flatMap((link) => {
    const coordinates = googleDestination(link.href)
    return coordinates ? [{ ...link, viewHref: `https://www.google.com/maps/search/?api=1&query=${coordinates}` }] : []
  })
  if (links.length > 0) return { tier: 'approved', links }
  if (input.gateHref && googleDestination(input.gateHref)) return { tier: 'gate', link: { label: DIRECTIONS_LABEL.gate, href: input.gateHref }, note: input.gateNote }
  if (input.addressQuery) {
    const q = encodeURIComponent(input.addressQuery)
    return { tier: 'address', note: ADDRESS_NOTE, links: [{ label: DIRECTIONS_LABEL.approved,
      href: `https://www.google.com/maps/dir/?api=1&destination=${q}`, viewHref: `https://www.google.com/maps/search/?api=1&query=${q}` }] }
  }
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
  const addressQuery = (job.workLocations ?? []).length === 1
    ? preciseStreetAddressQuery(job.workLocations![0].rawAddress, job.workLocations![0].industrialPark) : null
  return planDirections({ approvedLinks, gateHref: park ? industrialParkDirectionsUrl(park) : null,
    gateNote: park?.destination ? industrialParkDirectionsNote(park.destination) : undefined, addressQuery, phone: contactOf(job).phone })
}

export const ADDRESS_NOTE = 'Vị trí theo địa chỉ trong tin, chưa xác minh trên bản đồ.'

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim()
const ADMIN_PREFIX = /^(p|phuong|xa|thi tran|tt|q|quan|h|huyen|tx|thi xa|tp|thanh pho|t|tinh)\s+/

/** 2026-10-12 A안: "번지+도로명, 동, 구/시, 성" 형태로 위치가 특정되는 주소만 Google 주소 검색에 넘긴다. 아니면 null. */
export function preciseStreetAddressQuery(rawAddress: string | null | undefined, industrialPark?: string | null): string | null {
  if (!rawAddress || industrialPark) return null
  const all = norm(rawAddress)
  if (/\b(kcn|ccn|khu cong nghiep|cum cong nghiep|lo|thua dat)\b/.test(all)) return null
  const parts = rawAddress.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 4) return null
  let first = parts[0]
  const dash = first.match(/^[^\d]+?\s[-–]\s(?=(so\s*)?\d|Số\s*\d|\d)/i)
  if (dash) first = first.slice(dash[0].length)
  const m = norm(first).match(/^(so\s*)?\d+[a-z]?(\s*\d+[a-z]?)?\s+(.+)$/)
  if (!m || /^(khu|duong so|duong tinh|ql|quoc lo|tl|dt)\b/.test(m[3])) return null
  const tail = parts.slice(-3)
  const tailNames = new Set(tail.map((p) => norm(p).replace(ADMIN_PREFIX, '')))
  for (const mid of parts.slice(1, -3)) {
    if (!tailNames.has(norm(mid).replace(ADMIN_PREFIX, ''))) return null
  }
  return [first.trim(), ...tail].join(', ')
}
