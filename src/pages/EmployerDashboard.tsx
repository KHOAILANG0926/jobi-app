import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { fetchEmployerJobs } from '../lib/jobRows'
import { CATEGORY_LABELS } from '../data/categories'
import {
  APPLICATION_STATUS_META,
  loadApplications,
  subscribeApplications,
  updateApplicationStatus,
  type ApplicationStatus,
  type JobApplication,
} from '../lib/applicationsStorage'
import {
  appendEmployerMessage,
  countUnreadForEmployer,
  loadEmployerThreads,
  markReadByEmployer,
  subscribeMessages,
  type MessageThread,
} from '../lib/messagesStorage'
import { ScheduleInterviewModal } from '../components/ScheduleInterviewModal'
import { loadEmployerInterviews, subscribeInterviews, type InterviewSlot } from '../lib/interviewStorage'
import type { Job } from '../types/job'

type Tab = 'jobs' | 'applicants' | 'messages'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function EmployerDashboard() {
  const { user } = useAuth()
  const { deleteJob, updateJob } = useJobs()
  const [tab, setTab] = useState<Tab>('jobs')
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [filterJobId, setFilterJobId] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [msgThreads, setMsgThreads] = useState<MessageThread[]>([])
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null)
  const [msgDraft, setMsgDraft] = useState('')
  const msgBottomRef = useRef<HTMLDivElement>(null)
  const msgTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [scheduleTarget, setScheduleTarget] = useState<JobApplication | null>(null)
  const [applicationError, setApplicationError] = useState('')

  useEffect(() => {
    const handler = () => { loadApplications().then(setApplications) }
    handler()
    window.addEventListener('vgb:applications', handler)
    const unsubscribe = subscribeApplications(handler)
    return () => {
      window.removeEventListener('vgb:applications', handler)
      unsubscribe()
    }
  }, [])

  if (!user) return null

  // 2026-09-04 사용자 지시("EmployerDashboard가 공개 공고 목록을 가져온 뒤
  // 필터링하는 구조를 제거하고, 로그인한 기업의 employer_id=auth.uid() 공고를
  // 별도로 조회하도록 수정"): useJobs()의 공개(active=true) 목록에서
  // employerId만 걸러내던 기존 구조를 제거하고, employer_id로 직접 조회하는
  // fetchEmployerJobs()를 쓴다 — 본인 소유면 active=false/admin_hidden=true인
  // 공고도 서버에 요청 자체가 되므로(RLS migration 0019가 이미 허용) 이제
  // 실제로 화면에 뜬다.
  const [myJobs, setMyJobs] = useState<Job[]>([])
  const [myJobsLoading, setMyJobsLoading] = useState(true)

  const loadMyJobs = useCallback(async () => {
    setMyJobsLoading(true)
    const result = await fetchEmployerJobs(user.id)
    setMyJobs(result)
    setMyJobsLoading(false)
  }, [user.id])

  useEffect(() => { loadMyJobs() }, [loadMyJobs])

  const myJobIds = useMemo(() => new Set(myJobs.map((j) => j.id)), [myJobs])
  const myJobIdsArr = useMemo(() => myJobs.map((j) => j.id), [myJobs])

  // 지원자 목록 렌더 시 행마다 개별 조회하지 않도록 한 번에 불러와 Map으로 캐시
  const [interviewsByKey, setInterviewsByKey] = useState<Map<string, InterviewSlot>>(new Map())
  useEffect(() => {
    const sync = () => {
      loadEmployerInterviews(user.id).then((list) => {
        setInterviewsByKey(new Map(list.map((s) => [`${s.jobId}:${s.seekerId}`, s])))
      })
    }
    sync()
    return subscribeInterviews(sync)
  }, [user.id])

  // Message threads for this employer's jobs (지원자별로 분리된 채로 표시)
  const [msgUnreadCount, setMsgUnreadCount] = useState(0)

  useEffect(() => {
    const sync = () => {
      loadEmployerThreads(myJobIdsArr).then((threads) => {
        setMsgThreads(threads)
        setActiveMsgId((cur) => {
          if (cur && threads.some((t) => t.id === cur)) return cur
          return threads[0]?.id ?? null
        })
      })
      countUnreadForEmployer(myJobIdsArr).then(setMsgUnreadCount)
    }
    sync()
    return subscribeMessages(sync)
  }, [myJobIdsArr.join(',')])

  const activeMsg = useMemo(
    () => msgThreads.find((t) => t.id === activeMsgId) ?? null,
    [msgThreads, activeMsgId],
  )

  // Auto-scroll messages
  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMsg?.messages.length])

  // Mark employer thread as read when opened or new message arrives
  useEffect(() => {
    if (activeMsgId) markReadByEmployer(activeMsgId)
  }, [activeMsgId, activeMsg?.messages.length])


  const handleSelectMsg = (threadId: string) => {
    setActiveMsgId(threadId)
    markReadByEmployer(threadId)
  }

  const sendMsg = async () => {
    if (!activeMsg || !msgDraft.trim()) return
    const body = msgDraft.trim()
    setMsgDraft('')
    msgTextareaRef.current?.focus()
    const ok = await appendEmployerMessage(activeMsg.id, body)
    if (!ok) {
      setMsgDraft(body)
      return
    }
    loadEmployerThreads(myJobIdsArr).then(setMsgThreads)
  }

  const onMsgKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  }

  const myApplications = useMemo(
    () => applications.filter((a) => myJobIds.has(a.jobId)),
    [applications, myJobIds],
  )

  const applicantCountByJob = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of myApplications) {
      counts[a.jobId] = (counts[a.jobId] ?? 0) + 1
    }
    return counts
  }, [myApplications])

  const pendingCount = useMemo(
    () => myApplications.filter((a) => a.status === 'submitted' || a.status === 'reviewing').length,
    [myApplications],
  )

  const filteredApplications = useMemo(
    () =>
      filterJobId === 'all'
        ? myApplications
        : myApplications.filter((a) => a.jobId === filterJobId),
    [myApplications, filterJobId],
  )

  const handleStatusChange = async (key: string, status: ApplicationStatus) => {
    setApplicationError('')
    const updated = await updateApplicationStatus(key, status)
    if (!updated) setApplicationError('Không thể cập nhật trạng thái ứng tuyển. Vui lòng thử lại.')
    setApplications(await loadApplications())
  }

  const handleDelete = async (job: Job) => {
    if (deleteConfirmId === job.id) {
      await deleteJob(job.id)
      setDeleteConfirmId(null)
      // deleteJob()/updateJob()은 useJobs()의 공개 목록만 낙관적으로 갱신한다 —
      // 이 페이지가 쓰는 myJobs는 별도 state라 직접 다시 불러와야 반영된다.
      await loadMyJobs()
    } else {
      setDeleteConfirmId(job.id)
    }
  }

  const handleToggleUrgent = async (job: Job) => {
    await updateJob(job.id, { urgent: !job.urgent })
    await loadMyJobs()
  }

  return (
    <div className="page employer-dashboard">
      {/* Hero */}
      <header className="employer-dashboard__hero">
        <p className="employer-dashboard__greeting">Xin chào, {user.name}</p>
        <h1 className="employer-dashboard__title">Bảng điều khiển nhà tuyển dụng</h1>
        <div className="employer-dashboard__hero-actions">
          <Link to="/dang-tin" className="btn btn--primary employer-dashboard__cta">
            + Đăng tin mới
          </Link>
          <Link to="/" className="employer-dashboard__link">
            Xem danh sách trên Việc gần Bạn →
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="employer-dashboard__stats" aria-label="Thống kê nhanh">
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value">{myJobs.length}</span>
          <span className="employer-dashboard__stat-label">Tin đang đăng</span>
        </div>
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value">{myApplications.length}</span>
          <span className="employer-dashboard__stat-label">Tổng ứng viên</span>
        </div>
        <div className="employer-dashboard__stat">
          <span className="employer-dashboard__stat-value edb-stat--pending">{pendingCount}</span>
          <span className="employer-dashboard__stat-label">Chờ xét duyệt</span>
        </div>
      </section>

      {/* Tabs */}
      <div className="edb-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'jobs'}
          className={`edb-tab${tab === 'jobs' ? ' edb-tab--active' : ''}`}
          onClick={() => setTab('jobs')}
        >
          📋 Tin tuyển dụng
          {myJobs.length > 0 && <span className="edb-tab__badge">{myJobs.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'applicants'}
          className={`edb-tab${tab === 'applicants' ? ' edb-tab--active' : ''}`}
          onClick={() => setTab('applicants')}
        >
          👥 Ứng viên
          {pendingCount > 0 && <span className="edb-tab__badge edb-tab__badge--alert">{pendingCount}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'messages'}
          className={`edb-tab${tab === 'messages' ? ' edb-tab--active' : ''}`}
          onClick={() => setTab('messages')}
        >
          💬 Tin nhắn
          {msgUnreadCount > 0 && <span className="edb-tab__badge edb-tab__badge--alert">{msgUnreadCount}</span>}
        </button>
      </div>

      {/* ── Tab: Jobs ── */}
      {tab === 'jobs' && (
        <div className="edb-panel" role="tabpanel">
          {myJobsLoading ? null : myJobs.length === 0 ? (
            <div className="edb-empty">
              <span className="edb-empty__icon">📝</span>
              <p className="edb-empty__text">Bạn chưa đăng tin nào.</p>
              <Link to="/dang-tin" className="btn btn--primary">
                Đăng tin đầu tiên
              </Link>
            </div>
          ) : (
            <ul className="edb-job-list">
              {myJobs.map((job) => {
                const count = applicantCountByJob[job.id] ?? 0
                const isConfirming = deleteConfirmId === job.id
                return (
                  <li key={job.id} className="edb-job-item">
                    <div className="edb-job-item__main">
                      <div className="edb-job-item__header">
                        {job.urgent && <span className="edb-urgent-badge">🔥 Tuyển gấp</span>}
                        <Link
                          to={`/viec-lam/${job.id}`}
                          className="edb-job-item__title"
                        >
                          {job.title}
                        </Link>
                      </div>
                      <p className="edb-job-item__meta">
                        {CATEGORY_LABELS[job.category]} · {job.location} · {job.salary}
                      </p>
                      <p className="edb-job-item__date">
                        Đăng ngày {formatDate(job.postedAt)} · Hạn {formatDate(job.applicationDeadline)}
                      </p>
                      {/* 사용자 지시(2026-09-04): "기업은 본인의 공개·비공개·관리자
                          숨김 공고를 볼 수 있고" — 이제 목록 자체는 셋 다 가져오므로
                          (RLS migration 0019), 어떤 상태인지 최소한으로 구분해 보여준다. */}
                      {job.adminHidden ? (
                        <p className="edb-job-item__status edb-job-item__status--hidden">🚫 Bị quản trị viên ẩn</p>
                      ) : job.active === false ? (
                        <p className="edb-job-item__status edb-job-item__status--pending">⏳ Chưa công khai</p>
                      ) : null}
                    </div>

                    <div className="edb-job-item__right">
                      <button
                        className="edb-applicant-count"
                        onClick={() => {
                          setFilterJobId(job.id)
                          setTab('applicants')
                        }}
                        title="Xem ứng viên"
                      >
                        <span className="edb-applicant-count__num">{count}</span>
                        <span className="edb-applicant-count__label">ứng viên</span>
                      </button>

                      <div className="edb-job-item__actions">
                        <button
                          className={`edb-btn-urgent${job.urgent ? ' edb-btn-urgent--on' : ''}`}
                          onClick={() => handleToggleUrgent(job)}
                          title={job.urgent ? 'Bỏ tuyển gấp' : 'Đánh dấu tuyển gấp'}
                        >
                          🔥
                        </button>
                        <button
                          className={`edb-btn-delete${isConfirming ? ' edb-btn-delete--confirm' : ''}`}
                          onClick={() => handleDelete(job)}
                          title={isConfirming ? 'Nhấn lần nữa để xác nhận xoá' : 'Xoá tin'}
                        >
                          {isConfirming ? 'Xác nhận xoá?' : '🗑'}
                        </button>
                        {isConfirming && (
                          <button
                            className="edb-btn-cancel"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Huỷ
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Tab: Messages ── */}
      {tab === 'messages' && (
        <div className="edb-panel edb-panel--messages" role="tabpanel">
          {msgThreads.length === 0 ? (
            <div className="edb-empty">
              <span className="edb-empty__icon">💬</span>
              <p className="edb-empty__text">Chưa có tin nhắn từ ứng viên nào.</p>
            </div>
          ) : (
            <div className="messages-inbox__layout">
              <ul className="messages-inbox__list">
                {msgThreads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`messages-inbox__thread${t.id === activeMsgId ? ' messages-inbox__thread--active' : ''}`}
                      onClick={() => handleSelectMsg(t.id)}
                    >
                      <span className="messages-inbox__thread-top">
                        <span className="messages-inbox__thread-title">
                          {t.seekerName || 'Ứng viên ẩn danh'}
                        </span>
                        {t.unreadByEmployer && (
                          <span className="messages-inbox__unread-dot" aria-label="Tin nhắn mới" />
                        )}
                      </span>
                      <span className="messages-inbox__thread-meta">{t.jobTitle}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {activeMsg ? (
                <div className="messages-inbox__panel">
                  <div className="messages-inbox__panel-head">
                    <div>
                      <h3 className="messages-inbox__panel-title">
                        {activeMsg.seekerName || 'Ứng viên ẩn danh'}
                      </h3>
                      <p className="messages-inbox__panel-sub">{activeMsg.jobTitle}</p>
                    </div>
                  </div>

                  <div className="messages-inbox__stream">
                    {activeMsg.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`messages-inbox__bubble messages-inbox__bubble--${m.from === 'employer' ? 'seeker' : 'employer'}`}
                      >
                        <span className="messages-inbox__bubble-sender">
                          {m.from === 'employer' ? 'Bạn' : activeMsg.seekerName || 'Ứng viên'}
                        </span>
                        <p>{m.body}</p>
                        <time dateTime={m.sentAt}>
                          {new Date(m.sentAt).toLocaleString('vi-VN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    ))}
                    <div ref={msgBottomRef} />
                  </div>

                  <div className="messages-inbox__composer">
                    <textarea
                      ref={msgTextareaRef}
                      className="field__input field__textarea messages-inbox__input"
                      rows={2}
                      placeholder="Nhắn tin ứng viên... (Enter gửi, Shift+Enter xuống dòng)"
                      value={msgDraft}
                      onChange={(e) => setMsgDraft(e.target.value)}
                      onKeyDown={onMsgKeyDown}
                    />
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={sendMsg}
                      disabled={!msgDraft.trim()}
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Applicants ── */}
      {tab === 'applicants' && (
        <div className="edb-panel" role="tabpanel">
          {applicationError && <p className="form-error" role="alert">{applicationError}</p>}
          {/* Job filter */}
          {myJobs.length > 0 && (
            <div className="edb-filter-row">
              <label className="edb-filter-label" htmlFor="edb-job-filter">
                Lọc theo tin:
              </label>
              <select
                id="edb-job-filter"
                className="edb-filter-select"
                value={filterJobId}
                onChange={(e) => setFilterJobId(e.target.value)}
              >
                <option value="all">Tất cả ({myApplications.length})</option>
                {myJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({applicantCountByJob[j.id] ?? 0})
                  </option>
                ))}
              </select>
            </div>
          )}

          {filteredApplications.length === 0 ? (
            <div className="edb-empty">
              <span className="edb-empty__icon">👥</span>
              <p className="edb-empty__text">
                {myJobs.length === 0
                  ? 'Đăng tin để nhận ứng viên.'
                  : 'Chưa có ứng viên nào.'}
              </p>
            </div>
          ) : (
            <ul className="edb-applicant-list">
              {filteredApplications.map((app) => {
                const meta = APPLICATION_STATUS_META[app.status]
                return (
                  <li key={`${app.jobId}-${app.appliedAt}`} className="edb-applicant-item">
                    <div className="edb-applicant-item__avatar">
                      {(app.seekerName?.trim() || '?')[0].toUpperCase()}
                    </div>
                    <div className="edb-applicant-item__info">
                      <p className="edb-applicant-item__name">
                        {app.seekerName ?? 'Ẩn danh'}
                      </p>
                      <p className="edb-applicant-item__sub">
                        {app.seekerPhone && (
                          <a href={`tel:${app.seekerPhone}`} className="edb-phone-link">
                            📞 {app.seekerPhone}
                          </a>
                        )}
                        {app.seekerPhone && ' · '}
                        {app.jobTitle} · {formatDate(app.appliedAt)}
                      </p>
                    </div>
                    <div className="edb-applicant-item__status">
                      <select
                        className={`edb-status-select ${meta.badgeClass}`}
                        value={app.status}
                        onChange={(e) =>
                          handleStatusChange(app.id ?? app.appliedAt, e.target.value as ApplicationStatus)
                        }
                        aria-label={`Trạng thái ứng tuyển của ${app.seekerName ?? 'ứng viên'}`}
                      >
                        {app.status === 'submitted' && (
                          <option value="submitted" disabled>
                            {APPLICATION_STATUS_META.submitted.labelVi}
                          </option>
                        )}
                        {(['reviewing', 'interview', 'accepted', 'rejected'] as ApplicationStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {APPLICATION_STATUS_META[s].labelVi}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const slot = app.seekerId
                          ? interviewsByKey.get(`${app.jobId}:${app.seekerId}`) ?? null
                          : null
                        return slot ? (
                          <span className="edb-interview-badge">
                            🗓 {new Date(slot.datetime).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}{' '}
                            {new Date(slot.datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--sm edb-btn-schedule"
                            onClick={() => setScheduleTarget(app)}
                          >
                            🗓 Hẹn phỏng vấn
                          </button>
                        )
                      })()}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      <ScheduleInterviewModal
        open={scheduleTarget !== null}
        app={scheduleTarget}
        employerId={user.id}
        onClose={() => setScheduleTarget(null)}
        onScheduled={() => { loadApplications().then(setApplications) }}
      />
    </div>
  )
}
