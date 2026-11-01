import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useJobs } from '../context/JobsContext'
import { useBrands } from '../context/BrandsContext'
import { brandIndustries, BRAND_CATEGORY_IDS, type BrandCategoryId } from '../data/brandDirectory'
import { BrandLogo } from '../components/BrandIndustryMenu'

/**
 * "Thương hiệu tuyển dụng" — 2026-11-01 Lee: 알바몬 "브랜드 선택" 구성.
 * 왼쪽 30개 업종(공고 수), 오른쪽 고른 업종의 브랜드(공고 수, 0도 보임). 브랜드를 누르면 그 브랜드 공고 목록(/?brand=).
 * 업종을 안 고르면 공고가 있는 브랜드가 많은 업종을 먼저 고른다.
 */
export default function FranchiseJobs() {
  const { jobs } = useJobs()
  const { brands } = useBrands()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const industries = useMemo(() => brandIndustries(jobs, brands), [jobs, brands])
  const asked = params.get('nganh') as BrandCategoryId | null
  const selected = asked && BRAND_CATEGORY_IDS.includes(asked) ? asked
    : ([...industries].sort((a, b) => b.count - a.count || b.brands.length - a.brands.length)[0]?.id ?? BRAND_CATEGORY_IDS[0])
  const current = industries.find((g) => g.id === selected)

  return (
    <div className="page franchise-page">
      <header className="page-header">
        <h1 className="page-header__title">Thương hiệu tuyển dụng</h1>
        <p className="page-header__lead">Chuỗi cửa hàng đã xác minh có từ 3 chi nhánh trở lên.</p>
      </header>
      <div className="franchise-layout">
        <nav className="franchise-industries" aria-label="Ngành">
          {industries.map((g) => (
            <button key={g.id} type="button" className="franchise-industries__item" aria-current={g.id === selected}
              onClick={() => setParams({ nganh: g.id })}>
              <span>{g.label}</span>{g.count > 0 && <span className="franchise-brands__count">{g.count}</span>}
            </button>
          ))}
        </nav>
        <section className="franchise-brands" aria-label="Thương hiệu">
          {!current || current.brands.length === 0 ? (
            <p className="franchise-brands__empty">Chưa có thương hiệu trong ngành này.</p>
          ) : current.brands.map((b) => (
            <button key={b.id} type="button" className="franchise-brands__item" onClick={() => navigate(`/?brand=${encodeURIComponent(b.linkTo)}`)}>
              <BrandLogo color={b.color} domain={b.domain} initial={b.initial} />
              <span>{b.name}</span> <span className="franchise-brands__count">{b.count}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}
