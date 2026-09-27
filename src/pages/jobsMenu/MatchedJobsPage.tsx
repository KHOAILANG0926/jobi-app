import { Link } from 'react-router-dom'
import { JobAlertsPanel } from '../../components/JobAlertsPanel'
import { RecommendSection } from '../../components/RecommendSection'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { DISTANCE_MATCHING_ENABLED } from '../../lib/jobAlerts'

/**
 * 맞춤 공고 — 기존에 구현돼 있었지만 어디에도 연결되지 않았던
 * RecommendSection(+recommendStorage.ts)을 이 전용 페이지로 실제 연결한다.
 * 지역/최소 급여/근무 시간대/근무 요일/근무 기간/업종 조건을 사용자가 직접
 * 설정·저장(localStorage)하고 재사용할 수 있다. 판별 불가한 데이터는 조건
 * 일치로 간주하지 않고(recommendStorage.ts의 detectWorkDaysCategory/
 * detectWorkPeriodCategory 참고), 지역 조건이 있으면 다른 조건 점수와 무관하게
 * 그 지역 밖 공고는 결과에서 아예 제외한다(matchJobs()의 하드 필터).
 *
 * 2026-09-27: 로그인 구직자는 서버 저장 조건(JobAlertsPanel — 필수/선호, 충족/
 * 불일치/정보 미확인 판정, 새 공고 알림)을 쓴다. 게스트·기업은 기존 localStorage
 * 흐름을 그대로 유지한다.
 */
export default function MatchedJobsPage() {
  const { jobs } = useJobs()
  const { user } = useAuth()
  if (user?.role === 'seeker') {
    return (
      <div className="page jobs-menu-page">
        <header className="page-header">
          <h1 className="page-header__title">Việc làm phù hợp</h1>
          <p className="page-header__lead">
            Lưu điều kiện tìm việc (khu vực{DISTANCE_MATCHING_ENABLED ? ', khoảng cách' : ''}, ngành nghề, lương, giờ làm) và chọn điều kiện nào là bắt buộc.
            Khi có tin mới đạt đủ điều kiện bắt buộc, bạn sẽ nhận thông báo trong trang.
          </p>
        </header>
        <JobAlertsPanel />
      </div>
    )
  }
  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">Việc làm phù hợp</h1>
        <p className="page-header__lead">
          Thiết lập điều kiện của bạn (khu vực, lương, khung giờ, ngày làm, thời hạn, ngành nghề) — điều kiện
          được lưu lại trên trình duyệt này và có thể sửa hoặc đặt lại bất cứ lúc nào.
        </p>
      </header>
      {!user && (
        <p className="page-header__lead">
          <Link to="/dang-nhap?redirect=/viec-lam/phu-hop">Đăng nhập</Link> để lưu điều kiện vào tài khoản và nhận thông báo khi có tin mới phù hợp.
        </p>
      )}
      <RecommendSection jobs={jobs} />
    </div>
  )
}
