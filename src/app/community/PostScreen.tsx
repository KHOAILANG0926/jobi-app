import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Eye, Heart, Star } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { CATEGORY_LABELS } from '../../data/categories'
import { createReport, getOwnReportStatus, type ReportStatus } from '../../lib/adminOperations'
import { POST_CATEGORY_META, addComment, getPost, incrementViews, loadComments, loadLikedPostIds, toggleLike, type CommunityPost, type PostComment } from '../../lib/communityStorage'
import type { JobCategory } from '../../types/job'
import { timeAgo } from './communityView'

// 글 상세 — 웹 /cong-dong/:id와 같은 자료·같은 동작(조회수 +1, 좋아요 토글, 댓글, 신고 = lib/adminOperations.createReport).
function ReportBox({ post, userId }: { post: CommunityPost; userId: string | undefined }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('spam')
  const [description, setDescription] = useState('')
  const [state, setState] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState('')
  const [existing, setExisting] = useState<ReportStatus | null>(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getOwnReportStatus(userId, 'community_post', post.id).then((s) => { if (!cancelled) setExisting(s) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [userId, post.id])
  const start = () => { if (!userId) { navigate('/dang-nhap?redirect=' + encodeURIComponent(location.pathname)); return } setOpen(true) }
  const submit = async () => {
    if (!userId) return
    setState('saving'); setError('')
    try {
      await createReport({ reporterId: userId, targetType: 'community_post', targetId: post.id, category, description: description.trim(), snapshot: { title: post.title, author: post.authorName, url: `/cong-dong/${post.id}` } })
      setExisting('pending'); setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể gửi báo cáo.') } finally { setState('idle') }
  }
  if (existing) return <span className="app-com__reported">Báo cáo của bạn: {existing}</span>
  return (
    <div className="app-com__report">
      <button type="button" className="app-link-btn" onClick={start}>Báo cáo</button>
      {open && (
        <div className="app-com__reportform" role="dialog" aria-label="Báo cáo nội dung">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Lý do"><option value="spam">Spam / quảng cáo</option><option value="fraud">Lừa đảo / rủi ro</option><option value="abuse">Nội dung không phù hợp</option><option value="other">Lý do khác</option></select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)" rows={2} />
          {error && <p className="app-form__error" role="alert">{error}</p>}
          <div><button type="button" className="app-btn app-btn--ghost" onClick={() => setOpen(false)}>Hủy</button><button type="button" className="app-btn app-btn--primary" onClick={submit} disabled={state === 'saving'}>{state === 'saving' ? 'Đang gửi…' : 'Gửi báo cáo'}</button></div>
        </div>
      )}
    </div>
  )
}

export default function PostScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [post, setPost] = useState<CommunityPost | undefined>()
  const [comments, setComments] = useState<PostComment[]>([])
  const [liked, setLiked] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cBody, setCBody] = useState('')
  const [cName, setCName] = useState('')
  const [cError, setCError] = useState('')
  const [posting, setPosting] = useState(false)
  const login = '/dang-nhap?redirect=' + encodeURIComponent(location.pathname)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, c, likedIds] = await Promise.all([getPost(id), loadComments(id), user ? loadLikedPostIds(user.id) : Promise.resolve(new Set<string>())])
      setPost(p); setComments(c); setLiked(likedIds.has(id)); setLoadError('')
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Không thể tải bài viết.') } finally { setLoading(false) }
  }, [id, user])
  useEffect(() => { void reload() }, [reload])
  useEffect(() => { if (id) void incrementViews(id) }, [id])

  const like = async () => {
    if (!post) return
    if (!user) { navigate(login); return }
    if (likeBusy) return
    setLikeBusy(true)
    try {
      const now = await toggleLike(post.id, user.id, liked)
      setLiked(now)
      setPost((p) => (p ? { ...p, likes: now ? p.likes + 1 : Math.max(0, p.likes - 1) } : p))
    } catch { /* 다음 방문 때 다시 맞춰짐(웹과 같음) */ } finally { setLikeBusy(false) }
  }
  const comment = async (e: FormEvent) => {
    e.preventDefault()
    if (!post) return
    if (!user) { navigate(login); return }
    if (!cBody.trim()) { setCError('Vui lòng nhập nội dung bình luận.'); return }
    if (!cName.trim()) { setCError('Vui lòng nhập tên hiển thị.'); return }
    setPosting(true)
    try {
      const c = await addComment(post.id, cBody.trim(), user.id, cName.trim())
      setComments((prev) => [...prev, c])
      setPost((p) => (p ? { ...p, commentsCount: p.commentsCount + 1 } : p))
      setCBody(''); setCError('')
    } catch (err) { setCError(err instanceof Error ? err.message : 'Không thể đăng bình luận.') } finally { setPosting(false) }
  }

  const bar = <header className="app-pagebar"><button type="button" className="app-icon-btn" aria-label="Quay lại" onClick={() => navigate(-1)}><ChevronLeft size={24} aria-hidden /></button><h1 className="app-pagebar__title">Bài viết</h1></header>
  if (loading) return <div className="app-page">{bar}<p className="app-state" role="status">Đang tải…</p></div>
  if (loadError || !post) return <div className="app-page">{bar}<p className="app-state" role="alert">{loadError || 'Không tìm thấy bài viết.'}</p><Link to="/cong-dong" className="app-more">Về Cộng đồng</Link></div>
  const meta = POST_CATEGORY_META[post.category]

  return (
    <div className="app-page" data-testid="app-post">
      {bar}
      <article className="app-com__article">
        <span className={'app-com__badge app-com__badge--' + post.category}>{meta.label}</span>
        <h2>{post.title}</h2>
        <p className="app-com__meta2">
          {post.rating !== undefined && <span className="app-com__rating" aria-label={`${post.rating}/5 sao`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={15} aria-hidden className={post.rating! >= n ? 'app-on' : ''} />)} {post.rating}/5</span>}
          {post.company && <span>🏢 {post.company}</span>}
          {post.jobCategory && CATEGORY_LABELS[post.jobCategory as JobCategory] && <span>{CATEGORY_LABELS[post.jobCategory as JobCategory]}</span>}
          <span>{post.authorName} · {timeAgo(post.createdAt)}</span><span><Eye size={13} aria-hidden /> {post.views}</span>
        </p>
        {post.photoUrls.length > 0 && <div className="app-com__gallery">{post.photoUrls.map((u) => <img key={u} src={u} alt="" loading="lazy" />)}</div>}
        <div className="app-com__body">{post.body.split('\n').map((l, i) => (l.trim() === '' ? <br key={i} /> : <p key={i}>{l}</p>))}</div>
        <div className="app-com__actions">
          <button type="button" className={'app-btn' + (liked ? ' app-btn--primary' : '')} aria-pressed={liked} onClick={like} disabled={likeBusy}><Heart size={16} aria-hidden />{liked ? 'Đã thích' : 'Thích'} · {post.likes}</button>
          <ReportBox post={post} userId={user?.id} />
        </div>
      </article>
      <section className="app-com__comments" aria-label="Bình luận">
        <h2>Bình luận ({comments.length})</h2>
        {comments.length === 0 ? <p className="app-state">Chưa có bình luận. Hãy là người đầu tiên!</p>
          : <ul>{comments.map((c) => <li key={c.id}><div><strong>{c.authorName}</strong><small>{timeAgo(c.createdAt)}</small></div><p>{c.body}</p></li>)}</ul>}
        {user ? (
          <form className="app-form app-form--inline" onSubmit={comment} noValidate>
            <label className="app-field"><span>Tên hiển thị</span><input value={cName} maxLength={40} placeholder="Tên hoặc biệt danh" onChange={(e) => setCName(e.target.value)} /></label>
            <label className="app-field"><span>Nội dung</span><textarea rows={3} value={cBody} placeholder="Chia sẻ ý kiến của bạn..." onChange={(e) => setCBody(e.target.value)} /></label>
            {cError && <p className="app-form__error" role="alert">{cError}</p>}
            <button type="submit" className="app-btn app-btn--primary" disabled={posting}>{posting ? 'Đang đăng…' : 'Đăng bình luận'}</button>
          </form>
        ) : <p className="app-menu__login"><span>Đăng nhập để bình luận.</span> <Link className="app-btn app-btn--primary" to={login}>Đăng nhập</Link></p>}
      </section>
    </div>
  )
}
