import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { loadHydratedAccountCv, saveAccountCvWithPhoto } from '../../lib/cvAccountSync'
import { createEmptyCv, loadCv, saveCv, type CvData } from '../../lib/cvStorage'

const OBJECTIVE_MAX = 200
const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// CV(이력서) 작성 — 웹 CvBuilder와 같은 자료 모양(lib/cvStorage)·같은 계정 저장 순서(lib/cvAccountSync). 로그인 전에는 이 기기에만 저장한다(웹과 같음).
// 지원 시 이 CV의 이름·전화가 지원자 정보로 쓰인다(lib/applySubmit.buildProfile).
export default function CvScreen() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const userId = user?.role === 'seeker' ? user.id : undefined
  const [data, setData] = useState<CvData>(() => (userId ? createEmptyCv() : loadCv()))
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [skillInput, setSkillInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setError('')
    if (!userId) { setPhotoPath(null); setData(loadCv()); return }
    setData(createEmptyCv()); setPhotoPath(null)
    loadHydratedAccountCv(userId)
      .then((remote) => { if (!cancelled && remote) { setData(remote.cv); setPhotoPath(remote.photoPath) } })
      .catch(() => { if (!cancelled) setError('Không tải được CV từ tài khoản. Dữ liệu trên thiết bị vẫn được giữ nguyên.') })
    return () => { cancelled = true }
  }, [userId, authLoading])

  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => setData((d) => ({ ...d, [k]: v }))
  const upd = <K extends 'experiences' | 'education' | 'references'>(k: K, id: string, patch: Partial<CvData[K][number]>) =>
    setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }) as CvData)
  const del = (k: 'experiences' | 'education' | 'references', id: string) =>
    setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).filter((x) => x.id !== id) }) as CvData)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setStatus('saving')
    try {
      if (userId) setPhotoPath(await saveAccountCvWithPhoto(userId, data, photoPath))
      else saveCv(data)
      setStatus('saved')
      window.setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('idle')
      setError('Không lưu được CV lên tài khoản. Bản trên thiết bị chưa bị xoá.')
    }
  }
  const onPhoto = (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    if (f.size > PHOTO_MAX_BYTES) { setError('Ảnh quá lớn. Vui lòng chọn file dưới 1,5 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setError(''); set('profilePhotoDataUrl', reader.result as string) }
    reader.readAsDataURL(f)
  }
  const addSkill = () => {
    const t = skillInput.trim()
    if (t && !data.skillTags.includes(t)) set('skillTags', [...data.skillTags, t])
    setSkillInput('')
  }
  const employerBlocked = !!user && !userId

  return (
    <div className="app-page" data-testid="app-cv">
      <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">CV của tôi</h1></header>
      {!authLoading && !user && <p className="app-cv__hint">CV được lưu trên thiết bị này. <Link to="/dang-nhap?redirect=%2Fho-so%2Fcv">Đăng nhập</Link> để lưu vào tài khoản và ứng tuyển nhanh.</p>}
      {employerBlocked && <p className="app-cv__hint">Tài khoản nhà tuyển dụng không dùng CV ứng viên.</p>}
      <form className="app-form" onSubmit={onSubmit} noValidate>
        {error && <p className="app-form__error" role="alert">{error}</p>}

        <section className="app-cv__sec"><h2>Thông tin cơ bản</h2>
          <div className="app-cv__photo">
            <span className="app-cv__photo-box">{data.profilePhotoDataUrl ? <img src={data.profilePhotoDataUrl} alt="" /> : 'Ảnh'}</span>
            <div><label className="app-btn app-btn--ghost app-cv__file">Chọn ảnh<input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files)} /></label>
              {data.profilePhotoDataUrl && <button type="button" className="app-link-btn" onClick={() => set('profilePhotoDataUrl', null)}>Xoá ảnh</button>}</div>
          </div>
          <label className="app-field"><span>Họ và tên</span><input value={data.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" /></label>
          <label className="app-field"><span>Vị trí mong muốn</span><input value={data.headline} onChange={(e) => set('headline', e.target.value)} /></label>
          <label className="app-field"><span>Số điện thoại</span><input type="tel" value={data.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" /></label>
          <label className="app-field"><span>Email</span><input type="email" value={data.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></label>
          <label className="app-field"><span>Nơi ở (tỉnh/thành)</span><input value={data.city} onChange={(e) => set('city', e.target.value)} /></label>
          <label className="app-field"><span>Ngày sinh</span><input type="date" value={data.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></label>
          <label className="app-field"><span>Giới thiệu ngắn ({data.objective.length}/{OBJECTIVE_MAX})</span><textarea rows={3} maxLength={OBJECTIVE_MAX} value={data.objective} onChange={(e) => set('objective', e.target.value.slice(0, OBJECTIVE_MAX))} /></label>
        </section>

        <section className="app-cv__sec"><h2>Kinh nghiệm làm việc</h2>
          {data.experiences.map((ex, i) => (
            <div className="app-cv__item" key={ex.id} data-testid="app-cv-exp">
              <div className="app-cv__item-head"><strong>Kinh nghiệm {i + 1}</strong>{data.experiences.length > 1 && <button type="button" className="app-icon-btn" aria-label="Xoá kinh nghiệm" onClick={() => del('experiences', ex.id)}><Trash2 size={18} aria-hidden /></button>}</div>
              <label className="app-field"><span>Chức danh</span><input value={ex.role} onChange={(e) => upd('experiences', ex.id, { role: e.target.value })} /></label>
              <label className="app-field"><span>Công ty</span><input value={ex.company} onChange={(e) => upd('experiences', ex.id, { company: e.target.value })} /></label>
              <label className="app-field"><span>Thời gian</span><input value={ex.period} placeholder="03/2023 – 08/2024" onChange={(e) => upd('experiences', ex.id, { period: e.target.value })} /></label>
              <label className="app-field"><span>Mô tả</span><textarea rows={3} value={ex.description} onChange={(e) => upd('experiences', ex.id, { description: e.target.value })} /></label>
            </div>
          ))}
          <button type="button" className="app-btn app-btn--ghost" onClick={() => set('experiences', [...data.experiences, { id: uid('exp'), role: '', company: '', period: '', description: '' }])}><Plus size={16} aria-hidden />Thêm kinh nghiệm</button>
        </section>

        <section className="app-cv__sec"><h2>Học vấn</h2>
          {data.education.map((ed, i) => (
            <div className="app-cv__item" key={ed.id}>
              <div className="app-cv__item-head"><strong>Học vấn {i + 1}</strong>{data.education.length > 1 && <button type="button" className="app-icon-btn" aria-label="Xoá học vấn" onClick={() => del('education', ed.id)}><Trash2 size={18} aria-hidden /></button>}</div>
              <label className="app-field"><span>Trường</span><input value={ed.school} onChange={(e) => upd('education', ed.id, { school: e.target.value })} /></label>
              <label className="app-field"><span>Bằng cấp / chuyên ngành</span><input value={ed.degree} onChange={(e) => upd('education', ed.id, { degree: e.target.value })} /></label>
              <label className="app-field"><span>Năm tốt nghiệp</span><input inputMode="numeric" value={ed.graduationYear} onChange={(e) => upd('education', ed.id, { graduationYear: e.target.value })} /></label>
            </div>
          ))}
          <button type="button" className="app-btn app-btn--ghost" onClick={() => set('education', [...data.education, { id: uid('edu'), school: '', degree: '', graduationYear: '' }])}><Plus size={16} aria-hidden />Thêm học vấn</button>
        </section>

        <section className="app-cv__sec"><h2>Kỹ năng</h2>
          {data.skillTags.length > 0 && <p className="app-cv__tags">{data.skillTags.map((t) => <span key={t} className="app-tag app-cv__tag">{t}<button type="button" aria-label={`Xoá ${t}`} onClick={() => set('skillTags', data.skillTags.filter((x) => x !== t))}><X size={13} aria-hidden /></button></span>)}</p>}
          <div className="app-cv__addrow"><input aria-label="Thêm kỹ năng" value={skillInput} placeholder="Ví dụ: Giao tiếp, Excel" onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }} /><button type="button" className="app-btn app-btn--ghost" onClick={addSkill}>Thêm</button></div>
        </section>

        <section className="app-cv__sec"><h2>Người giới thiệu</h2>
          {data.references.map((r) => (
            <div className="app-cv__item" key={r.id}>
              <div className="app-cv__item-head"><strong>{r.name || 'Người giới thiệu'}</strong><button type="button" className="app-icon-btn" aria-label="Xoá người giới thiệu" onClick={() => del('references', r.id)}><Trash2 size={18} aria-hidden /></button></div>
              <label className="app-field"><span>Họ tên</span><input value={r.name} onChange={(e) => upd('references', r.id, { name: e.target.value })} /></label>
              <label className="app-field"><span>Số điện thoại</span><input type="tel" value={r.phone} onChange={(e) => upd('references', r.id, { phone: e.target.value })} /></label>
            </div>
          ))}
          <button type="button" className="app-btn app-btn--ghost" onClick={() => set('references', [...data.references, { id: uid('ref'), name: '', phone: '' }])}><Plus size={16} aria-hidden />Thêm người giới thiệu</button>
        </section>

        <div className="app-cv__save"><button type="submit" className="app-btn app-btn--primary app-btn--block" disabled={status === 'saving' || employerBlocked}>{status === 'saving' ? 'Đang lưu…' : status === 'saved' ? 'Đã lưu CV ✓' : 'Lưu CV'}</button></div>
      </form>
    </div>
  )
}
