import type { JobCategory } from '../types/job'

/** 공고 항목·구역·분류를 한 곳에 고정한다(docs/JOB_FIELDS_AND_DETAIL_DESIGN.md §2·§4 기준).
 * 상세 화면·등록 화면·crawler가 각자 항목을 새로 만들지 않도록 여기만 참조하고,
 * 항목을 바꾸면 jobSchema.test.ts가 실패해 문서·DB·화면을 같이 고치게 한다.
 * 원칙: 모르는 값은 빈 값(null) 유지 — 가짜 값·추정 채우기 금지. */

/** 상세 화면 구역 — 이 순서로 한 페이지에 이어서 보여준다(탭은 스크롤 이동만). */
export const JOB_SECTIONS = ['conditions', 'recruit', 'location', 'description', 'company'] as const
export type JobSection = (typeof JOB_SECTIONS)[number]

/** 대분류 13개(JobCategory와 동일 — 변경 시 categories.ts·classifier.py와 함께). */
export const JOB_CATEGORIES: readonly JobCategory[] = [
  'am_thuc_do_uong', 'quan_ly_ban_hang', 'dich_vu', 'van_phong', 'cskh_kinh_doanh',
  'san_xuat_xay_dung', 'cntt_ky_thuat', 'thiet_ke', 'truyen_thong', 'lai_xe_giao_hang',
  'y_te_dieu_duong', 'giao_duc_giang_day', 'khac',
]

/** 고정 값 목록(DB check 제약과 동일). */
export const SALARY_BASES = ['base', 'total_with_overtime'] as const
export const EMPLOYMENT_TYPES = ['full_time', 'seasonal', 'part_time'] as const
export const ROTATING_SHIFTS = [2, 3] as const
export const SALARY_PERIODS = ['hour', 'day', 'month', 'other'] as const
export const SHIFT_TYPES = ['day', 'night', 'rotating', 'other'] as const

export interface JobFieldDef {
  /** 화면·타입에서 쓰는 키 */
  key: string
  /** DB 컬럼(table.column) */
  column: string
  section: JobSection
}

const f = (key: string, column: string, section: JobSection): JobFieldDef => ({ key, column, section })

/** 항목 목록(구역별). column은 DB 컬럼명과 정확히 일치해야 한다. */
export const JOB_FIELDS: readonly JobFieldDef[] = [
  // ① 근무조건
  f('salary', 'local_jobs.salary', 'conditions'),
  f('salaryMin', 'local_jobs.salary_min', 'conditions'),
  f('salaryMax', 'local_jobs.salary_max', 'conditions'),
  f('salaryPeriod', 'local_jobs.salary_period', 'conditions'),
  f('salaryNegotiable', 'local_jobs.salary_negotiable', 'conditions'),
  f('salaryBasis', 'local_jobs.salary_basis', 'conditions'),
  f('salaryNote', 'local_jobs.salary_note', 'conditions'),
  f('jobDuration', 'local_jobs.job_duration', 'conditions'),
  f('workDays', 'local_jobs.work_days', 'conditions'),
  f('hours', 'local_jobs.hours', 'conditions'),
  f('shiftType', 'local_jobs.shift_type', 'conditions'),
  f('rotatingShifts', 'local_jobs.rotating_shifts', 'conditions'),
  f('employmentType', 'local_jobs.employment_type', 'conditions'),
  f('weekendWork', 'local_jobs.weekend_work', 'conditions'),
  f('shuttleBus', 'local_jobs.shuttle_bus', 'conditions'),
  f('dormitory', 'local_jobs.dormitory', 'conditions'),
  f('mealProvided', 'local_jobs.meal_provided', 'conditions'),
  f('benefitTags', 'local_jobs.benefit_tags', 'conditions'),
  // ② 모집조건
  f('applicationDeadline', 'local_jobs.application_deadline', 'recruit'),
  f('numHires', 'local_jobs.num_hires', 'recruit'),
  f('education', 'local_jobs.education', 'recruit'),
  f('preference', 'local_jobs.preference', 'recruit'),
  f('ageRequirement', 'local_jobs.age_requirement', 'recruit'),
  f('genderRequirement', 'local_jobs.gender_requirement', 'recruit'),
  f('requiredDocuments', 'local_jobs.required_documents', 'recruit'),
  f('languageRequirement', 'local_jobs.language_requirement', 'recruit'),
  f('businessTrip', 'local_jobs.business_trip', 'recruit'),
  // ③ 근무지역
  f('workLocationAddress', 'job_work_locations.raw_address', 'location'),
  f('industrialPark', 'job_work_locations.industrial_park', 'location'),
  f('shuttleRoute', 'job_work_locations.shuttle_route', 'location'),
  // ④ 상세요강
  f('description', 'local_jobs.description', 'description'),
  // ⑤ 기업정보 / 연락
  f('company', 'local_jobs.company', 'company'),
  f('recruitmentType', 'local_jobs.recruitment_type', 'company'),
  f('lastVerifiedAt', 'local_jobs.last_verified_at', 'company'),
  f('employerPhone', 'local_jobs.employer_phone', 'company'),
  f('contactZalo', 'local_jobs.contact_zalo', 'company'),
]

/** 이번 DDL로 추가하는 9개 컬럼(migration 20261007013659과 동일 — 2차는 NEW_DDL_COLUMNS_2). */
export const NEW_DDL_COLUMNS = [
  'local_jobs.salary_basis', 'local_jobs.salary_note', 'local_jobs.employment_type',
  'local_jobs.rotating_shifts', 'local_jobs.benefit_tags', 'local_jobs.required_documents',
  'local_jobs.contact_zalo', 'job_work_locations.industrial_park', 'job_work_locations.shuttle_route',
] as const

/** 2차 DDL(20261007031726) — 원문에서 뽑은 언어 조건·출장 가능 여부. 원문 백업 테이블 local_jobs_description_backup은 화면 항목이 아니라 목록에 없다. */
export const NEW_DDL_COLUMNS_2 = ['local_jobs.language_requirement', 'local_jobs.business_trip'] as const
