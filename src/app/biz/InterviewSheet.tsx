import { useState } from 'react'
import { scheduleInterviewForApplication } from '../../lib/interviewSchedule'
import type { JobApplication } from '../../lib/applicationsStorage'
import BottomSheet from '../ui/BottomSheet'

const PRESETS = ['Online (Zalo / Google Meet)', 'Tại văn phòng công ty', 'Khác']

// 면접 일정 시트 — 웹 ScheduleInterviewModal과 같은 항목·같은 저장 순서(lib/interviewSchedule).
export default function InterviewSheet({ app, employerId, onClose, onScheduled }: { app: JobApplication; employerId: string; onClose: () => void; onScheduled: () => void }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [place, setPlace] = useState(PRESETS[0])
  const [custom, setCustom] = useState('')
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const location = place === 'Khác' ? custom : place
  const valid = !!date && !!time && !!location.trim()
  const submit = async () => {
    if (!valid || state === 'saving') return
    setState('saving')
    try { await scheduleInterviewForApplication(app, employerId, { date, time, location, notes }); onScheduled(); setState('done'); window.setTimeout(onClose, 1400) } catch { setState('error') }
  }
  return (
    <BottomSheet title="Hẹn phỏng vấn" onClose={state === 'saving' ? () => {} : onClose}
      footer={state === 'done' ? undefined : <button type="button" className="app-btn app-btn--primary" disabled={!valid || state === 'saving'} onClick={submit}>{state === 'saving' ? 'Đang lưu…' : 'Xác nhận lịch'}</button>}>
      <p className="app-apply__job"><strong>{app.seekerName ?? 'Ứng viên'}</strong><span>{app.jobTitle}</span></p>
      {state === 'done' ? <p className="app-apply__ok" role="status">Đã đặt lịch phỏng vấn thành công!</p> : (
        <div className="app-form app-form--sheet" data-testid="app-interview-form">
          {state === 'error' && <p className="app-form__error" role="alert">Không thể đặt lịch lúc này. Vui lòng thử lại.</p>}
          <label className="app-field"><span>Ngày</span><input type="date" min={new Date().toISOString().split('T')[0]} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="app-field"><span>Giờ</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="app-field"><span>Địa điểm</span><select value={place} onChange={(e) => setPlace(e.target.value)}>{PRESETS.map((p) => <option key={p}>{p}</option>)}</select></label>
          {place === 'Khác' && <label className="app-field"><span>Địa chỉ</span><input value={custom} onChange={(e) => setCustom(e.target.value)} /></label>}
          <label className="app-field"><span>Ghi chú</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mang theo CCCD, CV…" /></label>
        </div>
      )}
    </BottomSheet>
  )
}
