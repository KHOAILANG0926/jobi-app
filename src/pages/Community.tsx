import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../data/categories'
import { useAuth } from '../context/AuthContext'
import { loadProfile } from '../lib/storage'
import {
  POST_CATEGORY_META,
  addPost,
  isLiked,
  loadPosts,
  toggleLike,
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

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({ post, onLikeChange }: { post: CommunityPost; onLikeChange: () => void }) {
  const [liked, setLiked] = useState(() => isLiked(post.id))
  const [count, setCount] = useState(post.likes)

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    const now = toggleLike(post.id)
    setLiked(now)
    setCount((c) => (now ? c + 1 : c - 1))
    onLikeChange()
  }

  const meta = POST_CATEGORY_META[post.category]
  const preview = post.body.slice(0, 120) + (post.body.length > 120 ? '…' : '')

  return (
    <li className="community-card">
      <div className="community-card__top">
        <span className={`post-cat-badge ${meta.colorClass}`}>
          {meta.icon} {meta.label}
        </span>
        {post.jobCategory && (
          <span className="community-card__job-cat">
            {CATEGORY_ICONS[post.jobCategory as JobCategory]}{' '}
            {CATEGORY_LABELS[post.jobCategory as JobCategory] ?? post.jobCategory}
          </span>
        )}
        {post.rating !== undefined && <Stars rating={post.rating} />}
      </div>

      <Link to={`/cong-dong/${post.id}`} className="community-card__title-link">
        <h3 className="community-card__title">{post.title}</h3>
      </Link>

      <p className="community-card__preview">{preview}</p>

      <div className="community-card__footer">
        <span className="community-card__author">
          {post.authorName} · {timeAgo(post.createdAt)}
        </span>
        <div className="community-card__actions">
          <span className="community-card__comments">
            💬 {post.comments.length}
          </span>
          <button
            className={`community-like-btn${liked ? ' community-like-btn--active' : ''}`}
            onClick={handleLike}
            aria-label={liked ? 'Bỏ thích' : 'Thích'}
          >
            ♥ {count}
          </button>
        </div>
      </div>
    </li>
  )
}

// ── Create Post Modal ─────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth()
  const profile = loadProfile()
  const defaultName = user ? user.name : profile.fullName || ''

  const [category, setCategory] = useState<PostCategory>('review')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState(defaultName)
  const [jobCategory, setJobCategory] = useState('')
  const [company, setCompany] = useState('')
  const [rating, setRating] = useState(0)
  const [error, setError] = useState('')

  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề.'); return }
    if (!body.trim()) { setError('Vui lòng nhập nội dung.'); return }
    if (!authorName.trim()) { setError('Vui lòng nhập tên hiển thị.'); return }
    if (category === 'review' && !rating) { setError('Vui lòng chọn số sao đánh giá.'); return }

    addPost({
      category,
      title: title.trim(),
      body: body.trim(),
      authorName: authorName.trim(),
      jobCategory: jobCategory || undefined,
      company: company.trim() || undefined,
      rating: category === 'review' ? rating : undefined,
    })
    onCreated()
    onClose()
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
                {(['factory', 'cafe', 'delivery', 'cleaning', 'retail', 'other'] as JobCategory[]).map(
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
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary">
              Đăng bài
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
  const [posts, setPosts] = useState<CommunityPost[]>(() => loadPosts())
  const [catFilter, setCatFilter] = useState<PostCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [sortBy, setSortBy] = useState<'new' | 'popular'>('new')

  const reload = () => setPosts(loadPosts())

  useEffect(() => {
    window.addEventListener('vgb:community', reload)
    return () => window.removeEventListener('vgb:community', reload)
  }, [])

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
        <button className="btn btn--primary community-header__post-btn" onClick={() => setCreating(true)}>
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
        <span>{posts.reduce((s, p) => s + p.comments.length, 0)} bình luận</span>
        <span>·</span>
        <span>{posts.reduce((s, p) => s + p.likes, 0)} lượt thích</span>
      </div>

      {/* Post list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Không tìm thấy bài viết nào.</p>
          <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)} style={{ marginTop: '0.75rem' }}>
            Đăng bài đầu tiên
          </button>
        </div>
      ) : (
        <ul className="community-list">
          {filtered.map((p) => (
            <PostCard key={p.id} post={p} onLikeChange={reload} />
          ))}
        </ul>
      )}

      {creating && (
        <CreateModal onClose={() => setCreating(false)} onCreated={reload} />
      )}
    </div>
  )
}
