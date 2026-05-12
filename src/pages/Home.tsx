import type { Job } from '../types/job'

interface JobCardProps {
  job: Job
  isApplied?: boolean
  onApply?: (job: Job) => void
}

export function JobCard({ job, isApplied, onApply }: JobCardProps) {
  return (
    <div className={`job-card ${isApplied ? 'job-card--applied' : ''}`}>
      <div className="job-card-body">
        <div className="job-card-info">
          {job.isUrgent && (
            <span className="job-urgent-tag">🔥 Tuyển gấp</span>
          )}
          <h3 className="job-card-title">{job.title}</h3>
          <p className="job-card-meta">
            {job.company} · {job.location}
          </p>
          <p className="job-card-salary">{job.salary}</p>
        </div>

        {onApply && (
          <button
            className={`apply-btn ${isApplied ? 'apply-btn--done' : ''}`}
            onClick={() => !isApplied && onApply(job)}
            disabled={isApplied}
          >
            {isApplied ? '✓ Đã ứng tuyển' : 'Ứng tuyển ngay'}
          </button>
        )}
      </div>
    </div>
  )
}