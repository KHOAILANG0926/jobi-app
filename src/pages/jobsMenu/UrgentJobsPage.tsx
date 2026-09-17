import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import ApplyModal from '../../components/ApplyModal'
import { useApply } from '../../components/useApply'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_LABELS } from '../../data/categories'
import { SUBCATEGORY_LABELS } from '../../data/subcategories'
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
function sameSet<T>(a: Set<T>, items: T[]): boolean {
  return a.size === items.length && items.every((x) => a.has(x))
}

/** 클릭하면 버튼 아래로 패널이 펼쳐지는 필터 드롭다운 — 급구 페이지의 4개
 * 필터(지역/업직종/근무기간/상세조건)가 전부 같은 틀을 쓴다. 패널 바깥을
 * 클릭하면 닫힌다. */
function FilterDropdown({
  label, count, isOpen, onToggle, onClose, children,
}: {
  label: string
  count: number
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [isOpen, onClose])

  return (
    <div className="jm-filter-dropdown" ref={ref}>
      <button
        type="button"
        className={`jm-filter-dropdown__btn${isOpen ? ' is-open' : ''}${count > 0 ? ' has-value' : ''}`}
        onClick={onToggle}
      >
        {label}{count > 0 ? ` (${count})` : ''}
        <span className="jm-filter-dropdown__caret" aria-hidden>▾</span>
      </button>
      {isOpen && <div className="jm-filter-dropdown__panel">{children}</div>}
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
 * 연령·고용형태 컬럼 자체가 없고, workPeriod/workDays/hours는 크롤러가 넣은
 * 자유텍스트라 요일·시간대별로 쪼갤 수 없음) 그 부분까지 그대로 베끼면
 * 실제로 아무것도 걸러내지 못하는 가짜 필터가 된다. 그래서 "패널 UI 틀"은
 * 4개 다 그대로 가져오되, 내용물은 실제 있는 데이터 기준으로만 채웠다:
 * 지역/업직종은 검색+다중선택, 근무기간은 다중선택(있는 값만), 상세조건은
 * 키워드 포함/제외 검색만(성별/연령/고용형태는 데이터가 없어 제외).
 */
export default function UrgentJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status, job: applyJob, profile, openApply, confirm, close, retry } = useApply()

  const [openPanel, setOpenPanel] = useState<PanelKey>(null)
  // 2026-09-16 사용자 지시로 지역 필터를 베트남 2025-07-01 행정구역 개편 반영한
  // 정확한 2단(성/시→동/사) 체계로 교체 — 예전 JOB_REGIONS(29개 임의 묶음, 실제
  // 통합 결과와 안 맞는 부분 확인됨)는 더 이상 쓰지 않는다. resolvedProvince/
  // resolvedWards는 crawler/vn_provinces_lookup.py(통계총국 공식 자료)로 확정된
  // 값만 담고 있어 옛/새 이름 혼동이 없다 — 값이 없는 공고(아직 지오코딩
  // 재처리 전)는 지역 필터로 못 찾는 게 맞다(억지로 옛 방식과 섞지 않음).
  const [selectedProvince, setSelectedProvince] = useState<string | null>(
    () => searchParams.get('province'),
  )
  const [selectedWards, setSelectedWards] = useState<Set<string>>(new Set())
  const [categoryIds, setCategoryIds] = useState<Set<JobCategory>>(new Set())
  // 2026-09-17 사용자 지시("업종도 동일하게") — 대분류(카테고리)|소분류 2단
  // 구조로 재구성. activeCategoryForSub은 지금 오른쪽 열에 어느 대분류의
  // 소분류 목록을 보여줄지 결정하는 탐색 상태(선택 여부와 별개)이고,
  // selectedSubcategoryKeys는 실제 필터로 쓰는 값이다. subcategory id는
  // 대분류마다 겹칠 수 있어("thu_ngan"이 cafe/restaurant/retail에 모두 있음)
  // `${category}:${subId}` 복합키로 저장해 다른 대분류의 같은 이름 소분류와
  // 섞이지 않게 한다.
  const [activeCategoryForSub, setActiveCategoryForSub] = useState<JobCategory | null>(null)
  const [selectedSubcategoryKeys, setSelectedSubcategoryKeys] = useState<Set<string>>(new Set())
  const [workPeriods, setWorkPeriods] = useState<Set<string>>(new Set())
  // 2026-09-17 사용자 지시 — work_days/hours는 크롤러가 자유 문장으로 저장한
  // 값이라(workScheduleParse.ts 참고) 요일/시간대는 job마다 파싱해서 걸러야
  // 한다. 요일 7개·시간대 4개는 고정된 작은 집합이라(수천 개짜리 동/사와
  // 다름) 공고 존재 여부와 무관하게 항상 전부 보여준다(성/시와 같은 원칙).
  const [selectedDays, setSelectedDays] = useState<Set<DayCode>>(new Set())
  const [selectedTimeBuckets, setSelectedTimeBuckets] = useState<Set<TimeBucket>>(new Set())
  // 2026-09-17 사용자 지시("한눈에 보이게") — 실제 알바몬 근무기간 패널은
  // 요일/시간대를 개별 선택뿐 아니라 자주 쓰는 조합(월-토/주말 등)과 주당
  // 근무일수(주N일)까지 한 화면에서 바로 고를 수 있게 해뒀다. 조합 프리셋은
  // 기존 selectedDays/selectedTimeBuckets를 그대로 세팅하는 UI 단축키일 뿐이라
  // 새 데이터가 필요 없고, 주당 근무일수는 parseWorkDays(job.workDays).size로
  // 실제 파싱 결과에서 바로 계산되는 값이라 이것도 진짜 데이터다. 다만
  // 알바몬의 최상단 "근무기간(하루/1주일~1개월/...)" 섹션은 고용 기간 데이터
  // 자체가 local_jobs에 없어(workPeriod는 전일제/시간제 구분일 뿐, 근무
  // 예정 "기간"이 아님) 만들지 않는다 — 사유는 CHATGPT_HANDOFF.md 참고.
  const [selectedDayCounts, setSelectedDayCounts] = useState<Set<number>>(new Set())
  const [categorySearch, setCategorySearch] = useState('')
  const [regionSearch, setRegionSearch] = useState('')
  const [includeKeywords, setIncludeKeywords] = useState<string[]>([])
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([])
  const [includeDraft, setIncludeDraft] = useState('')
  const [excludeDraft, setExcludeDraft] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [pageSize, setPageSize] = useState<number>(20)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadSavedJobIds(user?.id)))
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!selectedProvince) next.delete('province')
      else next.set('province', selectedProvince)
      return next
    }, { replace: true })
  }, [selectedProvince, setSearchParams])

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

  // 근무기간 선택지는 실제 급구 공고에 존재하는 값만 동적으로 뽑는다(알바몬처럼
  // 고정된 분류 체계를 새로 만들지 않고, 있는 데이터만 정직하게 보여줌).
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
  const wardOptions = useMemo(() => {
    if (!selectedProvince) return []
    return VN_WARDS_BY_PROVINCE[selectedProvince] ?? []
  }, [selectedProvince])

  // 2026-09-17 사용자가 알바몬 캡처본("대전 치면 이렇게 나오거든") 보여주며
  // 요청 — 알바몬은 지역 검색창에 "대전"을 치면 성/시·동/사를 가리지 않고
  // 이름에 포함된 모든 지역을 평탄화해서 한 번에 보여준다. 성/시 34개 ×
  // 동/사 평균 100개 = 약 3,300건 전체를 한 번만 만들어두고(useMemo, deps
  // 없음 — 정적 데이터라 재계산 불필요) 검색어로 필터링한다.
  const regionSearchIndex = useMemo(() => {
    const list: { key: string; province: string; ward: string | null; label: string }[] = []
    for (const p of VN_PROVINCES) {
      list.push({ key: p, province: p, ward: null, label: shortProvinceName(p) })
      for (const w of VN_WARDS_BY_PROVINCE[p] ?? []) {
        list.push({ key: `${p}::${w}`, province: p, ward: w, label: `${shortProvinceName(p)} · ${w}` })
      }
    }
    return list
  }, [])
  const regionSearchResults = useMemo(() => {
    const q = normalizeViText(regionSearch.trim())
    if (!q) return []
    return regionSearchIndex.filter((item) => normalizeViText(item.label).includes(q)).slice(0, 50)
  }, [regionSearch, regionSearchIndex])
  const isRegionResultSelected = (item: { province: string; ward: string | null }) =>
    item.ward === null
      ? selectedProvince === item.province && selectedWards.size === 0
      : selectedProvince === item.province && selectedWards.has(item.ward)
  const selectRegionSearchResult = (item: { province: string; ward: string | null }) => {
    if (item.ward === null) {
      selectProvince(item.province)
    } else if (selectedProvince !== item.province) {
      setSelectedProvince(item.province)
      setSelectedWards(new Set([item.ward]))
    } else {
      toggleWard(item.ward)
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
    if (selectedDays.size > 0) {
      list = list.filter((j) => {
        const days = parseWorkDays(j.workDays)
        return [...selectedDays].some((d) => days.has(d))
      })
    }
    if (selectedDayCounts.size > 0) {
      list = list.filter((j) => selectedDayCounts.has(parseWorkDays(j.workDays).size))
    }
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
  }, [urgentJobs, selectedProvince, selectedWards, categoryIds, selectedSubcategoryKeys, workPeriods, selectedDays, selectedDayCounts, selectedTimeBuckets, includeKeywords, excludeKeywords])

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

  const activeFilterCount = (selectedProvince ? 1 : 0) + selectedWards.size + categoryIds.size + selectedSubcategoryKeys.size + workPeriods.size + selectedDays.size + selectedDayCounts.size + selectedTimeBuckets.size + includeKeywords.length + excludeKeywords.length

  // 2026-09-17 알바몬 캡처본 참고 — 선택한 조건을 어느 패널을 보고 있든
  // 항상 태그로 보여주고 개별 삭제 가능하게 한다(지금까지는 각 드롭다운
  // 버튼의 "(2)" 숫자로만 알 수 있어서, 뭘 선택했는지 보려면 그 패널을
  // 다시 열어야 했음).
  type ActiveChip = { key: string; label: string; onRemove: () => void }
  const activeFilterChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = []
    if (selectedProvince && selectedWards.size === 0) {
      chips.push({ key: 'province', label: shortProvinceName(selectedProvince), onRemove: () => selectProvince(null) })
    }
    for (const w of selectedWards) {
      chips.push({ key: `ward:${w}`, label: w, onRemove: () => toggleWard(w) })
    }
    for (const c of categoryIds) {
      chips.push({ key: `cat:${c}`, label: `Tất cả ${CATEGORY_LABELS[c]}`, onRemove: () => toggleCategoryAll(c) })
    }
    for (const key of selectedSubcategoryKeys) {
      const [cat, subId] = key.split(':') as [JobCategory, string]
      const label = SUBCATEGORY_LABELS[cat]?.[subId] ?? subId
      chips.push({ key: `sub:${key}`, label, onRemove: () => toggleSubcategory(cat, subId) })
    }
    for (const p of workPeriods) {
      chips.push({ key: `wp:${p}`, label: p, onRemove: () => toggleWorkPeriod(p) })
    }
    for (const d of selectedDays) {
      chips.push({ key: `day:${d}`, label: DAY_LABELS[d], onRemove: () => toggleDay(d) })
    }
    for (const n of selectedDayCounts) {
      chips.push({ key: `dc:${n}`, label: `${n} ngày`, onRemove: () => toggleDayCount(n) })
    }
    for (const t of selectedTimeBuckets) {
      chips.push({ key: `tb:${t}`, label: TIME_BUCKET_LABELS[t], onRemove: () => toggleTimeBucket(t) })
    }
    for (const k of includeKeywords) {
      chips.push({ key: `inc:${k}`, label: `+ ${k}`, onRemove: () => setIncludeKeywords(includeKeywords.filter((x) => x !== k)) })
    }
    for (const k of excludeKeywords) {
      chips.push({ key: `exc:${k}`, label: `− ${k}`, onRemove: () => setExcludeKeywords(excludeKeywords.filter((x) => x !== k)) })
    }
    return chips
  }, [selectedProvince, selectedWards, categoryIds, selectedSubcategoryKeys, workPeriods, selectedDays, selectedDayCounts, selectedTimeBuckets, includeKeywords, excludeKeywords])

  const clearAllFilters = () => {
    selectProvince(null)
    setCategoryIds(new Set())
    setSelectedSubcategoryKeys(new Set())
    setWorkPeriods(new Set())
    setSelectedDays(new Set())
    setSelectedDayCounts(new Set())
    setSelectedTimeBuckets(new Set())
    setIncludeKeywords([])
    setExcludeKeywords([])
  }

  return (
    <div className="page jobs-menu-page">
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
        >
          <div className="jm-search-input-wrap">
            <input
              type="text"
              className="jm-filter-dropdown__search"
              placeholder="Tìm khu vực... vd: Đà Nẵng"
              value={regionSearch}
              onChange={(e) => setRegionSearch(e.target.value)}
            />
            <span className="jm-search-input-wrap__icon" aria-hidden="true">🔍</span>
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
            <div className="jm-region-columns">
              <div className="jm-region-col">
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
              <div className="jm-region-col">
                <p className="jm-region-col__head">Xã / Phường</p>
                {!selectedProvince ? (
                  <p className="hint jm-region-col__hint">Chọn tỉnh/thành phố trước.</p>
                ) : wardOptions.length === 0 ? (
                  <p className="hint jm-region-col__hint">Các tin tuyển gấp ở {shortProvinceName(selectedProvince)} chưa xác định được xã/phường cụ thể.</p>
                ) : (
                  <ul className="jm-region-col__list">
                    {wardOptions.map((w) => (
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
        >
          <div className="jm-search-input-wrap">
            <input
              type="text"
              className="jm-filter-dropdown__search"
              placeholder="Tìm ngành nghề..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
            />
            <span className="jm-search-input-wrap__icon" aria-hidden="true">🔍</span>
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
          count={workPeriods.size + selectedDays.size + selectedDayCounts.size + selectedTimeBuckets.size}
          isOpen={openPanel === 'workPeriod'}
          onToggle={() => togglePanel('workPeriod')}
          onClose={closePanel}
        >
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Hình thức</p>
            {workPeriodOptions.length === 0 ? (
              <p className="hint">Chưa có dữ liệu hình thức làm việc cho tin tuyển gấp hiện tại.</p>
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
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Ngày làm việc ({selectedDays.size})</p>
            <div className="jm-filter-dropdown__chips">
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
            </div>
            <div className="jm-filter-dropdown__chips">
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
          </div>
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Số ngày làm việc / tuần ({selectedDayCounts.size})</p>
            <div className="jm-filter-dropdown__chips">
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
          </div>
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Khung giờ ({selectedTimeBuckets.size})</p>
            <div className="jm-filter-dropdown__chips">
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
            <div className="jm-filter-dropdown__chips">
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
          </div>
          <div className="jm-filter-dropdown__footer">
            <button
              type="button"
              className="jm-filter-dropdown__reset"
              onClick={() => { setWorkPeriods(new Set()); setSelectedDays(new Set()); setSelectedDayCounts(new Set()); setSelectedTimeBuckets(new Set()) }}
            >
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Điều kiện khác"
          count={includeKeywords.length + excludeKeywords.length}
          isOpen={openPanel === 'detail'}
          onToggle={() => togglePanel('detail')}
          onClose={closePanel}
        >
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Chỉ hiện tin chứa từ khóa</p>
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
          </div>
          <div className="jm-keyword-group">
            <p className="jm-keyword-group__label">Loại trừ tin chứa từ khóa</p>
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
          <div className="jm-filter-dropdown__footer">
            <button
              type="button"
              className="jm-filter-dropdown__reset"
              onClick={() => { setIncludeKeywords([]); setExcludeKeywords([]) }}
            >
              ↻ Đặt lại
            </button>
          </div>
        </FilterDropdown>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="jm-active-filters">
          {activeFilterChips.map((chip) => (
            <span key={chip.key} className="jm-active-chip">
              {chip.label}
              <button type="button" onClick={chip.onRemove} aria-label={`Xóa ${chip.label}`}>×</button>
            </span>
          ))}
        </div>
      )}

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
