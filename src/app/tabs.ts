// 앱 하단 탭 정의(대표 결정 2026-11-25): 구직자 5개 · 기업 4개. 화면 코드가 아니라 데이터라 시험(boundary.test.ts)이 직접 읽는다.
// 기업 탭의 로그인 자동 전환은 5~6단계(로그인·기업)에서 연결한다 — 0단계에서는 /app/biz 아래 화면이면 기업 탭을 보여 준다.
export type AppTabIcon = 'home' | 'sparkles' | 'map' | 'community' | 'user' | 'manage' | 'post' | 'company'
export type AppTab = { key: string; label: string; to: string; icon: AppTabIcon; end?: boolean }

export const SEEKER_TABS: readonly AppTab[] = [
  { key: 'home', label: 'Trang chủ', to: '/', icon: 'home', end: true },
  { key: 'recommend', label: 'Gợi ý', to: '/goi-y', icon: 'sparkles' },
  { key: 'map', label: 'Bản đồ', to: '/ban-do', icon: 'map' },
  { key: 'community', label: 'Cộng đồng', to: '/cong-dong', icon: 'community' },
  { key: 'me', label: 'Của tôi', to: '/ho-so', icon: 'user' },
]

export const EMPLOYER_TABS: readonly AppTab[] = [
  { key: 'biz-home', label: 'Trang chủ', to: '/biz', icon: 'home', end: true },
  { key: 'biz-manage', label: 'Quản lý tin', to: '/biz/quan-ly-tin', icon: 'manage' },
  { key: 'biz-post', label: 'Đăng tin', to: '/biz/dang-tin', icon: 'post' },
  { key: 'biz-company', label: 'Doanh nghiệp', to: '/biz/doanh-nghiep', icon: 'company' },
]

export const EMPLOYER_PREFIX = '/biz'

// 라우터 basename(/app) 아래의 경로로 어느 탭 묶음을 보일지 정한다.
export function tabsForPath(pathname: string): readonly AppTab[] {
  return pathname === EMPLOYER_PREFIX || pathname.startsWith(EMPLOYER_PREFIX + '/') ? EMPLOYER_TABS : SEEKER_TABS
}
