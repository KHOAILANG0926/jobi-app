import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDES = [
  {
    bg: 'linear-gradient(135deg,#E53935 0%,#b71c1c 100%)',
    eyebrow: '🔥 Tuyển gấp hôm nay',
    title: 'Tìm việc bán thời gian\nnhanh · đúng · uy tín',
    cta: 'Xem việc làm ngay',
    href: '/',
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
    href: '/',
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
    eyebrow: '📋 Hồ sơ của bạn',
    title: 'Tạo CV miễn phí\nnhà tuyển dụng tự tìm bạn',
    cta: 'Tạo CV ngay',
    href: '/ho-so',
    badge: 'Miễn phí 100%',
    art: (
      <svg viewBox="0 0 120 100" fill="none" aria-hidden>
        <rect x="30" y="15" width="60" height="70" rx="8" fill="rgba(255,255,255,0.15)" />
        <rect x="42" y="28" width="36" height="4" rx="2" fill="rgba(255,255,255,0.6)" />
        <rect x="42" y="38" width="28" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
        <rect x="42" y="48" width="32" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
        <rect x="42" y="58" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="52" cy="76" r="8" fill="rgba(255,255,255,0.3)" />
        <text x="52" y="80" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">✓</text>
      </svg>
    ),
  },
]

export function HomeBanner() {
  const navigate = useNavigate()
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SLIDES.length), 4500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hbanner" role="banner">
      <div className="hbanner__track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {SLIDES.map((s, i) => (
          <div key={i} className="hbanner__slide" style={{ background: s.bg }}>
            <div className="hbanner__text">
              <span className="hbanner__eyebrow">{s.eyebrow}</span>
              <h2 className="hbanner__title" style={{ whiteSpace: 'pre-line' }}>{s.title}</h2>
              <button className="hbanner__cta" onClick={() => navigate(s.href)}>
                {s.cta} →
              </button>
            </div>
            <div className="hbanner__art">{s.art}</div>
            <span className="hbanner__badge">{s.badge}</span>
          </div>
        ))}
      </div>

      <div className="hbanner__dots" aria-label="Slide navigation">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`hbanner__dot${i === active ? ' hbanner__dot--active' : ''}`}
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
            aria-current={i === active}
          />
        ))}
      </div>
    </div>
  )
}
