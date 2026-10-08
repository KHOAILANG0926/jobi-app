import { useJobs } from '../context/JobsContext'

/** 공개 공고가 0건일 때 쓰는 안내 — "필터에 맞는 결과 없음"과 구분한다.
 *  예시·가짜 공고는 절대 채워 넣지 않는다(CLAUDE.md "예시·가짜 공고 표시 금지"). */
export function NoPublicJobs() {
  const { loading, jobsError } = useJobs()
  const message = loading
    ? 'Đang tải danh sách việc làm…'
    : jobsError
      ? 'Chưa tải được danh sách việc làm. Vui lòng thử lại sau.'
      : 'Hiện chưa có tin tuyển dụng nào đang mở. Vui lòng quay lại sau.'
  return (
    <div className="city-result__empty" data-testid="no-public-jobs">
      <span>🗂️</span>
      <p>{message}</p>
    </div>
  )
}
