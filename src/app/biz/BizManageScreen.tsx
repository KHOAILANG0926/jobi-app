import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Flame, Trash2 } from 'lucide-react'
import { useJobs } from '../../context/JobsContext'
import { CATEGORY_LABELS } from '../../data/categories'
import { loadApplicationCvPhoto } from '../../lib/accountCvStorage'
import { APPLICATION_STATUS_META, updateApplicationStatus, type ApplicationStatus, type JobApplication } from '../../lib/applicationsStorage'
import type { CvData } from '../../lib/cvStorage'
import type { Job } from '../../types/job'
import BizGate from './BizGate'
import { filterByJob, SELECTABLE_STATUSES } from './bizView'
import { useBizData } from './useBizData'

const fmt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN') }

function CvPanel({ app }: { app: JobApplication }) {
  const cv = app.cvSnapshot as Partial<CvData> | null
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState(false)
  useEffect(() => {
    // 지원 시점 사진 스냅샷 — 접근 허용은 서버(storage RLS)가 매번 확인한다. 실패하면 사진 없이 나머지만 보인다(웹과 같음).
    if (!app.cvPhotoSnapshotPath) return
    let cancelled = false
    loadApplicationCvPhoto(app.cvPhotoSnapshotPath).then((u) => { if (!cancelled) setPhoto(u) }).catch(() => { if (!cancelled) setPhotoError(true) })
    return () => { cancelled = true }
  }, [app.cvPhotoSnapshotPath])
  if (!cv) return <p className="app-cv__hint">Ứng viên chưa cập nhật CV vào lúc ứng tuyển.</p>
  return (
    <div className="app-bizcv" data-testid="app-biz-cv">
      {app.cvPhotoSnapshotPath && (photo ? <img src={photo} alt="Ảnh CV" /> : photoError ? <small>Không thể tải ảnh CV.</small> : <small>Đang tải ảnh...</small>)}
      <div>
        {cv.headline && <p><strong>{cv.headline}</strong></p>}
        {cv.objective && <p>{cv.objective}</p>}
        <p className="app-bizcv__muted">{[cv.email && `✉️ ${cv.email}`, cv.city && `📍 ${cv.city}`, cv.dateOfBirth && `🎂 ${cv.dateOfBirth}`].filter(Boolean).join(' · ')}</p>
        {!!cv.experiences?.some((e) => e.role || e.company) && <><h4>Kinh nghiệm</h4>{cv.experiences.filter((e) => e.role || e.company).map((e) => <p key={e.id}>{e.role}{e.company && ` · ${e.company}`}{e.period && ` (${e.period})`}</p>)}</>}
        {!!cv.education?.some((e) => e.school) && <><h4>Học vấn</h4>{cv.education.filter((e) => e.school).map((e) => <p key={e.id}>{e.school}{e.degree && ` · ${e.degree}`}{e.graduationYear && ` (${e.graduationYear})`}</p>)}</>}
        {!!cv.skillTags?.length && <p><strong>Kỹ năng:</strong> {cv.skillTags.join(', ')}</p>}
      </div>
    </div>
  )
}

