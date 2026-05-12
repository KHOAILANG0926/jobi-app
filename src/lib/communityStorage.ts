export type PostCategory = 'review' | 'tip' | 'question'

export const POST_CATEGORY_META: Record<
  PostCategory,
  { label: string; icon: string; colorClass: string }
> = {
  review: { label: 'Đánh giá', icon: '⭐', colorClass: 'post-cat--review' },
  tip: { label: 'Mẹo hay', icon: '💡', colorClass: 'post-cat--tip' },
  question: { label: 'Hỏi đáp', icon: '❓', colorClass: 'post-cat--question' },
}

export interface PostComment {
  id: string
  body: string
  authorName: string
  createdAt: string
}

export interface CommunityPost {
  id: string
  category: PostCategory
  title: string
  body: string
  authorName: string
  jobCategory?: string
  company?: string
  rating?: number
  likes: number
  createdAt: string
  comments: PostComment[]
}

const KEY = 'jobi_community_posts'
const LIKED_KEY = 'jobi_community_liked'

const SEED: CommunityPost[] = [
  {
    id: 'seed-1',
    category: 'review',
    title: 'Làm kho Bình Dương 3 tháng — thực lòng',
    body: 'Mình làm ở kho logistics Bình Dương được 3 tháng. Công việc đứng liên tục 8–10 tiếng, khá mệt. Nhưng lương đúng hẹn, quản lý không quá khắt khe. Có xe đưa đón từ bến xe Miền Đông, tiết kiệm được kha khá chi phí đi lại.\n\nĐiểm trừ: giờ tăng ca thất thường, khó sắp xếp lịch học. Nếu bạn rảnh toàn thời gian thì ổn, còn sinh viên thì cân nhắc.',
    authorName: 'Minh Tuấn',
    jobCategory: 'factory',
    company: 'Kho logistics Bình Dương',
    rating: 3,
    likes: 24,
    createdAt: '2026-05-10T08:30:00.000Z',
    comments: [
      {
        id: 'c1',
        body: 'Cảm ơn bạn đã chia sẻ! Mình đang cân nhắc chỗ này.',
        authorName: 'Lan Anh',
        createdAt: '2026-05-10T10:00:00.000Z',
      },
      {
        id: 'c2',
        body: 'Có yêu cầu kinh nghiệm không bạn? Mình mới ra trường.',
        authorName: 'Trung Kiên',
        createdAt: '2026-05-10T14:22:00.000Z',
      },
    ],
  },
  {
    id: 'seed-2',
    category: 'tip',
    title: 'Mẹo thương lượng lương khi phỏng vấn part-time',
    body: '1. Nghiên cứu mức lương thị trường trước (Jobi có trang tính lương nha).\n2. Đừng nói số đầu tiên — hỏi lại "Mức lương cho vị trí này là bao nhiêu?"\n3. Nếu bị ép thấp, đề xuất thêm quyền lợi: ăn ca, thưởng KPI, phụ cấp xăng...\n4. Không nhận việc ngay tại chỗ, xin 1–2 ngày suy nghĩ để tránh bị áp lực.\n5. Lần phỏng vấn đầu tiên hãy hỏi luôn về lịch thanh toán lương — tránh nơi trả chậm.',
    authorName: 'Thu Hà',
    likes: 57,
    createdAt: '2026-05-08T14:00:00.000Z',
    comments: [
      {
        id: 'c3',
        body: 'Tip số 2 hay quá, để mình thử xem!',
        authorName: 'Văn Đức',
        createdAt: '2026-05-09T09:15:00.000Z',
      },
    ],
  },
  {
    id: 'seed-3',
    category: 'review',
    title: 'Phục vụ Highlands Coffee cuối tuần — chill lắm',
    body: 'Làm 2 ca cuối tuần, mỗi ca 8 tiếng. Quản lý dễ chịu, khách không quá khó tính. Lương 25k/h chưa tính tip, cuối ca thường được thêm 50–100k. Đồng phục có sẵn, được ăn ca.\n\nMôi trường trẻ, nhiều bạn sinh viên như mình nên vui lắm. Recommend cho ai muốn kiếm thêm cuối tuần mà không muốn quá mệt.',
    authorName: 'Ngọc Bích',
    jobCategory: 'cafe',
    company: 'Highlands Coffee',
    rating: 4,
    likes: 41,
    createdAt: '2026-05-07T09:15:00.000Z',
    comments: [],
  },
  {
    id: 'seed-4',
    category: 'question',
    title: 'Shipper GrabFood có cần bằng lái xe không?',
    body: 'Mình mới 18 tuổi, có xe máy nhưng chưa có bằng A1. Nghe nói Grab yêu cầu bằng lái — vậy có cách nào đăng ký không hay phải đợi thi bằng?',
    authorName: 'Quang Hùng',
    jobCategory: 'delivery',
    likes: 12,
    createdAt: '2026-05-09T11:00:00.000Z',
    comments: [
      {
        id: 'c4',
        body: 'Grab yêu cầu bằng A1 hoặc B1 bạn ơi, không có bằng sẽ không được duyệt tài khoản đâu.',
        authorName: 'Tài xế Grab 3 năm',
        createdAt: '2026-05-09T12:30:00.000Z',
      },
      {
        id: 'c5',
        body: 'Bạn thử Be hoặc ShopeeFood xem, nghe họ linh hoạt hơn một chút với tài xế mới.',
        authorName: 'Mai Linh',
        createdAt: '2026-05-09T15:45:00.000Z',
      },
    ],
  },
  {
    id: 'seed-5',
    category: 'tip',
    title: 'Cách xin nghỉ không ảnh hưởng uy tín khi làm part-time',
    body: 'Nhiều bạn ngại xin nghỉ vì sợ mất việc. Đây là cách mình hay làm:\n\n• Báo trước ít nhất 24h, không "báo ca" (báo sát giờ)\n• Đề xuất người thay ca nếu có thể — điểm cộng rất lớn\n• Xin lỗi ngắn gọn, không cần giải thích dài dòng\n• Lần tiếp theo cố gắng gấp đôi để bù lại\n\nNhà tuyển dụng hiểu sinh viên có việc riêng, chỉ cần thông báo kịp thời là ổn.',
    authorName: 'Kiều Trang',
    likes: 33,
    createdAt: '2026-05-06T16:00:00.000Z',
    comments: [],
  },
  {
    id: 'seed-6',
    category: 'review',
    title: 'Shipper GrabFood 2 tháng — lời thật lỗ thật',
    body: 'Thu nhập: khoảng 200–280k/ngày nếu chạy 6–7 tiếng. Nghe to nhưng trừ xăng (~60k), khấu hao xe, đồ ăn thì còn lại ~150k. Không tệ nếu bạn chạy xe sẵn rồi.\n\nNhưng nắng mưa rất cực, đặc biệt giờ cao điểm tắc đường mà app vẫn tính thời gian. Tháng đầu mình bị phạt hủy đơn vài lần do không hiểu luật.',
    authorName: 'Đức Anh',
    jobCategory: 'delivery',
    company: 'GrabFood',
    rating: 3,
    likes: 68,
    createdAt: '2026-05-05T07:00:00.000Z',
    comments: [
      {
        id: 'c6',
        body: 'Trời ơi 150k/ngày sau khi trừ chi phí thì không đáng chút nào.',
        authorName: 'Hữu Phúc',
        createdAt: '2026-05-05T10:00:00.000Z',
      },
    ],
  },
]

