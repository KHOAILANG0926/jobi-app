import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CvBuilder } from '../components/CvBuilder'
import { MessagesInbox } from '../components/MessagesInbox'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'

import {
  APPLICATION_STATUS_META,
  cancelApplication,
  loadApplications,
  subscribeApplications,
  type JobApplication,
} from '../lib/applicationsStorage'
import { StatusTimeline } from '../components/StatusTimeline'
import { hasSavedCv } from '../lib/cvCompleteness'
import {
  loadSeekerInterviews,
  subscribeInterviews,
  type InterviewSlot,
} from '../lib/interviewStorage'
import { countUnreadForSeeker, subscribeMessages } from '../lib/messagesStorage'
import { loadAccountProfile, saveAccountProfile } from '../lib/accountProfileStorage'
import { loadAccountCv, saveAccountCv, uploadCvPhoto } from '../lib/accountCvStorage'
import { loadCv, hasStoredCv } from '../lib/cvStorage'
import {
  markLocalImportDecision,
  shouldOfferLocalImport,
} from '../lib/accountMigrationStorage'
import {
  hasStoredProfile,
  loadProfile,
  loadSavedJobIds,
  saveProfile,
  toggleSavedJobId,
  type SeekerProfile,
} from '../lib/storage'

type SeekerTab = 'info' | 'cv' | 'messages' | 'applications' | 'saved'

