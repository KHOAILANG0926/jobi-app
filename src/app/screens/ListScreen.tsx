import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Menu, Search } from 'lucide-react'
import { useBrandsOptional } from '../../context/BrandsContext'
import { useAuth } from '../../context/AuthContext'
import { JOB_REGIONS, type JobRegionId } from '../../data/jobRegions'
import { jobMatchesBrand } from '../../data/brandDirectory'
import { findNearbyJobs } from '../../lib/homeMapFilters'
import { suggestJobs } from '../../lib/jobSuggestions'
import { DEFAULT_JOB_SEARCH_PARAMS, filterAndSortJobs } from '../../lib/jobSearch'
import { hasPrefs, loadPrefs, matchJobs } from '../../lib/recommendStorage'
import { loadViewHistory } from '../../lib/viewHistoryStorage'
import type { Job } from '../../types/job'
import { useAppliedJobIds, useAppJobs, useSavedJobIds } from '../data/useAppData'
import { useOrigin } from '../data/useOrigin'
import { useAppFilters } from '../filters/AppFilters'
import { applyAppFilters, toMapFilters } from '../filters/applyFilters'
import FilterRail from '../ui/FilterRail'
import { useFilterSheets } from '../ui/useFilterSheets'
import JobList from './JobList'
import { isPresetId, PRESET_TITLES, SHORT_TERM_DURATIONS, type PresetId } from './presets'

