import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BookOpen, Factory, FileCheck2, HardHat,
  LayoutGrid, MapPin, Route, Search, SprayCan, Truck, UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import KoreaJobCard from '../components/korea/KoreaJobCard'
import { fetchKoreaJobs } from '../lib/koreaJobsApi'
import type { KoreaJob } from '../types/koreaJob'

const JOB_SEARCH_ROUTE = '/viec-han-quoc/tim-viec'
const MAX_HOME_JOBS = 6

function uniqueSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

// 승인 시안(시안.webp)의 6개 직종탐색 항목. 실제 DB의 category는 자유 텍스트라
// 고정된 taxonomy가 없으므로, 시안의 항목을 UI 라벨(베트남어)로 쓰고 실제 DB
// category 값과는 keyword로만 매칭한다 — 매칭되는 실제 공고가 없으면(현재 대부분)
// 필터 없이 전체 목록으로 보낸다. 존재하지 않는 데이터를 있는 척 필터링하지 않는다.
interface CategoryTaxonomy {
  key: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
  keywords: string[]
}

const CATEGORY_TAXONOMY: CategoryTaxonomy[] = [
  { key: 'production', label: 'Sản xuất · Kỹ thuật', icon: Factory, color: '#2563eb', bg: '#e0ecff', keywords: ['제조', '생산', '기술', '공장'] },
  { key: 'construction', label: 'Xây dựng', icon: HardHat, color: '#ea580c', bg: '#ffe8d6', keywords: ['건설', '건축', '토목'] },
  { key: 'logistics', label: 'Logistics · Vận tải', icon: Truck, color: '#2563eb', bg: '#e0ecff', keywords: ['물류', '운전', '배송', '택배'] },
  { key: 'service', label: 'Nhà hàng · Dịch vụ', icon: UtensilsCrossed, color: '#db2777', bg: '#ffe1ef', keywords: ['외식', '서비스', '식당', '음식'] },
  { key: 'cleaning', label: 'Vệ sinh', icon: SprayCan, color: '#16a34a', bg: '#dcfce7', keywords: ['청소', '미화'] },
]

function matchRealCategory(bucket: CategoryTaxonomy, realCategories: string[]): string | null {
  return realCategories.find((c) => bucket.keywords.some((k) => c.includes(k))) ?? null
}

// Korea Community는 아직 실제 서비스가 없다(글/작성자/시간 데이터 없음).
// 승인 시안의 "이미지 카드형" 구성(카드 상단 category badge + 대표 이미지 +
// 하단 title + 하단 상태)을 미리보기로 구현한다. 실제 사진이 없으므로 카테고리를
// 나타내는 flat 일러스트(SVG)를 대표 이미지로 쓰고, 실제 게시글로 오해되지
// 않도록 각 카드에 "Xem trước · Sắp ra mắt" 상태를 명시한다 — 실제 사용자명/
// 실제 작성 시간/실제 거래·모임처럼 보이는 문구는 쓰지 않는다.
function RoommateArt() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="90" fill="#c9f7e6" />
      <circle cx="98" cy="20" r="11" fill="#ffe08a" />
      <rect x="0" y="74" width="120" height="16" fill="#0d9488" opacity="0.14" />
      <rect x="16" y="26" width="20" height="16" rx="3" fill="#ffffff" opacity="0.85" />
      <rect x="14" y="44" width="72" height="30" rx="5" fill="#ffffff" />
      <rect x="14" y="38" width="72" height="10" rx="5" fill="#5eead4" />
      <rect x="18" y="48" width="16" height="18" rx="4" fill="#a7f3d0" />
    </svg>
  )
}
function MarketplaceArt() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="90" fill="#e6defc" />
      <rect x="0" y="76" width="120" height="14" fill="#5b21b6" opacity="0.12" />
      <path d="M46 34 L46 22 Q60 10 74 22 L74 34" fill="none" stroke="#5b21b6" strokeWidth="4" />
      <rect x="30" y="34" width="60" height="40" rx="5" fill="#a78bfa" />
      <rect x="30" y="34" width="60" height="11" fill="#7c3aed" />
    </svg>
  )
}
function CarpoolArt() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="90" fill="#d3e6ff" />
      <rect x="0" y="68" width="120" height="22" fill="#93c5fd" opacity="0.5" />
      <rect x="18" y="46" width="76" height="20" rx="8" fill="#3b82f6" />
      <rect x="33" y="33" width="42" height="18" rx="6" fill="#60a5fa" />
      <circle cx="36" cy="68" r="8" fill="#1e3a8a" />
      <circle cx="80" cy="68" r="8" fill="#1e3a8a" />
    </svg>
  )
}
function MeetupArt() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="120" height="90" fill="#ffe4c2" />
      <circle cx="42" cy="38" r="12" fill="#f59e0b" />
      <rect x="26" y="52" width="32" height="28" rx="10" fill="#fb923c" />
      <circle cx="80" cy="34" r="12" fill="#ea580c" />
      <rect x="64" y="48" width="32" height="32" rx="10" fill="#f97316" />
    </svg>
  )
}

