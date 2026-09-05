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

/** job_work_locations.address_accuracy — 원문 텍스트 자체가 얼마나 구체적인지
 *  (좌표 검증 여부와는 별개). 'region_only'(성·시/구·군·동만 있음)도 이제
 *  행으로 보존된다(2026-09-05 최종 제품 정책: "성·시·구·군만 있는 원문 위치도
 *  삭제하지 말고 보존"). 'undetermined'는 애초에 행 자체가 생기지 않는다. */
export type AddressAccuracy = 'exact_text' | 'region_only'

export interface JobWorkLocation {
  id: number
  rawAddress: string
  normalizedAddress?: string
  lat?: number
  lng?: number
  sortOrder: number
  /** job_work_locations.address_accuracy — 이 텍스트가 구체적 주소('exact_text',
   *  번지/도로/공단/건물/매장 등 고유 신호 있음)인지 성·시/구·군·동만 있는
   *  텍스트('region_only')인지. 지도 표시 등급(정확한 마커 vs 근사 위치)을
   *  결정하는 데 coordinateAccuracy와 함께 쓴다 — 컬럼이 아직 없던 과거
   *  데이터에서는 undefined. */
  addressAccuracy?: AddressAccuracy
  /** resolve_coordinate_accuracy()의 판정 — 원문 주소 텍스트(rawAddress)와는 별개다.
   *  텍스트와 길찾기(Google Maps 텍스트 검색 링크)는 이 값과 무관하게 항상 그대로
   *  제공한다(2026-09-04 사용자 지시: "location_verified=false인 ward도 길찾기
   *  버튼을 숨기지 않음"). 이 값은 오직 "내부 지도에 마커를 찍고 정확한 거리 계산에
   *  써도 되는지"만 결정한다 — 'exact'만 무조건 신뢰, 'ward'는 locationVerified가
   *  true일 때만(원문 좌표로 실제 확인된 경우, 다만 이 경우도 UI에는 'exact'가
   *  아니라 "근무구역 확인"으로 표시 — exact와 동일한 정밀도를 주장하지 않음) 신뢰,
   *  아니면 'region'/'unresolved'와 동일하게 내부 지도 마커를 만들지 않는다
   *  (2026-09-04 사용자 지시 — 같은 'ward' 등급도 반복주소 geocode 편향으로 최대
   *  ~15km까지 틀릴 수 있음이 실측 확인됨). */
  coordinateAccuracy?: CoordinateAccuracy
  /** job_work_locations.location_verified — 원문(vieclam24h)이 제공하는 고용주
   *  연락처 좌표로 이 근무지가 실제로 확인됐는지(source_verified). true면
   *  coordinateAccuracy가 'ward'여도 내부 지도 마커에 좌표를 써도 되지만, "exact"로
   *  표시하지는 않는다(정확한 거리라고 단정하지 않음). */
  locationVerified?: boolean
  /** job_work_locations.matched_recruitment_regions — 이 근무구역(물리적으로 1곳)에
   *  실제로 매칭된 모집지역 라벨의 부분집합(예: ["TP.HCM","Long An"]). 좌표는
   *  근무구역당 1개뿐이며 지역별로 복제되지 않는다 — 이 배열은 표시 전용 정보.
   *  공고 전체 모집지역(Job.recruitmentRegions)과는 별개 — 근무지 행이 0건이거나
   *  이 위치에 매칭되지 않은 지역은 여기 담기지 않는다. */
  matchedRecruitmentRegions?: string[]
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
  /** local_jobs.active/admin_hidden — 공개 목록(useJobs())은 이미 active=true인
   *  것만 가져오므로 항상 undefined(=true나 마찬가지)이지만, 기업 자신의 전체
   *  공고 조회(fetchEmployerJobs())는 비공개/관리자 숨김 공고도 포함해서 가져오므로
   *  실제 상태를 구분해서 보여줄 때 쓴다. */
  active?: boolean
  adminHidden?: boolean
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
  /** local_jobs.recruitment_regions — 공고 전체가 모집한다고 밝힌 지역 라벨 전부
   *  (예: ["TP.HCM","Long An"]). workLocations가 0건이어도 보존된다(2026-09-04
   *  사용자 지시: "공고 전체 모집지역은 근무지 행이 0건이어도 보존되어야 함").
   *  migration 0018이 2026-09-05 적용돼 컬럼이 실제로 존재하고 select에도
   *  포함된다. workLocations가 아예 비어있는 공고(근무지 후보 자체가 없어
   *  원문 어딘가 언급된 지역명만 있는 경우)의 지도 표시는 이 배열을
   *  fallback 기준으로 쓴다(src/lib/jobCoords.ts의 resolveMapLocations
   *  참고). "확인 안 된" 지역(이 값에는 있지만 어떤 workLocations[].
   *  matchedRecruitmentRegions에도 없는 지역)은 별도로 저장하지 않고
   *  필요할 때 두 배열의 차집합으로 계산한다. */
  recruitmentRegions?: string[]
}
