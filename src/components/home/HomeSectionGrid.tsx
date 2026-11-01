import { NavLink } from 'react-router-dom'
import JobCard from '../JobCard'
import type { Job } from '../../types/job'

/** 메인 화면 칸 하나(Lee 2026-11-01 알바몬 구성): 제목 + 승인된 공고 카드(JobCard) 격자. 공고가 없으면 칸을 숨긴다. */
export default function HomeSectionGrid({ id, title, jobs, isApplied, onApply, isSaved, onToggleSave }: {
  id: string; title: string; jobs: Job[]
  isApplied: (id: string) => boolean; onApply: (job: Job) => void
  isSaved: (id: string) => boolean; onToggleSave: (job: Job) => void
}) {
  if (jobs.length === 0) return null
  return (
    <section className={`home-section home-section--${id}`} data-home-section={id}>
      <h2 className="home-section__title">{title}</h2>
      <div className="home-jobs-grid">
        {jobs.map((job) => (
          <NavLink key={job.id} className="home-card-wrap" to={`/viec-lam/${job.id}`}>
            <JobCard job={job} isApplied={isApplied(job.id)} onApply={onApply} isSaved={isSaved(job.id)} onToggleSave={onToggleSave} />
          </NavLink>
        ))}
      </div>
    </section>
  )
}
