import { CATEGORY_LABELS } from '../data/categories'
import { REGION_MACRO_TABS } from '../data/jobRegions'
import type { Job, JobCategory } from '../types/job'

/**
 * 2026-09-22 사용자 지시로 정책 전면 개정 — "공고 3건 이상인 모든 지역·
 * 업직종을 자동 색인하지 말 것 / 전체 검색 기능과 색인 대상 관리를
 * 분리할 것 / 대표 페이지는 별도 설정 목록으로 관리 / 공고 수 변동만으로
 * canonical이 계속 바뀌지 않게 할 것".
 *
 * 이전 버전은 "업직종/지역 중 현재 공고 수가 3건 이상이면 자동으로 대표
 * 페이지"였다 — 이러면 (a) 검색 자체는 훨씬 넓은 조건을 지원하는데 그
 * 범위가 그대로 색인 정책이 돼버려서 두 가지가 분리가 안 되고, (b) 공고
 * 수가 2↔3 사이를 오가면 canonical 대상 자체가 매번 바뀌는 문제가 있었다.
 *
 * 지금 구조: "대표 페이지 후보"는 아래 REPRESENTATIVE_SEARCH_PAGE_CANDIDATES
 * 고정 목록(사람이 직접 관리)으로만 정해진다 — 실시간 공고 수 계산으로
 * 후보 자체가 늘거나 줄지 않는다(canonical 안정성의 근거). 공고 수는
 * 오직 "이 후보를 지금 sitemap에 실제로 올릴지"에만 쓴다(부족하면 일시
 * 제외, 후보 자격 자체는 유지 — 나중에 공고가 다시 늘면 다시 sitemap에
 * 올라옴).
 *
 * 2026-09-22 2차 수정(같은 날, 사용자 승인 후 추가 지시) — `khac`("기타")는
 * 검색 의도가 불명확해 대표 후보에서 제외. 나머지 업직종 10개 + 지역
 * 10개는 "초기 후보"로 유지(여전히 최종 확정 아님).
 */

export interface RepresentativePageCandidate {
  /** 예: "?cat=cafe" 또는 "?region=hanoi" — 앞에 물음표 포함. */
  query: string
  label: string
  /** 이 후보를 제안(2026-09-22)할 당시 실제 활성 공고 수 — 참고용 기록일
   *  뿐, 런타임 판정에는 안 쓴다(런타임에서는 항상 최신 실제 개수를
   *  다시 계산함, 아래 getCurrentJobCount 참고). */
  jobCountAtProposalTime: number
}

