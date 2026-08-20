import { useState } from 'react'
import { KoreaConsultModal } from './KoreaConsultModal'

export function KoreaBanner() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="korea-banner" onClick={() => setOpen(true)}>
        <span className="korea-banner__flag">🇰🇷</span>
        <span className="korea-banner__body">
          <span className="korea-banner__title">Đi làm việc tại Hàn Quốc E-8, E-7, E-9</span>
          <span className="korea-banner__sub">Thu nhập 40 – 65 triệu đồng/tháng · Tư vấn miễn phí, hồ sơ nhanh gọn</span>
        </span>
        <span className="korea-banner__cta">Đăng ký tư vấn →</span>
      </button>
      <KoreaConsultModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
