import { useNavigate } from 'react-router-dom'

const CARDS = [
  {
    bg: '#e53e3e',
    eyebrow: '🔥 Tuyển gấp hôm nay',
    title: 'Tìm việc bán thời gian\nnhanh · đúng · uy tín',
    cta: 'Xem việc làm ngay →',
    badge: 'Cập nhật hôm nay',
    href: '/',
    art: '⚡',
  },
  {
    bg: '#3182ce',
    eyebrow: '🏢 Thương hiệu lớn tuyển dụng',
    title: 'Highlands · WinMart · Grab\nđang cần người ngay!',
    cta: 'Khám phá ngay →',
    badge: 'Nhiều vị trí',
    href: '/',
    art: '📊',
  },
  {
    bg: '#276749',
    eyebrow: '🌏 Việc làm nước ngoài',
    title: 'Cơ hội việc làm\ntại Hàn Quốc & Nhật Bản',
    cta: 'Xem ngay →',
    badge: 'Lương cao',
    href: '/viec-han-quoc',
    art: '✈️',
  },
]

export function HomeBanner() {
  const navigate = useNavigate()
  return (
    <div className="hbanner-cards">
      {CARDS.map((card, i) => (
        <div key={i} className="hbanner-card" style={{ background: card.bg }}>
          <div className="hbanner__text">
            <span className="hbanner__eyebrow">{card.eyebrow}</span>
            <h2 className="hbanner__title" style={{ whiteSpace: 'pre-line' }}>{card.title}</h2>
            <button className="hbanner__cta" onClick={() => navigate(card.href)}>
              {card.cta}
            </button>
          </div>
          <div className="hbanner__art">{card.art}</div>
          <span className="hbanner__badge">{card.badge}</span>
        </div>
      ))}
    </div>
  )
}