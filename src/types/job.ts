/**
 * 2026-09-17 사용자 지시로 알바몬 실제 사이트(albamon.com/jobs/urgent 업직종
 * 필터)에서 직접 확인한 12개 대분류 + 기타 1개 = 13개로 전면 교체. 예전
 * 7개(factory/cafe/restaurant/delivery/cleaning/retail/office)는 사실
 * 소분류 레벨이었음 — crawler/classifier.py의 LEGACY_TO_MAJOR가 예전 값을
 * 이 새 값으로 결정적으로 매핑하고, subcategories.ts가 새 대분류 밑에
 * 158개 소분류(라벨은 전부, 분류 규칙은 일부만 검증됨)를 담는다. "당장 쓸모
 * 있는지"와 무관하게 실제 알바몬 분류 체계 전체를 기틀로 먼저 갖춘다(성/시·
 * 동/사 전체 목록을 공고 존재 여부와 무관하게 항상 보여주는 것과 같은 원칙).
 */
export type JobCategory =
  | 'am_thuc_do_uong'
  | 'quan_ly_ban_hang'
  | 'dich_vu'
  | 'van_phong'
  | 'cskh_kinh_doanh'
  | 'san_xuat_xay_dung'
  | 'cntt_ky_thuat'
  | 'thiet_ke'
  | 'truyen_thong'
  | 'lai_xe_giao_hang'
  | 'y_te_dieu_duong'
  | 'giao_duc_giang_day'
  | 'khac'

export type CoordinateAccuracy = 'exact' | 'ward' | 'region' | 'unresolved'

/** job_work_locations.address_accuracy — 원문 텍스트 자체가 얼마나 구체적인지
 *  (좌표 검증 여부와는 별개). 'region_only'(성·시/구·군·동만 있음)도 이제
 *  행으로 보존된다(2026-09-05 최종 제품 정책: "성·시·구·군만 있는 원문 위치도
 *  삭제하지 말고 보존"). 'undetermined'는 애초에 행 자체가 생기지 않는다. */
export type AddressAccuracy = 'exact_text' | 'region_only'

/** job_work_locations.geocode_status — 이 근무지가 지오코딩 파이프라인의
 *  어느 단계에 있는지. 'pending'은 "실패"가 아니라 "아직 시도하지 않음"
 *  (보통 addressAccuracy가 'region_only'라 지오코딩을 미룬 경우)이므로,
 *  UI는 이 값을 'failed'/좌표 없음과 같은 취급으로 숨기거나 베트남 기본
 *  중심으로 표시하면 안 되고 "위치 확인 중"으로 별도 구분해야 한다
 *  (2026-09-07 사용자 지시 — src/lib/jobCoords.ts의 MapCoordinateSource
 *  'pending' 참고). */
export type GeocodeStatus = 'pending' | 'success' | 'failed' | 'manual'

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
  /** job_work_locations.geocode_status — GeocodeStatus 참고. */
  geocodeStatus?: GeocodeStatus
  /** job_work_locations.resolved_province — 베트남 2025-07-01 행정구역 개편
   *  반영, 지금 유효한 성/시 34개 중 하나(crawler/vn_provinces_lookup.py가
   *  통계총국 공식 자료로 확정). province/district(Geoapify 원문, 옛/새 이름이
   *  섞여 있을 수 있음)와 별개 — 필터링에는 이 값만 신뢰한다. */
  resolvedProvince?: string
  /** job_work_locations.resolved_wards — 지금 유효한 동/사 후보(옛 군/구
   *  하나가 여러 동으로 쪼개진 경우 여러 개일 수 있음, 후보가 너무 많으면
   *  crawler에서 이미 걸러짐). 하나로 단정 못 하면 undefined. */
  resolvedWards?: string[]
}

export interface Job {
  id: string
  title: string
  company: string
  category: JobCategory
  /** local_jobs.subcategory — crawler/classifier.py의 classify_subcategory()가
   *  채우는 대분류 안 세부 분류(예: 'pha_che', 'thu_ngan'). 규칙에 안 걸리면
   *  undefined — 억지로 끼워맞추지 않는다. 화면에 보여줄 라벨은
   *  crawler/classifier.py의 SUBCATEGORY_LABELS와 동일한 값이어야 한다. */
  subcategory?: string
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
  /** local_jobs.job_duration — 알바몬 스타일 근무기간 7구간(예: "1 - 3 tháng").
   *  크롤러는 채우지 않고(소스에 구조화된 필드 없음) PostJob.tsx 직접등록
   *  전용으로 시작해 대부분 undefined일 것으로 예상된다. */
  jobDuration?: string
  /** local_jobs.gender_requirement — "Nam"/"Nữ" 중 하나를 기대. 크롤러는
   *  채우지 않고 PostJob.tsx 직접등록 전용. null = 조건 없음(모두 지원 가능). */
  genderRequirement?: string
  /** local_jobs.age_requirement — 급구 필터와 동일한 5구간 라벨(예:
   *  "18 - 24 tuổi"). 크롤러는 채우지 않고 PostJob.tsx 직접등록 전용. */
  ageRequirement?: string
  workDays?: string
  education?: string
  preference?: string
  numHires?: string
  companyVerified?: boolean
  companyFoundedYear?: number
  hireCount?: number
  /** local_jobs.labor_contract_pledge / social_insurance_pledge — 관리자가
   *  검증한 companyVerified와 달리 기업이 스스로 체크한 자가서약(self-pledge).
   *  크롤러는 채우지 않고 PostJob.tsx 직접등록 전용 체크박스로 시작한다. */
  laborContractPledge?: boolean
  socialInsurancePledge?: boolean
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
