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