interface CommunityPreview {
  key: string
  art: typeof RoommateArt
  badgeLabel: string
  caption: string
}

const COMMUNITY_PREVIEW: CommunityPreview[] = [
  { key: 'roommate', art: RoommateArt, badgeLabel: 'Tìm bạn ở ghép', caption: 'Tìm phòng trọ, ở ghép gần chỗ làm' },
  { key: 'marketplace', art: MarketplaceArt, badgeLabel: 'Mua bán', caption: 'Mua bán, trao đổi đồ dùng cũ' },
  { key: 'carpool', art: CarpoolArt, badgeLabel: 'Đi chung xe', caption: 'Đi chung xe, di chuyển tiết kiệm' },
  { key: 'meetup', art: MeetupArt, badgeLabel: 'Gặp gỡ, kết bạn', caption: 'Kết nối, gặp gỡ bạn bè' },
]

export default function KoreaHome() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<KoreaJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [provinceTerm, setProvinceTerm] = useState('')
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
  const realCategories = useMemo(() => uniqueSorted(jobs.map((j) => j.category)), [jobs])
  const provinces = useMemo(() => uniqueSorted(jobs.map((j) => j.province)), [jobs])

  const goSearch = (q: string, province: string) => {
    const params = new URLSearchParams()
    const term = q.trim()
    if (term) params.set('q', term)
    if (province) params.set('province', province)
    const qs = params.toString()
    navigate(qs ? `${JOB_SEARCH_ROUTE}?${qs}` : JOB_SEARCH_ROUTE)
  }

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    goSearch(searchTerm, provinceTerm)
  }

  const onProvinceChange = (value: string) => {
    setProvinceTerm(value)
    goSearch(searchTerm, value)
  }

  return (
    <div className="kh-page">
      {/* A. HERO */}
      <header className="kh-hero">
        <h1 className="kh-hero__title">Bạn muốn làm việc tại Hàn Quốc?</h1>
        <p className="kh-hero__lead">Việc làm, chuẩn bị hồ sơ và đời sống tại Hàn Quốc — tất cả trong một nơi.</p>
      </header>

      {/* B. DISCOVERY — 시안의 사람 일러스트 대신 실제 Viecganban 마스코트 사용 */}
      <section className="kh-discovery">
        <div className="kh-discovery__top">
          <img
            src="/images/mascot-turtle-mint.webp"
            alt=""
            aria-hidden
            className="kh-discovery__mascot"
          />
          <div className="kh-discovery__copy">
            <p className="kh-discovery__eyebrow">Chưa từng làm việc tại Hàn Quốc?</p>
            <h2 className="kh-discovery__title">Với kinh nghiệm của tôi, tôi có thể làm việc tại Hàn Quốc không?</h2>
            <p className="kh-discovery__lead">
              Dựa trên kinh nghiệm, học vấn và trình độ tiếng Hàn, hãy khám phá con đường việc làm phù hợp với bạn.
            </p>
            {!discoveryClicked ? (
              <button type="button" className="kh-discovery__cta" onClick={() => setDiscoveryClicked(true)}>
                Kiểm tra khả năng ứng tuyển →
              </button>
            ) : (
              <div className="kh-discovery__notice">
                <p>Chức năng kiểm tra khả năng ứng tuyển đang được chuẩn bị. Hãy xem việc làm tại Hàn Quốc trước nhé.</p>
                <NavLink to={JOB_SEARCH_ROUTE} className="kh-discovery__notice-link">
                  Xem việc làm tại Hàn Quốc <ArrowRight size={14} aria-hidden />
                </NavLink>
              </div>
            )}
          </div>
        </div>
        <div className="kh-discovery__benefits">
          <div className="kh-discovery__benefit">
            <Route size={20} aria-hidden />
            <span className="kh-discovery__benefit-label">Gợi ý lộ trình việc làm phù hợp</span>
          </div>
          <div className="kh-discovery__benefit">
            <FileCheck2 size={20} aria-hidden />
            <span className="kh-discovery__benefit-label">Thông tin visa &amp; điều kiện ứng tuyển</span>
          </div>
          <div className="kh-discovery__benefit">
            <BookOpen size={20} aria-hidden />
            <span className="kh-discovery__benefit-label">Thông tin chuẩn bị việc làm</span>
          </div>
        </div>
      </section>

      {/* C. 검색 + 지역탐색 — 검색 필드 | 지역 select, 보이는 버튼 없음(Enter/select로 이동) */}
      <form className="kh-search" onSubmit={onSearchSubmit} role="search">
        <label className="kh-search__field">
          <Search size={16} aria-hidden />
          <input
            className="kh-search__input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo tên công việc, công ty..."
            aria-label="Tìm việc làm tại Hàn Quốc"
          />
        </label>
        <span className="kh-search__divider" aria-hidden />
        <label className="kh-search__region">
          <MapPin size={16} aria-hidden />
          <select
            value={provinceTerm}
            onChange={(event) => onProvinceChange(event.target.value)}
            aria-label="Chọn khu vực"
          >
            <option value="">Chọn khu vực</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button type="submit" className="kh-search__submit">Tìm kiếm</button>
      </form>

      {/* D. 직종탐색 — 원형 아이콘 + 라벨 6열. 매칭되는 실제 category가 있으면
          그 값으로 필터링, 없으면 전체 목록으로 이동(가짜 필터링 없음) */}
      <nav className="kh-categories" aria-label="Khám phá theo ngành nghề">
        <div className="kh-categories__grid">
          {CATEGORY_TAXONOMY.map((bucket) => {
            const Icon = bucket.icon
            const matched = matchRealCategory(bucket, realCategories)
            const to = matched ? `${JOB_SEARCH_ROUTE}?cat=${encodeURIComponent(matched)}` : JOB_SEARCH_ROUTE
            return (
              <NavLink key={bucket.key} to={to} className="kh-category">
                <span className="kh-category__icon" style={{ background: bucket.bg, color: bucket.color }}>
                  <Icon size={22} aria-hidden />
                </span>
                <span className="kh-category__label">{bucket.label}</span>
              </NavLink>
            )
          })}
          <NavLink to={JOB_SEARCH_ROUTE} className="kh-category">
            <span className="kh-category__icon" style={{ background: '#f3f4f6', color: '#6b7280' }}>
              <LayoutGrid size={22} aria-hidden />
            </span>
            <span className="kh-category__label">Xem tất cả</span>
          </NavLink>
        </div>
      </nav>

      {/* E. 신규 한국 일자리 — 실제 DB 공고만, Home 전용 grid(216px 상한 없음) */}
      <section className="kh-jobs">
        <div className="kh-jobs__head">
          <h2 className="kh-jobs__title">🔥 Việc làm mới tại Hàn Quốc</h2>
          {homeJobs.length > 0 && (
            <NavLink to={JOB_SEARCH_ROUTE} className="kh-jobs__more-link">
              Xem thêm <ArrowRight size={13} aria-hidden />
            </NavLink>
          )}
        </div>
        {loading ? (
          <div className="korea-empty">Đang tải danh sách việc làm...</div>
        ) : homeJobs.length === 0 ? (
          <div className="korea-empty">Hiện chưa có việc làm tại Hàn Quốc để hiển thị.</div>
        ) : (
          <>
            <div className="kh-jobs-grid">
              {homeJobs.map((job) => <KoreaJobCard key={job.id} job={job} />)}
            </div>
            <div className="kh-jobs-more">
              <NavLink to={JOB_SEARCH_ROUTE} className="kh-jobs-more__link">
                Xem thêm việc làm tại Hàn Quốc <ArrowRight size={14} aria-hidden />
              </NavLink>
            </div>
          </>
        )}
      </section>

      {/* F. Korea Community — 시안의 이미지 카드형 구조(카드 상단 category badge +
          대표 이미지 + 하단 title + 하단 상태 영역)를 그대로 구현. 실제 게시글이
          없으므로 사진 대신 카테고리를 나타내는 flat 일러스트를 쓰고, 하단에는
          실제 시간 대신 "Xem trước · Sắp ra mắt" 상태만 표기한다. Korea Community
          실제 페이지가 아직 없어 "Xem thêm"은 비활성 표시만(링크 아님). */}
      <section className="kh-community">
        <div className="kh-community__head">
          <div className="kh-community__head-left">
            <h2 className="kh-community__title">Cộng đồng người Việt tại Hàn Quốc</h2>
            <span className="kh-community__badge">Sắp ra mắt</span>
          </div>
          <span className="kh-community__more" aria-disabled="true">
            Xem thêm <ArrowRight size={13} aria-hidden />
          </span>
        </div>
        <p className="kh-community__lead">
          Kết nối, chia sẻ đời sống và thông tin hữu ích cùng người Việt đang sinh sống, làm việc tại Hàn Quốc.
        </p>
        <div className="kh-community__grid">
          {COMMUNITY_PREVIEW.map((item) => {
            const Art = item.art
            return (
              <div key={item.key} className="kh-community-card">
                <div className="kh-community-card__media">
                  <Art />
                  <span className="kh-community-card__badge">{item.badgeLabel}</span>
                </div>
                <div className="kh-community-card__body">
                  <p className="kh-community-card__caption">{item.caption}</p>
                  <p className="kh-community-card__status">Xem trước · Sắp ra mắt</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
