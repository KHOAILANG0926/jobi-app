import { Link } from 'react-router-dom'

/**
 * "Công cụ" 헤더 탭의 대표 페이지 — 예전엔 탭 라벨을 클릭하면 드롭다운 4개
 * 그룹(Hồ sơ xin việc/Hoạt động ứng tuyển/Công cụ việc làm/Tài khoản) 중
 * 하나(급여계산기)로만 곧장 점프해서 나머지 그룹은 드롭다운을 열어야만
 * 보였다. 알바몬 6개 상단 탭을 전부 직접 클릭해 확인해보니 예외 없이
 * 각자 전용 페이지로 이동했다(예: "고객센터"→문의하기, "회원서비스"→
 * 로그인) — "Công cụ"도 같은 원칙으로 4개 그룹을 한눈에 보여주는 허브
 * 페이지가 있어야 한다고 판단해 신설.
 */
interface HubLink {
  icon: string
  label: string
  desc: string
  to: string
  state?: Record<string, unknown>
}

interface HubGroup {
  heading: string
  links: HubLink[]
}

const GROUPS: HubGroup[] = [
  {
    heading: 'Hồ sơ xin việc',
    links: [
      { icon: '📄', label: 'Hồ sơ của tôi', desc: 'Xem và chỉnh sửa hồ sơ ứng tuyển', to: '/ho-so' },
      { icon: '✍️', label: 'Tạo CV', desc: 'Tạo CV nhanh để ứng tuyển thuận tiện hơn', to: '/ho-so', state: { openCvTab: true } },
    ],
  },
  {
    heading: 'Hoạt động ứng tuyển',
    links: [
      { icon: '📨', label: 'Việc đã ứng tuyển', desc: 'Theo dõi trạng thái các đơn đã gửi', to: '/ho-so', state: { openApplicationsTab: true } },
      { icon: '🔖', label: 'Việc làm đã lưu', desc: 'Danh sách tin bạn đã lưu lại', to: '/viec-lam/da-luu' },
      { icon: '🕘', label: 'Việc làm đã xem', desc: 'Lịch sử các tin bạn đã xem gần đây', to: '/viec-lam/da-xem' },
    ],
  },
  {
    heading: 'Công cụ việc làm',
    links: [
      { icon: '💰', label: 'Tính lương Gross ↔ Net', desc: 'Quy đổi lương nhanh, chính xác', to: '/tinh-luong' },
      { icon: '💬', label: 'Câu hỏi phỏng vấn', desc: 'Câu hỏi thường gặp và cách trả lời', to: '/cau-hoi-phong-van' },
    ],
  },
  {
    heading: 'Tài khoản',
    links: [
      { icon: '👤', label: 'Thông tin cá nhân', desc: 'Quản lý thông tin tài khoản của bạn', to: '/ho-so' },
    ],
  },
]

export default function ToolsHub() {
  return (
    <div className="page th-page">
      <header className="page-header">
        <h1 className="page-header__title">Công cụ</h1>
        <p className="page-header__lead">
          Hồ sơ, ứng tuyển, tính lương và các công cụ hỗ trợ tìm việc — tất cả ở một nơi.
        </p>
      </header>

      <div className="th-groups">
        {GROUPS.map((group) => (
          <section key={group.heading} className="th-group">
            <h2 className="th-group__heading">{group.heading}</h2>
            <div className="th-group__cards">
              {group.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  state={link.state}
                  className="th-card"
                >
                  <span className="th-card__icon" aria-hidden>{link.icon}</span>
                  <span className="th-card__body">
                    <span className="th-card__label">{link.label}</span>
                    <span className="th-card__desc">{link.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
