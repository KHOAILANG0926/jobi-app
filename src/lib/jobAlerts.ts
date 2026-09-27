import type { JobCategory } from '../types/job'
import { supabase } from './supabase'

/**
 * 구직 희망조건 저장 → 매칭 → 앱 내 알림 (1차, 2026-09-27).
 *
 * 판정 로직은 DB 함수 public.job_alert_evaluate() 한 곳에만 있다(supabase/
 * migrations/20260927090000_job_alerts.sql) — 화면(job_alert_match_jobs RPC)과
 * 알림 배치가 같은 판정을 쓰게 하기 위해서다. 이 파일은 서버 결과를 받아
 * 화면용으로 묶고(groupMatchResults), 0건일 때 원인을 진단하고
 * (diagnoseEmptyResult), 라벨을 붙이는 일만 한다 — 여기서 공고를 다시
 * 판정하거나 "정보 미확인"을 충족으로 추정하지 않는다.
 *
 * 게스트/기존 localStorage 맞춤공고(recommendStorage.ts)는 그대로 둔다.
 */

export type Importance = 'required' | 'preferred'
export type CriterionKey = 'region' | 'category' | 'salary' | 'hours' | 'distance'
export type CriterionStatus = 'match' | 'mismatch' | 'unknown'
export type OverallStatus = 'match' | 'mismatch' | 'unknown'
export type SalaryPeriodPref = 'month' | 'day' | 'hour'

export const CRITERION_KEYS: CriterionKey[] = ['region', 'category', 'salary', 'hours', 'distance']

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  region: 'Khu vực',
  category: 'Ngành nghề',
  salary: 'Mức lương mong muốn',
  hours: 'Giờ làm việc',
  distance: 'Khoảng cách di chuyển',
}

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  required: 'Bắt buộc',
  preferred: 'Ưu tiên',
}

/** DB reason 코드 → 화면 문구. 코드 목록은 job_alert_evaluate()와 1:1. */
export const REASON_LABELS: Record<string, string> = {
  region_matched: 'Đúng khu vực',
  region_other: 'Khác khu vực',
  region_missing: 'Tin chưa ghi rõ khu vực',
  category_matched: 'Đúng ngành',
  category_other: 'Khác ngành',
  category_missing: 'Tin chưa được phân loại ngành',
  salary_meets: 'Lương đạt mức mong muốn',
  salary_below: 'Lương thấp hơn mức mong muốn',
  salary_negotiable: 'Lương thỏa thuận — chưa biết số tiền',
  salary_missing: 'Tin không ghi mức lương',
  salary_other_currency: 'Lương ghi bằng ngoại tệ — không quy đổi',
  salary_other_period: 'Lương tính theo đơn vị khác (tháng/ngày/giờ) — không quy đổi',
  salary_range_straddles: 'Khoảng lương bao quanh mức mong muốn — chưa chắc đạt',
  hours_within: 'Giờ làm nằm trong khung mong muốn',
  hours_outside: 'Giờ làm ngoài khung mong muốn',
  hours_rotating: 'Làm xoay ca',
  hours_rotating_accepted: 'Làm xoay ca (bạn chấp nhận)',
  hours_missing: 'Tin không ghi rõ giờ làm',
  distance_within: 'Trong phạm vi khoảng cách',
  distance_too_far: 'Xa hơn khoảng cách mong muốn',
  distance_home_missing: 'Chưa lưu vị trí của bạn',
  distance_job_coordinate_missing: 'Chưa xác minh được vị trí nơi làm việc',
}

export function reasonLabel(code: string | undefined): string {
  if (!code) return ''
  return REASON_LABELS[code] ?? code
}

export interface JobAlertPreference {
  id: string
  name: string
  status: 'active' | 'paused'
  regionIds: string[]
  regionImportance: Importance | null
  categories: JobCategory[]
  categoryImportance: Importance | null
  /** VND 정수. salaryPeriod와 짝. */
  salaryMin: number | null
  salaryPeriod: SalaryPeriodPref | null
  salaryImportance: Importance | null
  /** "HH:MM" */
  workStart: string | null
  workEnd: string | null
  acceptRotating: boolean
  hoursImportance: Importance | null
  maxDistanceKm: number | null
  distanceImportance: Importance | null
  createdAt: string
  updatedAt: string
}

