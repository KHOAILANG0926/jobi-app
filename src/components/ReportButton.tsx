import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createReport, getOwnReportStatus, type ReportStatus, type ReportTargetType } from '../lib/adminOperations'

export function ReportButton({ targetType, targetId, snapshot }: {
  targetType: ReportTargetType
  targetId: string
  snapshot: Record<string, unknown>
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('spam')
  const [description, setDescription] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')
  const [existingStatus, setExistingStatus] = useState<ReportStatus | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getOwnReportStatus(user.id, targetType, targetId)
      .then(status => { if (!cancelled) setExistingStatus(status) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [targetId, targetType, user])

  function start() {
    if (!user) {
      navigate(`/dang-nhap?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    setOpen(true)
  }

  async function submit() {
    if (!user || !category.trim()) return
    setState('saving'); setError('')
    try {
      await createReport({ reporterId: user.id, targetType, targetId, category, description: description.trim(), snapshot })
      setExistingStatus('pending')
      setState('done')
    } catch (e) {
      setState('idle')
      setError(e instanceof Error ? e.message : 'Không thể gửi báo cáo.')
    }
  }

  if (state === 'done' || existingStatus) return <span className="report-confirmation">Báo cáo của bạn: {existingStatus || 'pending'}</span>
  return <div className="report-control">
    <button type="button" className="report-button" onClick={start}>Báo cáo</button>
    {open && <div className="report-form" role="dialog" aria-label="Báo cáo nội dung">
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="spam">Spam / quảng cáo</option><option value="fraud">Lừa đảo / rủi ro</option>
        <option value="abuse">Nội dung không phù hợp</option><option value="other">Lý do khác</option>
      </select>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)" />
      {error && <small className="admin-error">{error}</small>}
      <div><button type="button" onClick={() => setOpen(false)}>Hủy</button><button type="button" onClick={submit} disabled={state === 'saving'}>{state === 'saving' ? 'Đang gửi…' : 'Gửi báo cáo'}</button></div>
    </div>}
  </div>
}
