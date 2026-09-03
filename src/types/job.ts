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
   *  'exact'/'ward'만 lat/lng를 신뢰해 지도에 표시 — 'region'/'unresolved'는 내부
   *  지도를 아예 숨기고 외부 Google 지도 검색 링크만 제공한다. */
  coordinateAccuracy?: CoordinateAccuracy
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
