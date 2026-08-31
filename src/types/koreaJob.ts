// korea_jobs_public / korea_job_work_locations_public 뷰의 컬럼과 1:1로 맞춘 타입.
// 이 뷰들은 공개용으로 선별된 컬럼만 가진다 — collected_at/verified_at/source_type/
// status/show_source_link 같은 내부 필드는 뷰 자체에 없으므로 여기도 없다.
export interface KoreaJob {
  id: number
  created_at: string
  title: string | null
  /** 베트남어 번역(있을 때만) — UI는 title_vi ?? title로 표시한다. */
  title_vi: string | null
  company: string | null
  region: string | null
  salary: string | null
  deadline: string | null
  description: string | null
  /** 베트남어 번역(있을 때만) — UI는 description_vi ?? description으로 표시한다. */
  description_vi: string | null
  category: string | null
  province: string | null
  district: string | null
  salary_type: 'hourly' | 'daily' | 'monthly' | 'annual' | 'negotiable' | null
  salary_min: number | null
  salary_max: number | null
  working_hours: string | null
  working_days: string | null
  days_off: string | null
  headcount: number | null
  gender_condition: 'male' | 'female' | 'any' | null
  age_condition: string | null
  korean_level_required: string | null
  experience_required: string | null
  visa_status_required: string | null
  dormitory: boolean | null
  meals: boolean | null
  transportation: boolean | null
  contact_method: string | null
  posted_at: string | null
  expires_at: string | null
  /** show_source_link=false인 원본 행은 null로 내려온다(뷰에서 이미 처리됨). */
  source_url: string | null
}

export interface KoreaJobWorkLocation {
  id: number
  job_id: number
  raw_address: string
  normalized_address: string | null
  sido: string | null
  sigungu: string | null
  eupmyeondong: string | null
  lat: number | null
  lng: number | null
  sort_order: number
}
