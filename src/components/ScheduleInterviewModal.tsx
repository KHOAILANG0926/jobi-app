import { FormEvent, useEffect, useState } from 'react'
import { updateApplicationStatus, type JobApplication } from '../lib/applicationsStorage'
import { scheduleInterview } from '../lib/interviewStorage'

interface Props {
  open: boolean
  app: JobApplication | null
  employerId: string
  onClose: () => void
  onScheduled: () => void
}

const TODAY = new Date().toISOString().split('T')[0]

const LOCATION_PRESETS = [
  'Online (Zalo / Google Meet)',
  'Tại văn phòng công ty',
  'Khác',
]

export function ScheduleInterviewModal({ open, app, employerId, onClose, onScheduled }: Props) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [location, setLocation] = useState(LOCATION_PRESETS[0])
  const [customLocation, setCustomLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) {
      setDate('')
      setTime('09:00')
      setLocation(LOCATION_PRESETS[0])
      setCustomLocation('')
      setNotes('')
      setDone(false)
      setSaving(false)
      setError(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !app) return null

  const resolvedLocation = location === 'Khác' ? customLocation : location

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!date || !time || !resolvedLocation.trim() || saving) return
    setSaving(true)
    setError(false)
    try {
      await scheduleInterview({
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        company: app.company,
        seekerId: app.seekerId ?? '',
        seekerName: app.seekerName,
        employerId,
        datetime: `${date}T${time}:00`,
        location: resolvedLocation.trim(),
        notes: notes.trim(),
        status: 'pending',
      })
      if (app.id) await updateApplicationStatus(app.id, 'interview')
      onScheduled()
      setDone(true)
      window.setTimeout(onClose, 1400)
    } catch (err) {
      console.error('scheduleInterview failed', err)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel__head">
          <h2 id="schedule-modal-title" className="modal-panel__title">
            Hẹn phỏng vấn
          </h2>
          <p className="modal-panel__subtitle">
            {app.seekerName ?? 'Ứng viên'} · {app.jobTitle}
          </p>
          <button type="button" className="modal-panel__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>

        {done ? (
          <p className="modal-panel__success" role="status">
            Đã đặt lịch phỏng vấn thành công!
          </p>
        ) : (
          <form className="modal-panel__form schedule-form" onSubmit={onSubmit}>
            <div className="schedule-form__row">
              <label className="field">
                <span className="field__label">Ngày phỏng vấn</span>
                <input
                  type="date"
                  className="field__input"
                  value={date}
                  min={TODAY}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Giờ bắt đầu</span>
                <input
                  type="time"
                  className="field__input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">Hình thức / Địa điểm</span>
              <select
                className="field__input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {LOCATION_PRESETS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>

            {location === 'Khác' && (
              <label className="field">
                <span className="field__label">Nhập địa điểm</span>
                <input
                  type="text"
                  className="field__input"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Số nhà, đường, quận..."
                  required
                />
              </label>
            )}

            <label className="field">
              <span className="field__label">Ghi chú cho ứng viên</span>
              <textarea
                className="field__input field__textarea"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mang CMND/CCCD, CV in sẵn, đúng giờ..."
              />
            </label>

            {error && (
              <p className="hint" style={{ color: '#e53935' }}>
                Có lỗi xảy ra, vui lòng thử lại.
              </p>
            )}

            <div className="modal-panel__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Huỷ
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={saving || !date || !time || (location === 'Khác' && !customLocation.trim())}
              >
                {saving ? 'Đang lưu...' : 'Xác nhận hẹn'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
