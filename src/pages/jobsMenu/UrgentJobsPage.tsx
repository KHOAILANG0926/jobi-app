import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import ApplyModal from '../../components/ApplyModal'
import { useApply } from '../../components/useApply'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_LABELS } from '../../data/categories'
import { JOB_DURATION_OPTIONS } from '../../data/jobDuration'
import { AGE_REQUIREMENT_OPTIONS } from '../../data/jobRequirements'
import { SUBCATEGORY_LABELS } from '../../data/subcategories'
import { VN_DISTRICTS_BY_PROVINCE, VN_WARDS_BY_DISTRICT } from '../../data/vnDistricts'
import { VN_PROVINCES } from '../../data/vnProvinces'
import { VN_WARDS_BY_PROVINCE } from '../../data/vnWards'
import { loadApplications } from '../../lib/applicationsStorage'
import { normalizeViText } from '../../lib/jobCoords'
import { loadSavedJobIds, toggleSavedJobId } from '../../lib/storage'
import {
  DAY_LABELS,
  DAY_ORDER,
  parseWorkDays,
  parseWorkHourBuckets,
  TIME_BUCKET_LABELS,
  TIME_BUCKET_ORDER,
  type DayCode,
  type TimeBucket,
} from '../../lib/workScheduleParse'
import type { Job, JobCategory } from '../../types/job'

type SortMode = 'newest' | 'deadline'
type PanelKey = 'region' | 'category' | 'workPeriod' | 'detail' | null

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function formatShortDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// "Tỉnh "/"Thành phố " 접두어는 정식 명칭의 일부지만 목록에 매번 반복되면
// 지저분해서, 화면 표시에서만 뺀다(매칭/저장에 쓰는 실제 값은 그대로 유지).
function shortProvinceName(name: string): string {
  return name.replace(/^(Tỉnh|Thành phố)\s+/, '')
}

// 요일/시간대 자주 쓰는 조합 — 기존 selectedDays/selectedTimeBuckets를 그대로
// 세팅하는 단축 버튼이라 새 데이터가 필요 없다(순수 UI 편의).
const DAY_PRESETS: { label: string; days: DayCode[] }[] = [
  { label: 'Mỗi ngày', days: DAY_ORDER },
  { label: 'Thứ 2 - Thứ 7', days: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'] },
  { label: 'Thứ 2 - Thứ 6', days: ['T2', 'T3', 'T4', 'T5', 'T6'] },
  { label: 'Cuối tuần (T7, CN)', days: ['T7', 'CN'] },
]
const WEEKLY_DAY_COUNTS = [1, 2, 3, 4, 5, 6, 7]
const TIME_PRESETS: { label: string; buckets: TimeBucket[] }[] = [
  { label: 'Sáng - Chiều', buckets: ['sang', 'chieu'] },
  { label: 'Chiều - Tối', buckets: ['chieu', 'toi'] },
  { label: 'Tối - Đêm', buckets: ['toi', 'dem'] },
  { label: 'Đêm - Sáng', buckets: ['dem', 'sang'] },
  { label: 'Cả ngày', buckets: TIME_BUCKET_ORDER },
]
// "Chọn thủ công" 시간 드롭다운용 — 실제 필터링에는 안 쓰는 순수 UI라
// 30분 단위 등 세분화할 필요 없이 정시(00:00~23:00)만 제공한다.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
function sameSet<T>(a: Set<T>, items: T[]): boolean {
  return a.size === items.length && items.every((x) => a.has(x))
}

// URL 쿼리스트링 ↔ 필터 상태 직렬화 — 직접 접속/새로고침/뒤로가기 시
// 조건과 결과가 그대로 유지돼야 하고(사용자 지시), entry-server.tsx가
// StaticRouter에 이 URL을 그대로 넘기므로 SSR도 같은 초기값을 읽어 클라이언트와
// 동일한 필터 결과를 렌더한다 — 이 함수들이 서버/클라이언트 필터 일치의
// 근거다. 콤마는 통제된 값(카테고리 id, 동/사 이름, 요일 코드 등)에만 쓰고,
// 자유 텍스트인 키워드는 콤마가 값 자체에 들어있을 수 있어 별도로 '|'를
// 구분자로 쓴다(둘 다 자체적으로 포함할 여지가 없는 문자).
function readCsvParam(sp: URLSearchParams, key: string): string[] {
  const v = sp.get(key)
  return v ? v.split(',').filter(Boolean) : []
}
function readCsvSetParam<T extends string>(sp: URLSearchParams, key: string): Set<T> {
  return new Set(readCsvParam(sp, key) as T[])
}
function readNumberSetParam(sp: URLSearchParams, key: string): Set<number> {
  return new Set(readCsvParam(sp, key).map(Number).filter((n) => !Number.isNaN(n)))
}
function readPipeListParam(sp: URLSearchParams, key: string): string[] {
  const v = sp.get(key)
  return v ? v.split('|').filter(Boolean) : []
}

/** 클릭하면 패널이 펼쳐지는 필터 드롭다운 — 급구 페이지의 4개 필터
 * (지역/업직종/근무기간/상세조건)가 전부 같은 틀을 쓴다. 패널 바깥을
 * 클릭하면 닫힌다.
 * 2026-09-19 사용자 지시("상단 클릭하면 공고가 가려지지?") — 패널을 각
 * 버튼 밑에서 그대로 렌더하면(과거엔 `position:absolute`로 띄워서) 아래
 * 공고 목록을 덮어버렸다. 버튼은 `.jm-urgent-filters` 가로줄 안에 그대로
 * 두되, 패널 내용은 `createPortal`로 그 줄 바로 아래(`panelSlot`, 일반
 * 문서 흐름)에 옮겨 그려서 목록이 밀려 내려가게 한다. */
function FilterDropdown({
  label, count, isOpen, onToggle, onClose, panelSlot, children,
}: {
  label: string
  count: number
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  panelSlot: HTMLDivElement | null
  children: ReactNode
}) {
  const btnRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      const insideButton = btnRef.current?.contains(target)
      const insidePanel = panelSlot?.contains(target)
      if (!insideButton && !insidePanel) onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [isOpen, onClose, panelSlot])

  return (
    <div className="jm-filter-dropdown" ref={btnRef}>
      <button
        type="button"
        className={`jm-filter-dropdown__btn${isOpen ? ' is-open' : ''}${count > 0 ? ' has-value' : ''}`}
        onClick={onToggle}
      >
        {label}{count > 0 ? ` (${count})` : ''}
        <span className="jm-filter-dropdown__caret" aria-hidden>▾</span>
      </button>
      {isOpen && panelSlot && createPortal(
        <div className="jm-filter-dropdown__panel">{children}</div>,
        panelSlot,
      )}
    </div>
  )
}

