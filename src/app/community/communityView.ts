// 커뮤니티 화면 공통: 상대 시간·목록 거르기/정렬(순수 함수, 시험 대상). 글·댓글 자료 모양은 웹과 같은 lib/communityStorage.
import type { CommunityPost, PostCategory } from '../../lib/communityStorage'

export type CommunityCatFilter = PostCategory | 'all'
export type CommunitySort = 'new' | 'popular'

export function timeAgo(iso: string, now = Date.now()): string {
  const m = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

/** 웹 커뮤니티 목록과 같은 기준: 분류 → 제목·본문·작성자 검색 → 최신순 또는 좋아요순. */
export function filterPosts(posts: CommunityPost[], cat: CommunityCatFilter, search: string, sort: CommunitySort): CommunityPost[] {
  const q = search.trim().toLowerCase()
  return posts
    .filter((p) => cat === 'all' || p.category === cat)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q))
    .sort((a, b) => (sort === 'popular' ? b.likes - a.likes : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
}