export function Profile() {
  const { user, logout } = useAuth()
  const { jobs } = useJobs()
  const location = useLocation()
  const [profile, setProfile] = useState<SeekerProfile>(() => loadProfile(user?.id))
  const [savedIds, setSavedIds] = useState<string[]>(() => loadSavedJobIds())
  const [savedMsg, setSavedMsg] = useState(false)
  const [seekerTab, setSeekerTab] = useState<SeekerTab>('info')
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [cvHint, setCvHint] = useState<string | null>(null)
  const [cvSaved, setCvSaved] = useState(() => hasSavedCv())
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null)
  const [interviews, setInterviews] = useState<InterviewSlot[]>([])
  const [applicationError, setApplicationError] = useState('')
  const [profileServerError, setProfileServerError] = useState('')
  const [localImportOffer, setLocalImportOffer] = useState(false)
  const [importingLocal, setImportingLocal] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'seeker') {
      setLocalImportOffer(false)
      setProfileServerError('')
      return
    }

    let cancelled = false
    setLocalImportOffer(false)
    setProfileServerError('')
    setProfile(loadProfile(user.id))
    Promise.all([loadAccountProfile(user.id), loadAccountCv(user.id)])
      .then(([remoteProfile, remoteCv]) => {
        if (cancelled) return
        if (remoteProfile) {
          setProfile(remoteProfile)
          saveProfile(remoteProfile, user.id)
        }
        setLocalImportOffer(shouldOfferLocalImport(
          user.id,
          Boolean(remoteProfile || remoteCv),
          hasStoredProfile() || hasStoredCv(),
        ))
      })
      .catch(() => {
        if (!cancelled) setProfileServerError('Không tải được dữ liệu tài khoản. Dữ liệu trên thiết bị vẫn được giữ nguyên.')
      })

    return () => { cancelled = true }
  }, [user?.id, user?.role])

  useEffect(() => {
    const syncSaved = () => setSavedIds(loadSavedJobIds())
    const onStorage = () => syncSaved()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', syncSaved)
    window.addEventListener('vgb:saved-jobs', syncSaved)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', syncSaved)
      window.removeEventListener('vgb:saved-jobs', syncSaved)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'seeker') {
      setApplications([])
      return
    }
    const syncApps = () => { loadApplications().then(setApplications) }
    syncApps()
    window.addEventListener('vgb:applications', syncApps)
    window.addEventListener('focus', syncApps)
    const unsubscribe = subscribeApplications(syncApps)
    return () => {
      window.removeEventListener('vgb:applications', syncApps)
      window.removeEventListener('focus', syncApps)
      unsubscribe()
    }
  }, [user])

  useEffect(() => {
    const syncCv = () => setCvSaved(hasSavedCv())
    window.addEventListener('vgb:cv-saved', syncCv)
    window.addEventListener('focus', syncCv)
    window.addEventListener('storage', syncCv)
    return () => {
      window.removeEventListener('vgb:cv-saved', syncCv)
      window.removeEventListener('focus', syncCv)
      window.removeEventListener('storage', syncCv)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'seeker') {
      setUnreadMsgCount(0)
      return
    }
    const sync = () => { countUnreadForSeeker().then(setUnreadMsgCount) }
    sync()
    return subscribeMessages(sync)
  }, [user?.role])

  useEffect(() => {
    if (user?.role !== 'seeker') {
      setInterviews([])
      return
    }
    const sync = () => { loadSeekerInterviews(user.id).then(setInterviews) }
    sync()
    return subscribeInterviews(sync)
  }, [user?.id, user?.role])

  useEffect(() => {
    const st = location.state as { openCvTab?: boolean; needCvForJob?: string } | null
    if (st?.openCvTab) {
      setSeekerTab('cv')
      if (st.needCvForJob) {
        setCvHint(`Hoàn thành và lưu CV để ứng tuyển nhanh cho: ${st.needCvForJob}`)
      }
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  /** Testing: default guests to CV tab so /ho-so opens the builder without login */
  useEffect(() => {
    if (!user) setSeekerTab('cv')
  }, [user])

  const savedJobs = savedIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter(Boolean) as typeof jobs

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) {
      saveProfile(profile)
      setSavedMsg(true)
      window.setTimeout(() => setSavedMsg(false), 2500)
      return
    }
    if (user.role !== 'seeker') return
    setProfileServerError('')
    try {
      await saveAccountProfile(user.id, profile)
      saveProfile(profile, user.id)
      setSavedMsg(true)
      window.setTimeout(() => setSavedMsg(false), 2500)
    } catch {
      setProfileServerError('Không lưu được hồ sơ lên tài khoản. Dữ liệu trên thiết bị chưa bị xoá.')
    }
  }

  const importLocalData = async () => {
    if (!user || user.role !== 'seeker') return
    setImportingLocal(true)
    setProfileServerError('')
    try {
      if (hasStoredProfile()) await saveAccountProfile(user.id, loadProfile())
      if (hasStoredCv()) {
        const localCv = loadCv()
        const photoPath = localCv.profilePhotoDataUrl
          ? await uploadCvPhoto(user.id, localCv.profilePhotoDataUrl)
          : null
        await saveAccountCv(user.id, localCv, photoPath)
      }
      markLocalImportDecision(user.id, 'accepted')
      setLocalImportOffer(false)
      window.dispatchEvent(new CustomEvent('vgb:account-cv-saved'))
    } catch {
      setProfileServerError('Không nhập được dữ liệu. Bản gốc trên thiết bị vẫn được giữ nguyên.')
    } finally {
      setImportingLocal(false)
    }
  }

  const declineLocalImport = () => {
    if (!user) return
    markLocalImportDecision(user.id, 'declined')
    setLocalImportOffer(false)
  }

  if (user?.role === 'employer') {
    return (
      <div className="page profile">
        <header className="page-header">
          <h1 className="page-header__title">Tài khoản nhà tuyển dụng</h1>
          <p className="page-header__lead">
            {user.name} · {user.email}
          </p>
        </header>
        <div className="profile-grid profile-grid--single">
          <section className="profile-card">
            <p className="profile-employer__text">
              Quản lý tin tuyển dụng từ bảng điều khiển hoặc đăng tin mới bất cứ lúc nào.
            </p>
            <div className="profile-employer__actions">
              <Link to="/bang-dieu-khien" className="btn btn--primary">
                Bảng điều khiển
              </Link>
              <Link to="/dang-tin" className="btn btn--ghost">
                Đăng tin tuyển dụng
              </Link>
            </div>
            <button type="button" className="btn btn--ghost profile-logout" onClick={logout}>
              Đăng xuất
            </button>
          </section>
        </div>
      </div>
    )
  }

  const isGuest = !user

  return (
    <div className="page profile">
      <header className="page-header">
        <h1 className="page-header__title">{isGuest ? 'Hồ sơ' : 'Hồ sơ ứng viên'}</h1>
        <p className="page-header__lead">
          {isGuest ? (
            <>
              Thử <strong>Tạo CV</strong> không cần đăng nhập (thử nghiệm). Đăng nhập để dùng đầy đủ tin nhắn và ứng
              tuyển.
            </>
          ) : (
            <>
              {user.name} · Quản lý thông tin, CV và tin nhắn với nhà tuyển dụng.
            </>
          )}
        </p>
        <div className="profile-seeker-actions profile-seeker-actions--always">
          {cvSaved ? <span className="profile-cv-saved-badge">CV đã lưu ✓</span> : null}
          <button type="button" className="btn btn--primary" onClick={() => setSeekerTab('cv')}>
            Tạo CV
          </button>
          {isGuest ? (
            <span className="profile-guest-auth">
              <Link to="/dang-nhap" className="btn btn--ghost btn--sm">
                Đăng nhập
              </Link>
              <Link to="/dang-ky" className="text-link profile-guest-signup">
                Đăng ký
              </Link>
            </span>
          ) : null}
        </div>
      </header>

      {profileServerError ? <p className="form-error" role="alert">{profileServerError}</p> : null}
      {localImportOffer ? (
        <section className="profile-card profile-card--guest" aria-label="Nhập dữ liệu cũ">
          <h2 className="profile-card__title">Nhập dữ liệu trên thiết bị này?</h2>
          <p className="profile-employer__text">
            Tài khoản chưa có hồ sơ hoặc CV trên máy chủ. Chỉ nhập dữ liệu này nếu đây là hồ sơ của bạn.
          </p>
          <div className="profile-employer__actions">
            <button type="button" className="btn btn--primary" onClick={importLocalData} disabled={importingLocal}>
              {importingLocal ? 'Đang nhập…' : 'Nhập vào tài khoản'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={declineLocalImport} disabled={importingLocal}>
              Không nhập
            </button>
          </div>
        </section>
      ) : null}

      <div className="profile-tabs" role="tablist" aria-label="Mục hồ sơ ứng viên">
        <button
          type="button"
          role="tab"
          aria-selected={seekerTab === 'info'}
          className={`profile-tabs__btn${seekerTab === 'info' ? ' profile-tabs__btn--active' : ''}`}
          onClick={() => setSeekerTab('info')}
        >
          Thông tin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seekerTab === 'cv'}
          className={`profile-tabs__btn${seekerTab === 'cv' ? ' profile-tabs__btn--active' : ''}`}
          onClick={() => setSeekerTab('cv')}
        >
          Tạo CV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seekerTab === 'applications'}
          className={`profile-tabs__btn${seekerTab === 'applications' ? ' profile-tabs__btn--active' : ''}`}
          onClick={() => setSeekerTab('applications')}
        >
          Việc đã ứng tuyển
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seekerTab === 'saved'}
          className={`profile-tabs__btn${seekerTab === 'saved' ? ' profile-tabs__btn--active' : ''}`}
          onClick={() => setSeekerTab('saved')}
        >
          Tin đã lưu {savedIds.length > 0 ? `(${savedIds.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={seekerTab === 'messages'}
          className={`profile-tabs__btn${seekerTab === 'messages' ? ' profile-tabs__btn--active' : ''}`}
          onClick={() => setSeekerTab('messages')}
        >
          Tin nhắn
          {unreadMsgCount > 0 && (
            <span className="profile-tabs__badge">{unreadMsgCount}</span>
          )}
        </button>
      </div>

      {seekerTab === 'info' && isGuest ? (
        <section className="profile-card profile-card--guest">
          <h2 className="profile-card__title">Thông tin cá nhân</h2>
          <p className="profile-employer__text">
            Đăng nhập để chỉnh sửa thông tin hồ sơ, xem việc đã lưu và tin nhắn với nhà tuyển dụng.
          </p>
          <div className="profile-employer__actions">
            <Link to="/dang-nhap" className="btn btn--primary">
              Đăng nhập
            </Link>
            <Link to="/dang-ky" className="btn btn--ghost">
              Đăng ký
            </Link>
          </div>
        </section>
      ) : seekerTab === 'info' ? (
        <div className="profile-grid">
          <section className="profile-card">
            <div className="profile-avatar" aria-hidden>
              {initials(profile.fullName)}
            </div>
            <form className="profile-form" onSubmit={onSubmit}>
              <label className="field">
                <span className="field__label">Họ và tên</span>
                <input
                  className="field__input"
                  value={profile.fullName}
                  onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">Số điện thoại</span>
                <input
                  className="field__input"
                  inputMode="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="field__input"
                  type="email"
                  autoComplete="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">Thành phố / tỉnh</span>
                <input
                  className="field__input"
                  value={profile.city}
                  onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field__label">Giới thiệu ngắn</span>
                <textarea
                  className="field__input field__textarea"
                  rows={4}
                  value={profile.bio}
                  onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn--primary">
                Lưu hồ sơ
              </button>
              {savedMsg ? (
                <p className="hint hint--success" role="status">
                  Đã lưu thông tin.
                </p>
              ) : null}
            </form>
            <p className="profile-tool-link">
              <Link to="/tinh-luong" className="text-link">
                Tính lương
              </Link>
            </p>
            <button type="button" className="btn btn--ghost profile-logout" onClick={logout}>
              Đăng xuất
            </button>
          </section>

          <section className="profile-card profile-card--saved">
            <h2 className="profile-card__title">Việc đã lưu ({savedJobs.length})</h2>
            {savedJobs.length === 0 ? (
              <p className="empty-state empty-state--inline">
                Chưa có tin nào.{' '}
                <Link to="/" className="text-link">
                  Xem việc làm
                </Link>
              </p>
            ) : (
              <ul className="saved-list">
                {savedJobs.map((job) => (
                  <li key={job.id}>
                    <Link to={`/viec-lam/${job.id}`} className="saved-list__link">
                      <span className="saved-list__title">{job.title}</span>
                      <span className="saved-list__meta">{job.company}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : seekerTab === 'cv' ? (
        <>
          {cvHint ? (
            <p className="hint profile-cv-hint" role="status">
              {cvHint}
            </p>
          ) : null}
          <CvBuilder userId={user?.role === 'seeker' ? user.id : undefined} />
        </>
      ) : seekerTab === 'saved' ? (
        <section className="profile-card profile-card--saved">
          <h2 className="profile-card__title">Tin đã lưu ({savedJobs.length})</h2>
          {savedJobs.length === 0 ? (
            <p className="empty-state empty-state--inline">
              Chưa có tin nào.{' '}
              <Link to="/" className="text-link">
                Xem việc làm
              </Link>
            </p>
          ) : (
            <ul className="saved-list">
              {savedJobs.map((job) => (
                <li key={job.id} className="saved-list__item">
                  <Link to={`/viec-lam/${job.id}`} className="saved-list__link">
                    <span className="saved-list__title">{job.title}</span>
                    <span className="saved-list__meta">{job.company} · {job.location}</span>
                    <span className="saved-list__meta">{job.salary}</span>
                  </Link>
                  <button
                    type="button"
                    className="saved-list__remove"
                    aria-label={`Bỏ lưu: ${job.title}`}
                    onClick={() => {
                      toggleSavedJobId(job.id)
                      setSavedIds(loadSavedJobIds())
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : seekerTab === 'applications' && isGuest ? (
        <section className="profile-card profile-card--guest">
          <h2 className="profile-card__title">Việc đã ứng tuyển</h2>
          <p className="profile-employer__text">
            Đăng nhập để xem và quản lý các đơn ứng tuyển của bạn.
          </p>
          <div className="profile-employer__actions">
            <Link to="/dang-nhap" className="btn btn--primary">
              Đăng nhập
            </Link>
          </div>
        </section>
      ) : seekerTab === 'applications' ? (
        <section className="profile-card profile-applications">
          <h2 className="profile-card__title">Việc đã ứng tuyển</h2>
          {applicationError && <p className="form-error" role="alert">{applicationError}</p>}

          {/* Upcoming interviews */}
          {interviews.filter((i) => new Date(i.datetime) > new Date()).length > 0 && (
            <div className="interview-upcoming">
              <h3 className="interview-upcoming__title">🗓 Phỏng vấn sắp tới</h3>
              <ul className="interview-upcoming__list">
                {interviews
                  .filter((i) => new Date(i.datetime) > new Date())
                  .map((slot) => (
                    <li key={slot.id} className="interview-card">
                      <div className="interview-card__datetime">
                        <span className="interview-card__date">
                          {new Date(slot.datetime).toLocaleDateString('vi-VN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <span className="interview-card__time">
                          {new Date(slot.datetime).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="interview-card__info">
                        <p className="interview-card__job">{slot.jobTitle}</p>
                        <p className="interview-card__company">{slot.company}</p>
                        <p className="interview-card__location">📍 {slot.location}</p>
                        {slot.notes && (
                          <p className="interview-card__notes">💬 {slot.notes}</p>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {applications.length === 0 ? (
            <p className="empty-state empty-state--inline">
              Chưa có đơn ứng tuyển.{' '}
              <Link to="/" className="text-link">
                Tìm việc
              </Link>
            </p>
          ) : (
            <ul className="applications-list">
              {applications.map((a) => {
                const appKey = a.id ?? a.appliedAt
                const isExpanded = expandedAppId === appKey
                return (
                  <li key={a.jobId} className="applications-list__item-wrap">
                    <div className="applications-list__item">
                      <div className="applications-list__main">
                        <Link to={`/viec-lam/${a.jobId}`} className="applications-list__title">
                          {a.jobTitle}
                        </Link>
                        <p className="applications-list__meta">{a.company}</p>
                        <p className="applications-list__date">
                          Ngày ứng tuyển:{' '}
                          {new Date(a.appliedAt).toLocaleDateString('vi-VN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="applications-list__right">
                        <span
                          className={`applications-list__select app-status-select ${APPLICATION_STATUS_META[a.status].badgeClass}`}
                          aria-label={`Trạng thái: ${APPLICATION_STATUS_META[a.status].labelVi}`}
                        >
                          {APPLICATION_STATUS_META[a.status].labelVi}
                        </span>
                        <button
                          type="button"
                          className="applications-list__timeline-btn"
                          onClick={() => setExpandedAppId(isExpanded ? null : appKey)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? 'Ẩn lịch sử ▲' : 'Lịch sử ▼'}
                        </button>
                        <button
                          type="button"
                          className="applications-list__timeline-btn"
                          onClick={async () => {
                            if (!a.id) return
                            if (!window.confirm('Bạn có chắc muốn hủy đơn ứng tuyển này?')) return
                            setApplicationError('')
                            const cancelled = await cancelApplication(a.id)
                            if (!cancelled) setApplicationError('Không thể hủy đơn ứng tuyển. Vui lòng thử lại.')
                            setApplications(await loadApplications())
                          }}
                        >
                          Hủy đơn
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="applications-list__timeline-wrap">
                        <StatusTimeline application={a} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : isGuest ? (
        <section className="profile-card profile-card--guest">
          <h2 className="profile-card__title">Tin nhắn</h2>
          <p className="profile-employer__text">Đăng nhập để xem hộp tin nhắn với nhà tuyển dụng.</p>
          <div className="profile-employer__actions">
            <Link to="/dang-nhap" className="btn btn--primary">
              Đăng nhập
            </Link>
          </div>
        </section>
      ) : (
        <MessagesInbox />
      )}
    </div>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
