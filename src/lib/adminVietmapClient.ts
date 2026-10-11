import { supabase } from './supabase'

// 관리자 화면에서 /api/admin-vietmap(관리자 전용 서버 프록시)을 부르는 얇은 클라이언트.
// VietMap 키는 브라우저에 없다 — 서버가 Vercel 환경변수로 호출하고 하루 250회를 센다.

export class VietmapRequestError extends Error {
  readonly used: number | null
  readonly limit: number | null
  readonly day: string | null
  constructor(
    message: string,
    used: number | null = null,
    limit: number | null = null,
    day: string | null = null,
  ) {
    super(message)
    this.name = 'VietmapRequestError'
    this.used = used
    this.limit = limit
    this.day = day
  }
}

export class DailyLimitError extends VietmapRequestError {
  override readonly used: number
  override readonly limit: number
  constructor(used: number, limit: number, day: string | null = null) {
    super('daily_limit', used, limit, day)
    this.name = 'DailyLimitError'
    this.used = used
    this.limit = limit
  }
}

export interface VietmapReply { data: unknown; used: number; limit: number; day?: string }

export type VietmapRequest =
  | { action: 'search'; text: string; focus?: { lat: number; lng: number } | null; any?: boolean }
  | { action: 'place'; refId: string }
  | { action: 'usage' }

const ERROR_TEXT: Record<string, string> = {
  not_configured: 'Máy chủ chưa cấu hình VIETMAP_SERVICE_KEY.',
  usage_counter_unavailable: 'Chưa có bộ đếm lượt gọi hằng ngày (cần áp dụng DDL research_store) — không gọi VietMap.',
}

export async function callAdminVietmap(body: VietmapRequest): Promise<VietmapReply> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Phiên đăng nhập quản trị đã hết hạn.')
  const res = await fetch('/api/admin-vietmap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; used?: number; limit?: number; day?: string; data?: unknown }
  const used = typeof json.used === 'number' ? json.used : null
  const limit = typeof json.limit === 'number' ? json.limit : null
  const day = typeof json.day === 'string' ? json.day : null
  if (res.status === 429) throw new DailyLimitError(used ?? 0, limit ?? 250, day)
  if (!res.ok) {
    const message = ERROR_TEXT[json.error ?? ''] ?? `Lỗi máy chủ VietMap (${res.status}${json.error ? `: ${json.error}` : ''}).`
    throw new VietmapRequestError(message, used, limit, day)
  }
  return { data: json.data ?? null, used: used ?? 0, limit: limit ?? 250, ...(day ? { day } : {}) }
}
