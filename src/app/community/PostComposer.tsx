import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Star, X } from 'lucide-react'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../../data/categories'
import { POST_CATEGORY_META, addPost, type PostCategory } from '../../lib/communityStorage'
import BottomSheet from '../ui/BottomSheet'

const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

// 글쓰기 — 웹 커뮤니티 글쓰기와 같은 항목·같은 검사·같은 저장 함수(lib/communityStorage.addPost: 사진 올리기 포함).
export default function PostComposer({ userId, onClose, onCreated }: { userId: string; onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState<PostCategory>('review')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [jobCategory, setJobCategory] = useState('')
  const [company, setCompany] = useState('')
  const [rating, setRating] = useState(0)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  const onPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) { setError(`Chỉ được tối đa ${MAX_PHOTOS} ảnh.`); return }
    for (const f of files) {
      if (!ACCEPTED.includes(f.type)) { setError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP.'); return }
      if (f.size > MAX_PHOTO_BYTES) { setError('Mỗi ảnh tối đa 8MB.'); return }
    }
    setError(''); setPhotos((prev) => [...prev, ...files])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề.'); return }
    if (!body.trim()) { setError('Vui lòng nhập nội dung.'); return }
    if (!authorName.trim()) { setError('Vui lòng nhập tên hiển thị.'); return }
    if (category === 'review' && !rating) { setError('Vui lòng chọn số sao đánh giá.'); return }
    setBusy(true)
    try {
      await addPost({ category, title: title.trim(), body: body.trim(), authorName: authorName.trim(), jobCategory: jobCategory || undefined, company: company.trim() || undefined, rating: category === 'review' ? rating : undefined }, userId, photos)
      onCreated(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng bài, vui lòng thử lại.')
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet title="Đăng bài mới" onClose={busy ? () => {} : onClose} full footer={<button type="submit" form="app-post-form" className="app-btn app-btn--primary" disabled={busy}>{busy ? 'Đang đăng…' : 'Đăng bài'}</button>}>
      <form id="app-post-form" className="app-form app-form--sheet" onSubmit={submit} noValidate>
        <div className="app-seg" role="group" aria-label="Phân loại">
          {(['review', 'tip', 'question'] as PostCategory[]).map((c) => <button key={c} type="button" className={category === c ? 'app-on' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>{POST_CATEGORY_META[c].label}</button>)}
        </div>
        {category === 'review' && (
          <div className="app-stars" role="group" aria-label="Đánh giá sao">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} sao`} aria-pressed={rating === n} className={rating >= n ? 'app-on' : ''} onClick={() => setRating(n)}><Star size={26} aria-hidden /></button>)}</div>
        )}
        {error && <p className="app-form__error" role="alert">{error}</p>}
        <label className="app-field"><span>Tiêu đề *</span><input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="app-field"><span>Loại công việc</span><select value={jobCategory} onChange={(e) => setJobCategory(e.target.value)}><option value="">-- Chọn loại --</option>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></label>
        {category === 'review' && <label className="app-field"><span>Công ty (không bắt buộc)</span><input value={company} placeholder="VD: Highlands Coffee" onChange={(e) => setCompany(e.target.value)} /></label>}
        <label className="app-field"><span>Nội dung *</span><textarea rows={6} value={body} placeholder="Chia sẻ chi tiết để giúp ích cho mọi người..." onChange={(e) => setBody(e.target.value)} /></label>
        <div className="app-field"><span>Ảnh (tối đa {MAX_PHOTOS} ảnh, mỗi ảnh ≤8MB)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPhotos} disabled={photos.length >= MAX_PHOTOS} />
          {previews.length > 0 && <div className="app-com__previews">{previews.map((src, i) => <span key={src}><img src={src} alt="" /><button type="button" aria-label="Xoá ảnh" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}><X size={14} aria-hidden /></button></span>)}</div>}
        </div>
        <label className="app-field"><span>Tên hiển thị *</span><input value={authorName} maxLength={40} placeholder="Tên hoặc biệt danh của bạn" onChange={(e) => setAuthorName(e.target.value)} /></label>
      </form>
    </BottomSheet>
  )
}
