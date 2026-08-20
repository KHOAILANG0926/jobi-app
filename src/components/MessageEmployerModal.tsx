import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../types/auth'
import type { Job } from '../types/job'
import { appendSeekerMessage } from '../lib/messagesStorage'

interface MessageEmployerModalProps {
  open: boolean
  job: Job
  user: AuthUser | null
  onClose: () => void
}

export function MessageEmployerModal({ open, job, user, onClose }: MessageEmployerModalProps) {
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) {
      setBody('')
      setSent(false)
      setSending(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || user.role !== 'seeker' || !body.trim()) return
    setSending(true)
    await appendSeekerMessage(job, body.trim())
    setSending(false)
    setSent(true)
    window.setTimeout(() => {
      onClose()
    }, 900)
  }

  const isSeeker = user?.role === 'seeker'

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="msg-employer-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-panel__head">
          <h2 id="msg-employer-title" className="modal-panel__title">
            Nhắn tin nhà tuyển dụng
          </h2>
          <p className="modal-panel__subtitle">
            {job.title} · {job.company}
          </p>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        {!isSeeker ? (
          <div className="modal-panel__form">
            <p className="hint">
              Đăng nhập tài khoản <strong>ứng viên</strong> để gửi tin nhắn trong app. Tin được lưu
              trong mục «Tin nhắn» ở Hồ sơ.
            </p>
            <div className="modal-panel__actions modal-panel__actions--single">
              <Link to="/dang-nhap" className="btn btn--primary btn--block" onClick={onClose}>
                Đăng nhập
              </Link>
              <Link to="/dang-ky" className="btn btn--ghost btn--block" onClick={onClose}>
                Đăng ký ứng viên
              </Link>
            </div>
          </div>
        ) : sent ? (
          <p className="modal-panel__success" role="status">
            Đã gửi tin nhắn. Xem hộp thư trong Hồ sơ → Tin nhắn.
          </p>
        ) : (
          <form className="modal-panel__form" onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Nội dung</span>
              <textarea
                className="field__input field__textarea"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Chào anh/chị, em muốn hỏi về ca làm và thời gian phỏng vấn..."
                required
              />
            </label>
            <div className="modal-panel__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Huỷ
              </button>
              <button type="submit" className="btn btn--primary" disabled={!body.trim() || sending}>
                {sending ? 'Đang gửi...' : 'Gửi tin nhắn'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