function initPosts(): CommunityPost[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED))
      return SEED
    }
    const parsed = JSON.parse(raw) as CommunityPost[]
    return Array.isArray(parsed) ? parsed : SEED
  } catch {
    return SEED
  }
}

export function loadPosts(): CommunityPost[] {
  return initPosts()
}

export function getPost(id: string): CommunityPost | undefined {
  return loadPosts().find((p) => p.id === id)
}

function persistPosts(list: CommunityPost[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('jobi:community'))
}

export function addPost(
  draft: Omit<CommunityPost, 'id' | 'likes' | 'createdAt' | 'comments'>,
): CommunityPost {
  const post: CommunityPost = {
    ...draft,
    id: `post-${crypto.randomUUID()}`,
    likes: 0,
    createdAt: new Date().toISOString(),
    comments: [],
  }
  persistPosts([post, ...loadPosts()])
  return post
}

export function addComment(postId: string, body: string, authorName: string): void {
  const list = loadPosts()
  const idx = list.findIndex((p) => p.id === postId)
  if (idx === -1) return
  const comment: PostComment = {
    id: `c-${crypto.randomUUID()}`,
    body,
    authorName,
    createdAt: new Date().toISOString(),
  }
  list[idx] = { ...list[idx], comments: [...list[idx].comments, comment] }
  persistPosts(list)
}

function loadLikedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function isLiked(postId: string): boolean {
  return loadLikedSet().has(postId)
}

export function toggleLike(postId: string): boolean {
  const liked = loadLikedSet()
  const list = loadPosts()
  const idx = list.findIndex((p) => p.id === postId)
  if (idx === -1) return false

  if (liked.has(postId)) {
    liked.delete(postId)
    list[idx] = { ...list[idx], likes: Math.max(0, list[idx].likes - 1) }
    localStorage.setItem(LIKED_KEY, JSON.stringify([...liked]))
    persistPosts(list)
    return false
  } else {
    liked.add(postId)
    list[idx] = { ...list[idx], likes: list[idx].likes + 1 }
    localStorage.setItem(LIKED_KEY, JSON.stringify([...liked]))
    persistPosts(list)
    return true
  }
}