// 공고 목록 화면 하나 — 프리셋(급구·지역별·단기·근처·맞춤·추천·저장·최근 본·브랜드)마다 맨 위 한 줄과 기본 조건만 다르고,
// 필터 칩 줄·필터 시트·지역 시트·카드·지원 버튼 판정은 모두 공통 부품을 쓴다.
export default function ListScreen({ preset: fixed }: { preset?: PresetId }) {
  const { preset: raw } = useParams()
  const preset: PresetId = fixed ?? (isPresetId(raw) ? raw : 'moi-nhat')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const brands = useBrandsOptional()
  const { jobs, loading: jobsLoading, jobsError, areas, areasReady } = useAppJobs()
  const loading = jobsLoading || !areasReady
  const { filters, patch } = useAppFilters()
  const saved = useSavedJobIds()
  const applied = useAppliedJobIds()
  const { origin, request } = useOrigin()
  const sheets = useFilterSheets(jobs, { hasOrigin: preset === 'gan-toi' && origin.status === 'ready' })

  const base: { jobs: Job[]; keepOrder?: boolean; distanceById?: Map<string, number>; reasonById?: Map<string, string>; needs?: 'origin' | 'prefs' | 'signal' } = useMemo(() => {
    switch (preset) {
      case 'tuyen-gap': return { jobs: jobs.filter((j) => j.urgent) }
      case 'da-luu': return { jobs: saved.ids.map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j) }
      case 'da-xem': return { jobs: loadViewHistory().map((h) => jobs.find((j) => j.id === h.id)).filter((j): j is Job => !!j), keepOrder: true }
      case 'thuong-hieu': {
        const key = params.get('brand')
        const brand = brands.find((b) => b.linkTo === key || b.name === key)
        return { jobs: brand ? jobs.filter((j) => jobMatchesBrand(j, brand)) : key ? filterAndSortJobs(jobs, { ...DEFAULT_JOB_SEARCH_PARAMS, brandFilter: key }, new Map()) : jobs }
      }
      case 'phu-hop': {
        const prefs = loadPrefs()
        if (!hasPrefs(prefs)) return { jobs: [], needs: 'prefs' as const }
        const m = matchJobs(jobs, prefs)
        return { jobs: m.map((x) => x.job), keepOrder: true, reasonById: new Map(m.filter((x) => x.reasons[0]).map((x) => [x.job.id, x.reasons[0]])) }
      }
      case 'goi-y': {
        const prefs = loadPrefs()
        const s = suggestJobs({ jobs, savedJobs: jobs.filter((j) => saved.set.has(j.id)), appliedJobs: jobs.filter((j) => applied.has(j.id)), regionId: (prefs.regionId || undefined) as JobRegionId | undefined, regionLabel: JOB_REGIONS.find((r) => r.id === prefs.regionId)?.label })
        if (s.length === 0 && !saved.ids.length && !applied.size && !prefs.regionId) return { jobs: [], needs: 'signal' as const }
        return { jobs: s.map((x) => x.job), keepOrder: true, reasonById: new Map(s.map((x) => [x.job.id, x.reasons[0]])) }
      }
      case 'gan-toi': {
        if (origin.status !== 'ready') return { jobs: [], needs: 'origin' as const }
        const near = findNearbyJobs(jobs, origin.point, toMapFilters(filters))
        return { jobs: near.map((n) => n.job), keepOrder: true, distanceById: new Map(near.map((n) => [n.job.id, n.distanceKm])) }
      }
      default: return { jobs }
    }
  }, [preset, jobs, saved.ids, saved.set, applied, params, brands, origin, filters])

  // 맞춤·추천·근처는 자기 기준으로 이미 고른 목록이라, 공통 필터(지역·업종·급여…)는 그 위에서 한 번 더 좁힌다.
  const shown = useMemo(() => applyAppFilters(base.jobs, preset === 'gan-toi' ? { ...filters, province: null, wards: [] } : filters, areas), [base.jobs, filters, areas, preset])
  const ordered = useMemo(() => {
    if (!base.keepOrder) return shown
    const order = new Map(base.jobs.map((j, i) => [j.id, i]))
    return [...shown].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }, [shown, base])

  let top: React.ReactNode = null
  if (preset === 'ngan-han') {
    top = <div className="app-chip-row app-subrail" role="group" aria-label="Thời gian làm việc">{SHORT_TERM_DURATIONS.map((d) => { const on = filters.jobDurations.includes(d); return <button key={d} type="button" className={'app-chip' + (on ? ' app-on' : '')} aria-pressed={on} onClick={() => patch({ jobDurations: on ? filters.jobDurations.filter((x) => x !== d) : [...filters.jobDurations, d] })}>{d}</button> })}</div>
  } else if (preset === 'khu-vuc') {
    top = <button type="button" className="app-region-row" onClick={sheets.openRegion}>{filters.province ? 'Đổi khu vực' : 'Chọn khu vực'} <span>›</span></button>
  }

  let empty: React.ReactNode = <p className="app-state">Chưa có việc làm phù hợp với điều kiện hiện tại.</p>
  if (base.needs === 'prefs') empty = <div className="app-state"><p>Bạn chưa thiết lập điều kiện việc làm phù hợp.</p><a className="app-btn app-btn--primary" href="/viec-lam/phu-hop">Thiết lập điều kiện</a></div>
  if (base.needs === 'signal') empty = <div className="app-state"><p>Chưa đủ thông tin để gợi ý. Hãy lưu hoặc ứng tuyển vài việc bạn quan tâm, hoặc thiết lập điều kiện phù hợp.</p><Link className="app-btn app-btn--primary" to="/danh-sach/phu-hop">Việc làm phù hợp</Link></div>
  if (base.needs === 'origin') {
    empty = (
      <div className="app-state">
        {origin.status === 'denied' || origin.status === 'unsupported'
          ? <p role="status">Không lấy được vị trí. Bạn vẫn có thể chọn khu vực để xem việc làm.</p>
          : <p>Cho phép dùng vị trí hiện tại để xem việc làm gần bạn.</p>}
        <button type="button" className="app-btn app-btn--primary" disabled={origin.status === 'loading'} onClick={request}>{origin.status === 'loading' ? 'Đang xác định vị trí…' : 'Dùng vị trí hiện tại'}</button>
        <button type="button" className="app-btn app-btn--ghost" onClick={() => navigate('/danh-sach/khu-vuc')}>Chọn khu vực</button>
      </div>
    )
  }
  if (preset === 'da-luu' && !saved.ids.length) empty = <p className="app-state">Bạn chưa lưu việc làm nào.</p>
  if (preset === 'da-xem' && !loadViewHistory().length) empty = <p className="app-state">Bạn chưa xem việc làm nào{user ? '' : ' trên thiết bị này'}.</p>

  return (
    <div className="app-page" data-testid="app-list" data-preset={preset}>
      <header className="app-pagebar">
        <button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button>
        <h1 className="app-pagebar__title">{PRESET_TITLES[preset]}</h1>
        <Link to="/tim-kiem" className="app-icon-btn" aria-label="Tìm kiếm"><Search size={22} aria-hidden /></Link>
        <Link to="/menu" className="app-icon-btn" aria-label="Danh mục"><Menu size={22} aria-hidden /></Link>
      </header>
      <FilterRail onOpen={sheets.openFilter} />
      {top}
      <JobList key={preset} jobs={ordered} loading={loading} error={jobsError} empty={empty} keepOrder={base.keepOrder} distanceById={base.distanceById} reasonById={base.reasonById} />
      {sheets.sheets}
    </div>
  )
}
