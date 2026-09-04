import { classifyJobCategory } from './jobCategoryRules.ts'
import { ensureJobFields } from './jobUtils.ts'
import { supabase } from './supabase.ts'
import type { CoordinateAccuracy, Job } from '../types/job.ts'

/** DB row(local_jobs/job_work_locations) -> Job 매핑 로직 — JobsContext.tsx와
 *  fetchEmployerJobs() 둘 다 이 파일을 공유한다(단일 진실 공급원). 이 파일에
 *  JSX가 전혀 없어(순수 .ts) Node의 타입 스트리핑 실행기(--experimental-strip-types)
 *  로 독립 테스트가 가능하다 — JobsContext.tsx(.tsx, JSX 포함)는 이 실행기가
 *  파싱을 못 해 직접 테스트할 수 없다. */

export function parseDescription(raw: string): { description: string; source?: string } {
  const match = raw?.match(/\[source:([^\]]+)\]/)
  if (!match) return { description: raw ?? '' }
  const rest = raw.replace(match[0], '').trim()
  return {
    description: rest,
    source: match[1],
  }
}

export function rowToWorkLocation(r: Record<string, unknown>): Job['workLocations'] extends (infer U)[] | undefined ? U : never {
  const coordinateAccuracy = (r.coordinate_accuracy as CoordinateAccuracy | null | undefined) ?? undefined
  const locationVerified = (r.location_verified as boolean | null | undefined) ?? undefined
  // 'exact'는 무조건 신뢰한다. 'ward'는 locationVerified(원문 좌표로 실제 확인됨)일
  // 때만 신뢰한다 — 2026-09-04 사용자 지시(반복주소 실측 발견): 같은 물리적 장소가
  // 모집지역 접미사만 다르게 붙어 여러 번 geocode되면 'ward' 등급도 최대 ~15km까지
  // 틀릴 수 있음이 확인됐다(KCN Hiệp Phước 공고). region/unresolved는 DB에 lat/lng가
  // 있어도(과거 데이터 등) 프론트에서 지도에 쓰지 않는다. coordinate_accuracy 컬럼이
  // 아직 없는(마이그레이션 전) 환경에서는 undefined이므로, 기존 lat/lng가 있으면
  // 안전한 기본값인 'exact'로 간주해 기존 동작을 유지한다.
  const trusted = coordinateAccuracy == null || coordinateAccuracy === 'exact' || locationVerified === true
  return {
    id: r.id as number,
    rawAddress: (r.raw_address as string) ?? '',
    normalizedAddress: (r.normalized_address as string) ?? undefined,
    lat: typeof r.lat === 'number' && Number.isFinite(r.lat) && trusted ? (r.lat as number) : undefined,
    lng: typeof r.lng === 'number' && Number.isFinite(r.lng) && trusted ? (r.lng as number) : undefined,
    sortOrder: (r.sort_order as number) ?? 0,
    coordinateAccuracy: coordinateAccuracy ?? undefined,
    locationVerified,
    // job_work_locations.matched_recruitment_regions 컬럼은 아직 없다(draft
    // migration 0018, 미실행) — select에도 포함하지 않았으므로 r.matched_
    // recruitment_regions는 항상 undefined. 컬럼이 생기고 select에 추가되면
    // 자동으로 채워진다.
    matchedRecruitmentRegions: (r.matched_recruitment_regions as string[] | null | undefined) ?? undefined,
  }
}

export function rowToJob(r: Record<string, unknown>, workLocations?: Job['workLocations']): Job {
  const { description, source } = parseDescription((r.description as string) ?? '')
  const baseJob = {
    title: (r.title as string) ?? '',
    company: (r.company as string) ?? '',
    category: (r.category as Job['category']) ?? 'other',
    description,
  }
  return ensureJobFields({
    id: `sb-${r.id}`,
    title: baseJob.title,
    company: baseJob.company,
    category: classifyJobCategory(baseJob),
    salary: (r.salary as string) ?? '',
    location: (r.location as string) ?? '',
    hours: (r.hours as string) ?? '',
    employerPhone: (r.employer_phone as string) ?? '',
    zalo: (r.zalo as string) ?? undefined,
    applicationDeadline: (r.application_deadline as string) ?? '',
    urgent: (r.urgent as boolean) ?? false,
    description,
    source,
    postedAt: (r.posted_at as string) ?? new Date().toISOString().slice(0, 10),
    lat: (r.lat as number) ?? undefined,
    lng: (r.lng as number) ?? undefined,
    employerId: (r.employer_id as string) ?? undefined,
    // 공개 목록(fetchJobs())은 .eq('active', true)만 가져오므로 r.active가 항상
    // true고 admin_hidden select 자체가 없어 둘 다 undefined로 채워진다(기존
    // 동작 그대로) — fetchEmployerJobs()만 이 값을 실제로 채운다.
    active: (r.active as boolean | undefined) ?? undefined,
    adminHidden: (r.admin_hidden as boolean | undefined) ?? undefined,
    imageUrl: (r.image_url as string) ?? undefined,
    images: (r.images as string[]) ?? undefined,
    workPeriod: (r.work_period as string) ?? undefined,
    workDays: (r.work_days as string) ?? undefined,
    education: (r.education as string) ?? undefined,
    preference: (r.preference as string) ?? undefined,
    numHires: (r.num_hires as string) ?? undefined,
    companyVerified: (r.company_verified as boolean) ?? undefined,
    companyFoundedYear: (r.company_founded_year as number) ?? undefined,
    hireCount: (r.hire_count as number) ?? undefined,
    rawSalary: (r.salary as string)?.trim() || undefined,
    rawLocation: (r.location as string)?.trim() || undefined,
    rawEducation: (r.education as string)?.trim() || undefined,
    rawPreference: (r.preference as string)?.trim() || undefined,
    rawLat: typeof r.lat === 'number' && Number.isFinite(r.lat) ? (r.lat as number) : undefined,
    rawLng: typeof r.lng === 'number' && Number.isFinite(r.lng) ? (r.lng as number) : undefined,
    sourceUrl: (r.source_url as string) ?? undefined,
    workLocations: workLocations && workLocations.length > 0 ? workLocations : undefined,
    // local_jobs.recruitment_regions 컬럼은 아직 없다(draft migration 0018,
    // 미실행) — 아래 select()에도 포함하지 않았으므로 r.recruitment_regions는
    // 항상 undefined. 컬럼이 생기고 select에 추가되면 자동으로 채워진다.
    recruitmentRegions: (r.recruitment_regions as string[] | null | undefined) ?? undefined,
  })
}

