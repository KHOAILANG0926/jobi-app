import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { APPLICATION_STATUS_META, cancelApplication, loadApplications, subscribeApplications, type JobApplication } from '../../lib/applicationsStorage'

const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN') }

// 지원 내역 — 웹 지원 내역과 같은 저장소(lib/applicationsStorage: 목록·실시간 반영·철회). 상태 이름도 같은 표(APPLICATION_STATUS_META).
export default function ApplicationsScreen() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [apps, setApps] = useState<JobApplication[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!user?.id) { setApps([]); return }
    loadApplications().then((all) => setApps(all.filter((a) => a.seekerId === user.id))).catch(() => setApps([]))
  }, [user?.id])
  useEffect(() => {
    reload()
    window.addEventListener('vgb:applications', reload)
    const off = user?.id ? subscribeApplications(reload) : () => {}
    return () => { window.removeEventListener('vgb:applications', reload); off() }
  }, [reload, user?.id])

  const cancel = async (a: JobApplication) => {
    if (!a.id || !window.confirm('Rút hồ sơ ứng tuyển này?')) return
    setBusyId(a.id); setError(null)
    const ok = await cancelApplication(a.id)
    setBusyId(null)
    if (!ok) setError('Không thể rút hồ sơ lúc này. Vui lòng thử lại.')
  }

  return (
    <div className="app-page" data-testid="app-applications">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Đã ứng tuyển</h1></header>
      {authLoading || apps === null ? <p className="app-state" role="status">Đang tải…</p>
        : !user ? <div className="app-menu__login"><p>Đăng nhập để xem các việc bạn đã ứng tuyển</p><div><Link className="app-btn app-btn--primary" to="/dang-nhap?redirect=%2Fho-so%2Fung-tuyen">Đăng nhập</Link></div></div>
        : apps.length === 0 ? <p className="app-state">Bạn chưa ứng tuyển việc nào.</p>
        : (
          <ul className="app-applist">
            {error && <li className="app-form__error" role="alert">{error}</li>}
            {apps.map((a) => {
              const meta = APPLICATION_STATUS_META[a.status]
              return (
                <li key={a.id ?? a.jobId} className="app-appcard" data-status={a.status}>
                  <Link to={`/viec-lam/${a.jobId}`} className="app-appcard__main"><strong>{a.jobTitle}</strong><span>{a.company}</span><small>Nộp ngày {fmt(a.appliedAt)}</small></Link>
                  <div className="app-appcard__side"><span className={'app-astatus app-astatus--' + a.status}>{meta?.labelVi ?? a.status}</span>
                    {a.status === 'submitted' && a.id && <button type="button" className="app-link-btn" disabled={busyId === a.id} onClick={() => cancel(a)}>Rút hồ sơ</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
