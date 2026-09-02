import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import KoreaJobCard from '../components/korea/KoreaJobCard'
import { fetchKoreaJobs } from '../lib/koreaJobsApi'
import type { KoreaJob } from '../types/koreaJob'

const SALARY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'hourly', label: 'Theo giờ' },
  { value: 'daily', label: 'Theo ngày' },
  { value: 'monthly', label: 'Theo tháng' },
  { value: 'annual', label: 'Theo năm' },
  { value: 'negotiable', label: 'Thỏa thuận' },
]

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

export default function KoreaJobs() {
  const [jobs, setJobs] = useState<KoreaJob[]>([])
  const [loading, setLoading] = useState(true)

  // KoreaHome의 검색바에서 /viec-han-quoc/tim-viec?q=...&province=...&cat=...
  // 로 넘어올 때 초기값만 읽는다 — 양방향 URL 동기화 같은 큰 리팩터링은
  // 하지 않는다(범위 최소화).
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [province, setProvince] = useState(searchParams.get('province') ?? '')
  const [category, setCategory] = useState(searchParams.get('cat') ?? '')
  const [salaryType, setSalaryType] = useState('')
  const [dormitoryOnly, setDormitoryOnly] = useState(false)
  const [koreanLevel, setKoreanLevel] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchKoreaJobs().then((data) => {
      if (!cancelled) { setJobs(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const provinces = useMemo(() => uniqueSorted(jobs.map((j) => j.province)), [jobs])
  const categories = useMemo(() => uniqueSorted(jobs.map((j) => j.category)), [jobs])
  const koreanLevels = useMemo(() => uniqueSorted(jobs.map((j) => j.korean_level_required)), [jobs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (q) {
        const haystack = `${job.title ?? ''} ${job.title_vi ?? ''} ${job.company ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (province && job.province !== province) return false
      if (category && job.category !== category) return false
      if (salaryType && job.salary_type !== salaryType) return false
      if (dormitoryOnly && job.dormitory !== true) return false
      if (koreanLevel && job.korean_level_required !== koreanLevel) return false
      return true
    })
  }, [jobs, search, province, category, salaryType, dormitoryOnly, koreanLevel])

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <div className="korea-page">
      <header className="page-header">
        <h1 className="page-header__title">Làm việc tại Hàn Quốc</h1>
        <p className="page-header__lead">Việc làm tại Hàn Quốc dành cho người Việt</p>
      </header>

      <form className="korea-search-bar" onSubmit={onSearchSubmit} role="search">
        <label className="korea-search-bar__field">
          <span aria-hidden>⌕</span>
          <input
            className="korea-search-bar__input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên công việc, công ty..."
            aria-label="Tìm việc làm"
          />
        </label>
        <label className="korea-search-bar__field korea-search-bar__field--select">
          <span aria-hidden>⌖</span>
          <select value={province} onChange={(event) => setProvince(event.target.value)} aria-label="Chọn khu vực">
            <option value="">Tất cả khu vực</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="submit" className="korea-search-bar__button">Tìm việc</button>
      </form>

      {categories.length > 0 && (
        <div className="korea-cat-chips">
          <button
            type="button"
            className={`korea-cat-chip${category === '' ? ' is-active' : ''}`}
            onClick={() => setCategory('')}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`korea-cat-chip${category === c ? ' is-active' : ''}`}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <h2 className="home-section__title">Việc làm tại Hàn Quốc</h2>

      <div className="korea-layout">
        <aside className="korea-filter-sidebar">
          <div className="korea-filter-group">
            <label className="korea-filter-group__label" htmlFor="korea-filter-province">Khu vực</label>
            <select id="korea-filter-province" value={province} onChange={(event) => setProvince(event.target.value)}>
              <option value="">Tất cả</option>
              {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="korea-filter-group">
            <label className="korea-filter-group__label" htmlFor="korea-filter-category">Ngành nghề</label>
            <select id="korea-filter-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Tất cả</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="korea-filter-group">
            <label className="korea-filter-group__label" htmlFor="korea-filter-salary">Hình thức lương</label>
            <select id="korea-filter-salary" value={salaryType} onChange={(event) => setSalaryType(event.target.value)}>
              <option value="">Tất cả</option>
              {SALARY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="korea-filter-group">
            <label className="korea-filter-group__label" htmlFor="korea-filter-korean-level">Yêu cầu tiếng Hàn</label>
            <select id="korea-filter-korean-level" value={koreanLevel} onChange={(event) => setKoreanLevel(event.target.value)}>
              <option value="">Tất cả</option>
              {koreanLevels.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="korea-filter-group">
            <label className="korea-filter-group__checkbox">
              <input type="checkbox" checked={dormitoryOnly} onChange={(event) => setDormitoryOnly(event.target.checked)} />
              Có ký túc xá
            </label>
          </div>
        </aside>

        <div>
          {loading ? (
            <div className="korea-empty">Đang tải danh sách việc làm...</div>
          ) : filtered.length === 0 ? (
            <div className="korea-empty">Không tìm thấy việc làm phù hợp.</div>
          ) : (
            <div className="korea-jobs-grid">
              {filtered.map((job) => <KoreaJobCard key={job.id} job={job} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
