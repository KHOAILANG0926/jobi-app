import { useNavigate } from 'react-router-dom'

const CARDS = [
  {
    bg: 'linear-gradient(135deg,#E53935 0%,#b71c1c 100%)',
    eyebrow: '🔥 Tuyển gấp hôm nay',
    title: 'Tìm việc bán thời gian\nnhanh · đúng · uy tín',
    cta: 'Xem việc làm ngay',
    href: '/?urgent=true',
    badge: '8 việc mới hôm nay',
    art: (
      <svg viewBox="0 0 120 100" fill="none" aria-hidden>
        <circle cx="60" cy="50" r="45" fill="rgba(255,255,255,0.07)" />
        <circle cx="60" cy="50" r="28" fill="rgba(255,255,255,0.1)" />
        <text x="60" y="62" textAnchor="middle" fontSize="32" fill="rgba(255,255,255,0.9)">⚡</text>
      </svg>
    ),
  },
  {
    bg: 'linear-gradient(135deg,#1565C0 0%,#0d47a1 100%)',
    eyebrow: '🏢 Thương hiệu lớn tuyển dụng',
    title: 'Highlands · WinMart · Grab\nđang cần người ngay!',
    cta: 'Khám phá ngay',
    href: '/franchise-jobs',
    badge: '12 thương hiệu',
    art: (
      <svg viewBox="0 0 120 100" fill="none" aria-hidden>
        <rect x="20" y="30" width="24" height="50" rx="4" fill="rgba(255,255,255,0.15)" />
        <rect x="48" y="15" width="24" height="65" rx="4" fill="rgba(255,255,255,0.2)" />
        <rect x="76" y="25" width="24" height="55" rx="4" fill="rgba(255,255,255,0.15)" />
      </svg>
    ),
  },
  {
    bg: 'linear-gradient(135deg,#2E7D32 0%,#1b5e20 100%)',
    eyebrow: '🌏 Việc làm nước ngoài',
    title: 'Cơ hội việc làm\ntại Hàn Quốc & Nhật Bản',
    cta: 'Xem ngay',
    href: '/viec-han-quoc',
    badge: 'Lương cao',
    art: (
      <svg viewBox="0 0 120 100" fill="none" aria-hidden>
        <circle cx="60" cy="50" r="35" fill="rgba(255,255,255,0.1)" />
        <text x="60" y="62" textAnchor="middle" fontSize="32" fill="rgba(255,255,255,0.9)">✈️</text>
      </svg>
    ),
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
              {card.cta} →
            </button>
          </div>
          <div className="hbanner__art">{card.art}</div>
          <span className="hbanner__badge">{card.badge}</span>
        </div>
      ))}
    </div>
  )
}