export type JobAlertPreferenceInput = Omit<JobAlertPreference, 'id' | 'createdAt' | 'updatedAt'>

export interface CriterionResult {
  importance: Importance
  status: CriterionStatus
  reason: string
  km?: number
}

export interface EvaluationResult {
  overall: OverallStatus
  preferred_met: number
  preferred_total: number
  criteria: Partial<Record<CriterionKey, CriterionResult>>
}

export interface JobMatchRow {
  /** local_jobs.id (DB 숫자) */
  jobId: number
  result: EvaluationResult
}

export interface HomeLocation {
  lat: number
  lng: number
  consentedAt: string
}

export interface JobAlertNotificationRow {
  id: number
  preferenceId: string
  preferenceName: string
  jobId: number
  result: EvaluationResult
  createdAt: string
  readAt: string | null
}

export const MAX_PREFERENCES = 5

/**
 * 1차 배포(2026-09-27)에서는 이동거리 조건을 선택할 수 없게 한다 — 운영 공고 중
 * 거리 판정에 쓸 수 있는 좌표(exact, 또는 ward+원문검증)가 0건이라(활성 135건 중
 * 좌표 있는 75건은 전부 미검증 ward), 거리 조건은 항상 "정보 미확인"이 되어 매칭·
 * 알림이 절대 생기지 않는다. DB 스키마/판정 함수는 거리 조건을 그대로 지원하므로
 * 위치 데이터 보강(후속 작업) 후 이 값만 true로 바꾸면 된다. false인 동안은 집 위치
 * 동의/저장 UI도 노출하지 않는다(쓰지 않는 개인 위치를 수집하지 않기 위해).
 */
export const DISTANCE_MATCHING_ENABLED = false

export const DISTANCE_DISABLED_REASON =
  'Tạm thời chưa dùng được điều kiện khoảng cách: hiện chưa có tin tuyển dụng nào có vị trí nơi làm việc ' +
  'đã được xác minh, nên chưa thể tính khoảng cách từ nơi bạn ở. Điều kiện này sẽ được mở lại khi dữ liệu ' +
  'vị trí được bổ sung.'

export function emptyPreferenceInput(): JobAlertPreferenceInput {
  return {
    name: 'Điều kiện của tôi',
    status: 'active',
    regionIds: [],
    regionImportance: null,
    categories: [],
    categoryImportance: null,
    salaryMin: null,
    salaryPeriod: null,
    salaryImportance: null,
    workStart: null,
    workEnd: null,
    acceptRotating: false,
    hoursImportance: null,
    maxDistanceKm: null,
    distanceImportance: null,
  }
}

/** 화면 검증 — DB CHECK와 같은 규칙을 미리 알려주기 위한 것(최종 판단은 DB). */
export function validatePreferenceInput(p: JobAlertPreferenceInput, hasHome: boolean): string | null {
  const name = p.name.trim()
  if (name.length < 1 || name.length > 60) return 'Tên điều kiện cần từ 1 đến 60 ký tự.'
  if (p.regionImportance && p.regionIds.length === 0) return 'Hãy chọn ít nhất một khu vực.'
  if (p.categoryImportance && p.categories.length === 0) return 'Hãy chọn ít nhất một ngành nghề.'
  if (p.salaryImportance && (!p.salaryMin || p.salaryMin <= 0 || !p.salaryPeriod)) return 'Hãy nhập mức lương mong muốn.'
  if (p.hoursImportance && (!p.workStart || !p.workEnd)) return 'Hãy chọn giờ bắt đầu và kết thúc.'
  if (p.hoursImportance && p.workStart === p.workEnd) return 'Giờ bắt đầu và kết thúc không được trùng nhau.'
  if (p.distanceImportance) {
    if (!DISTANCE_MATCHING_ENABLED) return DISTANCE_DISABLED_REASON
    if (!hasHome) return 'Chưa có vị trí đã lưu — chưa thể dùng điều kiện khoảng cách.'
    if (!p.maxDistanceKm || p.maxDistanceKm < 0.5 || p.maxDistanceKm > 200) return 'Khoảng cách cần từ 0,5 đến 200 km.'
  }
  const importances = [p.regionImportance, p.categoryImportance, p.salaryImportance, p.hoursImportance, p.distanceImportance]
  if (!importances.includes('required')) return 'Cần ít nhất một điều kiện "Bắt buộc".'
  return null
}