/**
 * 급구 공고 — local_jobs.urgent === true인 공고만 모아 보여준다. 제목의
 * 모호한 단어("gấp" 등)로 urgent를 임의 판정하지 않는다 — jobRows.ts가
 * DB 컬럼값을 그대로 매핑하고, 이 페이지는 그 job.urgent 값만 신뢰한다.
 *
 * 2026-09-16 사용자 지시로 알바몬 "급구 알바" 페이지의 필터 패널 구성을
 * 참고해 재구성. 알바몬은 4개 필터 각각이 클릭 시 펼쳐지는 패널이고,
 * 지역(시도/시구군/동 계단식)·업직종(대/소분류 2단)·근무기간(요일·시간대
 * 구조화 선택)·상세조건(성별/연령/고용형태) 등 훨씬 세분화된 항목을 담고
 * 있다 — 이 앱 데이터에는 그런 계층/구조화 값이 없어(local_jobs에 성별·
 * 연령 컬럼 자체가 없고, workDays/hours는 크롤러가 넣은 자유텍스트라
 * 요일·시간대별로 쪼갤 수 없음) 그 부분까지 그대로 베끼면 실제로 아무것도
 * 걸러내지 못하는 가짜 필터가 된다. 그래서 "패널 UI 틀"은 4개 다 그대로
 * 가져오되, 내용물은 실제 있는 데이터 기준으로만 채웠다: 지역/업직종은
 * 검색+다중선택, 근무기간은 다중선택(있는 값만 + job_duration 고정
 * 7구간), 상세조건은 고용형태(work_period, 2026-09-18부터 이 패널로
 * 이동) + 키워드 포함/제외 검색(성별/연령은 데이터가 없어 제외).
 */
