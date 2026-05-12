import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../data/categories'
import { useJobs } from '../context/JobsContext'
import type { JobCategory } from '../types/job'

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
}

export function PostJob() {
  const navigate = useNavigate()
  const { addPostedJob } = useJobs()
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
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
      setError('Vui lòng điền đầy đủ các trường bắt buộc.')
      return
    }
    const deadline =
      form.applicationDeadline.trim() ||
      (() => {
        const t = new Date()
        t.setDate(t.getDate() + 14)
        return t.toISOString().slice(0, 10)
      })()
    const job = addPostedJob({
      title: form.title.trim(),
      company: form.company.trim(),
      category: form.category,
      salary: form.salary.trim(),
      location: form.location.trim(),
      description: form.description.trim(),
      hours: form.hours.trim() || undefined,
      employerPhone: form.employerPhone.trim(),
      applicationDeadline: deadline,
      urgent: false,
    })
    setForm(emptyForm)
    navigate(`/viec-lam/${job.id}`, { replace: true })
  }

  return (
    <div className="page page--narrow post-job">
      <header className="page-header">
        <h1 className="page-header__title">Đăng tin tuyển dụng</h1>
        <p className="page-header__lead">
          Dành cho nhà tuyển dụng — đăng việc bán thời gian, tiếp cận ứng viên nhanh hơn.
        </p>
      </header>

      <form className="form-card" onSubmit={onSubmit} noValidate>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">Tiêu đề công việc *</span>
          <input
            className="field__input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ví dụ: Nhân viên phục vụ ca tối"
          />
        </label>

        <label className="field">
          <span className="field__label">Tên công ty / đơn vị *</span>
          <input
            className="field__input"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Công ty TNHH ..."
          />
        </label>

        <label className="field">
          <span className="field__label">Danh mục *</span>
          <select
            className="field__input"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value as JobCategory }))
            }
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Mức lương / chế độ *</span>
          <input
            className="field__input"
            value={form.salary}
            onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
            placeholder="Ví dụ: 30.000 đ/giờ hoặc thỏa thuận"
          />
        </label>

        <label className="field">
          <span className="field__label">Địa điểm làm việc *</span>
          <input
            className="field__input"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="Quận, thành phố"
          />
        </label>

        <label className="field">
          <span className="field__label">Thời gian làm việc (tuỳ chọn)</span>
          <input
            className="field__input"
            value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
            placeholder="Ca sáng, cuối tuần..."
          />
        </label>

        <label className="field">
          <span className="field__label">Số điện thoại liên hệ (nhà tuyển dụng) *</span>
          <input
            className="field__input"
            value={form.employerPhone}
            onChange={(e) => setForm((f) => ({ ...f, employerPhone: e.target.value }))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0900 000 000"
          />
        </label>

        <label className="field">
          <span className="field__label">Hạn nộp hồ sơ (để trống = mặc định 14 ngày)</span>
          <input
            className="field__input"
            type="date"
            value={form.applicationDeadline}
            onChange={(e) => setForm((f) => ({ ...f, applicationDeadline: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field__label">Mô tả chi tiết *</span>
          <textarea
            className="field__input field__textarea"
            rows={5}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Nội dung công việc, yêu cầu, quyền lợi..."
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary">
            Đăng tin
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setForm(emptyForm)}
          >
            Xoá form
          </button>
        </div>
      </form>
    </div>
  )
}
