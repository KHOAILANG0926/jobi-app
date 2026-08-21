import { FormEvent, forwardRef, useEffect, useRef, useState } from 'react'
import type { CvData, CvEducation, CvExperience, CvReference } from '../lib/cvStorage'
import { createEmptyCv, loadCv, saveCv } from '../lib/cvStorage'
import { loadProfile } from '../lib/storage'
import {
  deleteCvPhoto,
  loadAccountCv,
  loadCvPhoto,
  saveAccountCv,
  uploadCvPhoto,
} from '../lib/accountCvStorage'

const OBJECTIVE_MAX = 200
const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024

const CvA4Preview = forwardRef<HTMLDivElement, { data: CvData }>(function CvA4Preview(
  { data },
  ref,
) {
  const dobDisplay = data.dateOfBirth
    ? new Date(data.dateOfBirth + 'T12:00:00').toLocaleDateString('vi-VN')
    : ''

  return (
    <article ref={ref} className="cv-a4" aria-label="Bản xem trước CV">
      <header className="cv-a4__header">
        <div className="cv-a4__header-main">
          {data.profilePhotoDataUrl ? (
            <img src={data.profilePhotoDataUrl} alt="" className="cv-a4__photo" />
          ) : null}
          <div>
            <h1 className="cv-a4__name">{data.fullName || 'Họ và tên'}</h1>
            <p className="cv-a4__headline">{data.headline}</p>
            <ul className="cv-a4__contact">
              {data.email ? <li>{data.email}</li> : null}
              {data.phone ? <li>{data.phone}</li> : null}
              {data.city ? <li>{data.city}</li> : null}
              {dobDisplay ? <li>Sinh: {dobDisplay}</li> : null}
            </ul>
          </div>
        </div>
      </header>

      {data.objective ? (
        <section className="cv-a4__section">
          <h2 className="cv-a4__section-title">Mục tiêu</h2>
          <p className="cv-a4__text">{data.objective}</p>
        </section>
      ) : null}

      {data.experiences.some((e) => e.company || e.role || e.description) ? (
        <section className="cv-a4__section">
          <h2 className="cv-a4__section-title">Kinh nghiệm làm việc</h2>
          <ul className="cv-a4__list">
            {data.experiences.map((e) =>
              e.company || e.role || e.description ? (
                <li key={e.id}>
                  <div className="cv-a4__item-head">
                    <strong>{e.role || 'Chức danh'}</strong>
                    <span>{e.period}</span>
                  </div>
                  <div className="cv-a4__sub">{e.company}</div>
                  {e.description ? <p className="cv-a4__details">{e.description}</p> : null}
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      {data.education.some((x) => x.school || x.degree) ? (
        <section className="cv-a4__section">
          <h2 className="cv-a4__section-title">Học vấn</h2>
          <ul className="cv-a4__list">
            {data.education.map((x) =>
              x.school || x.degree ? (
                <li key={x.id}>
                  <div className="cv-a4__item-head">
                    <strong>{x.school || 'Trường'}</strong>
                    <span>{x.graduationYear}</span>
                  </div>
                  <div className="cv-a4__sub">{x.degree}</div>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      {data.skillTags.length > 0 ? (
        <section className="cv-a4__section">
          <h2 className="cv-a4__section-title">Kỹ năng</h2>
          <ul className="cv-a4__skills">
            {data.skillTags.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.references.some((r) => r.name || r.phone) ? (
        <section className="cv-a4__section">
          <h2 className="cv-a4__section-title">Người tham chiếu</h2>
          <ul className="cv-a4__list">
            {data.references.map((r) =>
              r.name || r.phone ? (
                <li key={r.id}>
                  <strong>{r.name}</strong>
                  {r.phone ? <span className="cv-a4__ref-phone"> · {r.phone}</span> : null}
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <p className="cv-a4__footer">Tạo bằng Việc gần Bạn</p>
    </article>
  )
})

export function CvBuilder({ userId }: { userId?: string }) {
  const [data, setData] = useState<CvData>(() => userId ? createEmptyCv() : loadCv())
  const [saved, setSaved] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [serverError, setServerError] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      setServerError('')
      if (!userId) {
        setPhotoPath(null)
        setData(loadCv())
        return
      }

      setData(createEmptyCv())
      setPhotoPath(null)
      try {
        const remote = await loadAccountCv(userId)
        if (cancelled || !remote) return
        let photoDataUrl: string | null = null
        if (remote.photoPath) photoDataUrl = await loadCvPhoto(userId, remote.photoPath)
        if (cancelled) return
        const hydrated = { ...remote.cv, profilePhotoDataUrl: photoDataUrl }
        setPhotoPath(remote.photoPath)
        setData(hydrated)
        saveCv(hydrated, userId)
      } catch {
        if (!cancelled) setServerError('Không tải được CV từ tài khoản. Dữ liệu trên thiết bị vẫn được giữ nguyên.')
      }
    }

    sync()
    window.addEventListener('vgb:account-cv-saved', sync)
    return () => {
      cancelled = true
      window.removeEventListener('vgb:account-cv-saved', sync)
    }
  }, [userId])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError('')
    try {
      if (userId) {
        const previousPhotoPath = photoPath
        const nextPhotoPath = data.profilePhotoDataUrl
          ? await uploadCvPhoto(userId, data.profilePhotoDataUrl)
          : null
        await saveAccountCv(userId, data, nextPhotoPath)
        setPhotoPath(nextPhotoPath)
        if (!nextPhotoPath && previousPhotoPath) {
          deleteCvPhoto(userId, previousPhotoPath).catch(() => undefined)
        }
      }
      saveCv(data, userId)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2800)
    } catch {
      setServerError('Không lưu được CV lên tài khoản. Bản trên thiết bị chưa bị xoá.')
    }
  }

  const syncFromProfile = () => {
    const p = loadProfile(userId)
    setData((d) => ({
      ...d,
      fullName: p.fullName,
      phone: p.phone,
      email: p.email,
      city: p.city,
      objective: p.bio ? p.bio.slice(0, OBJECTIVE_MAX) : d.objective,
    }))
  }

  const onPhotoChange = (fileList: FileList | null) => {
    const f = fileList?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return
    if (f.size > PHOTO_MAX_BYTES) {
      window.alert('Ảnh quá lớn. Vui lòng chọn file dưới 1,5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setData((d) => ({ ...d, profilePhotoDataUrl: reader.result as string }))
    }
    reader.readAsDataURL(f)
  }

  const clearPhoto = () => setData((d) => ({ ...d, profilePhotoDataUrl: null }))

  const addSkillTag = () => {
    const t = skillInput.trim()
    if (!t || data.skillTags.includes(t)) return
    setData((d) => ({ ...d, skillTags: [...d.skillTags, t] }))
    setSkillInput('')
  }

  const removeSkillTag = (tag: string) => {
    setData((d) => ({ ...d, skillTags: d.skillTags.filter((x) => x !== tag) }))
  }

  const addExperience = () => {
    setData((d) => ({
      ...d,
      experiences: [
        ...d.experiences,
        {
          id: `exp-${crypto.randomUUID()}`,
          company: '',
          role: '',
          period: '',
          description: '',
        },
      ],
    }))
  }

  const removeExperience = (id: string) => {
    setData((d) => {
      if (d.experiences.length <= 1) return d
      return { ...d, experiences: d.experiences.filter((x) => x.id !== id) }
    })
  }

  const updateExperience = (id: string, patch: Partial<CvExperience>) => {
    setData((d) => ({
      ...d,
      experiences: d.experiences.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }))
  }

  const addEducation = () => {
    setData((d) => ({
      ...d,
      education: [
        ...d.education,
        { id: `edu-${crypto.randomUUID()}`, school: '', degree: '', graduationYear: '' },
      ],
    }))
  }

  const removeEducation = (id: string) => {
    setData((d) => {
      if (d.education.length <= 1) return d
      return { ...d, education: d.education.filter((x) => x.id !== id) }
    })
  }

  const updateEducation = (id: string, patch: Partial<CvEducation>) => {
    setData((d) => ({
      ...d,
      education: d.education.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }))
  }

  const addReference = () => {
    setData((d) => ({
      ...d,
      references: [...d.references, { id: `ref-${crypto.randomUUID()}`, name: '', phone: '' }],
    }))
  }

  const removeReference = (id: string) => {
    setData((d) => ({ ...d, references: d.references.filter((x) => x.id !== id) }))
  }

  const updateReference = (id: string, patch: Partial<CvReference>) => {
    setData((d) => ({
      ...d,
      references: d.references.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }))
  }

  const onDownloadPdf = async () => {
    const el = previewRef.current
    if (!el) return
    setPdfLoading(true)
    try {
      const { downloadCvAsPdf } = await import('../lib/cvPdf')
      const base = (data.fullName || 'VGB').trim().replace(/\s+/g, '_').slice(0, 48)
      const safe = base.replace(/[^a-zA-Z0-9_\u00C0-\u024F-]/g, '') || 'VGB'
      await downloadCvAsPdf(el, `CV-${safe}`)
    } catch {
      window.alert('Không tạo được PDF. Thử lại sau.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="cv-builder">
      <div className="cv-builder__toolbar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={syncFromProfile}>
          Đồng bộ từ hồ sơ
        </button>
      </div>
      <div className="cv-builder__split">
        <form className="cv-builder__form profile-card" onSubmit={onSubmit} noValidate>
          <h2 className="cv-builder__form-title">Thông tin cá nhân</h2>
          <div className="cv-builder__photo-row">
            <div className="cv-builder__photo-preview">
              {data.profilePhotoDataUrl ? (
                <img src={data.profilePhotoDataUrl} alt="" className="cv-builder__photo-img" />
              ) : (
                <span className="cv-builder__photo-placeholder">Ảnh</span>
              )}
            </div>
            <div className="cv-builder__photo-actions">
              <label className="btn btn--ghost btn--sm cv-builder__file-label">
                Chọn ảnh đại diện
                <input
                  type="file"
                  accept="image/*"
                  className="cv-builder__file-input"
                  onChange={(e) => onPhotoChange(e.target.files)}
                />
              </label>
              {data.profilePhotoDataUrl ? (
                <button type="button" className="btn btn--ghost btn--sm" onClick={clearPhoto}>
                  Xoá ảnh
                </button>
              ) : null}
            </div>
          </div>

          <label className="field">
            <span className="field__label">Họ và tên</span>
            <input
              className="field__input"
              value={data.fullName}
              onChange={(e) => setData((d) => ({ ...d, fullName: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Vị trí / tiêu đề mong muốn</span>
            <input
              className="field__input"
              value={data.headline}
              onChange={(e) => setData((d) => ({ ...d, headline: e.target.value }))}
              placeholder="Ví dụ: Nhân viên phục vụ ca tối"
            />
          </label>
          <div className="cv-builder__row">
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="field__input"
                type="email"
                value={data.email}
                onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Điện thoại</span>
              <input
                className="field__input"
                inputMode="tel"
                value={data.phone}
                onChange={(e) => setData((d) => ({ ...d, phone: e.target.value }))}
              />
            </label>
          </div>
          <div className="cv-builder__row">
            <label className="field">
              <span className="field__label">Địa điểm</span>
              <input
                className="field__input"
                value={data.city}
                onChange={(e) => setData((d) => ({ ...d, city: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field__label">Ngày sinh</span>
              <input
                className="field__input"
                type="date"
                value={data.dateOfBirth}
                onChange={(e) => setData((d) => ({ ...d, dateOfBirth: e.target.value }))}
              />
            </label>
          </div>

          <h3 className="cv-builder__section-title">Mục tiêu / Tự giới thiệu</h3>
          <label className="field">
            <span className="field__label">Tối đa {OBJECTIVE_MAX} ký tự</span>
            <textarea
              className="field__input field__textarea"
              rows={3}
              maxLength={OBJECTIVE_MAX}
              value={data.objective}
              onChange={(e) =>
                setData((d) => ({ ...d, objective: e.target.value.slice(0, OBJECTIVE_MAX) }))
              }
              placeholder="Mong muốn nghề nghiệp, điểm mạnh ngắn gọn..."
            />
            <span className="cv-builder__char-count">
              {data.objective.length}/{OBJECTIVE_MAX}
            </span>
          </label>

          <h3 className="cv-builder__section-title">Kinh nghiệm làm việc</h3>
          {data.experiences.map((ex, idx) => (
            <div key={ex.id} className="cv-builder__block">
              <div className="cv-builder__block-head">
                <span className="cv-builder__block-label">Kinh nghiệm {idx + 1}</span>
                {data.experiences.length > 1 ? (
                  <button
                    type="button"
                    className="text-link cv-builder__remove"
                    onClick={() => removeExperience(ex.id)}
                  >
                    Xoá
                  </button>
                ) : null}
              </div>
              <label className="field">
                <span className="field__label">Chức danh công việc</span>
                <input
                  className="field__input"
                  value={ex.role}
                  onChange={(e) => updateExperience(ex.id, { role: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Công ty</span>
                <input
                  className="field__input"
                  value={ex.company}
                  onChange={(e) => updateExperience(ex.id, { company: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Thời gian (bắt đầu – kết thúc)</span>
                <input
                  className="field__input"
                  value={ex.period}
                  onChange={(e) => updateExperience(ex.id, { period: e.target.value })}
                  placeholder="VD: 06/2024 – Hiện tại"
                />
              </label>
              <label className="field">
                <span className="field__label">Mô tả</span>
                <textarea
                  className="field__input field__textarea"
                  rows={2}
                  value={ex.description}
                  onChange={(e) => updateExperience(ex.id, { description: e.target.value })}
                />
              </label>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={addExperience}>
            + Thêm kinh nghiệm
          </button>

          <h3 className="cv-builder__section-title">Học vấn</h3>
          {data.education.map((ed, idx) => (
            <div key={ed.id} className="cv-builder__block">
              <div className="cv-builder__block-head">
                <span className="cv-builder__block-label">Học vấn {idx + 1}</span>
                {data.education.length > 1 ? (
                  <button
                    type="button"
                    className="text-link cv-builder__remove"
                    onClick={() => removeEducation(ed.id)}
                  >
                    Xoá
                  </button>
                ) : null}
              </div>
              <label className="field">
                <span className="field__label">Tên trường</span>
                <input
                  className="field__input"
                  value={ed.school}
                  onChange={(e) => updateEducation(ed.id, { school: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Bằng cấp / chuyên ngành</span>
                <input
                  className="field__input"
                  value={ed.degree}
                  onChange={(e) => updateEducation(ed.id, { degree: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Năm tốt nghiệp</span>
                <input
                  className="field__input"
                  value={ed.graduationYear}
                  onChange={(e) => updateEducation(ed.id, { graduationYear: e.target.value })}
                  placeholder="VD: 2025"
                />
              </label>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={addEducation}>
            + Thêm học vấn
          </button>

          <h3 className="cv-builder__section-title">Kỹ năng (thẻ)</h3>
          <div className="cv-builder__tags-input-row">
            <input
              className="field__input"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSkillTag()
                }
              }}
              placeholder="VD: Giao tiếp tốt — Enter để thêm"
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={addSkillTag}>
              Thêm
            </button>
          </div>
          {data.skillTags.length > 0 ? (
            <ul className="cv-builder__tags">
              {data.skillTags.map((tag) => (
                <li key={tag} className="cv-builder__tag">
                  {tag}
                  <button
                    type="button"
                    className="cv-builder__tag-remove"
                    aria-label={`Xoá ${tag}`}
                    onClick={() => removeSkillTag(tag)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="cv-builder__section-title">Người tham chiếu (tuỳ chọn)</h3>
          {data.references.map((ref, idx) => (
            <div key={ref.id} className="cv-builder__block">
              <div className="cv-builder__block-head">
                <span className="cv-builder__block-label">Người tham chiếu {idx + 1}</span>
                <button
                  type="button"
                  className="text-link cv-builder__remove"
                  onClick={() => removeReference(ref.id)}
                >
                  Xoá
                </button>
              </div>
              <label className="field">
                <span className="field__label">Họ tên</span>
                <input
                  className="field__input"
                  value={ref.name}
                  onChange={(e) => updateReference(ref.id, { name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Điện thoại</span>
                <input
                  className="field__input"
                  inputMode="tel"
                  value={ref.phone}
                  onChange={(e) => updateReference(ref.id, { phone: e.target.value })}
                />
              </label>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={addReference}>
            + Thêm người tham chiếu
          </button>

          <div className="cv-builder__save-row">
            <button type="submit" className="btn btn--primary">
              Lưu CV
            </button>
            {saved ? (
              <span className="cv-builder__saved-badge" role="status">
                Đã lưu vào hồ sơ ✓
              </span>
            ) : null}
          </div>
          {serverError ? <p className="form-error" role="alert">{serverError}</p> : null}
          <p className="hint">CV đã lưu được dùng tự động cho Ứng tuyển ngay.</p>
        </form>

        <div className="cv-builder__preview-wrap">
          <div className="cv-builder__preview-toolbar">
            <p className="cv-builder__preview-label">Xem trước (A4)</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onDownloadPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Đang tạo…' : 'Tải xuống PDF'}
            </button>
          </div>
          <div className="cv-builder__preview-scale">
            <div className="cv-builder__preview-scale-inner">
              <CvA4Preview ref={previewRef} data={data} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
