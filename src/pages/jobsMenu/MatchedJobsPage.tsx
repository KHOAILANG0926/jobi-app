import { RecommendSection } from '../../components/RecommendSection'
import { useJobs } from '../../context/JobsContext'

/**
 * 맞춤 공고 — 기존에 구현돼 있었지만 어디에도 연결되지 않았던
 * RecommendSection(+recommendStorage.ts)을 이 전용 페이지로 실제 연결한다.
 * 지역/최소 급여/근무 시간대/근무 요일/근무 기간/업종 조건을 사용자가 직접
 * 설정·저장(localStorage)하고 재사용할 수 있다. 판별 불가한 데이터는 조건
 * 일치로 간주하지 않고(recommendStorage.ts의 detectWorkDaysCategory/
 * detectWorkPeriodCategory 참고), 지역 조건이 있으면 다른 조건 점수와 무관하게
 * 그 지역 밖 공고는 결과에서 아예 제외한다(matchJobs()의 하드 필터).
 */
export default function MatchedJobsPage() {
  const { jobs } = useJobs()
  return (
    <div className="page jobs-menu-page">
      <header className="page-header">
        <h1 className="page-header__title">Việc làm phù hợp</h1>
        <p className="page-header__lead">
          Thiết lập điều kiện của bạn (khu vực, lương, khung giờ, ngày làm, thời hạn, ngành nghề) — điều kiện
          được lưu lại trên trình duyệt này và có thể sửa hoặc đặt lại bất cứ lúc nào.
        </p>
      </header>
      <RecommendSection jobs={jobs} />
    </div>
  )
}
