import { NavLink } from 'react-router-dom'
import JobCard from './JobCard'
import { CATEGORY_COLORS } from '../data/categories'
import type { Job } from '../types/job'

/** 2026-09-20 사용자 지시 — 사람인 "꼭 봐야 할 공고(플래티넘)" 캐러셀 참고,
 *  단 유료 등급 개념은 우리에게 없어 순수 디자인만 차용한다. 처음엔 사진이
 *  크게 들어간 별도 세로형 카드로 만들었는데, 사용자가 "이게 우리 기본틀이야
 *  이 틀을 지켜"로 기존 JobCard 그대로 쓰고 상단에 얇은 색깔 줄만 얹으라고
 *  정정함 — JobCard.tsx 자체는 건드리지 않고, 바깥 wrapper에 절대위치로
 *  띠를 겹쳐서 그린다. 색은 업직종(CATEGORY_COLORS, 그라데이션이라 사람인
 *  처럼 옆으로 색이 변하는 효과가 자연히 나옴) 재사용. 이모지/설명 문구는
 *  "진지한 사이트로" 지시로 넣지 않는다. Home 전용(다른 화면은 이미 각자
 *  목적이 있어 확대 안 함). */
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
          <div key={job.id} className="featured-job-wrap">
            <span
              className="featured-job-wrap__bar"
              style={{ background: CATEGORY_COLORS[job.category] }}
              aria-hidden
            />
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
