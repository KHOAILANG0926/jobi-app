import { useMemo } from 'react'
import type { Job } from '../types/job'
import { brandIndustries, type BrandDefinition } from '../data/brandDirectory'

/**
 * "Thương hiệu" 메가메뉴 — 2026-11-01 Lee: 알바몬 "업직종별 브랜드 / 스페셜 브랜드" 구성.
 * 왼쪽: 30개 업종 전부(공고가 없어도 보임, 누르면 그 업종 브랜드 화면). 오른쪽: 대표 브랜드(featured) 칸.
 * 로고 그림은 domain이 등록된 옛 브랜드만(새 브랜드는 이름 글자·색만 — Lee 기준).
 */
export function BrandLogo({ color, domain, initial }: { color: string; domain?: string; initial: string }) {
  return (
    <span className="mega-menu__brand-card-logo" style={{ background: color }}>
      {domain ? <img src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} alt="" aria-hidden />
        : <span className="mega-menu__brand-card-initial">{initial}</span>}
    </span>
  )
}

export default function BrandIndustryMenu({ jobs, brands, onNavigate }: { jobs: Job[]; brands: BrandDefinition[]; onNavigate: (to: string) => void }) {
  const industries = useMemo(() => brandIndustries(jobs, brands), [jobs, brands])
  const featured = useMemo(() => industries.flatMap((g) => g.brands).filter((b) => b.featured).sort((a, b) => b.count - a.count), [industries])
  return (
    <>
      <div className="mega-menu__brand-layout2">
        <div className="mega-menu__brand-byindustry">
          <h4 className="mega-menu__heading">Thương hiệu theo ngành</h4>
          <div className="brand-industry-list">
            {industries.map((g) => (
              <button key={g.id} type="button" className="brand-industry-list__item" onClick={() => onNavigate(`/franchise-jobs?nganh=${g.id}`)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mega-menu__brand-featured">
          <h4 className="mega-menu__heading">Thương hiệu nổi bật</h4>
          {featured.length === 0 ? <p className="mega-menu__brand-empty">Chưa có thương hiệu nào đang tuyển.</p> : (
            <div className="mega-menu__brand-featured-grid">
              {featured.map((b) => (
                <button key={b.name} type="button" className="mega-menu__brand-mini-card" onClick={() => onNavigate(`/?brand=${encodeURIComponent(b.linkTo)}`)}>
                  <BrandLogo color={b.color} domain={b.domain} initial={b.initial} />
                  <span className="mega-menu__brand-mini-card-label">{b.name}</span>
                  <span className="mega-menu__brand-mini-card-count">{b.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mega-menu__brand-footer">
        <button type="button" className="mega-menu__brand-all" onClick={() => onNavigate('/franchise-jobs')}>Tất cả thương hiệu →</button>
      </div>
    </>
  )
}
