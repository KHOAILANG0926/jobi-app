import type { Job } from "../types/job";

interface JobCardProps {
  job: Job;
  isApplied: boolean;
  onApply: (job: Job) => void;
  isSaved?: boolean;
  onToggleSave?: (job: Job) => void;
  rank?: number;
}

export default function JobCard({ job, isApplied, onApply, isSaved, onToggleSave, rank }: JobCardProps) {
  return (
    <div className={`job-card ${isApplied ? "job-card--applied" : ""}`}>
      {rank && (
        <div className="job-rank">#{rank}</div>
      )}

      <div className="job-card-body">
        <div className="job-card-info">
          {job.urgent && (
            <span className="job-urgent-tag">🔥 Tuyển gấp</span>
          )}
          <h3 className="job-card-title">{job.title}</h3>
          <p className="job-card-meta">
            {job.company} · {job.location}
          </p>
          <p className="job-card-salary">{job.salary}</p>
        </div>

        <div className="job-card-actions">
          {onToggleSave && (
            <button
              type="button"
              className={`job-card__bookmark${isSaved ? " job-card__bookmark--saved" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggleSave(job) }}
              aria-label={isSaved ? "Bỏ lưu tin" : "Lưu tin"}
              aria-pressed={isSaved}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="job-card__bookmark-icon">
                <path
                  d="M7 3.5h10a2 2 0 012 2v16.5l-7-4.25L5 22V5.5a2 2 0 012-2z"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            className={`apply-btn ${isApplied ? "apply-btn--done" : ""}`}
            onClick={(e) => { e.stopPropagation(); !isApplied && onApply(job) }}
            disabled={isApplied}
            aria-label={
              isApplied ? "Đã ứng tuyển" : `Ứng tuyển ngay: ${job.title}`
            }
          >
            {isApplied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
                  <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Đã ứng tuyển
              </>
            ) : (
              "Ứng tuyển ngay"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
