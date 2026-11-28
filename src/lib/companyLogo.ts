import type { Job } from '../types/job'
import type { BrandDefinition } from '../data/brandDirectory'
import { brandIconUrl, brandLogoFor } from './brandLogo'
import { jobPhotoUrl } from './cardPhoto'

// 회사 로고로 보여줄 이미지 주소 (2026-10-06 사용자 결정).
// 수집 출처 사이트(vieclam24h 등)·Facebook CDN 이미지는 로고로 쓰지 않는다. 로고가 없는 회사에 출처 사이트
// 자체 기본 로고(vieclam24h_logo_customer_default)가 들어가 출처를 노출했고, 원본 채용사이트 노출 금지
// 원칙(CLAUDE.md)에 맞춰 출처 CDN 로고 전체를 막는다. 차단 목록이 아니라 허용 목록 방식이라 새 출처도 자동으로 막힌다.
// 허용: 우리 Supabase Storage(public bucket)에 올라간 이미지 — 기업 직접 등록(PostJob)·관리자 업로드만.
// 막힌 경우 화면은 기존 대체 표시(상세: 회사명 이니셜, 목록 카드: 업종 이미지)를 쓴다.

/** src/lib/supabase.ts와 같은 프로젝트 */
const OWN_STORAGE_HOST = 'edhuesdnuxlbcfephutq.supabase.co'
const OWN_STORAGE_PATH = '/storage/v1/object/public/'

export function companyLogoUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined
  try {
    const url = new URL(imageUrl)
    return url.protocol === 'https:' && url.hostname === OWN_STORAGE_HOST && url.pathname.startsWith(OWN_STORAGE_PATH)
      ? imageUrl
      : undefined
  } catch {
    return undefined
  }
}

/** 카드 썸네일(≤96px)용 작은 사본 주소 — 우리 저장소 job-images의 그림·사진을 Supabase 저장소 변환 기능(같은 저장소 안 기능)으로 줄여 받는다.
 *  원본 포스터(수백 KB~1MB)를 70×84 카드 자리에 그대로 받던 전송을 줄이려는 것이다. 원본 파일·DB 주소는 바꾸지 않고, 변환이 실패하면
 *  화면이 원본 주소 → 업종 사진 순으로 이어서 쓴다(CompanyLogo·AppJobCard의 failed 목록). 상세·확대 화면은 원본 그대로. */
export const CARD_THUMB_WIDTH = 192
const RASTER_EXT = /\.(?:png|jpe?g|webp)$/i
export function cardThumbnailUrl(imageUrl: string | null | undefined, width = CARD_THUMB_WIDTH): string | undefined {
  const own = companyLogoUrl(imageUrl)
  if (!own) return undefined
  const url = new URL(own)
  const rest = url.pathname.slice(OWN_STORAGE_PATH.length)
  if (!rest.startsWith('job-images/') || !RASTER_EXT.test(rest)) return undefined
  return `${url.origin}/storage/v1/render/image/public/${rest}?width=${width}&quality=75`
}

/** 공고 이미지(저장소 경로 또는 주소) → 우리 저장소 공개 주소. 허용 목록 밖이면 undefined. */
export function jobImagePublicUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return companyLogoUrl(value)
  const path = value.replace(/^\/+/, '').replace(/^job-images\//, '')
  if (!/^[A-Za-z0-9._\/-]+$/.test(path) || path.split('/').includes('..')) return undefined
  return `https://${OWN_STORAGE_HOST}${OWN_STORAGE_PATH}job-images/${path}`
}

/** 회사 공식 웹사이트 아이콘(Lee 2026-11-07): 사진·브랜드 로고가 없는 공고만 서버가 Google 장소의 웹사이트로 채운 도메인. */
export function companySiteLogoUrl(domain: string | null | undefined): string | undefined {
  return domain && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain) ? brandIconUrl(domain) : undefined
}

/** 공고 대표 이미지 공통 순서. 하단 채용 사진 목록은 이 선택과 별개로 유지한다.
 *  브랜드 로고 → 공고 사진(우리 저장소: 페이스북 사진 복사본·포스터·업로드) → 회사 웹사이트 아이콘 → 업종 공용 사진(Lee 2026-11-07). */
export function jobRepresentativeImageUrl(
  job: Pick<Job, 'company' | 'title' | 'imageUrl' | 'images'> & Partial<Pick<Job, 'category' | 'subcategory' | 'description' | 'companyDomain' | 'occupationCode' | 'roleCodes' | 'primaryRoleCode'>>,
  brands: BrandDefinition[],
): string {
  return brandLogoFor(job, brands)
    ?? companyLogoUrl(job.imageUrl)
    ?? jobImagePublicUrl(job.images?.[0])
    ?? companySiteLogoUrl(job.companyDomain)
    ?? jobPhotoUrl(job)
}
