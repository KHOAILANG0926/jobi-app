import { classifyJobCategory } from './jobCategoryRules.ts'
import { ensureJobFields } from './jobUtils.ts'
import { supabase } from './supabase.ts'
import type { AddressAccuracy, CoordinateAccuracy, GeocodeStatus, Job } from '../types/job.ts'

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
  // 2026-09-05 최종 제품 정책으로 정정: lat/lng는 DB에 있는 그대로 항상
  // 전달한다 — 예전에는 'ward'인데 locationVerified가 아니거나 'region'/
  // 'unresolved'면 여기서 lat/lng를 통째로 null로 지웠는데, 그러면 "구체적
  // 주소는 있지만 좌표 미검증"인 위치가 지도에 근사 표시조차 될 수 없었다
  // (정책: "지오코더가 반환한 안전한 상위 지역 좌표가 있으면 근사 지도
  // 표시"). 지도에 "정확한 마커"로 쓸지 "근사 위치"로 쓸지, 거리검색에 써도
  // 되는지는 이제 이 함수가 아니라 소비처(src/lib/jobCoords.ts의
  // resolveMapLocations/resolveDistanceSearchPoint)가 coordinateAccuracy/
  // locationVerified를 보고 판단한다 — "지도 fallback 좌표와 거리검색
  // 좌표를 코드상 명확히 분리"하라는 지시에 따라 이 매핑 함수 하나가 both를
  // 뭉뚱그려 결정하지 않는다.
  return {
    id: r.id as number,
    rawAddress: (r.raw_address as string) ?? '',
    normalizedAddress: (r.normalized_address as string) ?? undefined,
    lat: typeof r.lat === 'number' && Number.isFinite(r.lat) ? (r.lat as number) : undefined,
    lng: typeof r.lng === 'number' && Number.isFinite(r.lng) ? (r.lng as number) : undefined,
    sortOrder: (r.sort_order as number) ?? 0,
    addressAccuracy: (r.address_accuracy as AddressAccuracy | null | undefined) ?? undefined,
    coordinateAccuracy: coordinateAccuracy ?? undefined,
    locationVerified,
    matchedRecruitmentRegions: (r.matched_recruitment_regions as string[] | null | undefined) ?? undefined,
    geocodeStatus: (r.geocode_status as GeocodeStatus | null | undefined) ?? undefined,
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
  'id,title,company,category,salary,location,hours,employer_phone,employer_id,application_deadline,urgent,description,posted_at,lat,lng,active,admin_hidden,created_at,image_url,source,work_period,work_days,education,preference,num_hires,company_verified,company_founded_year,hire_count,images,source_url,recruitment_regions'
const JOB_WORK_LOCATIONS_SELECT_COLUMNS =
  'id,job_id,raw_address,normalized_address,lat,lng,sort_order,address_accuracy,coordinate_accuracy,location_verified,matched_recruitment_regions,geocode_status'

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
