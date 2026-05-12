import { useEffect, useRef } from "react";
import type { ApplyStatus, UserProfile } from "./useApply";
import type { Job } from "../types/job";

interface ApplyModalProps {
  status: ApplyStatus;
  job: Job | null;
  profile: UserProfile;
  onConfirm: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export default function ApplyModal({
  status,
  job,
  profile,
  onConfirm,
  onClose,
  onRetry,
}: ApplyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status !== "loading") onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "loading") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status, onClose]);

  // Focus trap
  useEffect(() => {
    if (status !== "idle") {
      modalRef.current?.focus();
    }
  }, [status]);

  if (status === "idle" || !job) return null;

  const initials = profile.name
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="apply-modal-backdrop"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Ứng tuyển ngay"
    >
      <div
        className={`apply-modal-sheet ${status === "success" ? "success-state" : ""}`}
        ref={modalRef}
        tabIndex={-1}
      >
        {/* Handle bar */}
        <div className="modal-handle" />

        {/* ── CONFIRMING STATE ── */}
        {status === "confirming" && (
          <>
            <div className="modal-header">
              <h2 className="modal-title">Ứng tuyển ngay</h2>
              <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
                ✕
              </button>
            </div>

            {/* Job info */}
            <div className="job-summary-card">
              {job.urgent && (
                <span className="urgent-badge">🔥 Tuyển gấp</span>
              )}
              <p className="job-summary-title">{job.title}</p>
              <p className="job-summary-meta">
                {job.company} · {job.location}
              </p>
              <p className="job-summary-salary">{job.salary}</p>
            </div>

            <div className="section-divider">
              <span>Thông tin ứng viên</span>
            </div>

            {/* Profile preview */}
            <div className="profile-row">
              <div className="avatar-circle">{initials}</div>
              <div className="profile-info">
                <p className="profile-name">{profile.name}</p>
                <p className="profile-sub">
                  {profile.phone} · {profile.age} tuổi
                </p>
              </div>
              <span className="profile-check">✓</span>
            </div>

            {/* CV note */}
            <div className="cv-note">
              <span className="cv-note-icon">📄</span>
              <p>
                Hồ sơ của bạn sẽ được gửi trực tiếp đến nhà tuyển dụng.
                Họ sẽ liên hệ qua số điện thoại đã đăng ký.
              </p>
            </div>

            {/* CTA */}
            <button className="apply-confirm-btn" onClick={onConfirm}>
              Xác nhận ứng tuyển
            </button>
            <button className="apply-cancel-btn" onClick={onClose}>
              Hủy
            </button>
          </>
        )}

        {/* ── LOADING STATE ── */}
        {status === "loading" && (
          <div className="state-center">
            <div className="spinner" />
            <p className="state-title">Đang gửi hồ sơ...</p>
            <p className="state-sub">Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {/* ── SUCCESS STATE ── */}
        {status === "success" && (
          <div className="state-center">
            <div className="success-icon-wrap">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#FF3B5C" fillOpacity="0.12" />
                <path
                  d="M14 24l8 8 12-14"
                  stroke="#FF3B5C"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="state-title success-text">Ứng tuyển thành công! 🎉</p>
            <p className="state-sub">
              Nhà tuyển dụng sẽ liên hệ với bạn trong{" "}
              <strong>24–48 giờ</strong> tới.
            </p>
            <div className="success-job-name">{job.title}</div>
            <button className="apply-confirm-btn" onClick={onClose}>
              Xem việc làm khác
            </button>
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {status === "error" && (
          <div className="state-center">
            <div className="error-icon-wrap">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#FF6B35" fillOpacity="0.12" />
                <path
                  d="M16 16l16 16M32 16L16 32"
                  stroke="#FF6B35"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="state-title">Có lỗi xảy ra</p>
            <p className="state-sub">
              Không thể gửi hồ sơ lúc này. Vui lòng thử lại.
            </p>
            <button className="apply-confirm-btn" onClick={onRetry}>
              Thử lại
            </button>
            <button className="apply-cancel-btn" onClick={onClose}>
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
