import { FormEvent, useEffect, useState } from 'react'
import { REGION_MACRO_TABS } from '../data/jobRegions'
import { addKoreaLead } from '../lib/koreaLeadsStorage'

interface KoreaConsultModalProps {
  open: boolean
  onClose: () => void
}

const FIELD_OPTIONS = [
  { value: 'e9-sanxuat', label: 'Sản xuất chế tạo (E-9)' },
  { value: 'e9-xaydung', label: 'Xây dựng (E-9)' },
  { value: 'e8-nongnghiep', label: 'Nông nghiệp / Ngư nghiệp (E-8)' },
  { value: 'e7-kythuat', label: 'Kỹ thuật viên có tay nghề (E-7)' },
  { value: 'khac', label: 'Khác / Chưa rõ, cần tư vấn' },
]

export function KoreaConsultModal({ open, onClose }: KoreaConsultModalProps) {
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [region, setRegion] = useState('')
  const [field, setField] = useState('')
  const [zalo, setZalo] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) {
      setName(''); setBirthYear(''); setRegion(''); setField(''); setZalo(''); setSent(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSubmit = name.trim() && birthYear.trim() && region && field && zalo.trim()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    addKoreaLead({ name: name.trim(), birthYear: birthYear.trim(), region, field, zalo: zalo.trim() })
    setSent(true)
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="korea-consult-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-panel__head">
          <h2 id="korea-consult-title" className="modal-panel__title">
            🇰🇷 Đăng ký tư vấn đi làm Hàn Quốc
          </h2>
          <p className="modal-panel__subtitle">
            Để lại thông tin, tư vấn viên sẽ liên hệ qua Zalo trong 24h
          </p>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        {sent ? (
          <p className="modal-panel__success" role="status">
            Đã ghi nhận thông tin đăng ký. Tư vấn viên sẽ nhắn Zalo cho bạn sớm nhất!
          </p>
        ) : (
          <form className="modal-panel__form" onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Họ và tên</span>
              <input
                className="field__input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Năm sinh</span>
              <input
                className="field__input"
                type="number"
                inputMode="numeric"
                min={1960}
                max={2010}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="1998"
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Khu vực hiện tại</span>
              <select
                className="field__input"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                required
              >
                <option value="" disabled>Chọn tỉnh/thành</option>
                {REGION_MACRO_TABS.map((tab) => (
                  <optgroup key={tab.label} label={tab.label}>
                    {tab.provinces.map((p) => (
                      <option key={p.id} value={p.label}>{p.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Lĩnh vực mong muốn</span>
              <select
                className="field__input"
                value={field}
                onChange={(e) => setField(e.target.value)}
                required
              >
                <option value="" disabled>Chọn lĩnh vực</option>
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Số Zalo liên hệ</span>
              <input
                className="field__input"
                type="tel"
                inputMode="tel"
                value={zalo}
                onChange={(e) => setZalo(e.target.value)}
                placeholder="09xxxxxxxx"
                required
              />
            </label>
            <div className="modal-panel__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Huỷ</button>
              <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                Đăng ký tư vấn miễn phí
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
