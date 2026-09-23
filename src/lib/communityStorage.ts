import { supabase } from './supabase'

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
  authorId: string
  jobCategory?: string
  company?: string
  rating?: number
  photoUrls: string[]
  likes: number
  commentsCount: number
  views: number
  createdAt: string
}

const PHOTO_BUCKET = 'community-photos'
const PHOTO_MAX_BYTES = 8 * 1024 * 1024
const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

interface PostRow {
  id: string
  author_id: string
  author_name: string
  category: PostCategory
  title: string
  body: string
  job_category: string | null
  company: string | null
  rating: number | null
  photo_paths: string[]
  likes_count: number
  comments_count: number
  views_count: number
  created_at: string
}

interface CommentRow {
  id: string
  body: string
  author_name: string
  created_at: string
}

function photoUrl(path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

function fromRow(row: PostRow): CommunityPost {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    authorName: row.author_name,
    authorId: row.author_id,
    jobCategory: row.job_category ?? undefined,
    company: row.company ?? undefined,
    rating: row.rating ?? undefined,
    photoUrls: (row.photo_paths ?? []).map(photoUrl),
    likes: row.likes_count,
    commentsCount: row.comments_count,
    views: row.views_count,
    createdAt: row.created_at,
  }
}

export async function loadPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<PostRow[]>()
  if (error) throw new Error(error.message)
  return (data ?? []).map(fromRow)
}

export async function getPost(id: string): Promise<CommunityPost | undefined> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle<PostRow>()
  if (error) throw new Error(error.message)
  return data ? fromRow(data) : undefined
}

export async function loadComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('id,body,author_name,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .returns<CommentRow[]>()
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    authorName: c.author_name,
    createdAt: c.created_at,
  }))
}

async function uploadPostPhotos(userId: string, mediaId: string, files: File[]): Promise<string[]> {
  const paths: string[] = []
  for (const [index, file] of files.entries()) {
    const extension = PHOTO_EXTENSIONS[file.type]
    if (!extension) throw new Error(`Định dạng ảnh không hỗ trợ: ${file.type}`)
    if (file.size > PHOTO_MAX_BYTES) throw new Error('Mỗi ảnh tối đa 8MB.')
    const path = `${userId}/${mediaId}/${index}.${extension}`
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      contentType: file.type,
    })
    if (error) throw new Error(error.message)
    paths.push(path)
  }
  return paths
}

export async function addPost(
  draft: {
    category: PostCategory
    title: string
    body: string
    authorName: string
    jobCategory?: string
    company?: string
    rating?: number
  },
  authorId: string,
  photoFiles: File[],
): Promise<CommunityPost> {
  const mediaId = crypto.randomUUID()
  const photoPaths = photoFiles.length ? await uploadPostPhotos(authorId, mediaId, photoFiles) : []

  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: authorId,
      author_name: draft.authorName,
      category: draft.category,
      title: draft.title,
      body: draft.body,
      job_category: draft.jobCategory ?? null,
      company: draft.company ?? null,
      rating: draft.rating ?? null,
      photo_paths: photoPaths,
    })
    .select('*')
    .single<PostRow>()

  if (error) throw new Error(error.message)
  return fromRow(data)
}

export async function addComment(
  postId: string,
  body: string,
  authorId: string,
  authorName: string,
): Promise<PostComment> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, author_id: authorId, author_name: authorName, body })
    .select('id,body,author_name,created_at')
    .single<CommentRow>()
  if (error) throw new Error(error.message)
  return { id: data.id, body: data.body, authorName: data.author_name, createdAt: data.created_at }
}

export async function loadLikedPostIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('community_likes')
    .select('post_id')
    .eq('user_id', userId)
    .returns<{ post_id: string }[]>()
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.post_id))
}

export async function incrementViews(postId: string): Promise<void> {
  await supabase.rpc('community_increment_views', { p_post_id: postId })
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('community_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return false
  }
  const { error } = await supabase
    .from('community_likes')
    .insert({ post_id: postId, user_id: userId })
  if (error) throw new Error(error.message)
  return true
}
