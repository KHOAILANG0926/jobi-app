import { supabase } from './supabase'

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
