import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface GuestJobRow {
  id: number
  title: string
  company: string
  category: string
  salary: string
  location: string
  hours: string | null
  employer_phone: string
  application_deadline: string
  description: string
  active: boolean
  posted_at: string
}

const emptyDraft = {
  title: '', company: '', salary: '', location: '', hours: '', employer_phone: '',
  application_deadline: '', description: '',
}

/**
 * "Đăng nhanh, không cần đăng ký"(게스트 공고 등록)로 올린 사람이 관리
 * 링크(이 페이지 URL + ?token=)로 돌아와 자기 공고를 고치거나 마감 처리하는
 * 화면. 로그인 계정이 전혀 없으므로, 본인 확인은 URL의 토큰이
 * get_guest_job()/update_guest_job() 함수 안에서 정확히 일치하는지로만
 * 이뤄진다(20260920120000_local_jobs_guest_posting.sql 참고) — 토큰을
 * 모르면 이 화면에서 아무것도 볼 수도 고칠 수도 없다.
 */
export default function ManageGuestJob() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<GuestJobRow | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id || !token) { setNotFound(true); setLoading(false); return }
    let cancelled = false
    supabase
      .rpc('get_guest_job', { p_job_id: Number(id), p_token: token })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return
        const row = (data as GuestJobRow[] | null)?.[0]
        if (rpcError || !row) { setNotFound(true); setLoading(false); return }
        setJob(row)
        setDraft({
          title: row.title,
          company: row.company,
          salary: row.salary,
          location: row.location,
          hours: row.hours ?? '',
          employer_phone: row.employer_phone,
          application_deadline: row.application_deadline,
          description: row.description,
        })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, token])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setError(null)
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('update_guest_job', {
      p_job_id: Number(id),
      p_token: token,
      p_title: draft.title.trim(),
      p_company: draft.company.trim(),
      p_salary: draft.salary.trim(),
      p_location: draft.location.trim(),
      p_hours: draft.hours.trim() || null,
      p_employer_phone: draft.employer_phone.trim(),
      p_application_deadline: draft.application_deadline || null,
      p_description: draft.description.trim(),
    })
    setSaving(false)
    if (rpcError || !(data as unknown[] | null)?.length) {
      setError('Không thể lưu thay đổi. Vui lòng thử lại.')
      return
    }
    setSaved(true)
    setJob((prev) => (prev ? { ...prev, ...draft, hours: draft.hours } : prev))
  }

  const toggleActive = async () => {
    if (!id || !job) return
    setSaving(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('update_guest_job', {
      p_job_id: Number(id),
      p_token: token,
      p_active: !job.active,
    })
    setSaving(false)
    const row = (data as GuestJobRow[] | null)?.[0]
    if (rpcError || !row) { setError('Không thể cập nhật trạng thái. Vui lòng thử lại.'); return }
    setJob((prev) => (prev ? { ...prev, active: row.active } : prev))
  }

  if (loading) return <div className="page page--narrow" role="status">Đang tải...</div>

  if (notFound || !job) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <h1 className="page-header__title">Không tìm thấy tin</h1>
        </header>
        <div className="form-card">
          <p>Link quản lý không đúng hoặc đã hết hạn. Nếu bạn đã mất link quản lý, vui lòng liên hệ chúng tôi kèm số điện thoại đã đăng trong tin để được hỗ trợ.</p>
          <Link to="/" className="text-link">← Về trang chủ</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--narrow post-job">
      <header className="page-header">
        <h1 className="page-header__title">Quản lý tin đăng</h1>
        <p className="page-header__lead">
          Tin này được đăng không qua tài khoản — hãy lưu lại link này để quản lý về sau.
        </p>
      </header>

      <div className="form-card" style={{ marginBottom: '1rem' }}>
        <p>
          Trạng thái: <strong>{job.active ? 'Đang hiển thị' : 'Đã ẩn / ngừng đăng'}</strong>
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={toggleActive} disabled={saving}>
          {job.active ? 'Ngừng đăng tin này' : 'Hiển thị lại tin này'}
        </button>
        {' '}
        <Link to={`/viec-lam/sb-${job.id}`} className="text-link">Xem tin →</Link>
      </div>

      <form className="form-card" onSubmit={onSave} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p style={{ color: 'var(--color-primary)' }}>Đã lưu thay đổi.</p>}

        <label className="field">
          <span className="field__label">Tiêu đề công việc *</span>
          <input className="field__input" value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Tên công ty / đơn vị *</span>
          <input className="field__input" value={draft.company}
            onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Mức lương / chế độ *</span>
          <input className="field__input" value={draft.salary}
            onChange={(e) => setDraft((d) => ({ ...d, salary: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Địa điểm làm việc *</span>
          <input className="field__input" value={draft.location}
            onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Thời gian làm việc (tuỳ chọn)</span>
          <input className="field__input" value={draft.hours}
            onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Số điện thoại liên hệ *</span>
          <input className="field__input" value={draft.employer_phone}
            onChange={(e) => setDraft((d) => ({ ...d, employer_phone: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Hạn nộp hồ sơ *</span>
          <input className="field__input" type="date" value={draft.application_deadline}
            onChange={(e) => setDraft((d) => ({ ...d, application_deadline: e.target.value }))} />
        </label>

        <label className="field">
          <span className="field__label">Mô tả công việc *</span>
          <textarea className="field__input" rows={6} value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        </label>

        <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  )
}
