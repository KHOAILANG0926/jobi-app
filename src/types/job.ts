export type JobCategory =
  | 'factory'
  | 'cafe'
  | 'restaurant'
  | 'delivery'
  | 'cleaning'
  | 'retail'
  | 'office'
  | 'other'

export type CoordinateAccuracy = 'exact' | 'ward' | 'region' | 'unresolved'

export interface JobWorkLocation {
  id: number
  rawAddress: string
  normalizedAddress?: string
  lat?: number
  lng?: number
  sortOrder: number
  /** resolve_coordinate_accuracy()의 판정 — 원문 주소 텍스트(rawAddress)와는 별개다.
   *  텍스트는 항상 그대로 보여준다; 이 값은 지도에 마커를 찍어도 되는지만 결정한다.
   *  'exact'만 무조건 신뢰 — 'ward'는 locationVerified가 true일 때만(원문 좌표로
   *  실제 확인된 경우) 신뢰하고, 아니면 'region'/'unresolved'와 동일하게 내부
   *  지도를 숨기고 외부 Google 지도 검색 링크만 제공한다(2026-09-04 사용자 지시 —
   *  같은 'ward' 등급도 반복주소 geocode 편향으로 최대 ~15km까지 틀릴 수 있음이
   *  실측 확인됨). */
  coordinateAccuracy?: CoordinateAccuracy
  /** job_work_locations.location_verified — 원문(vieclam24h)이 제공하는 고용주
   *  연락처 좌표로 이 근무지가 실제로 확인됐는지(source_verified). true면
   *  coordinateAccuracy가 'ward'여도 좌표를 신뢰해도 된다. */
  locationVerified?: boolean
  /** job_work_locations.recruitment_regions — 같은 물리적 근무지를 모집 지역으로
   *  명시한 원문 지역 라벨 전부(예: ["TP.HCM","Long An"]). 좌표는 근무구역당
   *  1개뿐이며 지역별로 복제되지 않는다 — 이 배열은 표시 전용 정보. */
  recruitmentRegions?: string[]
}

export interface Job {
  id: string
  title: string
  company: string
  category: JobCategory
  salary: string
  location: string
  description: string
  postedAt: string
  employerPhone: string
  zalo?: string
  applicationDeadline: string
  urgent?: boolean
  hours?: string
  employerId?: string
  lat?: number
  lng?: number
  imageUrl?: string
  images?: string[]
  source?: string
  workPeriod?: string
  workDays?: string
  education?: string
  preference?: string
  numHires?: string
  companyVerified?: boolean
  companyFoundedYear?: number
  hireCount?: number
  /** Pre-fallback raw values (undefined if the source field was empty) — used where
   *  a field must be hidden rather than shown with injected placeholder text. */
  rawSalary?: string
  rawLocation?: string
  rawEducation?: string
  rawPreference?: string
  /** Coordinates as actually stored in the DB row — undefined when the row had none,
   *  unlike `lat`/`lng` which may be back-filled with a guessed province-level location. */
  rawLat?: number
  rawLng?: number
  /** Original posting URL (crawler source), when known. */
  sourceUrl?: string
  /** Real work-site addresses for this job (job_work_locations), 0..N. Undefined/empty
   *  means no structured work-location data — callers must keep using rawLocation/
   *  rawLat/rawLng as before (this is purely additive, never required). */
  workLocations?: JobWorkLocation[]
}
