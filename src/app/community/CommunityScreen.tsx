import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Heart, Image as ImageIcon, MessageSquare, Pencil, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { POST_CATEGORY_META, loadPosts, type CommunityPost } from '../../lib/communityStorage'
import { filterPosts, timeAgo, type CommunityCatFilter, type CommunitySort } from './communityView'

const PostComposer = lazy(() => import('./PostComposer')) // 글쓰기 시트는 열 때 처음 불러온다

const CATS: { value: CommunityCatFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'review', label: 'Đánh giá' },
  { value: 'tip', label: 'Mẹo hay' },
  { value: 'question', label: 'Hỏi đáp' },
]

// 커뮤니티 목록 — 웹 /cong-dong과 같은 자료(lib/communityStorage.loadPosts)·같은 분류·검색·정렬(communityView.filterPosts).
export default function CommunityScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cat, setCat] = useState<CommunityCatFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CommunitySort>('new')
  const [composing, setComposing] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try { setPosts(await loadPosts()); setLoadError('') } catch (e) { setLoadError(e instanceof Error ? e.message : 'Không thể tải bài viết.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const shown = useMemo(() => filterPosts(posts, cat, search, sort), [posts, cat, search, sort])
  const write = () => { if (!user) { navigate('/dang-nhap?redirect=' + encodeURIComponent('/cong-dong')); return } setComposing(true) }

  return (
    <div className="app-page" data-testid="app-community">
      <header className="app-pagebar"><h1 className="app-pagebar__title">Cộng đồng</h1><button type="button" className="app-btn app-btn--primary app-com__write" onClick={write}><Pencil size={16} aria-hidden />Đăng bài</button></header>
      <div className="app-com__top">
        <label className="app-com__search"><Search size={18} aria-hidden /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bài viết..." aria-label="Tìm bài viết" /></label>
        <select className="app-com__sort" aria-label="Sắp xếp" value={sort} onChange={(e) => setSort(e.target.value as CommunitySort)}><option value="new">Mới nhất</option><option value="popular">Phổ biến</option></select>
      </div>
      <div className="app-chip-row app-com__cats" role="group" aria-label="Phân loại">
        {CATS.map((c) => <button key={c.value} type="button" className={'app-chip' + (cat === c.value ? ' app-on' : '')} aria-pressed={cat === c.value} onClick={() => setCat(c.value)}>{c.label}</button>)}
      </div>
      {loading ? <p className="app-state" role="status">Đang tải bài viết…</p>
        : loadError ? <p className="app-state" role="alert">{loadError}</p>
        : shown.length === 0 ? <p className="app-state">Không tìm thấy bài viết nào.</p>
        : (
          <ul className="app-com__list">
            {shown.map((p) => {
              const meta = POST_CATEGORY_META[p.category]
              return (
                <li key={p.id}><Link className="app-com__post" to={`/cong-dong/${p.id}`} data-testid="app-com-post">
                  <span className={'app-com__badge app-com__badge--' + p.category}>{meta.label}</span>
                  <strong>{p.title}</strong>
                  <span className="app-com__snippet">{p.body}</span>
                  <small className="app-com__meta"><span>{p.authorName} · {timeAgo(p.createdAt)}</span>
                    {p.rating !== undefined && <span>★{p.rating}</span>}
                    {p.photoUrls.length > 0 && <ImageIcon size={13} aria-label="Có ảnh" />}
                    <span><Eye size={13} aria-hidden /> {p.views}</span><span><Heart size={13} aria-hidden /> {p.likes}</span><span><MessageSquare size={13} aria-hidden /> {p.commentsCount}</span></small>
                </Link></li>
              )
            })}
          </ul>
        )}
      {composing && user && <Suspense fallback={null}><PostComposer userId={user.id} onClose={() => setComposing(false)} onCreated={() => { void reload() }} /></Suspense>}
    </div>
  )
}
