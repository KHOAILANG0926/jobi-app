import { FormEvent, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import type { JobCategory } from '../types/job'

const supabase = createClient(
  'https://edhuesdnuxlbcfephutq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHVlc2RudXhsYmNmZXBodXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg5MTcsImV4cCI6MjA5NDU4NDkxN30.mnbMkGLy8UwFaOg6qdkDaV6DGZ2LyCSfOhJVB_48_HE'
)

const emptyForm = {
  title: '',
  company: '',
  category: 'other' as JobCategory,
  salary: '',
  location: '',
  hours: '',
  description: '',
  employerPhone: '',
  applicationDeadline: '',
  urgent: false,
}

export function PostJob() {
  const navigate = useNavigate()
  const { addPostedJob } = useJobs()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (
      !form.title.trim() ||
      !form.company.trim() ||
      !form.salary.trim() ||
      !form.location.trim() ||
      !form.description.trim() ||
      !form.employerPhone.trim()
    ) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*).')
      return
    }

    const deadline =
      form.applicationDeadline.trim() ||
      (() => {
        const t = new Date()
        t.setDate(t.getDate() + 14)
        return t.toISOString().slice(0, 10)
      })()

    setSubmitting(true)
    try {
      let imageUrl: string | undefined = undefined

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(path, imageFile, { upsert: true })
        if (uploadError) throw new Error('Tải ảnh thất bại: ' + uploadError.message)
        const { data } = supabase.storage.from('job-images').getPublicUrl(path)
        imageUrl = data.publicUrl
      }

      const job = await addPostedJob({
        title: form.title.trim(),
        company: form.company.trim(),
        category: form.category,
        salary: form.salary.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        hours: form.hours.trim() || undefined,
        employerPhone: form.employerPhone.trim(),
        applicationDeadline: deadline,
        urgent: form.urgent,
        imageUrl,
      })
      setForm(emptyForm)
      setImageFile(null)
      setImagePreview(null)
      navigate(`/viec-lam/${job.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page page--narrow post-job">
      <header className="page-header">
        <h1 className="page-header__title">Đăng tin tuyển dụng</h1>
        <p className="page-header__lead">
          Nhà tuyển dụng đăng việc miễn phí — tiếp cận ứng viên ngay hôm nay.
        </p>
      </header>

      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error && <p className="form-error" role="alert">{error}</p>}

        <label className="field">
          <span className="field__label">Tiêu đề công việc *</span>
          <input className="field__input" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ví dụ: Nhân viên phục vụ ca tối" />
        </label>

        <label className="field">
          <span className="field__label">Tên công ty / đơn vị *</span>
          <input className="field__input" value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Công ty TNHH ..." />
        </label>

        <label className="field">
          <span className="field__label">Danh mục *</span>
          <select className="field__input" value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as JobCategory }))}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Mức lương / chế độ *</span>
          <input className="field__input" value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
            placeholder="Ví dụ: 30.000 đ/giờ hoặc thỏa thuận" />
        </label>

        <label className="field">
          <span className="field__label">Địa điểm làm việc *</span>
          <input className="field__input" value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="Quận, thành phố" />
        </label>

        <label className="field">
          <span className="field__label">Thời gian làm việc (tuỳ chọn)</span>
          <input className="field__input" value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            placeholder="Ca sáng, cuối tuần..." />
        </label>

        <label className="field">
          <span className="field__label">Số điện thoại liên hệ *</span>
          <input className="field__input" value={form.employerPhone}
            onChange={(e) => setForm((f) => ({ ...f, employerPhone: e.target.value }))}
            inputMode="tel" autoComplete="tel" placeholder="0900 000 000" />
        </label>

        <label className="field">
          <span className="field__label">Hạn nộp hồ sơ (để trống = 14 ngày)</span>
          <input className="field__input" type="date" value={form.applicationDeadline}
            onChange={(e) => setForm((f) => ({ ...f, applicationDeadline: e.target.value }))} />
        </label>

        <label className="field field--row">
          <input type="checkbox" checked={form.urgent}
            onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))} />
          <span className="field__label">🔥 Tuyển gấp</span>
        </label>

        <div className="field">
          <span className="field__label">Ảnh công ty / nơi làm việc (tuỳ chọn)</span>
          <div
            style={{ border: '2px dashed #ddd', borderRadius: 8, padding: 16, textAlign: 'center', cursor: 'pointer', marginTop: 6 }}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ maxHeight: 160, borderRadius: 6, maxWidth: '100%' }} />
              : <p style={{ color: '#aaa', margin: 0 }}>Nhấn để chọn ảnh (JPG, PNG)</p>
            }
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageChange} />
          {imagePreview && (
            <button type="button" style={{ marginTop: 6, fontSize: 12, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setImageFile(null); setImagePreview(null) }}>
              Xoá ảnh
            </button>
          )}
        </div>

        <label className="field">
          <span className="field__label">Mô tả chi tiết *</span>
          <textarea className="field__input field__textarea" rows={5} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Nội dung công việc, yêu cầu, quyền lợi..." />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Đang đăng...' : 'Đăng tin'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => { setForm(emptyForm); setImageFile(null); setImagePreview(null) }} disabled={submitting}>
            Xoá form
          </button>
        </div>
      </form>
    </div>
  )
}