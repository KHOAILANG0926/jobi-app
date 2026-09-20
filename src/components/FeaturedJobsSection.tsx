import type { CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import JobCard from './JobCard'
import { CATEGORY_COLORS } from '../data/categories'
import type { Job } from '../types/job'

/** 2026-09-20 사용자 지시 — 사람인 "꼭 봐야 할 공고(플래티넘)" 캐러셀 참고,
 *  단 유료 등급 개념은 우리에게 없어 순수 디자인만 차용한다. JobCard.tsx
 *  자체는 안 건드리고 기존 틀 그대로 재사용, 상단(+양쪽 위 모서리 곡선)에만
 *  얇은 색선을 표시한다. 절대위치 막대(고정 높이) 방식은 카드 모서리 곡선
 *  (16px)만큼 굵어야만 곡선을 덮을 수 있어 "직선 막대가 곡선까지 침범한다"
 *  는 문제가 있었다 — 최종적으로 카드 테두리 전체를 얇게 감싸는 그라데이션
 *  링을 CSS mask로 만들고(`.featured-job-wrap::before`, index.css),
 *  clip-path로 상단(+모서리 곡선 끝나는 지점까지)만 노출하는 방식으로
 *  교체 — 곡선이 끝나는 정확한 지점에서 색선도 끝나고, 양옆 직선 구간·
 *  하단에는 색이 전혀 안 보인다. 색은 업직종(CATEGORY_COLORS, 다른
 *  색상까지 뚜렷하게 변하는 3단 그라데이션). Home 전용. */
const FEATURED_COUNT = 8

/** 2026-09-20 사용자 지적("왜 다 빨간색이야?") — 그냥 최신순 8개를 뽑으면
 *  실제 DB에 압도적으로 많은 'khac'(기타) 카테고리 공고가 대부분을 차지해
 *  카드 색이 죄다 같아 보였다(실측: 최신 10건 중 8건이 khac). 업직종당
 *  최신 1건씩 먼저 채워서 색이 실제로 다양하게 보이도록 한다. */
export function selectFeaturedJobs(jobs: Job[]): Job[] {
  const sorted = [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  const byCategory = new Map<string, Job[]>()
  for (const j of sorted) {
    const list = byCategory.get(j.category) ?? []
    list.push(j)
    byCategory.set(j.category, list)
  }
  const picked: Job[] = []
  const usedIds = new Set<string>()
  // 1라운드: 업직종마다 최신 1건씩(최신순 카테고리 우선)
  for (const j of sorted) {
    if (picked.length >= FEATURED_COUNT) break
    if (usedIds.has(j.category)) continue
    picked.push(j)
    usedIds.add(j.category)
  }
  // 남는 자리는(업직종 수 < FEATURED_COUNT) 최신순으로 채움
  if (picked.length < FEATURED_COUNT) {
    const pickedJobIds = new Set(picked.map((j) => j.id))
    for (const j of sorted) {
      if (picked.length >= FEATURED_COUNT) break
      if (pickedJobIds.has(j.id)) continue
      picked.push(j)
      pickedJobIds.add(j.id)
    }
  }
  return picked.sort((a, b) => b.postedAt.localeCompare(a.postedAt))
}

export default function FeaturedJobsSection({
  jobs, isApplied, onApply, isSaved, onToggleSave,
}: {
  jobs: Job[]
  isApplied: (id: string) => boolean
  onApply: (job: Job) => void
  isSaved: (id: string) => boolean
  onToggleSave: (job: Job) => void
}) {
  const featured = selectFeaturedJobs(jobs)
  if (featured.length === 0) return null

  return (
    <section className="home-featured">
      <h2 className="home-featured__title">Việc làm nổi bật</h2>
      <div className="home-featured__row">
        {featured.map((job) => (
          <div
            key={job.id}
            className="featured-job-wrap"
            style={{ '--card-gradient': CATEGORY_COLORS[job.category] } as CSSProperties}
          >
            <NavLink className="home-card-wrap" to={`/viec-lam/${job.id}`}>
              <JobCard
                job={job}
                isApplied={isApplied(job.id)}
                onApply={onApply}
                isSaved={isSaved(job.id)}
                onToggleSave={onToggleSave}
              />
            </NavLink>
          </div>
        ))}
      </div>
    </section>
  )
}
