// 2026-09-20 사용자 지시("Việc làm của tôi" 4개 페이지에 알바몬 스타일
// 표 뷰 적용, "스타일은 알바몬하고 최대한 동일하게") — 카드/표 전환과 등록일
// 필터를 4개 페이지가 공유하는 작은 헬퍼. 뷰 모드는 한 번 고르면 4개 페이지
// 어디서든 유지되도록 localStorage 키 하나를 공유한다(storage.ts의 기존
// try/catch 패턴 재사용).

export type JobsViewMode = 'grid' | 'table'

const VIEW_KEY = 'vgb_jobs_view_mode'

export function loadJobsViewMode(): JobsViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid'
  } catch {
    return 'grid'
  }
}

export function saveJobsViewMode(mode: JobsViewMode): void {
  try {
    localStorage.setItem(VIEW_KEY, mode)
  } catch {
    // ignore — 저장 실패해도 화면 전환 자체는 계속 동작해야 함
  }
}

export type DateRangeFilter = 'all' | 'today' | '7d' | '30d'

/** postedAt(날짜만 있는 'YYYY-MM-DD' 또는 전체 ISO 문자열 둘 다 허용)이
 *  선택한 기간 안에 있는지 — Home.tsx/UrgentJobsPage.tsx가 마감일 필터에
 *  쓰는 것과 동일한 날짜 문자열 비교 방식(시/분 단위 epoch 계산 대신)을
 *  그대로 따른다. postedAt이 없으면(korea 미확인 등) 필터에서 걸러내지
 *  않고 항상 통과시킨다 — 데이터가 없다고 숨기지 않는다. */
export function matchesDateRange(postedAt: string | null | undefined, range: DateRangeFilter): boolean {
  if (range === 'all' || !postedAt) return true
  const postedDay = postedAt.slice(0, 10)
  const todayDay = new Date().toISOString().slice(0, 10)
  if (range === 'today') return postedDay === todayDay
  const days = range === '7d' ? 7 : 30
  const cutoffDay = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  return postedDay >= cutoffDay
}
