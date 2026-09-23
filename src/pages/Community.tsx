import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS } from '../data/categories'
import { useAuth, type AuthUser } from '../context/AuthContext'
import {
  POST_CATEGORY_META,
  addPost,
  loadPosts,
  type CommunityPost,
  type PostCategory,
} from '../lib/communityStorage'
import type { JobCategory } from '../types/job'

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

function Stars({ rating, interactive = false, onRate }: { rating: number; interactive?: boolean; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="stars" aria-label={`${rating} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${(hover || rating) >= n ? ' star-btn--on' : ''}`}
          onClick={() => interactive && onRate?.(n)}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          style={{ cursor: interactive ? 'pointer' : 'default', pointerEvents: interactive ? undefined : 'none' }}
          tabIndex={interactive ? 0 : -1}
          aria-label={`${n} sao`}
        >
          ★
        </button>
      ))}
    </span>
  )
}

// ── Post Row (전통 게시판형 리스트) ──────────────────────────────────────────

function PostRow({ post }: { post: CommunityPost }) {
  const navigate = useNavigate()
  const meta = POST_CATEGORY_META[post.category]

  const go = () => navigate(`/cong-dong/${post.id}`)
  const goOnKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() }
  }

  return (
    <tr className="community-row" onClick={go} onKeyDown={goOnKey} tabIndex={0} role="link">
      <td className="community-row__cat">
        <span className={`post-cat-badge ${meta.colorClass}`}>
          {meta.icon} {meta.label}
        </span>
      </td>
      <td className="community-row__title">
        {post.jobCategory && (
          <span className="community-row__job-cat">
            {CATEGORY_ICONS[post.jobCategory as JobCategory]}
          </span>
        )}
        <span className="community-row__title-text">{post.title}</span>
        {post.rating !== undefined && (
          <span className="community-row__rating">★{post.rating}</span>
        )}
        {post.photoUrls.length > 0 && <span className="community-row__photo-icon">🖼</span>}
        {post.commentsCount > 0 && (
          <span className="community-row__comment-count">[{post.commentsCount}]</span>
        )}
      </td>
      <td className="community-row__author">
        <span>{post.authorName}</span>
        <span className="community-row__date">{timeAgo(post.createdAt)}</span>
      </td>
      <td className="community-row__num">{post.views}</td>
      <td className="community-row__num">{post.likes}</td>
    </tr>
  )
}

// ── Create Post Modal ─────────────────────────────────────────────────────────