/**
 * fetchEmployerJobs()가 실제 Supabase 클라이언트 대신 테스트용 fake를
 * 주입받을 수 있도록 하는 최소 인터페이스 — supabase-js의 복잡한 제네릭과
 * 싸우지 않고, 이 파일이 실제로 쓰는 메서드 체인만 구조적으로 흉내낸다.
 */
export interface JobsQueryBuilder {
  select: (columns: string) => JobsQueryBuilder
  eq: (column: string, value: unknown) => JobsQueryBuilder
  in: (column: string, values: unknown[]) => JobsQueryBuilder
  order: (column: string, opts?: { ascending?: boolean }) => JobsQueryBuilder
  then: <T>(
    resolve: (result: { data: Record<string, unknown>[] | null; error: unknown }) => T,
  ) => Promise<T> | T
}
export interface JobsQueryClient {
  from: (table: string) => JobsQueryBuilder
}

const EMPLOYER_JOBS_SELECT_COLUMNS =
  'id,title,company,category,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,admin_hidden,created_at,image_url,source,work_period,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,images,source_url'
const JOB_WORK_LOCATIONS_SELECT_COLUMNS =
  'id,job_id,raw_address,normalized_address,lat,lng,sort_order,coordinate_accuracy,location_verified'

/**
 * 로그인한 기업 자신의 공고를 employer_id=auth.uid() 기준으로 직접 조회한다 —
 * 공개(.eq('active', true)) 목록에서 필터링하지 않는다.
 *
 * 2026-09-04 사용자 지시("EmployerDashboard가 공개 공고 목록을 가져온 뒤
 * 필터링하는 구조를 제거하고, 로그인한 기업의 employer_id=auth.uid() 공고를
 * 별도로 조회하도록 수정"): 기존 EmployerDashboard.tsx는 useJobs()의 공개
 * (active=true) 목록에서 employerId만 걸러냈다 — RLS(migration 0019)가
 * "본인 소유는 active/admin_hidden 무관하게 조회 가능"을 이미 허용해도, 이
 * 프론트 쿼리 자체가 애초에 그런 공고를 서버에 요청조차 안 해서 화면엔
 * 여전히 안 보였다. 이 함수는 공개 필터 없이 employer_id로만 조회해 그
 * 문제를 없앤다 — 실제 접근 제어는 RLS가 하므로(다른 기업 소유는 이 쿼리로도
 * 절대 안 돌아옴, migration 0019 실측 검증됨), 여기서 active/admin_hidden으로
 * 결과를 다시 좁히지 않는다 — 오히려 그 값을 그대로 Job.active/adminHidden에
 * 실어서 화면이 상태를 구분해 보여줄 수 있게 한다.
 */
export async function fetchEmployerJobs(
  employerId: string,
  client: JobsQueryClient = supabase as unknown as JobsQueryClient,
): Promise<Job[]> {
  if (!employerId) return []
  const { data } = await client
    .from('local_jobs')
    .select(EMPLOYER_JOBS_SELECT_COLUMNS)
    .eq('employer_id', employerId)
    .order('posted_at', { ascending: false })
    .order('id', { ascending: false })
  const rows = (data ?? []) as Record<string, unknown>[]
  if (rows.length === 0) return []

  const jobIds = rows.map((r) => r.id as number)
  const { data: locRows } = await client
    .from('job_work_locations')
    .select(JOB_WORK_LOCATIONS_SELECT_COLUMNS)
    .in('job_id', jobIds)
    .order('sort_order', { ascending: true })
  const locationsByJobId = new Map<number, NonNullable<Job['workLocations']>>()
  for (const r of (locRows ?? []) as Record<string, unknown>[]) {
    const jobId = r.job_id as number
    const list = locationsByJobId.get(jobId) ?? []
    list.push(rowToWorkLocation(r))
    locationsByJobId.set(jobId, list)
  }
  return rows.map((r) => rowToJob(r, locationsByJobId.get(r.id as number)))
}
