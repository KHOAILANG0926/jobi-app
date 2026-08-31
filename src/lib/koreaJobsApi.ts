import { supabase } from './supabase'
import type { KoreaJob, KoreaJobWorkLocation } from '../types/koreaJob'

// select('*')를 절대 쓰지 않는다 — 뷰 자체가 이미 공개 컬럼만 갖고 있지만, 여기서도
// 명시적으로 필드를 나열해 앞으로 뷰에 컬럼이 추가되더라도 프론트가 의도한 필드만
// 받도록 고정한다.
const KOREA_JOB_PUBLIC_FIELDS =
  'id,created_at,title,company,region,salary,deadline,description,category,province,district,' +
  'salary_type,salary_min,salary_max,working_hours,working_days,days_off,headcount,' +
  'gender_condition,age_condition,korean_level_required,experience_required,visa_status_required,' +
  'dormitory,meals,transportation,contact_method,posted_at,expires_at,source_url'

const KOREA_WORK_LOCATION_PUBLIC_FIELDS =
  'id,job_id,raw_address,normalized_address,sido,sigungu,eupmyeondong,lat,lng,sort_order'

export async function fetchKoreaJobs(): Promise<KoreaJob[]> {
  const { data, error } = await supabase
    .from('korea_jobs_public')
    .select(KOREA_JOB_PUBLIC_FIELDS)
    .order('created_at', { ascending: false })
  if (error) {
    console.error(error)
    return []
  }
  return (data ?? []) as unknown as KoreaJob[]
}

export async function fetchKoreaJob(id: number): Promise<KoreaJob | null> {
  const { data, error } = await supabase
    .from('korea_jobs_public')
    .select(KOREA_JOB_PUBLIC_FIELDS)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error(error)
    return null
  }
  return data as unknown as KoreaJob | null
}

export async function fetchKoreaJobWorkLocations(jobId: number): Promise<KoreaJobWorkLocation[]> {
  const { data, error } = await supabase
    .from('korea_job_work_locations_public')
    .select(KOREA_WORK_LOCATION_PUBLIC_FIELDS)
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error(error)
    return []
  }
  return (data ?? []) as unknown as KoreaJobWorkLocation[]
}