const MAX_PHOTOS = 4
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function CreateModal({ user, onClose, onCreated }: { user: AuthUser; onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState<PostCategory>('review')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [jobCategory, setJobCategory] = useState('')
  const [company, setCompany] = useState('')
  const [rating, setRating] = useState(0)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPhotoPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [photos])

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Chỉ được tối đa ${MAX_PHOTOS} ảnh.`)
      return
    }
    for (const f of files) {
      if (!ACCEPTED_PHOTO_TYPES.includes(f.type)) { setError('Chỉ hỗ trợ ảnh JPG, PNG, WEBP.'); return }
      if (f.size > MAX_PHOTO_BYTES) { setError('Mỗi ảnh tối đa 8MB.'); return }
    }
    setError('')
    setPhotos((prev) => [...prev, ...files])
  }

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề.'); return }
    if (!body.trim()) { setError('Vui lòng nhập nội dung.'); return }
    if (!authorName.trim()) { setError('Vui lòng nhập tên hiển thị.'); return }
    if (category === 'review' && !rating) { setError('Vui lòng chọn số sao đánh giá.'); return }

    setSubmitting(true)
    try {
      await addPost(
        {
          category,
          title: title.trim(),
          body: body.trim(),
          authorName: authorName.trim(),
          jobCategory: jobCategory || undefined,
          company: company.trim() || undefined,
          rating: category === 'review' ? rating : undefined,
        },
        user.id,
        photos,
      )
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng bài, vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Đăng bài mới"
    >
      <div className="modal-panel community-modal">
        <div className="modal-panel__head">
          <h2 className="modal-panel__title">Đăng bài mới</h2>
          <button className="modal-panel__close" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        <form onSubmit={handleSubmit} className="community-form">
          {/* Category */}
          <div className="community-form__cats">
            {(['review', 'tip', 'question'] as PostCategory[]).map((cat) => {
              const m = POST_CATEGORY_META[cat]
              return (
                <button
                  key={cat}
                  type="button"
                  className={`rec-chip${category === cat ? ' rec-chip--active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {m.icon} {m.label}
                </button>
              )
            })}
          </div>

          {category === 'review' && (
            <div className="field">
              <span className="field__label">Đánh giá mức độ hài lòng</span>
              <Stars rating={rating} interactive onRate={setRating} />
            </div>
          )}

          <label className="field">
            <span className="field__label">Tiêu đề *</span>
            <input
              className="field__input"
              placeholder={
                category === 'review' ? 'VD: Làm cafe Highlands 2 tháng — chia sẻ thật'
                : category === 'tip' ? 'VD: Mẹo để không bị trừ lương khi xin nghỉ'
                : 'VD: Part-time nhà máy có cần kinh nghiệm không?'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </label>

          <div className="community-form__grid">
            <label className="field">
              <span className="field__label">Loại công việc</span>
              <select
                className="field__input"
                value={jobCategory}
                onChange={(e) => setJobCategory(e.target.value)}
              >
                <option value="">-- Chọn loại --</option>
                {ALL_CATEGORIES.map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                    </option>
                  ),
                )}
              </select>
            </label>

            {category === 'review' && (
              <label className="field">
                <span className="field__label">Công ty (không bắt buộc)</span>
                <input
                  className="field__input"
                  placeholder="VD: Highlands Coffee"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </label>
            )}
          </div>

          <label className="field">
            <span className="field__label">Nội dung *</span>
            <textarea
              className="field__input field__textarea community-form__body"
              placeholder="Chia sẻ chi tiết để giúp ích cho mọi người..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </label>

          <div className="field">
            <span className="field__label">Ảnh (không bắt buộc, tối đa {MAX_PHOTOS} ảnh, mỗi ảnh ≤8MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoChange}
              disabled={photos.length >= MAX_PHOTOS}
            />
            {photoPreviews.length > 0 && (
              <div className="community-photo-previews">
                {photoPreviews.map((src, i) => (
                  <div key={src} className="community-photo-preview">
                    <img src={src} alt="" />
                    <button type="button" onClick={() => removePhoto(i)} aria-label="Xoá ảnh">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="field">
            <span className="field__label">Tên hiển thị *</span>
            <input
              className="field__input"
              placeholder="Tên hoặc biệt danh của bạn"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={40}
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-panel__actions modal-panel__actions--single">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Đang đăng…' : 'Đăng bài'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const CAT_FILTERS: { value: PostCategory | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Tất cả', icon: '📋' },
  { value: 'review', label: 'Đánh giá', icon: '⭐' },
  { value: 'tip', label: 'Mẹo hay', icon: '💡' },
  { value: 'question', label: 'Hỏi đáp', icon: '❓' },
]

export function Community() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [catFilter, setCatFilter] = useState<PostCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [sortBy, setSortBy] = useState<'new' | 'popular'>('new')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const nextPosts = await loadPosts()
      setPosts(nextPosts)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Không thể tải bài viết.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleCreateClick = () => {
    if (!user) {
      navigate(`/dang-nhap?redirect=${encodeURIComponent('/cong-dong')}`)
      return
    }
    setCreating(true)
  }

  const filtered = posts
    .filter((p) => catFilter === 'all' || p.category === catFilter)
    .filter((p) => {
      const q = search.trim().toLowerCase()
      return !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q)
    })
    .sort((a, b) =>
      sortBy === 'popular'
        ? b.likes - a.likes
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

  return (
    <div className="page community-page">
      <header className="page-header community-header">
        <div>
          <h1 className="page-header__title">Cộng đồng Việc gần Bạn</h1>
          <p className="page-header__lead">
            Chia sẻ kinh nghiệm làm thêm, mẹo hay và giải đáp thắc mắc cùng nhau.
          </p>
        </div>
        <button className="btn btn--primary community-header__post-btn" onClick={handleCreateClick}>
          + Đăng bài
        </button>
      </header>

      {/* Controls */}
      <div className="community-controls">
        <div className="community-cat-filters">
          {CAT_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`rec-chip${catFilter === f.value ? ' rec-chip--active' : ''}`}
              onClick={() => setCatFilter(f.value)}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        <div className="community-controls__right">
          <input
            type="search"
            className="community-search"
            placeholder="Tìm bài viết..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field__input community-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'new' | 'popular')}
          >
            <option value="new">Mới nhất</option>
            <option value="popular">Phổ biến</option>
          </select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="community-stats">
        <span>{posts.length} bài viết</span>
        <span>·</span>
        <span>{posts.reduce((s, p) => s + p.commentsCount, 0)} bình luận</span>
        <span>·</span>
        <span>{posts.reduce((s, p) => s + p.likes, 0)} lượt thích</span>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="empty-state">
          <p>Đang tải bài viết…</p>
        </div>
      ) : loadError ? (
        <div className="empty-state">
          <p>{loadError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>Không tìm thấy bài viết nào.</p>
          <button className="btn btn--primary btn--sm" onClick={handleCreateClick} style={{ marginTop: '0.75rem' }}>
            Đăng bài đầu tiên
          </button>
        </div>
      ) : (
        <table className="community-table">
          <thead>
            <tr>
              <th className="community-table__cat-head">Phân loại</th>
              <th>Tiêu đề</th>
              <th className="community-table__author-head">Người đăng</th>
              <th className="community-table__num-head">Xem</th>
              <th className="community-table__num-head">Thích</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PostRow key={p.id} post={p} />
            ))}
          </tbody>
        </table>
      )}

      {creating && user && (
        <CreateModal user={user} onClose={() => setCreating(false)} onCreated={reload} />
      )}
    </div>
  )
}