// 2026-09-22 제안(같은 날 2차 수정으로 `khac` 제외) — 실제 Production
// 데이터(활성 공고 263건) 기준, 업직종/지역 단일 조건 중 3건 이상인
// 조합을 계산한 결과에서 검색 의도가 불명확한 `khac`만 뺐다.
// *** 여전히 "초기 후보"다 — 최종 확정한 것이 아님. ***
export const REPRESENTATIVE_SEARCH_PAGE_CANDIDATES: RepresentativePageCandidate[] = [
  { query: '?cat=am_thuc_do_uong', label: 'Ẩm thực · Đồ uống', jobCountAtProposalTime: 45 },
  { query: '?cat=van_phong', label: 'Văn phòng', jobCountAtProposalTime: 44 },
  { query: '?cat=san_xuat_xay_dung', label: 'Sản xuất · Xây dựng · Lao động phổ thông', jobCountAtProposalTime: 42 },
  { query: '?cat=lai_xe_giao_hang', label: 'Lái xe · Giao hàng', jobCountAtProposalTime: 32 },
  { query: '?cat=cskh_kinh_doanh', label: 'Chăm sóc khách hàng · Kinh doanh', jobCountAtProposalTime: 23 },
  { query: '?cat=thiet_ke', label: 'Thiết kế', jobCountAtProposalTime: 7 },
  { query: '?cat=quan_ly_ban_hang', label: 'Quản lý cửa hàng · Bán hàng', jobCountAtProposalTime: 6 },
  { query: '?cat=cntt_ky_thuat', label: 'CNTT · Kỹ thuật', jobCountAtProposalTime: 5 },
  { query: '?cat=dich_vu', label: 'Dịch vụ', jobCountAtProposalTime: 4 },
  { query: '?cat=giao_duc_giang_day', label: 'Giáo dục · Giảng dạy', jobCountAtProposalTime: 3 },
  { query: '?region=hcm', label: 'TP. Hồ Chí Minh', jobCountAtProposalTime: 111 },
  { query: '?region=hanoi', label: 'Hà Nội', jobCountAtProposalTime: 91 },
  { query: '?region=haiphong', label: 'Hải Phòng', jobCountAtProposalTime: 13 },
  { query: '?region=quangninh', label: 'Quảng Ninh', jobCountAtProposalTime: 11 },
  { query: '?region=nghean', label: 'Nghệ An', jobCountAtProposalTime: 9 },
  { query: '?region=dongnai', label: 'Đồng Nai', jobCountAtProposalTime: 4 },
  { query: '?region=hunguyen', label: 'Hưng Yên', jobCountAtProposalTime: 4 },
  { query: '?region=bacninh', label: 'Bắc Ninh', jobCountAtProposalTime: 3 },
  { query: '?region=khanhhoa', label: 'Khánh Hòa', jobCountAtProposalTime: 3 },
  { query: '?region=tayninh', label: 'Tây Ninh', jobCountAtProposalTime: 3 },
]

// 후보 자격이 있어도 sitemap에는 "지금 실제로 이 정도는 있다"는 최소선을
// 넘을 때만 올린다 — canonical/robots(색인 허용 여부)는 이 값과 무관하게
// 후보 목록 등재 여부만으로 결정된다(공고 수 변동에 따라 canonical이
// 계속 바뀌는 걸 막기 위함, 위 파일 상단 설명 참고). sitemap 등재만
// 공고 수에 반응해 일시적으로 빠졌다 다시 들어올 수 있다.
const MIN_JOBS_FOR_SITEMAP = 3

// 2026-09-22 3차 수정 — "대표 canonical에는 대표 조건에 필요한 파라미터만
// 남길 것 / sort, 페이지번호, 추적용 UTM 등은 포함하지 말 것". 이 값들은
// 결과 "내용"을 바꾸지 않는(정렬 순서·페이지·추적 태그일 뿐) 파라미터라 —
// 대표 여부 판정과 canonical 생성 둘 다에서 아예 무시한다. q(검색어)/
// sub(소분류)/brand/urgent/today는 실제로 결과 집합을 바꾸는 "내용"
// 파라미터라 이 목록에 넣지 않는다(하나라도 있으면 여전히 비대표로 취급).
const IGNORED_PARAM_KEYS = new Set(['sort', 'page', 'pageSize'])
function isIgnoredParamKey(key: string): boolean {
  return IGNORED_PARAM_KEYS.has(key) || key.startsWith('utm_') || key === 'utm'
}

/** 지금 요청받은 query string에서 "대표 여부/canonical 대상"에 실제로
 *  영향을 주는 파라미터만 남기고 나머지(sort/page/pageSize/utm_*)는
 *  무시한 뒤, cat 또는 region 단일 조건과 정확히 일치하는지 판정한다.
 *  파라미터 순서/대소문자 차이로 같은 조합을 다른 URL로 오인하지 않는다.
 *  cat/region 외의 실제 내용 파라미터(q/sub/brand/urgent/today)가 하나라도
 *  있으면 비대표로 취급한다. */
export function normalizeSearchQuery(search: string): string {
  const params = new URLSearchParams(search)
  const cat = params.get('cat')
  const region = params.get('region')
  const contentKeys = [...params.keys()].filter((k) => params.get(k) && !isIgnoredParamKey(k))
  if (contentKeys.length === 0) return ''
  if (contentKeys.length === 1 && contentKeys[0] === 'cat' && cat) return `?cat=${encodeURIComponent(cat)}`
  if (contentKeys.length === 1 && contentKeys[0] === 'region' && region) return `?region=${encodeURIComponent(region)}`
  return '__non_representative__'
}

