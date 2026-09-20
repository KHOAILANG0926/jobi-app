// 2026-09-20 사용자 지시(알바몬 "최근 본 알바" 캡처 재지적 — "이렇게 만들어
// 달라니까.... 구성을") — 처음엔 "Đang tuyển"/"Đã hết hạn"을 섹션 제목으로
// 쌓아서 전부 같이 보여주는 구조로 만들었는데, 실제 알바몬은 표 하나를
// 탭(전체/게재중/마감)으로 전환하는 구조였다. JobDetail.tsx가 이미 쓰던
// .jd2-tabs/.jd2-tab 밑줄 탭 스타일을 그대로 재사용해 새 CSS를 만들지 않는다.

export type JobsStatusFilter = 'all' | 'open' | 'closed'

const TABS: { value: JobsStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Đang tuyển' },
  { value: 'closed', label: 'Đã hết hạn' },
]

export default function JobsStatusTabs({
  value,
  onChange,
}: {
  value: JobsStatusFilter
  onChange: (v: JobsStatusFilter) => void
}) {
  return (
    <div className="jd2-tabs" role="tablist" aria-label="Lọc theo trạng thái">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`jd2-tab${value === t.value ? ' jd2-tab--active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
