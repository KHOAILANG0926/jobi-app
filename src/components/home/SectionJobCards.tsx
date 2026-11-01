import { NavLink } from 'react-router-dom'
import type { Job } from '../../types/job'
import SalaryText from '../SalaryText'
import { CompanyLogo } from '../JobCard'
import { useBrandsOptional } from '../../context/BrandsContext'
import { brandLogoFor } from '../../lib/brandLogo'
import { cardCompany, cardTitle } from '../../lib/cardText'
import { shortArea } from '../../lib/shortArea'
import { benefitTags, cardPhoto, deadlineLabel } from '../../lib/cardPhoto'
import './section-cards.css'

/**
 * 메인 칸 카드 — Lee 2026-11-01 사람인 방식(PC·모바일 화면 예시).
 * PhotoCard: 위 회사 표시(브랜드 아이콘 또는 이름 글자) + 제목 2줄 + 급여, 아래 사진(포스터 없으면 업종 사진) 위에 혜택 꼬리표·마감.
 * TextCard: 사진 없는 글 카드(연한 바탕에 제목·지역·마감, 아래 회사 이름·급여).
 * 사진 고르기·급여 표시는 공용 함수(cardPhoto, SalaryText) 한 곳만 쓴다.
 */
export function PhotoCard({ job }: { job: Job }) {
  const brands = useBrandsOptional()
  const logo = brandLogoFor(job, brands)
  const photo = cardPhoto(job)
  const tag = benefitTags(job)[0]
  const deadline = deadlineLabel(job.applicationDeadline)
  const area = shortArea(job.location)
  return (
    <NavLink to={`/viec-lam/${job.id}`} className="scard scard--photo" data-job-id={job.id}>
      <div className="scard__brand">
        {logo ? <CompanyLogo company={job.company} imageUrl={logo} /> : <span className="scard__brand-name">{cardCompany(job.company, area)}</span>}
      </div>
      <h3 className="scard__title">{cardTitle(job.title, job.company)}</h3>
      <p className="scard__pay"><SalaryText job={job} empty="Xem trong tin" /></p>
      <div className="scard__photo">
        <img src={photo.url} alt="" loading="lazy" />
        {tag && <span className="scard__tag">{tag}</span>}
        {deadline && <span className="scard__deadline">{deadline}</span>}
      </div>
    </NavLink>
  )
}

export function TextCard({ job }: { job: Job }) {
  const area = shortArea(job.location)
  const deadline = deadlineLabel(job.applicationDeadline)
  return (
    <NavLink to={`/viec-lam/${job.id}`} className="scard scard--text" data-job-id={job.id}>
      <div className="scard__box">
        <h3 className="scard__title">{cardTitle(job.title, job.company)}</h3>
        <p className="scard__area">{area}</p>
        {deadline && <span className="scard__box-deadline">{deadline}</span>}
      </div>
      {cardCompany(job.company, area) && <p className="scard__company">{cardCompany(job.company, area)}</p>}
      <p className="scard__pay"><SalaryText job={job} empty="Xem trong tin" /></p>
    </NavLink>
  )
}

/** 칸 하나: PC는 4개 바둑판, 모바일은 세로 3개씩 묶어 옆으로 밀기. 공고가 없으면 칸을 숨긴다. */
export function HomeSection({ id, title, jobs, variant }: { id: string; title: string; jobs: Job[]; variant: 'photo' | 'text' }) {
  if (jobs.length === 0) return null
  const Card = variant === 'photo' ? PhotoCard : TextCard
  const columns: Job[][] = []
  for (let i = 0; i < jobs.length; i += 3) columns.push(jobs.slice(i, i + 3))
  return (
    <section className={`hsec hsec--${id}`} data-home-section={id}>
      <h2 className="hsec__title">{title}</h2>
      <div className="hsec__grid">{jobs.map((j) => <Card key={j.id} job={j} />)}</div>
      <div className="hsec__rail">
        {columns.map((col, i) => <div className="hsec__col" key={i}>{col.map((j) => <Card key={j.id} job={j} />)}</div>)}
      </div>
    </section>
  )
}