/** 필터 없는 기본 페이지("")는 항상 대표로 취급한다(검색 진입점 자체는
 *  당연히 색인 가치가 있음) — 그 외엔 고정 후보 목록에 있는지만 본다.
 *  실시간 공고 수는 이 판정에 전혀 관여하지 않는다(canonical 안정성). */
export function isRepresentativeCandidate(normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true
  return REPRESENTATIVE_SEARCH_PAGE_CANDIDATES.some((c) => c.query === normalizedQuery)
}

function getCurrentJobCountForCandidate(jobs: Job[], query: string, countFn: (jobs: Job[], search: string) => number): number {
  return countFn(jobs, query)
}

/** sitemap.xml.js가 쓴다 — 후보 목록 중 지금 실제 활성 공고 수가 최소
 *  기준을 넘는 것만 돌려준다(기준 미달이면 "일시 제외", 후보 자격
 *  자체는 유지되므로 다음에 공고가 늘면 다시 포함됨). */
export function computeSitemapEligiblePages(
  jobs: Job[],
  countFn: (jobs: Job[], search: string) => number,
): { query: string; label: string; jobCount: number }[] {
  return REPRESENTATIVE_SEARCH_PAGE_CANDIDATES
    .map((c) => ({ query: c.query, label: c.label, jobCount: getCurrentJobCountForCandidate(jobs, c.query, countFn) }))
    .filter((c) => c.jobCount >= MIN_JOBS_FOR_SITEMAP)
}

const ALL_REGIONS = REGION_MACRO_TABS.flatMap((t) => t.provinces)

export interface RepresentativePageCopy {
  title: string
  description: string
  h1: string
}

/** 대표 업직종/지역 페이지 전용 title/description/H1 — 실제 필터명과
 *  실제 공고 수만 쓰고, 급여·근무조건처럼 이 데이터에 없는 내용은 절대
 *  넣지 않는다(사용자 지시). normalizedQuery는 위 normalizeSearchQuery()의
 *  결과와 동일한 형식("?cat=X"/"?region=Y")이어야 한다 — 기본 페이지("")나
 *  비대표("__non_representative__")는 null(개인화 안 함, 기존 공통
 *  제목/문구 그대로 씀). JobSearchPage.tsx(H1)와 api/ssr.js(title/meta)가
 *  이 함수 하나를 그대로 같이 써서 서버/클라이언트 문구가 어긋나지
 *  않는다. */
export function buildRepresentativePageCopy(normalizedQuery: string, jobCount: number): RepresentativePageCopy | null {
  const catMatch = /^\?cat=(.+)$/.exec(normalizedQuery)
  if (catMatch) {
    const cat = decodeURIComponent(catMatch[1]) as JobCategory
    const label = CATEGORY_LABELS[cat] ?? cat
    return {
      title: `Việc làm ${label} mới nhất | Việt Gần Bạn`,
      description: `Xem ${jobCount} việc làm ${label} đang tuyển tại Việt Gần Bạn, cập nhật mới nhất.`,
      h1: `Việc làm ${label} mới nhất`,
    }
  }
  const regionMatch = /^\?region=(.+)$/.exec(normalizedQuery)
  if (regionMatch) {
    const region = decodeURIComponent(regionMatch[1])
    const label = ALL_REGIONS.find((r) => r.id === region)?.label ?? region
    return {
      title: `Việc làm tại ${label} mới nhất | Việt Gần Bạn`,
      description: `Xem ${jobCount} việc làm tại ${label} đang tuyển tại Việt Gần Bạn, cập nhật mới nhất.`,
      h1: `Việc làm tại ${label} mới nhất`,
    }
  }
  return null
}
