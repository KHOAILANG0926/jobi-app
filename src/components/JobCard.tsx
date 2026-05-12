import type { Job } from "../types/job";

interface JobCardProps {
  job: Job;
  isApplied: boolean;
  onApply: (job: Job) => void;
  rank?: number;
}

export default function JobCard({ job, isApplied, onApply, rank }: JobCardProps) {
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

        <button
          className={`apply-btn ${isApplied ? "apply-btn--done" : ""}`}
          onClick={() => !isApplied && onApply(job)}
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
  );
}