// ---------------------------------------------------------------------------
// DB 매핑
// ---------------------------------------------------------------------------

type PrefRow = Record<string, unknown>

function hhmm(v: unknown): string | null {
  return typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : null
}

export function rowToPreference(r: PrefRow): JobAlertPreference {
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    status: r.status === 'paused' ? 'paused' : 'active',
    regionIds: (r.region_ids as string[]) ?? [],
    regionImportance: (r.region_importance as Importance | null) ?? null,
    categories: (r.categories as JobCategory[]) ?? [],
    categoryImportance: (r.category_importance as Importance | null) ?? null,
    salaryMin: (r.salary_min as number | null) ?? null,
    salaryPeriod: (r.salary_period as SalaryPeriodPref | null) ?? null,
    salaryImportance: (r.salary_importance as Importance | null) ?? null,
    workStart: hhmm(r.work_start),
    workEnd: hhmm(r.work_end),
    acceptRotating: r.accept_rotating === true,
    hoursImportance: (r.hours_importance as Importance | null) ?? null,
    maxDistanceKm: r.max_distance_km == null ? null : Number(r.max_distance_km),
    distanceImportance: (r.distance_importance as Importance | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

/** 사용 안 하는 조건은 값까지 비워서 보낸다(DB CHECK: importance null ⇔ 값 없음). */
export function preferenceToRow(p: JobAlertPreferenceInput): PrefRow {
  const useRegion = !!p.regionImportance
  const useCategory = !!p.categoryImportance
  const useSalary = !!p.salaryImportance
  const useHours = !!p.hoursImportance
  const useDistance = !!p.distanceImportance
  return {
    name: p.name.trim(),
    status: p.status,
    region_ids: useRegion ? p.regionIds : [],
    region_importance: useRegion ? p.regionImportance : null,
    categories: useCategory ? p.categories : [],
    category_importance: useCategory ? p.categoryImportance : null,
    salary_min: useSalary ? p.salaryMin : null,
    salary_period: useSalary ? p.salaryPeriod : null,
    salary_importance: useSalary ? p.salaryImportance : null,
    work_start: useHours ? p.workStart : null,
    work_end: useHours ? p.workEnd : null,
    accept_rotating: useHours ? p.acceptRotating : false,
    hours_importance: useHours ? p.hoursImportance : null,
    max_distance_km: useDistance ? p.maxDistanceKm : null,
    distance_importance: useDistance ? p.distanceImportance : null,
  }
}

/** DB 오류 코드를 사람이 읽을 문구로. */
export function describeSaveError(message: string | undefined): string {
  const m = message ?? ''
  if (m.includes('job_alert_limit_reached')) return `Bạn chỉ có thể lưu tối đa ${MAX_PREFERENCES} điều kiện.`
  if (m.includes('job_alert_home_location_required')) return 'Chưa có vị trí đã lưu — chưa thể dùng điều kiện khoảng cách.'
  if (m.includes('has_required')) return 'Cần ít nhất một điều kiện "Bắt buộc".'
  if (m.includes('row-level security') || m.includes('permission denied')) return 'Chỉ tài khoản người tìm việc mới lưu được điều kiện.'
  return 'Không lưu được điều kiện. Vui lòng thử lại.'
}

// ---------------------------------------------------------------------------
// Supabase 호출
// ---------------------------------------------------------------------------

export async function listPreferences(): Promise<JobAlertPreference[]> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToPreference)
}

export async function createPreference(input: JobAlertPreferenceInput): Promise<JobAlertPreference> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .insert(preferenceToRow(input))
    .select('*')
    .single()
  if (error) throw error
  return rowToPreference(data)
}

