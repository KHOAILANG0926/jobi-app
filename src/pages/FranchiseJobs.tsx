import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '../context/JobsContext'
import { useBrands } from '../context/BrandsContext'
import { computeBrandCounts, groupBrandsByCategory } from '../data/brandDirectory'

/**
 * "Tất cả thương hiệu" — 상단 메뉴 브랜드 메가메뉴의 "Tất cả thương hiệu"
 * 링크가 여는 전체 목록 페이지. 이전 버전은 고정된 8개 브랜드를 하드코딩하고
 * 클릭해도 필터 없이 "/"로만 이동하는 사실상 미작동 페이지였다 — 이번에
 * 실제 활성 공고 데이터(src/data/brandDirectory.ts, Layout.tsx의 메가메뉴와
 * 동일한 계산 로직 재사용)로 교체했다.
 */
export default function FranchiseJobs() {
  const { jobs } = useJobs()
  const { brands } = useBrands()
  const navigate = useNavigate()
  const groups = useMemo(() => groupBrandsByCategory(computeBrandCounts(jobs, brands)), [jobs, brands])

  return (
    <div className="page franchise-page">
      <header className="page-header">
        <h1 className="page-header__title">Thương hiệu tuyển dụng</h1>
        <p className="page-header__lead">
          Các thương hiệu chuỗi/cửa hàng đang có tin tuyển dụng thực tế trên Việcganban.
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="city-result__empty">
          <span>🔍</span>
          <p>Hiện chưa có thương hiệu nào đang tuyển.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="franchise-group">
            <h2 className="home-section__title">{g.label}</h2>
            <div className="mega-menu__brand-grid franchise-group__grid">
              {g.brands.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className="mega-menu__brand-card"
                  onClick={() => navigate(`/?brand=${encodeURIComponent(b.linkTo)}`)}
                >
                  <span className="mega-menu__brand-card-logo" style={{ background: b.color }}>
                    {b.domain ? (
                      <img src={`https://www.google.com/s2/favicons?sz=64&domain=${b.domain}`} alt="" aria-hidden />
                    ) : (
                      <span className="mega-menu__brand-card-initial">{b.initial}</span>
                    )}
                  </span>
                  <span className="mega-menu__brand-card-label">{b.name}</span>
                  <span className="mega-menu__brand-item-count">{b.count}</span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
