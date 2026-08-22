import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../data/categories'
import { useAuth } from '../context/AuthContext'
import { loadProfile } from '../lib/storage'
import {
  POST_CATEGORY_META,
  addComment,
  getPost,
  isLiked,
  toggleLike,
  type CommunityPost,
} from '../lib/communityStorage'
import type { JobCategory } from '../types/job'
import { ReportButton } from '../components/ReportButton'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`${rating} sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`star-btn${rating >= n ? ' star-btn--on' : ''}`}>★</span>
      ))}
    </span>
  )
}

export function CommunityPostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const profile = loadProfile()
  const defaultName = user ? user.name : profile.fullName || ''

  const [post, setPost] = useState<CommunityPost | undefined>(() => getPost(id ?? ''))
  const [liked, setLiked] = useState(() => isLiked(id ?? ''))
  const [likeCount, setLikeCount] = useState(post?.likes ?? 0)
  const [commentBody, setCommentBody] = useState('')
  const [commentName, setCommentName] = useState(defaultName)
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    const reload = () => {
      const p = getPost(id ?? '')
      setPost(p)
      setLikeCount(p?.likes ?? 0)
    }
    window.addEventListener('vgb:community', reload)
    return () => window.removeEventListener('vgb:community', reload)
  }, [id])

  if (!post) {
    return (
      <div className="page not-found">
        <h1>Không tìm thấy bài viết</h1>
        <p>Bài viết này đã bị xoá hoặc không tồn tại.</p>
        <Link to="/cong-dong" className="btn btn--primary">
          Quay lại cộng đồng
        </Link>
      </div>
    )
  }

  const meta = POST_CATEGORY_META[post.category]

  const handleLike = () => {
    const now = toggleLike(post.id)
    setLiked(now)
    setLikeCount((c) => (now ? c + 1 : c - 1))
  }

  const handleComment = (e: FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim()) { setCommentError('Vui lòng nhập nội dung bình luận.'); return }
    if (!commentName.trim()) { setCommentError('Vui lòng nhập tên hiển thị.'); return }
    addComment(post.id, commentBody.trim(), commentName.trim())
    setCommentBody('')
    setCommentError('')
    // reload
    const updated = getPost(post.id)
    if (updated) setPost(updated)
  }

  return (
    <div className="page post-detail-page">
      <button className="back-link" onClick={() => navigate('/cong-dong')}>
        ← Quay lại cộng đồng
      </button>

      <article className="post-detail">
        {/* Header */}
        <header className="post-detail__header">
          <div className="post-detail__badges">
            <span className={`post-cat-badge ${meta.colorClass}`}>
              {meta.icon} {meta.label}
            </span>
            {post.jobCategory && (
              <span className="community-card__job-cat">
                {CATEGORY_ICONS[post.jobCategory as JobCategory]}{' '}
                {CATEGORY_LABELS[post.jobCategory as JobCategory] ?? post.jobCategory}
              </span>
            )}
          </div>

          <h1 className="post-detail__title">{post.title}</h1>

          <div className="post-detail__meta">
            {post.rating !== undefined && (
              <span className="post-detail__rating">
                <Stars rating={post.rating} />
                <span className="post-detail__rating-text">{post.rating}/5 sao</span>
              </span>
            )}
            {post.company && (
              <span className="post-detail__company">🏢 {post.company}</span>
            )}
            <span className="post-detail__author">✍️ {post.authorName}</span>
            <span className="post-detail__date">🕐 {timeAgo(post.createdAt)}</span>
          </div>
          <ReportButton
            targetType="community_post"
            targetId={post.id}
            snapshot={{ title: post.title, author: post.authorName, url: `/cong-dong/${post.id}` }}
          />
        </header>

        {/* Body */}
        <div className="post-detail__body">
          {post.body.split('\n').map((line, i) =>
            line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>,
          )}
        </div>

        {/* Like */}
        <div className="post-detail__like-row">
          <button
            className={`community-like-btn community-like-btn--lg${liked ? ' community-like-btn--active' : ''}`}
            onClick={handleLike}
          >
            ♥ {liked ? 'Đã thích' : 'Thích'} · {likeCount}
          </button>
          <span className="post-detail__share">
            💬 {post.comments.length} bình luận
          </span>
        </div>
      </article>

      {/* Comments */}
      <section className="post-comments">
        <h2 className="post-comments__title">Bình luận ({post.comments.length})</h2>

        {post.comments.length === 0 ? (
          <p className="post-comments__empty">Chưa có bình luận. Hãy là người đầu tiên!</p>
        ) : (
          <ul className="post-comments__list">
            {post.comments.map((c) => (
              <li key={c.id} className="post-comment">
                <div className="post-comment__head">
                  <span className="post-comment__author">{c.authorName}</span>
                  <span className="post-comment__time">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="post-comment__body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}

        {/* Comment form */}
        <form className="post-comment-form" onSubmit={handleComment}>
          <h3 className="post-comment-form__title">Thêm bình luận</h3>
          <label className="field">
            <span className="field__label">Tên hiển thị</span>
            <input
              className="field__input"
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              placeholder="Tên hoặc biệt danh"
              maxLength={40}
            />
          </label>
          <label className="field">
            <span className="field__label">Nội dung</span>
            <textarea
              className="field__input field__textarea"
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Chia sẻ ý kiến của bạn..."
            />
          </label>
          {commentError && <p className="form-error" role="alert">{commentError}</p>}
          <button type="submit" className="btn btn--primary btn--sm">
            Đăng bình luận
          </button>
        </form>
      </section>
    </div>
  )
}