export async function updatePreference(id: string, input: JobAlertPreferenceInput): Promise<JobAlertPreference> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .update(preferenceToRow(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return rowToPreference(data)
}

export async function setPreferenceStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  const { error } = await supabase.from('job_alert_preferences').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deletePreference(id: string): Promise<void> {
  const { error } = await supabase.from('job_alert_preferences').delete().eq('id', id)
  if (error) throw error
}

export async function fetchMatches(preferenceId: string): Promise<JobMatchRow[]> {
  const { data, error } = await supabase.rpc('job_alert_match_jobs', { p_preference_id: preferenceId })
  if (error) throw error
  return ((data ?? []) as { job_id: number; result: EvaluationResult }[]).map((r) => ({
    jobId: Number(r.job_id),
    result: r.result,
  }))
}

export async function loadHomeLocation(): Promise<HomeLocation | null> {
  const { data, error } = await supabase
    .from('job_alert_home_locations')
    .select('lat,lng,consented_at')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { lat: Number(data.lat), lng: Number(data.lng), consentedAt: data.consented_at as string }
}

/** 소수점 3자리(약 100m)로 낮춘다. DB 컬럼 타입도 같은 자릿수로 강제한다. */
export function coarsenCoordinate(v: number): number {
  return Math.round(v * 1000) / 1000
}

/**
 * 동의한 경우에만 호출한다. 원문 주소는 받지도 보내지도 않는다 — 좌표만.
 * seeker_id는 DB default(auth.uid())가 채운다.
 */
export async function saveHomeLocation(lat: number, lng: number): Promise<HomeLocation> {
  const row = { lat: coarsenCoordinate(lat), lng: coarsenCoordinate(lng), consented_at: new Date().toISOString() }
  const existing = await loadHomeLocation()
  const query = existing
    ? supabase.from('job_alert_home_locations').update(row).not('seeker_id', 'is', null)
    : supabase.from('job_alert_home_locations').insert(row)
  const { data, error } = await query.select('lat,lng,consented_at').single()
  if (error) throw error
  return { lat: Number(data.lat), lng: Number(data.lng), consentedAt: data.consented_at as string }
}

/** 동의 철회 — 저장된 좌표 삭제. */
export async function deleteHomeLocation(): Promise<void> {
  const { error } = await supabase.from('job_alert_home_locations').delete().not('seeker_id', 'is', null)
  if (error) throw error
}

export async function listAlertNotifications(): Promise<JobAlertNotificationRow[]> {
  const { data, error } = await supabase
    .from('job_alert_notifications')
    .select('id,preference_id,job_id,result,created_at,read_at,job_alert_preferences(name)')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    preferenceId: r.preference_id as string,
    preferenceName: ((r.job_alert_preferences as { name?: string } | null)?.name) ?? '',
    jobId: Number(r.job_id),
    result: r.result as EvaluationResult,
    createdAt: r.created_at as string,
    readAt: (r.read_at as string | null) ?? null,
  }))
}