function Manage({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'ung-vien' ? 'ung-vien' : 'tin'
  const filterJobId = params.get('job') ?? 'all'
  const { deleteJob, updateJob } = useJobs()
  const data = useBizData(userId)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cvOpen, setCvOpen] = useState<string | null>(null)
  const setView = (t: 'tin' | 'ung-vien', job?: string) => setParams(() => { const n = new URLSearchParams(); if (t === 'ung-vien') n.set('tab', 'ung-vien'); if (job) n.set('job', job); return n }, { replace: true })

  const toggleUrgent = async (job: Job) => {
    setError('')
    try { await updateJob(job.id, { urgent: !job.urgent }); await data.reloadJobs() } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật tin.') }
  }
  const remove = async (job: Job) => {
    if (confirmId !== job.id) { setConfirmId(job.id); return }
    await deleteJob(job.id); setConfirmId(null); await data.reloadJobs()
  }
  const changeStatus = async (a: JobApplication, status: ApplicationStatus) => {
    setError('')
    if (!a.id || !(await updateApplicationStatus(a.id, status))) setError('Không thể cập nhật trạng thái ứng tuyển. Vui lòng thử lại.')
    data.reloadApplications()
  }

  const shown = filterByJob(data.applications, filterJobId)
  return (
    <div className="app-page" data-testid="app-biz-manage">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Quản lý tin</h1></header>
      <div className="app-seg app-biz__seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'tin'} className={tab === 'tin' ? 'app-on' : ''} onClick={() => setView('tin')}>Tin tuyển dụng{data.jobs.length > 0 ? ` (${data.jobs.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'ung-vien'} className={tab === 'ung-vien' ? 'app-on' : ''} onClick={() => setView('ung-vien')}>Ứng viên{data.pending.length > 0 ? ` (${data.pending.length} chờ)` : ''}</button>
      </div>
      {error && <p className="app-form__error app-biz__err" role="alert">{error}</p>}

      {tab === 'tin' && (data.jobsLoading ? <p className="app-state" role="status">Đang tải…</p>
        : data.jobsError ? <div className="app-state" role="alert">Không thể tải danh sách tin đăng. <button type="button" className="app-link-btn" onClick={() => data.reloadJobs()}>Thử lại</button></div>
        : data.jobs.length === 0 ? <div className="app-state">Bạn chưa đăng tin nào.<br /><Link className="app-btn app-btn--primary app-biz__first" to="/biz/dang-tin">Đăng tin đầu tiên</Link></div>
        : (
          <ul className="app-applist">
            {data.jobs.map((job) => {
              const n = data.countsByJob[job.id] ?? 0
              return (
                <li key={job.id} className="app-bizjob" data-testid="app-biz-job">
                  <Link to={`/viec-lam/${job.id}`} className="app-bizjob__main">
                    {job.urgent && <span className="app-pill app-pill--urgent">Tuyển gấp</span>}
                    <strong>{job.title}</strong>
                    <span>{CATEGORY_LABELS[job.category]} · {job.location}</span>
                    <small>Đăng {fmt(job.postedAt)} · Hạn {fmt(job.applicationDeadline)}</small>
                    {job.adminHidden ? <small className="app-bizjob__warn">Bị quản trị viên ẩn</small> : job.active === false ? <small className="app-bizjob__warn">Chưa công khai</small> : null}
                  </Link>
                  <div className="app-bizjob__side">
                    <button type="button" className="app-link-btn" onClick={() => setView('ung-vien', job.id)}><b>{n}</b> ứng viên</button>
                    <div>
                      <button type="button" className={'app-icon-btn' + (job.urgent ? ' app-on' : '')} aria-label={job.urgent ? 'Bỏ tuyển gấp' : 'Đánh dấu tuyển gấp'} aria-pressed={!!job.urgent} onClick={() => toggleUrgent(job)}><Flame size={20} aria-hidden /></button>
                      <button type="button" className={'app-icon-btn' + (confirmId === job.id ? ' app-biz__danger' : '')} aria-label={confirmId === job.id ? 'Nhấn lần nữa để xác nhận xoá' : 'Xoá tin'} onClick={() => remove(job)}><Trash2 size={20} aria-hidden />{confirmId === job.id && <span className="app-biz__confirm">Xác nhận xoá?</span>}</button>
                      {confirmId === job.id && <button type="button" className="app-link-btn" onClick={() => setConfirmId(null)}>Huỷ</button>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}

      {tab === 'ung-vien' && (
        <>
          {data.jobs.length > 0 && (
            <label className="app-field app-biz__filter"><span>Lọc theo tin</span>
              <select value={filterJobId} onChange={(e) => setView('ung-vien', e.target.value === 'all' ? undefined : e.target.value)}>
                <option value="all">Tất cả ({data.applications.length})</option>
                {data.jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({data.countsByJob[j.id] ?? 0})</option>)}
              </select></label>
          )}
          {shown.length === 0 ? <p className="app-state">{data.jobs.length === 0 ? 'Đăng tin để nhận ứng viên.' : 'Chưa có ứng viên nào.'}</p> : (
            <ul className="app-applist">
              {shown.map((a) => {
                const key = a.id ?? a.appliedAt
                return (
                  <li key={key} className="app-bizapp" data-testid="app-biz-applicant">
                    <div className="app-bizapp__row">
                      <div className="app-bizapp__who"><strong>{a.seekerName ?? 'Ẩn danh'}</strong>
                        <span>{a.seekerPhone && <a href={`tel:${a.seekerPhone.replace(/\s/g, '')}`}>📞 {a.seekerPhone}</a>}{a.seekerPhone && ' · '}{a.jobTitle} · {fmt(a.appliedAt)}</span>
                        <button type="button" className="app-link-btn" aria-expanded={cvOpen === key} onClick={() => setCvOpen(cvOpen === key ? null : key)}>{cvOpen === key ? 'Ẩn CV' : 'Xem CV'}</button></div>
                      <select className={'app-astatus app-astatus--' + a.status + ' app-bizapp__status'} value={a.status} aria-label={`Trạng thái ứng tuyển của ${a.seekerName ?? 'ứng viên'}`} onChange={(e) => changeStatus(a, e.target.value as ApplicationStatus)}>
                        {a.status === 'submitted' && <option value="submitted" disabled>{APPLICATION_STATUS_META.submitted.labelVi}</option>}
                        {SELECTABLE_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_META[s].labelVi}</option>)}
                      </select>
                    </div>
                    {cvOpen === key && <CvPanel app={a} />}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function BizManageScreen() { return <BizGate>{(userId) => <Manage userId={userId} />}</BizGate> }
