import { NavLink } from 'react-router-dom'
import { CATEGORY_COLORS } from '../data/categories'
import { sanitizeSalary } from './JobCard'
import type { Job } from '../types/job'

/** 2026-09-20 사용자 지시 — 사람인 "꼭 봐야 할 공고(플래티넘)" 캐러셀 참고,
 *  단 유료 등급 개념은 우리에게 없어 순수 디자인(상단 색줄 + 사진 카드)만
 *  차용한다. Home 전용(다른 화면은 이미 목적이 달라 안 맞는다고 판단 —
 *  급구/저장한 공고/최근 본 공고/맞춤 공고는 각자 이미 명확한 목적이 있음).
 *  사진은 local_jobs.image_url이 실제로 있는 공고만 후보로 삼는다(없으면
 *  카테고리 일반 이미지로 때우지 않음 — "의미없는 이미지" 지적, 사람인
 *  사진을 가져다 쓰는 것도 저작권+다른 회사 사진 오인 문제로 제외 확정).
 *  상단 색줄은 유료 등급이 아니라 업직종(대분류) 색상(CATEGORY_COLORS)을
 *  재사용 — 실제 의미(분류) 있는 색 구분. */
const FEATURED_COUNT = 8

export function selectFeaturedJobs(jobs: Job[]): Job[] {
  return jobs
    .filter((j) => !!j.imageUrl)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .slice(0, FEATURED_COUNT)
}

export default function FeaturedJobsSection({ jobs }: { jobs: Job[] }) {
  const featured = selectFeaturedJobs(jobs)
  if (featured.length === 0) return null

  return (
    <section className="home-featured">
      <div className="home-featured__head">
        <span className="home-featured__icon" aria-hidden>🌟</span>
        <h2 className="home-featured__title">Việc làm nổi bật</h2>
      </div>
      <div className="home-featured__row">
        {featured.map((job) => (
          <NavLink key={job.id} to={`/viec-lam/${job.id}`} className="featured-job-card">
            <span
              className="featured-job-card__bar"
              style={{ background: CATEGORY_COLORS[job.category] }}
              aria-hidden
            />
            <p className="featured-job-card__company">{job.company}</p>
            <p className="featured-job-card__title">{job.title}</p>
            <div
              className="featured-job-card__photo"
              style={{ backgroundImage: `url(${job.imageUrl})` }}
              role="img"
              aria-label={job.company}
            />
            <div className="featured-job-card__footer">
              <span className="featured-job-card__salary">{sanitizeSalary(job.salary || 'Thỏa thuận')}</span>
              <span className="featured-job-card__location">{job.location}</span>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  )
}
