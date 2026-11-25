import { filterPosts, timeAgo } from './communityView.ts'
import type { CommunityPost } from '../../lib/communityStorage.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }
const mk = (id: string, category: CommunityPost['category'], title: string, likes: number, createdAt: string, extra: Partial<CommunityPost> = {}): CommunityPost => ({
  id, category, title, body: 'nội dung ' + id, authorName: 'Lan', authorId: 'u', photoUrls: [], likes, commentsCount: 0, views: 0, createdAt, ...extra,
})
const posts = [
  mk('1', 'review', 'Quán cà phê A', 5, '2026-11-01T00:00:00Z'),
  mk('2', 'tip', 'Mẹo phỏng vấn', 9, '2026-11-03T00:00:00Z'),
  mk('3', 'question', 'Hỏi về lương', 1, '2026-11-02T00:00:00Z', { authorName: 'Minh' }),
]
assert(filterPosts(posts, 'all', '', 'new').map((p) => p.id).join() === '2,3,1', '최신순')
assert(filterPosts(posts, 'all', '', 'popular').map((p) => p.id).join() === '2,1,3', '좋아요순')
assert(filterPosts(posts, 'tip', '', 'new').length === 1, '분류')
assert(filterPosts(posts, 'all', 'MINH', 'new').map((p) => p.id).join() === '3', '작성자 검색(대소문자 무시)')
assert(filterPosts(posts, 'all', 'phỏng vấn', 'new').length === 1, '제목 검색')
assert(filterPosts(posts, 'review', 'lương', 'new').length === 0, '분류+검색 교집합')
const now = Date.parse('2026-11-10T12:00:00Z')
assert(timeAgo('2026-11-10T11:59:50Z', now) === 'Vừa xong', '방금')
assert(timeAgo('2026-11-10T11:30:00Z', now) === '30 phút trước', '분')
assert(timeAgo('2026-11-10T09:00:00Z', now) === '3 giờ trước', '시간')
assert(timeAgo('2026-11-08T12:00:00Z', now) === '2 ngày trước', '일')
console.log('app communityView: 분류·검색·정렬·상대 시간 통과')
