import { supabase } from './supabase'
import type { BrandCategoryId } from '../data/brandDirectory'

export type JobOrigin = 'crawler' | 'employer' | 'admin' | 'legacy'
export type AccountStatus = 'active' | 'suspended'
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'
export type ReportTargetType = 'job' | 'user' | 'community_post'

export interface AdminJob {
  id: number
  title: string
  company: string
  origin: JobOrigin
  active: boolean
  admin_hidden: boolean
  employer_id: string | null
  created_at: string
}

export interface AdminUser {
  user_id: string
  role: 'seeker' | 'employer' | null
  status: AccountStatus
  joined_at: string
  display_name: string
  job_count: number
  application_count: number
}

export interface UserReport {
  id: string
  reporter_id: string
  target_type: ReportTargetType
  target_id: string
  category: string
  description: string
  snapshot: Record<string, unknown>
  status: ReportStatus
  created_at: string
  handled_at: string | null
}

export interface AuditLog {
  id: number
  admin_user_id: string
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, unknown>
  created_at: string
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('Không nhận được dữ liệu từ máy chủ.')
  return data
}

export async function listAdminJobs(): Promise<AdminJob[]> {
  const { data, error } = await supabase
    .from('local_jobs')
    .select('id,title,company,origin,active,admin_hidden,employer_id,created_at')
    .order('created_at', { ascending: false })
  return unwrap((data ?? []) as AdminJob[], error)
}

export async function setJobHidden(jobId: number, hidden: boolean, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_set_job_hidden', {
    target_job_id: jobId,
    hidden,
    reason,
  })
  if (error) throw new Error(error.message)
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  return unwrap((data ?? []) as AdminUser[], error)
}

export async function setAccountStatus(userId: string, status: AccountStatus, reason = ''): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Phiên đăng nhập quản trị đã hết hạn.')
  const response = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, status, reason }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Không thể cập nhật trạng thái tài khoản.')
}

export async function createReport(input: {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  category: string
  description: string
  snapshot: Record<string, unknown>
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    category: input.category,
    description: input.description,
    snapshot: input.snapshot,
  })
  if (error) throw new Error(error.message)
}

export async function getOwnReportStatus(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
): Promise<ReportStatus | null> {
  const { data, error } = await supabase.from('reports').select('status')
    .eq('reporter_id', reporterId).eq('target_type', targetType).eq('target_id', targetId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.status as ReportStatus | undefined) ?? null
}

export async function listReports(): Promise<UserReport[]> {
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
  return unwrap((data ?? []) as UserReport[], error)
}

export async function handleReport(reportId: string, status: Exclude<ReportStatus, 'pending'>): Promise<void> {
  const { error } = await supabase.rpc('admin_handle_report', {
    target_report_id: reportId,
    next_status: status,
    note: '',
  })
  if (error) throw new Error(error.message)
}

export async function listAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return unwrap((data ?? []) as AuditLog[], error)
}

export interface AdminBrandAlias {
  alias: string
  isPrimary: boolean
}

export interface AdminBrand {
  id: number
  name: string
  slug: string
  category: BrandCategoryId
  domain: string | null
  initial: string
  color: string
  active: boolean
  featured: boolean
  aliases: AdminBrandAlias[]
}

/** 관리자 화면 전용 — is_admin() SELECT 정책 덕분에 active=false 브랜드도
 *  보인다(공개 useBrands()는 active=true만 본다). */
export async function listAdminBrands(): Promise<AdminBrand[]> {
  const { data: brandRows, error } = await supabase
    .from('job_brands')
    .select('id,name,slug,category,domain,initial,color,active,featured')
    .order('name', { ascending: true })
  const brands = unwrap((brandRows ?? []) as Omit<AdminBrand, 'aliases'>[], error)
  if (brands.length === 0) return []
  const { data: aliasRows } = await supabase
    .from('job_brand_aliases')
    .select('brand_id,alias,is_primary')
    .in('brand_id', brands.map((b) => b.id))
  const aliasesByBrand = new Map<number, AdminBrandAlias[]>()
  for (const a of aliasRows ?? []) {
    const brandId = a.brand_id as number
    const list = aliasesByBrand.get(brandId) ?? []
    list.push({ alias: a.alias as string, isPrimary: (a.is_primary as boolean) ?? false })
    aliasesByBrand.set(brandId, list)
  }
  return brands.map((b) => ({ ...b, aliases: aliasesByBrand.get(b.id) ?? [] }))
}

/** 브랜드 생성/수정을 admin_upsert_brand RPC로 위임 — 별칭 목록은 전체
 *  교체(작은 브랜드당 몇 개뿐이라 부분 편집보다 단순함). p_id가 없으면 생성.
 *  clearCandidateKeys를 넘기면 해당 후보 무시 기록도 함께 정리된다(승인
 *  플로우에서 사용). */
export async function upsertBrand(input: {
  id?: number
  name: string
  slug: string
  category: BrandCategoryId
  domain?: string
  initial: string
  color: string
  active: boolean
  featured: boolean
  aliases: string[]
  clearCandidateKeys?: string[]
}): Promise<AdminBrand> {
  const { data, error } = await supabase.rpc('admin_upsert_brand', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_slug: input.slug,
    p_category: input.category,
    p_domain: input.domain ?? '',
    p_initial: input.initial,
    p_color: input.color,
    p_active: input.active,
    p_featured: input.featured,
    p_aliases: input.aliases,
    p_clear_candidate_keys: input.clearCandidateKeys ?? null,
  })
  if (error) throw new Error(error.message)
  const row = data as { id: number; name: string; slug: string; category: BrandCategoryId; domain: string | null; initial: string; color: string; active: boolean; featured: boolean }
  return { ...row, aliases: input.aliases.map((alias, i) => ({ alias, isPrimary: i === 0 })) }
}

/** 브랜드 후보 무시 상태(company_key만) — 후보 자체는 local_jobs에서 매번
 *  다시 계산되는 파생 데이터라 서버에 저장하지 않는다(src/lib/brandCandidates.ts). */
export async function listDismissedBrandCandidateKeys(): Promise<Set<string>> {
  const { data, error } = await supabase.from('job_brand_candidate_dismissals').select('company_key')
  const rows = unwrap((data ?? []) as { company_key: string }[], error)
  return new Set(rows.map((r) => r.company_key))
}

export async function dismissBrandCandidate(companyKey: string, note = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_dismiss_brand_candidate', {
    p_company_key: companyKey,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}
