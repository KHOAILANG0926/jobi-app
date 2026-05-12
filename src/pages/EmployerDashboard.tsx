import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'

export function EmployerDashboard() {
  const { user } = useAuth()
  const { jobs } = useJobs()

  if (!user) return null

  return (
    <div className="page employer-dashboard">
      <header className="employer-dashboard__hero">
        <p className="employer-dashboard__greeting">Xin chào, {user.name}</p>
        <h1 className="employer-dashboard__title">Bảng điều khiển nhà tuyển dụng</h1>
        <p className="employer-dashboard__lead">
          Đăng tin mới để tiếp cận ứng viên bán thời gian nhanh chóng.
        </p>
        <Link to="/dang-tin" className="btn btn--primary employer-dashboard__cta">
          Đăng tin tuyển dụng
        </Link>
        <Link to="/" className="employer-dashboard__link">
          Xem danh sách việc làm trên Jobi →
        </Link>
      </header>

      <section className="employer-dashboard__stats" aria-label="Thống kê nhanh">
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value">{jobs.length}</span>
          <span className="employer-dashboard__stat-label">Tin đang hiển thị trên Jobi</span>
        </div>
      </section>
    </div>
  )
}
