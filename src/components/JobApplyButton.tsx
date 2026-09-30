import { NavLink } from 'react-router-dom'
import type { Job } from '../types/job'
import { JOB_CONTACT_HASH, resolveApplyAction } from '../lib/jobUtils'

/** 목록(급구 표·추천 표·추천 카드)의 지원 버튼 — resolveApplyAction() 기준(2026-09-30). */
export default function JobApplyButton({ job, applied = false, onInternalApply, className = 'btn btn--primary btn--sm' }: {
  job: Job
  applied?: boolean
  /** 내부 지원형만 호출된다(로그인 확인은 호출부의 기존 흐름). */
  onInternalApply: (job: Job) => void
  className?: string
}) {
  const action = resolveApplyAction(job)
  if (action === 'internal') {
    return (
      <button type="button" className={`${className}${applied ? ' btn--ghost' : ''}`} disabled={applied}
        onClick={() => !applied && onInternalApply(job)}>
        {applied ? 'Đã ứng tuyển' : 'Ứng tuyển'}
      </button>
    )
  }
  if (action === 'contact') {
    return (
      <NavLink to={`/viec-lam/${job.id}#${JOB_CONTACT_HASH}`} className={className}>
        Xem cách liên hệ
      </NavLink>
    )
  }
  return <span className="job-apply-none">Chưa có thông tin liên hệ</span>
}
