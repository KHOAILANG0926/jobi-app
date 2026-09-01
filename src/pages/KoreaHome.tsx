import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, MapPin, Search, Sparkles } from 'lucide-react'
import KoreaJobCard from '../components/korea/KoreaJobCard'
import { fetchKoreaJobs } from '../lib/koreaJobsApi'
import type { KoreaJob } from '../types/koreaJob'

const JOB_SEARCH_ROUTE = '/viec-han-quoc/tim-viec'
const MAX_HOME_JOBS = 6
// 직종 카테고리를 탐색 요소로 보여줄 최소 종류 수 — 이보다 적으면 선택지로서
// 의미가 없어 영역 자체를 숨긴다(Job 노출과는 다른 기준: Job은 1건도 실제
// 매물이라 그대로 보여주지만, 카테고리는 필터/탐색 UI이므로 다르게 판단).
const MIN_CATEGORIES_TO_SHOW = 3

function uniqueCategories(jobs: KoreaJob[]): string[] {
  return Array.from(new Set(jobs.map((j) => j.category).filter((c): c is string => !!c)))
}

export default function KoreaHome() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<KoreaJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [discoveryClicked, setDiscoveryClicked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchKoreaJobs().then((data) => {
      if (!cancelled) { setJobs(data); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  // fetchKoreaJobs()가 이미 created_at desc로 정렬해서 반환한다(posted_at은
  // 현재 전 건 NULL이라 신뢰 불가 — 조사 단계에서 확인됨). 여기서는 상위
  // 6건만 자른다.
  const homeJobs = useMemo(() => jobs.slice(0, MAX_HOME_JOBS), [jobs])
  const categories = useMemo(() => uniqueCategories(jobs), [jobs])

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const q = searchTerm.trim()
    navigate(q ? `${JOB_SEARCH_ROUTE}?q=${encodeURIComponent(q)}` : JOB_SEARCH_ROUTE)
  }

  return (
    <div className="korea-page korea-home-page">
      {/* A. Header — 태극기/공공기관 느낌 없이, 기존 page-header 톤 재사용 */}
      <header className="page-header">
        <h1 className="page-header__title">Bạn muốn làm việc tại Hàn Quốc?</h1>
        <p className="page-header__lead">Tìm con đường phù hợp và việc làm thực tế dành cho bạn.</p>
      </header>

      {/* B. Discovery — 차별화 포인트, 페이지 상단에 유지하되 hero 크기로 만들지 않음 */}
      <section className="korea-discovery">
        <div className="korea-discovery__copy">
          <h2 className="korea-discovery__title">
            <Sparkles size={18} aria-hidden /> Liệu tôi có thể làm việc tại Hàn Quốc?
          </h2>
          <p className="korea-discovery__lead">
            Dựa trên kinh nghiệm, học vấn và trình độ tiếng Hàn, hãy khám phá con đường việc làm phù hợp với bạn tại Hàn Quốc.
          </p>
          {!discoveryClicked ? (
            <button type="button" className="korea-discovery__cta" onClick={() => setDiscoveryClicked(true)}>
              Kiểm tra khả năng ứng tuyển
            </button>
          ) : (
            <div className="korea-discovery__notice">
              <p>Chức năng kiểm tra khả năng ứng tuyển đang được chuẩn bị. Hãy xem việc làm tại Hàn Quốc trước nhé.</p>
              <NavLink to={JOB_SEARCH_ROUTE} className="korea-discovery__notice-link">
                Xem việc làm tại Hàn Quốc <ArrowRight size={14} aria-hidden />
              </NavLink>
            </div>
          )}
        </div>
        <img
          src="/images/mascot-turtle-mint.webp"
          alt=""
          aria-hidden
          className="korea-discovery__mascot"
        />
      </section>

      {/* C. 한국 일자리 검색 진입 — KoreaJobs.tsx의 복잡한 필터를 다시 만들지 않고 키워드만 */}
      <form className="korea-search-bar" onSubmit={onSearchSubmit} role="search">
        <label className="korea-search-bar__field">
          <Search size={16} aria-hidden />
          <input
            className="korea-search-bar__input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm việc làm tại Hàn Quốc..."
            aria-label="Tìm việc làm tại Hàn Quốc"
          />
        </label>
        <button type="submit" className="korea-search-bar__button">Tìm kiếm</button>
      </form>

      {/* D. 직종 Category — 실제 distinct category가 3개 이상일 때만 노출 */}
      {categories.length >= MIN_CATEGORIES_TO_SHOW && (
        <div className="korea-cat-chips">
          {categories.map((c) => (
            <NavLink key={c} to={`${JOB_SEARCH_ROUTE}?cat=${encodeURIComponent(c)}`} className="korea-cat-chip">
              <Briefcase size={13} aria-hidden /> {c}
            </NavLink>
          ))}
        </div>
      )}

      {/* E. 신규 한국 일자리 — 1건이라도 있으면 그대로 표시(카테고리와 기준이 다름) */}
      <section>
        <h2 className="home-section__title">Việc làm mới tại Hàn Quốc</h2>
        {loading ? (
          <div className="korea-empty">Đang tải danh sách việc làm...</div>
        ) : homeJobs.length === 0 ? (
          <div className="korea-empty">Hiện chưa có việc làm tại Hàn Quốc để hiển thị.</div>
        ) : (
          <>
            <div className="korea-jobs-grid">
              {homeJobs.map((job) => <KoreaJobCard key={job.id} job={job} />)}
            </div>
            <div className="korea-home-more">
              <NavLink to={JOB_SEARCH_ROUTE} className="korea-home-more__link">
                Xem thêm việc làm tại Hàn Quốc <ArrowRight size={14} aria-hidden />
              </NavLink>
            </div>
          </>
        )}
      </section>

      {/* F. Korea Community teaser — 최소 placeholder, 버튼/클릭/가짜 데이터 없음 */}
      <section className="korea-community-teaser">
        <p className="korea-community-teaser__title"><MapPin size={13} aria-hidden /> Cộng đồng — sắp ra mắt</p>
        <p className="korea-community-teaser__lead">
          Cộng đồng sinh hoạt tại Hàn Quốc cũng đang được chúng tôi chuẩn bị.
        </p>
      </section>
    </div>
  )
}