export default function UrgentJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  // 2026-09-18 사용자 지시("패널이 열린상태로 두라고", "화면이 안비게") —
  // 급구 페이지 진입 시 Khu vực 패널이 닫혀있으면 기본 지역(Cần Thơ)에
  // 공고가 0건이라 화면이 텅 비어 보인다. 패널을 처음부터 열어두면 빈
  // 결과창 대신 지역 선택 UI가 바로 채워져 보인다.
  const [openPanel, setOpenPanel] = useState<PanelKey>('region')
  // 열린 패널이 실제로 렌더될 위치(.jm-urgent-filters 줄 바로 아래, 일반
  // 문서 흐름) — FilterDropdown이 createPortal로 이 노드에 그린다.
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null)
  // 2026-09-16 사용자 지시로 지역 필터를 베트남 2025-07-01 행정구역 개편 반영한
  // 정확한 2단(성/시→동/사) 체계로 교체 — 예전 JOB_REGIONS(29개 임의 묶음, 실제
  // 통합 결과와 안 맞는 부분 확인됨)는 더 이상 쓰지 않는다. resolvedProvince/
  // resolvedWards는 crawler/vn_provinces_lookup.py(통계총국 공식 자료)로 확정된
  // 값만 담고 있어 옛/새 이름 혼동이 없다 — 값이 없는 공고(아직 지오코딩
  // 재처리 전)는 지역 필터로 못 찾는 게 맞다(억지로 옛 방식과 섞지 않음).
  // 2026-09-17 사용자 지시로 한때 URL에 ?province= 없으면 첫 성/시
  // (VN_PROVINCES[0]=Cần Thơ)를 기본 필터로 자동 적용했었으나, Cần Thơ에
  // 실제 공고가 0건이라 첫 화면이 계속 빈 목록으로 보이는 문제가 있었다.
  // 2026-09-19 사용자 지시("아무것도 선택하지 않아도 기본테이블 보이게
  // 해줘") — 아무 지역도 선택 안 된 상태(null)를 기본값으로 되돌려서,
  // 처음 들어오면 전체 급구 공고 목록이 필터 없이 그대로 보이게 한다.
  const [selectedProvince, setSelectedProvince] = useState<string | null>(
    () => searchParams.get('province') ?? null,
  )
  const [selectedWards, setSelectedWards] = useState<Set<string>>(
    () => readCsvSetParam(searchParams, 'wards'),
  )
  // 2026-09-18 사용자 지시 — 2025년 개편으로 행정상 폐지된 옛 Quận/Huyện(구/현)을
  // 생활권 중간 탐색 단계로 복원(vnDistricts.ts, 통계총국 공식 legacy 변환표
  // 기반). 실제 필터는 여전히 성/시+동/사(selectedProvince/selectedWards)로만
  // 걸린다 — selectedDistrict는 오른쪽 Xã/Phường 열에 어느 구/현의 동만 보여줄지
  // 결정하는 순수 탐색용 상태이고, 선택 자체는 아니다(알바몬도 시/구/군 클릭은
  // 오른쪽 목록만 바꾸고 필터는 동/읍/면에서 확정됨).
  // URL에 동/사가 이미 있으면(공유 링크/새로고침) 오른쪽 패널이 빈 "구/현을
  // 먼저 선택하세요" 상태로 뜨지 않게, 첫 동/사가 속한 구/현을 탐색 상태로
  // 미리 잡아둔다(필터 자체는 selectedWards가 이미 갖고 있어 이 값과 무관).
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(() => {
    const province = searchParams.get('province')
    const wards = readCsvParam(searchParams, 'wards')
    if (!province || wards.length === 0) return null
    const byDistrict = VN_WARDS_BY_DISTRICT[province]
    if (!byDistrict) return null
    for (const [district, districtWards] of Object.entries(byDistrict)) {
      if (districtWards.includes(wards[0])) return district
    }
    return null
  })
  const [categoryIds, setCategoryIds] = useState<Set<JobCategory>>(
    () => readCsvSetParam<JobCategory>(searchParams, 'category'),
  )
  // 2026-09-17 사용자 지시("업종도 동일하게") — 대분류(카테고리)|소분류 2단
  // 구조로 재구성. activeCategoryForSub은 지금 오른쪽 열에 어느 대분류의
  // 소분류 목록을 보여줄지 결정하는 탐색 상태(선택 여부와 별개)이고,
  // selectedSubcategoryKeys는 실제 필터로 쓰는 값이다. subcategory id는
  // 대분류마다 겹칠 수 있어("thu_ngan"이 cafe/restaurant/retail에 모두 있음)
  // `${category}:${subId}` 복합키로 저장해 다른 대분류의 같은 이름 소분류와
  // 섞이지 않게 한다.
  const [selectedSubcategoryKeys, setSelectedSubcategoryKeys] = useState<Set<string>>(
    () => readCsvSetParam(searchParams, 'subcat'),
  )
  // URL에 category/subcat이 있으면(공유 링크) 오른쪽 소분류 패널이 빈
  // "먼저 선택하세요" 상태가 아니라 실제 선택된 대분류를 바로 보여준다.
  const [activeCategoryForSub, setActiveCategoryForSub] = useState<JobCategory | null>(() => {
    const first = readCsvParam(searchParams, 'category')[0] as JobCategory | undefined
    if (first) return first
    const firstSubKey = readCsvParam(searchParams, 'subcat')[0]
    return (firstSubKey?.split(':')[0] as JobCategory | undefined) ?? null
  })
  const [workPeriods, setWorkPeriods] = useState<Set<string>>(
    () => readCsvSetParam(searchParams, 'workPeriod'),
  )
  // 2026-09-17 사용자 지시 — work_days/hours는 크롤러가 자유 문장으로 저장한
  // 값이라(workScheduleParse.ts 참고) 요일/시간대는 job마다 파싱해서 걸러야
  // 한다. 요일 7개·시간대 4개는 고정된 작은 집합이라(수천 개짜리 동/사와
  // 다름) 공고 존재 여부와 무관하게 항상 전부 보여준다(성/시와 같은 원칙).
  const [selectedDays, setSelectedDays] = useState<Set<DayCode>>(
    () => readCsvSetParam<DayCode>(searchParams, 'days'),
  )
  const [selectedTimeBuckets, setSelectedTimeBuckets] = useState<Set<TimeBucket>>(
    () => readCsvSetParam<TimeBucket>(searchParams, 'timeBuckets'),
  )
  // 2026-09-17 사용자 지시("한눈에 보이게") — 실제 알바몬 근무기간 패널은
  // 요일/시간대를 개별 선택뿐 아니라 자주 쓰는 조합(월-토/주말 등)과 주당
  // 근무일수(주N일)까지 한 화면에서 바로 고를 수 있게 해뒀다. 조합 프리셋은
  // 기존 selectedDays/selectedTimeBuckets를 그대로 세팅하는 UI 단축키일 뿐이라
  // 새 데이터가 필요 없고, 주당 근무일수는 parseWorkDays(job.workDays).size로
  // 실제 파싱 결과에서 바로 계산되는 값이라 이것도 진짜 데이터다.
  const [selectedDayCounts, setSelectedDayCounts] = useState<Set<number>>(
    () => readNumberSetParam(searchParams, 'dayCounts'),
  )
  // 2026-09-18 사용자 지시("둘 다 가야지") — job_duration(알바몬 스타일
  // 근무기간 7구간, PostJob.tsx 직접등록 전용 컬럼) 추가. 크롤러 공고는
  // 채우지 않아 대부분 undefined일 걸 알고 진행 — CHATGPT_HANDOFF.md 참고.
  // 2026-09-20 사용자 지시("헤더 메가메뉴 탐색축 세분화") — 헤더 "Theo thời
  // gian"에서 특정 근무기간으로 바로 진입할 수 있도록 province와 동일한
  // 패턴으로 URL(?duration=)에서 초기값을 읽는다(양방향 동기화는 안 함 —
  // 다른 필터들도 마찬가지로 진입 시점 프리셋 용도일 뿐).
  const [jobDurations, setJobDurations] = useState<Set<string>>(
    () => readCsvSetParam(searchParams, 'duration'),
  )
  // 2026-09-20 사용자 지시 — 헤더 "Theo điều kiện"에서 "자가서약(근로계약서/
  // BHXH) 기업 공고만" 보기로 바로 진입. labor_contract_pledge/
  // social_insurance_pledge 둘 중 하나라도 true인 공고만 남긴다.
  const [pledgeOnly, setPledgeOnly] = useState<boolean>(() => searchParams.get('pledge') === '1')
  // 2026-09-18 사용자 지시(알바몬 캡처본 참고) — "근무요일"/"근무시간" 줄에
  // "목록에서 선택/직접선택" 전환을 추가한다. 근무요일은 두 모드 다 기존
  // selectedDays state를 그대로 쓰는 진짜 기능(목록=프리셋 조합, 직접선택=
  // 요일 하나씩 직접 고르기)이라 가짜 필터가 아니다. 근무시간은 정확한
  // 시작/종료 "시각" 데이터가 DB에 없어(hours가 자유텍스트, 버킷 단위로만
  // 파싱 가능 — workScheduleParse.ts) "직접선택"의 시작/종료시간 드롭다운은
  // 실제 필터링에 반영하지 않는 순수 UI(사용자 확인 후 진행, 아래 안내 문구로
  // 명시) — 정확한 시간 필터는 위의 버킷 칩으로만 가능하다.
  const [dayFilterMode, setDayFilterMode] = useState<'list' | 'manual'>('list')
  const [timeFilterMode, setTimeFilterMode] = useState<'list' | 'manual'>('list')
  const [manualStartTime, setManualStartTime] = useState('')
  const [manualEndTime, setManualEndTime] = useState('')
  // 2026-09-18 사용자 지시("동일하게 만들어") — 알바몬 캡처본은 목록/직접선택
  // 둘 다 항상 같이 보이고(선택 안 된 쪽만 흐리게) "협의 제외" 체크박스가
  // 있다. "협의 제외" 자체는 그대로 베끼면 대응 데이터가 없는 가짜 필터가
  // 되므로, 같은 의도(정보가 불명확한 공고 제외)를 실제 데이터로 구현한다 —
  // workDays/hours가 비어있는(=일정 미기재) 공고를 제외하는 진짜 필터.
  const [excludeUnspecifiedDays, setExcludeUnspecifiedDays] = useState(
    () => searchParams.get('excludeDays') === '1',
  )
  const [excludeUnspecifiedHours, setExcludeUnspecifiedHours] = useState(
    () => searchParams.get('excludeHours') === '1',
  )
  // "Điều kiện khác" 성별/연령 — local_jobs.gender_requirement 값("Nam"/"Nữ")과
  // 그대로 맞춘다 — 번역 레이어 없이 바로 비교(filtered useMemo 참고).
  const [genderFilter, setGenderFilter] = useState<'Nam' | 'Nữ' | null>(() => {
    const g = searchParams.get('gender')
    return g === 'Nam' || g === 'Nữ' ? g : null
  })
  const [ageFilter, setAgeFilter] = useState(() => searchParams.get('age') ?? '')
  const [categorySearch, setCategorySearch] = useState('')
  const [regionSearch, setRegionSearch] = useState('')
  const [includeKeywords, setIncludeKeywords] = useState<string[]>(
    () => readPipeListParam(searchParams, 'include'),
  )
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(
    () => readPipeListParam(searchParams, 'exclude'),
  )
  const [includeDraft, setIncludeDraft] = useState('')
  const [excludeDraft, setExcludeDraft] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (searchParams.get('sort') === 'deadline' ? 'deadline' : 'newest'),
  )
  const [pageSize, setPageSize] = useState<number>(() => {
    const n = Number(searchParams.get('pageSize'))
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 20
  })
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  // 필터 상태 → URL 통합 동기화. 직접 접속/새로고침/뒤로가기 시 조건과
  // 결과가 그대로 유지돼야 한다는 요구사항의 핵심 — 이 effect 하나가 모든
  // 필터를 URL에 반영하고(값이 기본값이면 파라미터 자체를 지워 URL을
  // 깔끔하게 유지), 위의 각 useState 초기값이 그 반대 방향(URL → 상태)을
  // 담당한다. entry-server.tsx가 StaticRouter에 동일한 URL을 그대로
  // 넘기므로 SSR도 같은 결과를 렌더한다(서버/클라이언트 필터 일치의 근거).
  // 기존 province만 동기화하던 effect를 여기로 통합했다.
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      const setOrDelete = (key: string, value: string) => {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      setOrDelete('province', selectedProvince ?? '')
      setOrDelete('wards', [...selectedWards].join(','))
      setOrDelete('category', [...categoryIds].join(','))
      setOrDelete('subcat', [...selectedSubcategoryKeys].join(','))
      setOrDelete('workPeriod', [...workPeriods].join(','))
      setOrDelete('duration', [...jobDurations].join(','))
      setOrDelete('pledge', pledgeOnly ? '1' : '')
      setOrDelete('gender', genderFilter ?? '')
      setOrDelete('age', ageFilter)
      setOrDelete('days', [...selectedDays].join(','))
      setOrDelete('dayCounts', [...selectedDayCounts].join(','))
      setOrDelete('excludeDays', excludeUnspecifiedDays ? '1' : '')
      setOrDelete('timeBuckets', [...selectedTimeBuckets].join(','))
      setOrDelete('excludeHours', excludeUnspecifiedHours ? '1' : '')
      setOrDelete('include', includeKeywords.join('|'))
      setOrDelete('exclude', excludeKeywords.join('|'))
      setOrDelete('sort', sortMode === 'deadline' ? 'deadline' : '')
      setOrDelete('pageSize', pageSize === 20 ? '' : String(pageSize))
      return next
    }, { replace: true })
  }, [
    selectedProvince, selectedWards, categoryIds, selectedSubcategoryKeys, workPeriods, jobDurations,
    pledgeOnly, genderFilter, ageFilter, selectedDays, selectedDayCounts, excludeUnspecifiedDays,
    selectedTimeBuckets, excludeUnspecifiedHours, includeKeywords, excludeKeywords, sortMode, pageSize,
    setSearchParams,
  ])

  useEffect(() => {
    const sync = () => setSavedIds(new Set(loadSavedJobIds(user?.id)))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('vgb:saved-jobs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) { setAppliedIds(new Set()); return }
    let cancelled = false
    loadApplications().then((apps) => {
      if (cancelled) return
      setAppliedIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId)))
    })
    return () => { cancelled = true }
  }, [user?.id])

  const handleToggleSave = useCallback((job: Job) => {
    toggleSavedJobId(job.id, user?.id)
    setSavedIds(new Set(loadSavedJobIds(user?.id)))
  }, [user?.id])

  const handleApply = useCallback((job: Job) => {
    if (!user) { navigate('/dang-nhap'); return }
    openApply(job)
  }, [user, navigate, openApply])

  const togglePanel = (key: PanelKey) => setOpenPanel((cur) => (cur === key ? null : key))
  const closePanel = () => setOpenPanel(null)

  const selectProvince = (p: string | null) => {
    setSelectedProvince(p)
    setSelectedWards(new Set())
    setSelectedDistrict(null)
  }
  const selectDistrict = (d: string | null) => setSelectedDistrict((cur) => (cur === d ? null : d))
  // 2026-09-20 사용자 지시 — 구/현은 지금까지 순수 탐색용(오른쪽 동/사
  // 목록만 바꿈)이었는데, "이 구 전체"를 한 번에 필터로 걸고 싶다는 요청.
  // 업직종 패널의 "Tất cả <대분류>" 패턴과 동일하게, 그 구/현에 속한 동/사
  // 전체를 selectedWards에 한꺼번에 넣는다(개별 동 선택과 같은 저장소를
  // 쓰므로 이후 개별 토글도 그대로 동작).
  const selectAllWardsInDistrict = (province: string, district: string) => {
    const wards = VN_WARDS_BY_DISTRICT[province]?.[district] ?? []
    setSelectedDistrict(district)
    setSelectedWards(new Set(wards))
  }
  const toggleWard = (w: string) => setSelectedWards((prev) => {
    const next = new Set(prev)
    if (next.has(w)) next.delete(w); else next.add(w)
    return next
  })
  // 2026-09-17 알바몬 참고 캡처본 확인 후 수정 — 대분류 클릭은 탐색(오른쪽에
  // 어느 대분류의 소분류를 보여줄지)만 하고, 실제 필터 선택은 오른쪽 목록의
  // 항목(아래 toggleCategoryAll/toggleSubcategory)에서만 일어난다. 원래는
  // 이 함수가 탐색과 선택을 같이 처리해서, 소분류를 구경하려고 다른 대분류를
  // 클릭할 때마다 그 대분류가 의도치 않게 필터에 계속 쌓이는 문제가 있었다.
  const activateCategory = (c: JobCategory) => setActiveCategoryForSub(c)
  const toggleCategoryAll = (c: JobCategory) => setCategoryIds((prev) => {
    const next = new Set(prev)
    if (next.has(c)) next.delete(c); else next.add(c)
    return next
  })
  const toggleSubcategory = (category: JobCategory, subId: string) => {
    const key = `${category}:${subId}`
    setSelectedSubcategoryKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const toggleWorkPeriod = (p: string) => setWorkPeriods((prev) => {
    const next = new Set(prev)
    if (next.has(p)) next.delete(p); else next.add(p)
    return next
  })
  const toggleJobDuration = (d: string) => setJobDurations((prev) => {
    const next = new Set(prev)
    if (next.has(d)) next.delete(d); else next.add(d)
    return next
  })
  const toggleDay = (d: DayCode) => setSelectedDays((prev) => {
    const next = new Set(prev)
    if (next.has(d)) next.delete(d); else next.add(d)
    return next
  })
  const toggleTimeBucket = (t: TimeBucket) => setSelectedTimeBuckets((prev) => {
    const next = new Set(prev)
    if (next.has(t)) next.delete(t); else next.add(t)
    return next
  })
  const applyDayPreset = (days: DayCode[]) => setSelectedDays((prev) => (sameSet(prev, days) ? new Set() : new Set(days)))
  const applyTimePreset = (buckets: TimeBucket[]) => setSelectedTimeBuckets((prev) => (sameSet(prev, buckets) ? new Set() : new Set(buckets)))
  const toggleDayCount = (n: number) => setSelectedDayCounts((prev) => {
    const next = new Set(prev)
    if (next.has(n)) next.delete(n); else next.add(n)
    return next
  })

  const addKeyword = (draft: string, list: string[], setList: (v: string[]) => void, setDraft: (v: string) => void) => {
    const v = draft.trim()
    if (v && !list.includes(v)) setList([...list, v])
    setDraft('')
  }

  // 모집 중인 급구만: 급구(urgent)라도 지원 마감일이 이미 지났으면 급구 목록에서
  // 제외한다(SavedJobsPage의 "모집 중/마감" 판정과 동일 기준 — 마감일이 없으면
  // 상시 모집으로 보고 포함).
  const todayStr = new Date().toISOString().slice(0, 10)
  const urgentJobs = useMemo(
    () => jobs.filter((j) => j.urgent && (!j.applicationDeadline || j.applicationDeadline >= todayStr)),
    [jobs, todayStr],
  )

  // work_period는 크롤러 자유텍스트(닫힌 enum 아님)라 job_duration과 달리
  // 고정 목록을 쓰지 않는다 — 실제 존재하는 값만 동적으로 보여준다(2026-09-18
  // 사용자 지시로 고정 목록 시도 후 되돌림).
  const workPeriodOptions = useMemo(() => {
    const set = new Set<string>()
    for (const j of urgentJobs) if (j.workPeriod) set.add(j.workPeriod)
    return [...set].sort()
  }, [urgentJobs])

  // 성/시(1단계)뿐 아니라 동/사(2단계)도 공고 존재 여부와 무관하게 항상
  // 전체를 보여준다(2026-09-17 사용자 지시 — "2차 지역은 왜 다 안보여?").
  // 처음엔 전국 동/사가 3,321개라 프론트에 다 들고 있기 부담스럽다고
  // 판단했지만, 성/시 1개를 선택한 뒤에는 그 성/시 안의 동/사만 보여주면
  // 되므로(평균 100개 이하) vnWards.ts(vietnam-provinces 패키지에서 추출한
  // 공식 전체 목록)로 항상 전체를 보여줄 수 있다. 선택한 동/사에 실제
  // 매칭되는 공고가 없으면 0건으로 정직하게 보여주면 된다(province와 동일
  // 원칙 — 목록 자체를 job 데이터로 줄이지 않는다).
  const districtOptions = useMemo(() => {
    if (!selectedProvince) return []
    return VN_DISTRICTS_BY_PROVINCE[selectedProvince] ?? []
  }, [selectedProvince])
  const districtWardOptions = useMemo(() => {
    if (!selectedProvince || !selectedDistrict) return []
    return VN_WARDS_BY_DISTRICT[selectedProvince]?.[selectedDistrict] ?? []
  }, [selectedProvince, selectedDistrict])

  // 2026-09-17 사용자가 알바몬 캡처본("대전 치면 이렇게 나오거든") 보여주며
  // 요청 — 알바몬은 지역 검색창에 "대전"을 치면 성/시·동/사를 가리지 않고
  // 이름에 포함된 모든 지역을 평탄화해서 한 번에 보여준다. 성/시 34개 ×
  // 동/사 평균 100개 = 약 3,300건 전체를 한 번만 만들어두고(useMemo, deps
  // 없음 — 정적 데이터라 재계산 불필요) 검색어로 필터링한다.
  // 2026-09-20 사용자 지시 — 구/현 이름으로도 검색되게(지금까지는 성/시+
  // 동/사만 인덱싱돼서 "Bình Thuỷ" 같은 구/현 이름을 쳐도 안 나왔음).
  // district 필드를 추가해 세 종류(성/시만 / 성/시+구/현 / 성/시+동/사)를
  // 한 목록에 같이 인덱싱한다.
  const regionSearchIndex = useMemo(() => {
    const list: { key: string; province: string; district: string | null; ward: string | null; label: string }[] = []
    for (const p of VN_PROVINCES) {
      list.push({ key: p, province: p, district: null, ward: null, label: shortProvinceName(p) })
      for (const d of VN_DISTRICTS_BY_PROVINCE[p] ?? []) {
        list.push({ key: `${p}::d::${d}`, province: p, district: d, ward: null, label: `${shortProvinceName(p)} · ${d}` })
      }
      for (const w of VN_WARDS_BY_PROVINCE[p] ?? []) {
        list.push({ key: `${p}::${w}`, province: p, district: null, ward: w, label: `${shortProvinceName(p)} · ${w}` })
      }
    }
    return list
  }, [])
  const regionSearchResults = useMemo(() => {
    const q = normalizeViText(regionSearch.trim())
    if (!q) return []
    return regionSearchIndex.filter((item) => normalizeViText(item.label).includes(q)).slice(0, 50)
  }, [regionSearch, regionSearchIndex])
  const findDistrictOfWard = (province: string, ward: string): string | null => {
    const byDistrict = VN_WARDS_BY_DISTRICT[province]
    if (!byDistrict) return null
    for (const [district, wards] of Object.entries(byDistrict)) {
      if (wards.includes(ward)) return district
    }
    return null
  }
  const isRegionResultSelected = (item: { province: string; district: string | null; ward: string | null }) => {
    if (selectedProvince !== item.province) return false
    if (item.ward !== null) return selectedWards.has(item.ward)
    if (item.district !== null) {
      const districtWards = VN_WARDS_BY_DISTRICT[item.province]?.[item.district] ?? []
      return districtWards.length > 0 && districtWards.every((w) => selectedWards.has(w))
    }
    return selectedWards.size === 0
  }
  const selectRegionSearchResult = (item: { province: string; district: string | null; ward: string | null }) => {
    if (item.ward !== null) {
      if (selectedProvince !== item.province) {
        setSelectedProvince(item.province)
        setSelectedWards(new Set([item.ward]))
      } else {
        toggleWard(item.ward)
      }
      setSelectedDistrict(findDistrictOfWard(item.province, item.ward))
    } else if (item.district !== null) {
      setSelectedProvince(item.province)
      selectAllWardsInDistrict(item.province, item.district)
    } else {
      selectProvince(item.province)
    }
  }

  const categoryEntries = useMemo(
    () => (Object.keys(CATEGORY_LABELS) as JobCategory[])
      .filter((c) => !categorySearch || normalizeViText(CATEGORY_LABELS[c]).includes(normalizeViText(categorySearch))),
    [categorySearch],
  )

  const filtered = useMemo(() => {
    let list = urgentJobs
    if (selectedProvince) {
      list = list.filter((j) => (j.workLocations ?? []).some((loc) => {
        if (loc.resolvedProvince !== selectedProvince) return false
        if (selectedWards.size === 0) return true
        return (loc.resolvedWards ?? []).some((w) => selectedWards.has(w))
      }))
    }
    if (categoryIds.size > 0) list = list.filter((j) => categoryIds.has(j.category))
    if (selectedSubcategoryKeys.size > 0) {
      list = list.filter((j) => !!j.subcategory && selectedSubcategoryKeys.has(`${j.category}:${j.subcategory}`))
    }
    if (workPeriods.size > 0) list = list.filter((j) => !!j.workPeriod && workPeriods.has(j.workPeriod))
    if (jobDurations.size > 0) list = list.filter((j) => !!j.jobDuration && jobDurations.has(j.jobDuration))
    // 성별/연령은 "이 공고 자체의 성질"이 아니라 "누가 지원 가능한가"라는
    // 조건이라 workPeriod/jobDuration과 다르게 다룬다 — 조건 값이 없는
    // 공고(genderRequirement/ageRequirement가 null)는 "제한 없음"을
    // 뜻하므로 어느 필터를 선택해도 계속 보여야 한다(선택한 조건과
    // 정확히 일치하는 공고만 남기면 아직 아무 공고도 이 값을 안 채운
    // 지금 시점엔 전부 사라져버림).
    if (genderFilter) list = list.filter((j) => !j.genderRequirement || j.genderRequirement === genderFilter)
    if (ageFilter) list = list.filter((j) => !j.ageRequirement || j.ageRequirement === ageFilter)
    if (pledgeOnly) list = list.filter((j) => !!j.laborContractPledge || !!j.socialInsurancePledge)
    if (selectedDays.size > 0) {
      list = list.filter((j) => {
        const days = parseWorkDays(j.workDays)
        return [...selectedDays].some((d) => days.has(d))
      })
    }
    if (selectedDayCounts.size > 0) {
      list = list.filter((j) => selectedDayCounts.has(parseWorkDays(j.workDays).size))
    }
    if (excludeUnspecifiedDays) list = list.filter((j) => parseWorkDays(j.workDays).size > 0)
    if (excludeUnspecifiedHours) list = list.filter((j) => parseWorkHourBuckets(j.hours).size > 0)
    if (selectedTimeBuckets.size > 0) {
      list = list.filter((j) => {
        const buckets = parseWorkHourBuckets(j.hours)
        return [...selectedTimeBuckets].some((b) => buckets.has(b))
      })
    }
    if (includeKeywords.length > 0) {
      list = list.filter((j) => {
        const text = normalizeViText(`${j.title} ${j.description}`)
        return includeKeywords.every((k) => text.includes(normalizeViText(k)))
      })
    }
    if (excludeKeywords.length > 0) {
      list = list.filter((j) => {
        const text = normalizeViText(`${j.title} ${j.description}`)
        return !excludeKeywords.some((k) => text.includes(normalizeViText(k)))
      })
    }
    return list
  }, [urgentJobs, selectedProvince, selectedWards, categoryIds, selectedSubcategoryKeys, workPeriods, jobDurations, genderFilter, ageFilter, pledgeOnly, selectedDays, selectedDayCounts, excludeUnspecifiedDays, excludeUnspecifiedHours, selectedTimeBuckets, includeKeywords, excludeKeywords])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sortMode === 'deadline') {
      // 마감일 없는(상시 모집) 공고는 급하지 않다고 보고 뒤로 보낸다.
      list.sort((a, b) => {
        if (!a.applicationDeadline && !b.applicationDeadline) return 0
        if (!a.applicationDeadline) return 1
        if (!b.applicationDeadline) return -1
        return a.applicationDeadline.localeCompare(b.applicationDeadline)
      })
    } else {
      list.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    }
    return list
  }, [filtered, sortMode])

  const visible = useMemo(() => sorted.slice(0, pageSize), [sorted, pageSize])

  const isApplied = useCallback((id: string) => appliedIds.has(id), [appliedIds])

  const activeFilterCount = (selectedProvince ? 1 : 0) + selectedWards.size + categoryIds.size + selectedSubcategoryKeys.size + workPeriods.size + jobDurations.size + (genderFilter ? 1 : 0) + (ageFilter ? 1 : 0) + (pledgeOnly ? 1 : 0) + selectedDays.size + selectedDayCounts.size + (excludeUnspecifiedDays ? 1 : 0) + selectedTimeBuckets.size + (excludeUnspecifiedHours ? 1 : 0) + includeKeywords.length + excludeKeywords.length

  const clearAllFilters = () => {
    selectProvince(null)
    setCategoryIds(new Set())
    setSelectedSubcategoryKeys(new Set())
    setWorkPeriods(new Set())
    setJobDurations(new Set())
    setGenderFilter(null)
    setAgeFilter('')
    setPledgeOnly(false)
    setSelectedDays(new Set())
    setSelectedDayCounts(new Set())
    setExcludeUnspecifiedDays(false)
    setSelectedTimeBuckets(new Set())
    setExcludeUnspecifiedHours(false)
    setIncludeKeywords([])
    setExcludeKeywords([])
  }

  return (
    <div className="page jobs-menu-page jm-urgent-page">
      <header className="page-header">
        <h1 className="page-header__title">🔥 Tuyển gấp</h1>
        <p className="page-header__lead">
          Các công việc nhà tuyển dụng đánh dấu cần tuyển gấp — chọn điều kiện để lọc theo nhu cầu của bạn.
        </p>
      </header>

      <div className="jm-urgent-filters">
        <FilterDropdown
          label="Khu vực"
          count={(selectedProvince ? 1 : 0) + selectedWards.size}
          isOpen={openPanel === 'region'}
          onToggle={() => togglePanel('region')}
          onClose={closePanel}
          panelSlot={panelSlot}
        >
          <div className="jm-search-input-wrap jm-search-input-wrap--khu-vuc">
            <input
              type="text"
              className="jm-filter-dropdown__search"
              placeholder=""
              value={regionSearch}
              onChange={(e) => setRegionSearch(e.target.value)}
            />
            <svg className="jm-search-input-wrap__icon" aria-hidden="true" width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          {regionSearch.trim() ? (
            <ul className="jm-region-col__list jm-region-search-results">
              {regionSearchResults.length === 0 ? (
                <p className="hint jm-region-col__hint">Không tìm thấy khu vực phù hợp.</p>
              ) : (
                regionSearchResults.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`jm-region-row${isRegionResultSelected(item) ? ' is-selected' : ''}`}
                      onClick={() => selectRegionSearchResult(item)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <div className="jm-region-columns jm-region-columns--khu-vuc">
              <div className="jm-region-col jm-region-col--tinh">
                <p className="jm-region-col__head">Tỉnh / Thành phố</p>
                <ul className="jm-region-col__list">
                  {VN_PROVINCES.map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        className={`jm-region-row${selectedProvince === p ? ' is-selected' : ''}`}
                        onClick={() => selectProvince(selectedProvince === p ? null : p)}
                      >
                        {shortProvinceName(p)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="jm-region-col jm-region-col--quan">
                <p className="jm-region-col__head">Quận / Huyện</p>
                {!selectedProvince ? (
                  <p className="hint jm-region-col__hint">Chọn tỉnh/thành phố trước.</p>
                ) : (
                  <ul className="jm-region-col__list">
                    {districtOptions.map((d) => (
                      <li key={d}>
                        <button
                          type="button"
                          className={`jm-region-row${selectedDistrict === d ? ' is-selected' : ''}`}
                          onClick={() => selectDistrict(d)}
                        >
                          {d}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="jm-region-col jm-region-col--wide">
                <p className="jm-region-col__head">Xã / Phường</p>
                {!selectedProvince ? (
                  <p className="hint jm-region-col__hint">Chọn tỉnh/thành phố trước.</p>
                ) : !selectedDistrict ? (
                  <p className="hint jm-region-col__hint">Chọn quận/huyện trước.</p>
                ) : districtWardOptions.length === 0 ? (
                  <p className="hint jm-region-col__hint">Các tin tuyển gấp ở {shortProvinceName(selectedProvince)} chưa xác định được xã/phường cụ thể.</p>
                ) : (
                  <ul className="jm-region-col__list">
                    <li>
                      <button
                        type="button"
                        className={`jm-region-row${districtWardOptions.every((w) => selectedWards.has(w)) ? ' is-selected' : ''}`}
                        onClick={() => selectAllWardsInDistrict(selectedProvince, selectedDistrict)}
                      >
                        Tất cả {selectedDistrict}
                      </button>
                    </li>
                    {districtWardOptions.map((w) => (
                      <li key={w}>
                        <button
                          type="button"
                          className={`jm-region-row${selectedWards.has(w) ? ' is-selected' : ''}`}
                          onClick={() => toggleWard(w)}
                        >
                          {w}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div className="jm-filter-dropdown__footer">
            <button type="button" className="jm-filter-dropdown__reset" onClick={() => { selectProvince(null); setRegionSearch('') }}>
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Ngành nghề"
          count={categoryIds.size + selectedSubcategoryKeys.size}
          isOpen={openPanel === 'category'}
          onToggle={() => togglePanel('category')}
          onClose={closePanel}
          panelSlot={panelSlot}
        >
          <div className="jm-search-input-wrap jm-search-input-wrap--nganh-nghe">
            <input
              type="text"
              className="jm-filter-dropdown__search"
              placeholder=""
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            <svg className="jm-search-input-wrap__icon" aria-hidden="true" width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="jm-region-columns jm-region-columns--category">
            <div className="jm-region-col jm-region-col--narrow">
              <p className="jm-region-col__head">Ngành nghề lớn</p>
              <ul className="jm-region-col__list">
                {categoryEntries.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      className={`jm-region-row${activeCategoryForSub === c ? ' is-active' : ''}`}
                      onClick={() => activateCategory(c)}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="jm-region-col jm-region-col--wide">
              <p className="jm-region-col__head">Phân loại chi tiết</p>
              {!activeCategoryForSub ? (
                <p className="hint jm-region-col__hint">Chọn ngành nghề lớn bên trái để xem phân loại chi tiết.</p>
              ) : (
                <ul className="jm-region-col__list jm-region-col__list--grid">
                  <li>
                    <button
                      type="button"
                      className={`jm-region-row${categoryIds.has(activeCategoryForSub) ? ' is-selected' : ''}`}
                      onClick={() => toggleCategoryAll(activeCategoryForSub)}
                    >
                      Tất cả {CATEGORY_LABELS[activeCategoryForSub]}
                    </button>
                  </li>
                  {SUBCATEGORY_LABELS[activeCategoryForSub]
                    ? Object.entries(SUBCATEGORY_LABELS[activeCategoryForSub]!).map(([subId, label]) => {
                        const key = `${activeCategoryForSub}:${subId}`
                        return (
                          <li key={subId}>
                            <button
                              type="button"
                              className={`jm-region-row${selectedSubcategoryKeys.has(key) ? ' is-selected' : ''}`}
                              onClick={() => toggleSubcategory(activeCategoryForSub, subId)}
                            >
                              {label}
                            </button>
                          </li>
                        )
                      })
                    : (
                      <li className="jm-region-col__hint-inline">
                        <p className="hint">{CATEGORY_LABELS[activeCategoryForSub]} chưa có phân loại chi tiết — chọn "Tất cả" ở trên để lọc theo cả ngành này.</p>
                      </li>
                    )}
                </ul>
              )}
            </div>
          </div>
          <div className="jm-filter-dropdown__footer">
            <button
              type="button"
              className="jm-filter-dropdown__reset"
              onClick={() => { setCategoryIds(new Set()); setSelectedSubcategoryKeys(new Set()); setActiveCategoryForSub(null) }}
            >
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Thời gian làm việc"
          count={jobDurations.size + selectedDays.size + selectedDayCounts.size + (excludeUnspecifiedDays ? 1 : 0) + selectedTimeBuckets.size + (excludeUnspecifiedHours ? 1 : 0)}
          isOpen={openPanel === 'workPeriod'}
          onToggle={() => togglePanel('workPeriod')}
          onClose={closePanel}
          panelSlot={panelSlot}
        >
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Thời hạn làm việc</p>
            <div className="jm-filter-row__body">
              <div className="jm-filter-dropdown__chips">
                {JOB_DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`jm-chip${jobDurations.has(d) ? ' is-selected' : ''}`}
                    onClick={() => toggleJobDuration(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Ngày làm việc ({selectedDays.size + selectedDayCounts.size})</p>
            <div className="jm-filter-row__body">
              <div className="jm-workhour-mode-toggle">
                <button
                  type="button"
                  className={`jm-workhour-mode-btn${dayFilterMode === 'list' ? ' is-selected' : ''}`}
                  onClick={() => setDayFilterMode('list')}
                >
                  Chọn từ danh sách
                </button>
                <button
                  type="button"
                  className={`jm-workhour-mode-btn${dayFilterMode === 'manual' ? ' is-selected' : ''}`}
                  onClick={() => setDayFilterMode('manual')}
                >
                  Chọn thủ công
                </button>
              </div>
              {/* 2026-09-18 사용자 지시("동일하게 만들어", 알바몬 캡처본) — 목록/
                  직접선택 둘 다 항상 같이 보이고, 지금 선택 안 된 쪽만
                  흐리게(jm-workhour-inactive) 처리한다(완전히 숨기지 않음) —
                  두 칩 그룹 다 같은 selectedDays/selectedDayCounts state를
                  쓰는 진짜 기능이라 흐려도 클릭은 계속 된다. */}
              <div className={`jm-filter-dropdown__chips${dayFilterMode === 'manual' ? ' jm-workhour-inactive' : ''}`}>
                {DAY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`jm-chip${sameSet(selectedDays, preset.days) ? ' is-selected' : ''}`}
                    onClick={() => applyDayPreset(preset.days)}
                  >
                    {preset.label}
                  </button>
                ))}
                {WEEKLY_DAY_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`jm-chip${selectedDayCounts.has(n) ? ' is-selected' : ''}`}
                    onClick={() => toggleDayCount(n)}
                  >
                    {n} ngày
                  </button>
                ))}
              </div>
              <div className={`jm-filter-dropdown__chips${dayFilterMode === 'list' ? ' jm-workhour-inactive' : ''}`}>
                {DAY_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`jm-chip${selectedDays.has(d) ? ' is-selected' : ''}`}
                    onClick={() => toggleDay(d)}
                  >
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
              <label className="jm-workhour-exclude">
                <input
                  type="checkbox"
                  checked={excludeUnspecifiedDays}
                  onChange={(e) => setExcludeUnspecifiedDays(e.target.checked)}
                />
                Loại trừ tin chưa rõ ngày làm việc
              </label>
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Khung giờ ({selectedTimeBuckets.size})</p>
            <div className="jm-filter-row__body">
              <div className="jm-workhour-mode-toggle">
                <button
                  type="button"
                  className={`jm-workhour-mode-btn${timeFilterMode === 'list' ? ' is-selected' : ''}`}
                  onClick={() => setTimeFilterMode('list')}
                >
                  Chọn từ danh sách
                </button>
                <button
                  type="button"
                  className={`jm-workhour-mode-btn${timeFilterMode === 'manual' ? ' is-selected' : ''}`}
                  onClick={() => setTimeFilterMode('manual')}
                >
                  Chọn thủ công
                </button>
              </div>
              <div className={`jm-filter-dropdown__chips${timeFilterMode === 'manual' ? ' jm-workhour-inactive' : ''}`}>
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`jm-chip${sameSet(selectedTimeBuckets, preset.buckets) ? ' is-selected' : ''}`}
                    onClick={() => applyTimePreset(preset.buckets)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className={`jm-filter-dropdown__chips${timeFilterMode === 'manual' ? ' jm-workhour-inactive' : ''}`}>
                {TIME_BUCKET_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`jm-chip${selectedTimeBuckets.has(t) ? ' is-selected' : ''}`}
                    onClick={() => toggleTimeBucket(t)}
                  >
                    {TIME_BUCKET_LABELS[t]}
                  </button>
                ))}
              </div>
              {/* 시작/종료 드롭다운은 실제 필터링에 반영하지 않는 순수 UI —
                  local_jobs.hours가 자유텍스트라 정확한 시/분 단위로 거를 데이터가
                  없음(workScheduleParse.ts는 버킷 단위 파싱만 가능, 사용자 확인 후
                  진행). "직접선택" 모드일 때만 흐림 해제해 강조한다. */}
              <div className={`jm-workhour-manual-row${timeFilterMode === 'list' ? ' jm-workhour-inactive' : ''}`}>
                <select
                  className="jm-workhour-manual-select"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  aria-label="Thời gian bắt đầu"
                >
                  <option value="">Thời gian bắt đầu</option>
                  {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span>—</span>
                <select
                  className="jm-workhour-manual-select"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  aria-label="Thời gian kết thúc"
                >
                  <option value="">Thời gian kết thúc</option>
                  {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {timeFilterMode === 'manual' && (
                <p className="hint jm-workhour-manual-hint">
                  Bộ lọc theo giờ chính xác chưa khả dụng — dùng khung giờ có sẵn ở chế độ "Chọn từ danh sách" để lọc.
                </p>
              )}
              <label className="jm-workhour-exclude">
                <input
                  type="checkbox"
                  checked={excludeUnspecifiedHours}
                  onChange={(e) => setExcludeUnspecifiedHours(e.target.checked)}
                />
                Loại trừ tin chưa rõ giờ làm việc
              </label>
            </div>
          </div>
          <div className="jm-filter-dropdown__footer">
            <button
              type="button"
              className="jm-filter-dropdown__reset"
              onClick={() => { setJobDurations(new Set()); setSelectedDays(new Set()); setSelectedDayCounts(new Set()); setExcludeUnspecifiedDays(false); setSelectedTimeBuckets(new Set()); setExcludeUnspecifiedHours(false) }}
            >
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Điều kiện khác"
          count={workPeriods.size + (genderFilter ? 1 : 0) + (ageFilter ? 1 : 0) + (pledgeOnly ? 1 : 0) + includeKeywords.length + excludeKeywords.length}
          isOpen={openPanel === 'detail'}
          onToggle={() => togglePanel('detail')}
          onClose={closePanel}
          panelSlot={panelSlot}
        >
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Giới tính</p>
            <div className="jm-filter-row__body">
              <div className="jm-filter-dropdown__chips">
                <button
                  type="button"
                  className={`jm-chip${genderFilter === 'Nam' ? ' is-selected' : ''}`}
                  onClick={() => setGenderFilter((g) => (g === 'Nam' ? null : 'Nam'))}
                >
                  Nam
                </button>
                <button
                  type="button"
                  className={`jm-chip${genderFilter === 'Nữ' ? ' is-selected' : ''}`}
                  onClick={() => setGenderFilter((g) => (g === 'Nữ' ? null : 'Nữ'))}
                >
                  Nữ
                </button>
              </div>
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Độ tuổi</p>
            <div className="jm-filter-row__body">
              <select
                className="jm-workhour-manual-select"
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                aria-label="Độ tuổi"
              >
                <option value="">Chọn độ tuổi</option>
                {AGE_REQUIREMENT_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Độ tin cậy</p>
            <div className="jm-filter-row__body">
              <label className="jm-workhour-exclude">
                <input type="checkbox" checked={pledgeOnly} onChange={(e) => setPledgeOnly(e.target.checked)} />
                Chỉ hiện tin có cam kết với người lao động (hợp đồng lao động / BHXH-BHYT)
              </label>
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Loại hình công việc</p>
            <div className="jm-filter-row__body">
              {workPeriodOptions.length === 0 ? (
                <p className="hint">Chưa có dữ liệu loại hình công việc cho tin tuyển gấp hiện tại.</p>
              ) : (
                <div className="jm-filter-dropdown__chips">
                  {workPeriodOptions.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`jm-chip${workPeriods.has(p) ? ' is-selected' : ''}`}
                      onClick={() => toggleWorkPeriod(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="jm-filter-row">
            <p className="jm-filter-row__label">Từ khóa</p>
            <div className="jm-filter-row__body">
              <p className="jm-keyword-group__label">Bao gồm ({includeKeywords.length})</p>
              <div className="jm-keyword-input-row">
                <input
                  type="text"
                  className="jm-filter-dropdown__search"
                  placeholder="vd: pha chế, giao hàng"
                  value={includeDraft}
                  onChange={(e) => setIncludeDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(includeDraft, includeKeywords, setIncludeKeywords, setIncludeDraft) } }}
                />
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => addKeyword(includeDraft, includeKeywords, setIncludeKeywords, setIncludeDraft)}
                >
                  Thêm
                </button>
              </div>
              {includeKeywords.length > 0 && (
                <div className="jm-filter-dropdown__chips">
                  {includeKeywords.map((k) => (
                    <span key={k} className="jm-keyword-tag">
                      {k}
                      <button type="button" onClick={() => setIncludeKeywords(includeKeywords.filter((x) => x !== k))} aria-label={`Xóa từ khóa ${k}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <p className="jm-keyword-group__label jm-keyword-group__label--spaced">Loại trừ ({excludeKeywords.length})</p>
              <div className="jm-keyword-input-row">
                <input
                  type="text"
                  className="jm-filter-dropdown__search"
                  placeholder="vd: bán hàng đa cấp"
                  value={excludeDraft}
                  onChange={(e) => setExcludeDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(excludeDraft, excludeKeywords, setExcludeKeywords, setExcludeDraft) } }}
                />
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => addKeyword(excludeDraft, excludeKeywords, setExcludeKeywords, setExcludeDraft)}
                >
                  Thêm
                </button>
              </div>
              {excludeKeywords.length > 0 && (
                <div className="jm-filter-dropdown__chips">
                  {excludeKeywords.map((k) => (
                    <span key={k} className="jm-keyword-tag">
                      {k}
                      <button type="button" onClick={() => setExcludeKeywords(excludeKeywords.filter((x) => x !== k))} aria-label={`Xóa từ khóa ${k}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="jm-filter-dropdown__footer">
            <button
              type="button"
              className="jm-filter-dropdown__reset"
              onClick={() => { setGenderFilter(null); setAgeFilter(''); setWorkPeriods(new Set()); setIncludeKeywords([]); setExcludeKeywords([]) }}
            >
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>
      </div>

      <div ref={setPanelSlot} className="jm-urgent-panel-slot" />

      <div className="jm-urgent-toolbar">
        <p className="jm-result-count">
          Tổng {sorted.length} việc làm tuyển gấp
          {activeFilterCount > 0 && (
            <button type="button" className="jm-clear-filters" onClick={clearAllFilters}>Xóa hết bộ lọc</button>
          )}
        </p>
        <div className="jm-urgent-toolbar__controls">
          <select
            className="jm-urgent-toolbar__select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label="Sắp xếp"
          >
            <option value="newest">Mới nhất</option>
            <option value="deadline">Sắp hết hạn</option>
          </select>
          <select
            className="jm-urgent-toolbar__select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Số lượng hiển thị"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} tin/trang</option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="city-result__empty">
          <span>🔍</span>
          <p>Chưa có việc làm tuyển gấp phù hợp với điều kiện đã chọn.</p>
          <NavLink to="/">← Xem tất cả việc làm</NavLink>
        </div>
      ) : (
        <div className="admin-table-wrap jm-urgent-table-wrap">
          <table className="admin-table jm-urgent-table">
            <thead>
              <tr>
                <th aria-label="Lưu tin" />
                <th>Khu vực</th>
                <th>Tin tuyển dụng</th>
                <th>Lương</th>
                <th>Thời gian làm việc</th>
                <th>Ngày đăng</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => (
                <tr key={job.id}>
                  <td>
                    <button
                      type="button"
                      className="jm-urgent-table__save"
                      aria-label={savedIds.has(job.id) ? 'Bỏ lưu tin' : 'Lưu tin'}
                      onClick={() => handleToggleSave(job)}
                    >
                      {savedIds.has(job.id) ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="jm-urgent-table__region">{job.location}</td>
                  <td>
                    <span className="jm-urgent-table__badge">Khẩn cấp</span>
                    <NavLink to={`/viec-lam/${job.id}`} className="jm-urgent-table__title">
                      {job.title}
                    </NavLink>
                    <p className="jm-urgent-table__company">{job.company}</p>
                  </td>
                  <td className="jm-urgent-table__salary">{job.salary}</td>
                  <td>{job.hours || '—'}</td>
                  <td>
                    {formatShortDate(job.postedAt)}
                    {job.sourceUrl && (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="jm-urgent-table__external"
                        aria-label="Xem tin gốc"
                        title="Xem tin gốc"
                      >
                        ↗
                      </a>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => handleApply(job)}
                      disabled={isApplied(job.id)}
                    >
                      {isApplied(job.id) ? 'Đã ứng tuyển' : 'Ứng tuyển'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApplyModal status={status} job={applyJob} profile={profile} onConfirm={confirm} onClose={close} onRetry={retry} />
    </div>
  )
}
