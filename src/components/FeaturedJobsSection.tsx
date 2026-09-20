import { NavLink } from 'react-router-dom'
import JobCard from './JobCard'
import { CATEGORY_COLORS } from '../data/categories'
import type { Job } from '../types/job'

/** 2026-09-20 사용자 지시 — 사람인 "꼭 봐야 할 공고(플래티넘)" 캐러셀 참고,
 *  단 유료 등급 개념은 우리에게 없어 순수 디자인만 차용한다. 처음엔 사진이
 *  크게 들어간 별도 세로형 카드로 만들었는데, 사용자가 "이게 우리 기본틀이야
 *  이 틀을 지켜"로 기존 JobCard 그대로 쓰고 상단에 얇은 색깔 줄만 얹으라고
 *  정정함. 그 다음 실제로는 카드 상단만이 아니라 **카드 전체를 얇게 감싸는
 *  진짜 테두리**였고("사람인 다시 확인해" — Webcash/세종분석연구원/coupang/
 *  SHINSEGAE 캡처, 4면을 따라 도는 얇은 선), 두께는 처음 만든 얇은 크기
 *  ("이전 사이즈 좋아 그 사이즈 기준 건들지마") 그대로 유지하라고 정정함 —
 *  JobCard.tsx 자체는 안 건드리고, `padding-box`+`border-box` 이중
 *  배경 기법으로 둥근 모서리까지 자연스럽게 도는 그라데이션 테두리를
 *  wrapper에 그린다. 색은 업직종(CATEGORY_COLORS, 옆으로 갈수록 다른
 *  색상까지 뚜렷하게 변하는 3단 그라데이션으로 재정의 — "그라데이션이
 *  들어가다 만거같아" 지적). 이모지/설명 문구는 "진지한 사이트로" 지시로
 *  넣지 않는다. Home 전용(다른 화면은 이미 각자 목적이 있어 확대 안 함). */
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
            style={{ backgroundImage: `linear-gradient(#fff,#fff), ${CATEGORY_COLORS[job.category]}` }}
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