export async function markAlertNotificationsRead(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('job_alert_notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null)
  if (error) throw error
}

/** "지우기"는 숨김 처리 — 행을 지우지 않아 같은 공고가 다시 알림되지 않는다. */
export async function dismissAlertNotifications(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('job_alert_notifications')
    .update({ dismissed_at: now })
    .in('id', ids)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// 화면용 묶기 + 0건 진단 (순수 함수 — jobAlerts.test.ts)
// ---------------------------------------------------------------------------

export interface GroupedMatches {
  matched: JobMatchRow[]
  unknown: JobMatchRow[]
  mismatchCount: number
  total: number
}

export function groupMatchResults(rows: JobMatchRow[]): GroupedMatches {
  const matched: JobMatchRow[] = []
  const unknown: JobMatchRow[] = []
  let mismatchCount = 0
  for (const row of rows) {
    if (row.result.overall === 'match') matched.push(row)
    else if (row.result.overall === 'unknown') unknown.push(row)
    else mismatchCount++
  }
  // 입력 순서(최신순)를 유지한 채 선호조건 충족 수가 많은 순으로 — Array.sort는 안정 정렬.
  matched.sort((a, b) => b.result.preferred_met - a.result.preferred_met)
  return { matched, unknown, mismatchCount, total: rows.length }
}

/** 필수조건 중 status가 unknown인 것들(정보 미확인 영역에 이유로 표시). */
export function unknownRequiredCriteria(result: EvaluationResult): { key: CriterionKey; reason: string }[] {
  const out: { key: CriterionKey; reason: string }[] = []
  for (const key of CRITERION_KEYS) {
    const c = result.criteria[key]
    if (c && c.importance === 'required' && c.status === 'unknown') out.push({ key, reason: c.reason })
  }
  return out
}

export type EmptyDiagnosisKind =
  /** 지금 열린 공고 자체가 0건 */
  | 'no_open_jobs'
  /** 지역/업종 등 한 조건만으로도 맞는 공고가 0건 — 그 범위 공고가 부족 */
  | 'few_jobs_in_scope'
  /** 공고는 있는데 필수조건 조합이 좁아서 0건 */
  | 'too_narrow'
  /** 필수조건을 판정할 정보가 공고에 없어서 0건 */
  | 'insufficient_info'
  /** 위 원인이 섞여 있거나 어느 쪽도 뚜렷하지 않음 — 단정하지 않는다 */
  | 'undetermined'

export interface EmptyDiagnosis {
  kind: EmptyDiagnosisKind
  totalOpenJobs: number
  unknownCount: number
  /** 이 필수조건 하나만 풀면 충족되는 공고 수(불일치 1개만 걸린 공고). */
  relaxable: { key: CriterionKey; count: number }[]
  /** 이 필수조건 정보만 있으면 판정 가능한 공고 수(미확인 조건별). */
  missingInfo: { key: CriterionKey; count: number }[]
  /** 필수조건 하나만 봤을 때 충족 공고가 0건인 조건(범위 공고 부족). */
  emptyScopes: CriterionKey[]
}

function sortedCounts(map: Map<CriterionKey, number>): { key: CriterionKey; count: number }[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || CRITERION_KEYS.indexOf(a.key) - CRITERION_KEYS.indexOf(b.key))
}

/**
 * 매칭 0건일 때 원인을 구분한다. 단일 원인이 뚜렷할 때만 그 원인을 말하고,
 * 섞여 있으면 'undetermined'로 두되 근거 숫자(relaxable/missingInfo)는 같이
 * 돌려줘서 화면이 사실만 보여줄 수 있게 한다.
 */
export function diagnoseEmptyResult(rows: JobMatchRow[]): EmptyDiagnosis {
  const relaxMap = new Map<CriterionKey, number>()
  const missingMap = new Map<CriterionKey, number>()
  const matchCountByKey = new Map<CriterionKey, number>()
  const requiredKeys = new Set<CriterionKey>()
  let unknownCount = 0

  for (const row of rows) {
    const required = CRITERION_KEYS
      .map((key) => ({ key, c: row.result.criteria[key] }))
      .filter((x): x is { key: CriterionKey; c: CriterionResult } => !!x.c && x.c.importance === 'required')
    for (const { key, c } of required) {
      requiredKeys.add(key)
      if (c.status === 'match') matchCountByKey.set(key, (matchCountByKey.get(key) ?? 0) + 1)
    }
    const mismatches = required.filter((x) => x.c.status === 'mismatch')
    const unknowns = required.filter((x) => x.c.status === 'unknown')
    if (row.result.overall === 'unknown') {
      unknownCount++
      for (const u of unknowns) missingMap.set(u.key, (missingMap.get(u.key) ?? 0) + 1)
    }
    if (mismatches.length === 1 && unknowns.length === 0) {
      const key = mismatches[0].key
      relaxMap.set(key, (relaxMap.get(key) ?? 0) + 1)
    }
  }

  const relaxable = sortedCounts(relaxMap)
  const missingInfo = sortedCounts(missingMap)
  const emptyScopes = [...requiredKeys]
    .filter((key) => (matchCountByKey.get(key) ?? 0) === 0)
    .sort((a, b) => CRITERION_KEYS.indexOf(a) - CRITERION_KEYS.indexOf(b))
  const base = { totalOpenJobs: rows.length, unknownCount, relaxable, missingInfo, emptyScopes }

  if (rows.length === 0) return { kind: 'no_open_jobs', ...base }

  const hasRelax = relaxable.length > 0
  const hasUnknown = unknownCount > 0
  // 지역/업종 하나만 봐도 충족 공고가 0건이면 "조건이 좁다"보다 "그 범위에 지금
  // 공고가 없다"가 원인이다(예: 선택한 지역에 열린 공고 0건). 단, 미확인 공고가
  // 있으면 그 공고가 실제로 그 범위일 수도 있으므로 단정하지 않는다.
  const scopeShortage = emptyScopes.some((k) => k === 'region' || k === 'category')
  if (hasUnknown) {
    return { kind: hasRelax || scopeShortage ? 'undetermined' : 'insufficient_info', ...base }
  }
  if (scopeShortage) return { kind: 'few_jobs_in_scope', ...base }
  // 한 조건만 불일치인 공고가 있거나(완화 대상 있음), 모든 공고가 필수조건 2개
  // 이상에서 불일치 — 어느 쪽이든 조합이 좁은 것.
  return { kind: 'too_narrow', ...base }
}
