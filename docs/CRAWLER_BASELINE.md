# Vieclam24h / VietnamWorks 크롤러 기준 (Baseline)

이 문서는 크롤러(`crawler/crawl_topcv.py` 및 관련 모듈)의 확정된 동작 기준을
**단계별로** 기록한다. 여기 적힌 기준을 바꾸는 코드 변경은 먼저 이 문서에서
바꾸려는 기준·이유·영향 범위를 정리한 뒤에 진행한다. 오류 수정의 원인·재현·
테스트·커밋 이력은 [`CRAWLER_FIX_HISTORY.md`](CRAWLER_FIX_HISTORY.md)에
따로 기록돼 있다 — 이 문서는 "현재 무엇이 기준인가"만, 이력 문서는 "왜 지금
이 기준이 됐는가"를 담당한다. 현재 진행 중인 작업 상태·미확인 항목은
[`WORK_STATUS.md`](WORK_STATUS.md) 참고.

- **기준 커밋**: [`0458bf3`](https://github.com/KHOAILANG0926/jobi-app/commit/0458bf3)
  (VietnamWorks 크롤러 추가 — 이 문서 최초 작성 시점인
  [`8b432e8`](https://github.com/KHOAILANG0926/jobi-app/commit/8b432e8)
  이후 확정된 기준까지 반영)
- **대상 사이트**: `vieclam24h.vn`(`--site vieclam24h`, 기본값), `vietnamworks.com`
  (`--site vietnamworks`)

---

## 1. 파이프라인 단계별 기준

### 1.1 원본 수집 (목록 → 상세 URL)

| 사이트 | 목록 수집 | 상세 수집 |
|---|---|---|
| vieclam24h | `crawl_category()` — `CATEGORY_URLS`(생활밀착형 10개+사무직 2개+지역별 8개+브랜드 키워드 3개) 순회 | `fetch_job_detail()` — heading 경계 기반 섹션 추출("Địa điểm làm việc"/"Mô tả công việc"/"Yêu cầu công việc"/"Quyền lợi"), `__NEXT_DATA__`의 `employer_info` 좌표(있으면) |
| VietnamWorks | `crawl_vietnamworks_category()` — `VIETNAMWORKS_CATEGORY_URLS`(목록 페이지 1개, 실측 1페이지당 300건 이상 공고 확보돼 추가 페이지 불필요) | `fetch_vietnamworks_job_detail()` — heading 텍스트 완전일치 기반 섹션 추출("Mô tả công việc"/"Yêu cầu công việc"/"Các phúc lợi dành cho bạn"/"Địa điểm làm việc"), JSON-LD(`schema.org JobPosting`)의 `validThrough`만 마감일에 사용 |

**VietnamWorks 상세페이지는 단계적으로 렌더링된다**(실측: `domcontentloaded` 직후엔
`h1`/일부 섹션만 있고 "Địa điểm làm việc"는 약 3초 후 별도로 나타남) —
`fetch_vietnamworks_job_detail()`는 "Thông tin việc làm" 헤딩이 나타날 때까지
최대 8초 폴리(`page.wait_for_function`)한 뒤 진행한다(고정 타임아웃 아님). 자세한
발견 경위는 [`CRAWLER_FIX_HISTORY.md` #8](CRAWLER_FIX_HISTORY.md#fix8).

**JSON-LD 주소는 근무지 데이터로 절대 쓰지 않는다** — 실측으로 화면에 보이는
"Địa điểm làm việc" DOM 텍스트와 JSON-LD `jobLocation.address.streetAddress`가
같은 공고에서 서로 다른 값을 가진 사례를 확인했다(같은 회사 건물인데 도로명이
다름). 화면에 실제로 보이는 값만 사용자가 보는 정보이므로, 근무지는 항상 DOM
텍스트만 채택한다(`fetch_vietnamworks_job_detail()` 함수 docstring 참고).

### 1.2 추출 (상세 → 후보 필드)

| 사이트 | 조립 함수 | 근무지 추출 |
|---|---|---|
| vieclam24h | `build_job_record()` | `split_work_locations(section_text, with_region=True)` — 원문 자체가 `"<지역>:"` 접두사를 제공 |
| VietnamWorks | `build_vietnamworks_job_record()` | `_vietnamworks_location_candidates(location_lines)` — 각 줄을 `split_work_locations(..., with_region=False)`로 정제 후 `guess_province_from_text()`로 지역명을 별도 추정(원문에 콜론 접두사가 없음) |

공통으로 재사용하는 것: `classify_work_location_candidate()`(exact/region_only/
undetermined 판정), `resolve_work_locations()`(4~7단계 파이프라인), `gate_auto_publish()`
(공개 게이트), `validate_job_payload(job, source=...)`(품질 검증 — `source`로
`[source:<site>]` 태그를 사이트별로 검사).

### 1.2-1 급구(urgent) 판정 — 명시적 표현만 인정 (2026-09-10)

- **이전 기준**: `build_job_record()`/`build_vietnamworks_job_record()` 둘 다
  사이트에 별도 "급구" 배지 필드가 없어(원문 HTML/상세 데이터 어디에도
  `detailUrgent` 류의 필드가 추출되지 않음, 실측 확인) `"urgent": False`를
  무조건 저장했다 — 신규 공고는 사이트에 실제로 "Tuyển gấp"이 적혀 있어도
  항상 `urgent=false`로 들어갔다.
- **변경**: `job_quality.detect_explicit_urgent_hiring(title, description)` —
  제목·본문에 **"tuyển gấp"** 문구(발음 구별 기호·대소문자 무관, 단어 경계
  매칭)가 실제로 있을 때만 `True`. 두 크롤러 모두 이 함수 결과를
  `"urgent"` 필드에 그대로 쓴다(무조건 `False` 하드코딩 제거).
- **근거(2026-09-10, 운영 DB 읽기 전용 조회 — 신규 크롤링·저장 없음)**:
  활성(active=true) 공고 중 description에 "tuyển gấp"이 실제로 3건 있었고
  (job_id 4487/4507/4533, 전부 vieclam24h 소스), 셋 다 "Cần tuyển gấp, đi
  làm ngay" 형태의 명확한 채용 긴급성 표현이었다(title 매칭은 0건). 반면
  "khẩn cấp"은 2건 매칭됐지만(job_id 4419/4620) 전부 HSE(안전관리) 직무의
  "ứng phó tình huống khẩn cấp"(비상 상황 대응 업무 설명)로, 채용 긴급성과
  무관한 오탐이었다 — 그래서 "khẩn cấp"과 "gấp" 단독은 판정 근거에서
  제외했다. 급여 수준·마감일 임박만으로 급구를 추정하지 않는다.
- **기존 저장 공고에는 적용하지 않음**: `urgent`는 `job_quality.
  UPDATE_TRACKED_FIELDS`(§1.3)에 포함돼 있지 않으므로, 이미 저장된 공고를
  재방문(`compute_job_updates()`)해도 `urgent` 값은 절대 갱신되지 않는다 —
  이 변경은 앞으로 **신규로 처음 저장되는 공고**의 INSERT 값에만 적용된다.
  기존 3건(4487/4507/4533)을 포함한 기존 운영 공고의 일괄 재분류는 실행하지
  않았다 — 필요하면 별도 승인 후 진행.
- **테스트**: `crawler/test_job_quality.py`의
  `test_detect_explicit_urgent_hiring`(참 4건/거짓 1건/오탐 방지 3건,
  위 실측 사례를 그대로 테스트 케이스화) — `python test_job_quality.py`로
  19/19 전체 통과 확인(2026-09-10).

### 1.3 DB 저장

- 단 하나의 저장 경로: `upsert_job_record()` — 신규든 기존 재방문이든 이 함수만 거친다(vieclam24h/VietnamWorks 공통).
- 기존 공고 조회: `load_existing_lookup_maps(source="vieclam24h"|"vietnamworks")` — description의 `"[source:<site>]"` 태그로 **사이트별로 분리** 조회한다. 분리하지 않으면 서로 다른 사이트의 우연히 같은 제목+회사 공고가 서로를 "이미 존재"로 잘못 매칭할 수 있다(2026-09-08 VietnamWorks 추가 시 `source` 파라미터화, 기본값 `"vieclam24h"`로 기존 동작 100% 유지).
- 저장 진입점: `save_to_supabase(jobs, source="vieclam24h"|"vietnamworks")` — 마찬가지로 사이트별 파라미터.
- 기존 공고 업데이트 범위(`compute_job_updates()`, `job_quality.UPDATE_TRACKED_FIELDS`): `salary`/`application_deadline`/`description`/`location`/`source_url`/`preference`/`education`/`work_period`/`num_hires`/`hours`/`work_days`/`recruitment_regions`만 갱신 대상 — `title`/`company`/`id`는 이 경로로 절대 변경되지 않는다(구조적 보장, 화이트리스트 밖 필드는 diff 대상 자체가 아님). `active`/`publish_gate_reason`/`crawler_version`/`last_verified_at`은 `origin='crawler'`이고 `admin_hidden`이 아니며 이번 판정에 지오코딩 일시 오류가 없었을 때만 함께 갱신된다.

### 1.4 좌표 판정 — 크롤타임 vs 재지오코딩 스윕

두 개의 서로 다른 시점에 서로 다른 함수가 관여한다 — 혼동하지 않는다.

1. **크롤타임**(신규 발견/재방문 즉시): `resolve_work_locations()` → `geocode.resolve_coordinate_accuracy(raw_address, province)` → `crawl_topcv._coordinate_accuracy_for_db()`(DB 컬럼 값으로 변환, `exact_candidate`를 독립 검증 없이 `exact`로 승격하지 않음).
2. **재지오코딩 스윕**(별도 실행, `regeocode_work_locations.py --geocode-status pending|failed --apply` 또는 `--regeocode-work-location-ids`): 이미 저장된 `pending`/`failed` 행을 대상으로 `_resolve_province_hint()`/`_region_matches_strictly()`/`_build_update_payload()`가 관여 — CHECK 제약과 호환되게 `exact_candidate`를 `unresolved`로 낮추고, 미검증 후보는 `manual`로, 지역 불일치는 강제 `manual`로 분류한다.

크롤타임에 처음 만들어진 `pending`(성·시 텍스트만 있음) 행은 **최종 상태가 아니다** — 신규 공고 처리 후 반드시 재지오코딩 스윕으로 `success`/`manual`/`failed` 중 하나로 확정해야 한다(§9 pending 0건 기준 참고).

### 1.5 화면 표시

- 지도: `src/lib/jobCoords.ts`의 `resolveMapLocations()` — §7 참고.
- 상세페이지 캡션: `src/pages/JobDetail.tsx`(약 line 370~510) — `geocodeStatus`/`addressAccuracy`/`coordinateAccuracy`/`locationVerified` 조합으로 4가지 캡션 중 하나 렌더(§6/§7 참고).
- 거리검색: `resolveDistanceSearchPoints()`/`resolveDistanceSearchPoint()` — §7 참고.

---

## 2. 다중 근무지 보존 · 동일 장소 병합 · 모집지역 라벨 보존

- **원칙**: 구조화된 근무지 항목(원문의 "Địa điểm làm việc"에 실제로 나열된 항목)은 전부 보존한다 — 하나로 합치거나 임의로 누락시키지 않는다.
- **병합 조건** (`_group_candidates_by_core_location()`): 같은 "core 주소"(모집지역 접미사를 뺀 핵심 주소)를 가진 후보만 하나로 묶는다. 병합 판정 신호는 `_MERGE_HOUSE_NUMBER_RE`/`_MERGE_STRONG_PLACE_SIGNAL_RE` — **브랜드명 속 숫자(예: "GS25")는 병합 신호로 인정하지 않는다**(과거 이 숫자를 신호로 오인해 서로 다른 5개 매장이 1개 행으로 병합된 결함이 있었음 — [`CRAWLER_FIX_HISTORY.md` #1](CRAWLER_FIX_HISTORY.md#fix1)).
- **신호가 전혀 없을 때(region_only)**: `_strip_recruitment_region_suffix()`는 후보 텍스트에 특정 장소 신호가 하나도 없으면 원문 전체를 그대로 core로 반환한다(꼬리를 지우지 않음) — 서로 다른 구·군이 우연히 같은 필러 문구로 수렴해 병합되는 것을 막는다.
- **대표값 선정** (`_select_group_representative()`): 병합된 그룹 안에서는 번지·도로·Lô·건물·공장 정보가 가장 구체적인 원문을 저장한다(최단 문자열이 아님 — 동점일 때만 보조 기준).
- **모집지역 라벨 보존** (`matched_recruitment_regions`): 병합으로 사라질 수 있는 구·군 라벨은 `_trailing_district_label()`로 별도 수집해 함께 보존한다(병합된 경우, 즉 그룹 멤버가 2개 이상일 때만 — 단일 후보 그룹은 기존처럼 `region_prefix`만 담는다). 이 필드는 "이 근무구역 1개"에 매칭된 지역 라벨이고, 공고 전체 모집지역인 `local_jobs.recruitment_regions`(`_compute_job_recruitment_regions()`, 근무지 행이 0건이어도 보존됨)와는 별개 개념이다 — 좌표는 지역별로 절대 복제하지 않는다.
- **VietnamWorks 전용**: 제목/본문에 있지만 구조화된 근무지 목록에는 없는 지역은 `_vietnamworks_title_extra_regions()`가 골라내 **로그로만 출력**한다(job_work_locations/recruitment_regions 어디에도 자동 반영되지 않음) — 인식되지 않는 지명(2025년 성급 통합 여부가 불분명한 경우 포함)은 임의로 추정해 확정하지 않는다(§9 미구현 항목 참고, 실측 사례: job_id 4643 "Bạc Liêu").

## 3. 지오코딩 일시 오류 보호

- **신호**: `resolve_work_locations()`가 반환하는 `had_transient_geocode_failure`(어느 candidate든 API 요청 자체가 실패하면 True) — 이번 판정이 불완전하다는 뜻이며, 좋은 기존 데이터를 불완전한 결과로 덮어쓰면 안 된다.
- **판단 기준은 "local_jobs 매칭 여부"가 아니라 "job_work_locations에 이미 행이 있는가"** — `_has_existing_work_locations(job_id)`. 신규 INSERT든 기존 job 재처리(`--reprocess-ids`)든 이 기준 하나로 통일한다. `job_work_locations`가 이미 0건이면(지킬 데이터가 없음) transient 오류와 무관하게 이번 판정을 저장하고, 1건 이상 있으면 transient 오류 시 기존 데이터를 그대로 둔다.
- **제한적 재시도**: `geocode._TRANSIENT_RETRY_ATTEMPTS = 2`(최초 1회 + 재시도 1회) — 요청 자체가 실패(타임아웃/연결 오류)한 경우에만 재시도한다. 정상 응답이 왔지만 결과가 없는 경우(`no_results`)는 재시도 대상이 아니다 — 무한 재시도는 어떤 경우에도 하지 않는다.

## 4. `--new-only` 조건

- 이미 DB에 있는 `source_url`은 **상세 수집·주소 처리(Geoapify 호출 포함)·업데이트를 전혀 하지 않고 즉시 건너뛴다** — `_filter_new_only_candidates(candidates, existing_hrefs, limit)`가 목록 후보 단계에서 먼저 걸러내므로, 이미 존재하는 후보는 상세페이지 요청 자체가 발생하지 않는다.
- **종료 조건**: 신규 저장 **성공** 건수가 목표(`--sample-limit`)에 도달하는 즉시, 배치(카테고리 페이지) 중간이라도 정확히 멈춘다 — 목표를 채운 뒤에 남은 후보는 더 보지 않는다.
- vieclam24h는 `--sample-offset`(0 초과)과 함께 쓸 수 없다(목적이 겹침 — 이미 있는 후보를 건너뛰는 방법이 두 가지로 갈리면 혼란). VietnamWorks는 `--sample-offset` 자체를 아직 지원하지 않는다(이번이 첫 크롤이라 기존 공고 0건 — 건너뛸 상위 후보 개념이 아직 없음, §9).
- `--sample-limit`의 기존 1~10 상한은 `--new-only`/`--site`와 무관하게 그대로 유지된다(사고 재발 방지 안전장치, 우회 불가) — 20건 이상을 모으려면 여러 번의 `--new-only` 실행을 반복해야 한다(vieclam24h 21건: 2회+3회 실행, VietnamWorks 20건: 2회 실행).

## 5. 지역 힌트 · 지역 불명 시 성공 금지 · 지역 일치 검사 · manual/failed 전환 시 좌표 제거

- **지역 힌트(region_prefix/province) 확보 방법**: vieclam24h는 원문 자체의 `"<지역>:"` 접두사(`split_work_locations(with_region=True)`). VietnamWorks는 각 근무지 텍스트에서 `guess_province_from_text()`로 별도 추정 — 영어 표기 주소(예: "...Yen Hoa Ward, Hanoi")도 인식되도록 `job_quality._PROVINCE_ALIASES`에 영어 성·시 별칭을 추가했다(이미 알려진 성·시와 동일 대상만 인식시킬 뿐, 새 성·시를 만들지 않음 — 2025년 성급 통합 여부가 불분명한 지명은 추가하지 않음).
- **지역을 확정하지 못하면 자동 성공 금지**:
  - 재지오코딩 스윕에서: `_build_update_payload()`가 province=None이면 지역 검증을 건너뛰지 않고 **강제로 `manual`**로 낮춘다.
  - 크롤타임에서(VietnamWorks): `geocode._region_text_matches(top, expected_region_text)`는 `expected_region_text`가 `None`이면 **무조건 `True`를 반환**한다(geocode.py 기존 동작, 변경하지 않음 — vieclam24h는 원문이 항상 지역 접두사를 제공해 이 경로를 사실상 타지 않는다). VietnamWorks는 영어 주소 등으로 지역을 못 찾을 수 있어 이 loophole에 실제로 노출될 수 있으므로, `crawl_topcv._enforce_region_confirmed_before_success()`가 크롤타임 결과에 대해 **사후 검사**한다 — `matched_recruitment_regions`가 비어 있는(=지역을 하나도 확정 못 한) 행이 `geocode_status='success'`로 나오면 좌표를 지우고 `failed`로 되돌린다. `resolve_work_locations()`/`geocode.py` 자체는 수정하지 않았다 — 그 출력만 보고 판단하는 순수 후처리이며 vieclam24h 경로는 이 함수를 호출하지 않는다.
- **지역 일치 검사**: `_resolve_province_hint()`가 `matched_recruitment_regions`(DB에 이미 저장된 신뢰할 수 있는 원문 지역 라벨)를 **최우선**으로 쓰고, 없을 때만 텍스트 추측(`guess_province_from_text(raw_address)`)으로 보조한다. 저장 직전 최종 관문은 `_region_matches_strictly()` — `geocode._region_text_matches()`가 state/county/city 등 여러 필드 아무 곳에서나 일치하면 통과시키는 의도적 관대함을 갖는데, 이 관대함이 실측 오탐(예: `city="Lạng Sơn"`이 우연히 일치했지만 `state="Đắk Lắk Province"`는 명백히 다른 경우)을 냈으므로, `state` 필드를 최우선으로 엄격히 비교하는 로컬 함수로 최종 확인한다.
- **manual/failed 전환 시 잔재 좌표 제거**: `manual`/`failed`로 낮추는 모든 경로는 `lat`/`lng`/`coordinate_accuracy`/`geocode_source`를 payload에 **명시적으로 `None`**으로 넣는다 — 이 필드들을 payload에서 아예 빼면 Supabase 부분 업데이트 특성상 이전 `success` 시절의 잘못된 좌표가 그대로 남는 결함이 실측으로 확인됐다(운영 DB에서 62건 발견·정리, [`CRAWLER_FIX_HISTORY.md` #6](CRAWLER_FIX_HISTORY.md#fix6)).

## 6. 상태값 구분 (혼동 금지)

4개의 서로 다른 컬럼/개념이며, 하나를 다른 것의 값처럼 쓰지 않는다 — 특히
**`region_only`는 `geocode_status`의 값이 아니라 `address_accuracy`의 값**이다.

| 개념 | 컬럼 | 허용 값 | 의미 |
|---|---|---|---|
| 주소 상세도 | `job_work_locations.address_accuracy` | `exact_text`, `region_only` | 원문 텍스트 자체가 구체적 장소를 가리키는지(번지/시설명 등) — `classify_work_location_candidate()` 판정 |
| 지오코딩 처리 상태 | `job_work_locations.geocode_status` | `pending`, `success`, `failed`, `manual` | 이 행의 좌표 조회가 어느 단계인지 — `pending`=아직 조회 시도 안 함(구체 장소가 없어 조회 자체를 안 함, 또는 크롤타임 이후 재지오코딩 대기), `success`=신뢰 가능한 좌표 확보, `failed`=조회했으나 신뢰 가능한 좌표 없음, `manual`=후보 좌표는 있으나 독립 검증 안 됨(사람 확인 필요) |
| 좌표 정확도 등급 | `job_work_locations.coordinate_accuracy` | `exact`, `ward`, `region`, `unresolved` | DB에 저장되는 값 — 파이프라인 내부 어휘인 `exact_candidate`는 **DB에 절대 그대로 들어가지 않는다**(`_coordinate_accuracy_for_db()`가 `source_verified=True`일 때만 `exact`로 승격, 아니면 `unresolved`로 낮추고 좌표도 비움) |
| 원문 좌표 검증 여부 | `job_work_locations.location_verified` | `boolean` | `source_verified`(고용주 등록 좌표와 근무지 텍스트가 실제로 일치함이 확인됨) 그대로 저장 — vieclam24h만 지원(§9), VietnamWorks는 이 메커니즘 자체가 없어 항상 `False` |

**`success` 또는 지역 일치만으로 "정확한 사업장 위치가 입증됐다"는 뜻이 아니다.**
`resolve_coordinate_accuracy()` 자체의 문서화된 한계(2026-09-04 감사 기록): `exact_candidate`는
"우리 자신의 2+ 질의 변형이 서로 300m 이내로 수렴했다"는 뜻일 뿐 실제 정확도를
보장하지 않는다 — 당시 감사에서 `exact_candidate` 11건 중 3건이 독립 확인 시
405m~2.6km 오차를 보였다. `ward` 등급(더 낮은 확신)은 더더욱 "정확한 위치"가
아니다 — 이 등급이 `success`로 저장되는 건 "성·시/구·군 수준까지는 신뢰 가능"
정도의 의미다. 화면에서도 `verifiedWard`(=`location_verified=true`인 `ward`)만
"확인된 위치"로 표시하고, 나머지 `ward`(미검증)는 "미검증" 캡션을 그대로 유지한다(§7).

## 7. 지도 표시 · 근사 위치 안내 · 거리검색 허용 조건 (실제 코드 대조)

`src/lib/jobCoords.ts` 기준 — 코드를 다시 읽고 대조함, 추측 없음.

- **지도 표시 정책**: "모든 위치 등급에서 지도 표시 시도"(`resolveMapLocations()`). `geocodeStatus==='pending'`이고 `addressAccuracy==='exact_text'`인 근무지만 좌표 생성을 보류한다(아직 확인 안 된 구체 주소를 임의 좌표로 보여주지 않기 위함) — `addressAccuracy==='region_only'`인 `pending`은 **기존처럼 `findRegionCenter()` 지역 대표 좌표를 그대로 보여준다**(pending 여부와 무관, [`CRAWLER_FIX_HISTORY.md` #3](CRAWLER_FIX_HISTORY.md#fix3)).
- **캡션 우선순위**(`JobDetail.tsx`): ① `geocodeStatus==='pending' && !isRegionOnlyText` → "아직 확인 중" ② `isRegionOnlyText`(=`addressAccuracy==='region_only'`) → "행정구역 단위 근사 위치, pending 여부 무관하게 항상 이 문구" ③ `tier==='ward' && locationVerified===true` → "확인된 위치"(Tier A) ④ 그 외 `tier!=='exact'` → "미검증 근사 위치, 거리계산 미사용"(문구상 안내일 뿐, 실제 거리검색 포함 여부는 별도 함수 — 아래 참고) ⑤ `tier==='exact'` → 정확한 위치.
- **거리검색은 2단계 자격**(`resolveDistanceSearchPoints()`/`resolveDistanceSearchPoint()`, 2026-09-05 정책): **정밀**(`locationVerified===true`, `precise=true`, "N km" 표시) 또는 **근사**(미검증이지만 `coordinateAccuracy`가 `exact` 또는 `ward`이고 실제 `lat`/`lng`가 있음, `precise=false`, "~N km" 표시) 중 하나면 포함된다. `coordinateAccuracy==='region'`은 실제 좌표(행정 중심)가 있어도 **등급과 무관하게 항상 제외**된다(테스트: `testDistanceSearchOnlyUsesVerifiedLocations` — 함수명은 과거 정책 시절 이름이 남아있고 실제 검증 내용은 2단계 정책 그대로 반영돼 있음, §8).
- **주의**: `JobDetail.tsx`의 개별 캡션 문구("không dùng để tính khoảng cách" 등)는 위 함수의 실제 포함/제외 결과와 문구가 정확히 대응하지 않는 경우가 있다(예: 미검증 `ward`는 캡션상 "거리계산 미사용"이라 적혀 있지만 `resolveDistanceSearchPoints()`는 이를 근사 자격으로 실제로 포함한다) — 이 문서 작성 중 재확인된 기존 특성이며, 이번 크롤러 작업으로 새로 생긴 문제는 아니다. 캡션 문구 자체의 정확성 개선은 이 문서의 범위 밖(§9 미확인).

## 8. 관련 자동 테스트 파일 대응 관계

| 테스트 파일/함수 | 대응하는 기준 |
|---|---|
| `crawler/test_cli_safety.py` | §4 — `--new-only`/`--sample-limit`/`--sample-offset`/`--site` 조합의 CLI 안전장치 (21/21) |
| `crawler/test_address_pipeline_integration.py` | §2(그룹핑), §3(transient 보호), §4(`_select_sample_window`/`_filter_new_only_candidates`) 등 순수 로직 회귀 + 주소·근무지 파이프라인 전반 (54/54) — 특히 `test_group_candidates_by_core_location_*`(그룹핑), `test_*_transient_geocode_failure_*`/`test_reprocessed_existing_job_with_zero_work_locations_*`(§3) |
| `crawler/test_regeocode_work_locations.py` | §5 — `test_resolve_province_hint_prefers_matched_recruitment_regions`, `test_update_payload_forces_manual_when_province_unknown_even_with_real_coordinates`, `test_update_payload_forces_manual_when_region_mismatch`, `test_update_payload_still_succeeds_when_region_genuinely_matches`, `test_failed_and_manual_are_distinguishable_outcomes` (11/11) |
| `crawler/test_geocode.py` | §3 — 제한적 재시도(무한 재시도 금지), 정상 `no_results`는 재시도 안 함 (6/6) |
| `crawler/test_job_quality.py` | §6(좌표 등급 CHECK 호환), §5(`test_guess_province_from_text_recognizes_english_province_names` — 영어 지명 별칭), §1.2-1(`test_detect_explicit_urgent_hiring` — 급구 판정 참/거짓/오탐 방지) (19/19) |
| `crawler/test_vietnamworks_extraction.py` | §1.2/§2/§5 VietnamWorks 전용 — 단일 주소/다중 근무지 일치/제목-필드 불일치 3사례, `_enforce_region_confirmed_before_success` (8/8) |
| `src/lib/jobCoords.test.ts` | §7 — `testPendingGeocodeStatusIsDistinctFromDefaultAndNeverFallsBackToText`, `testRegionOnlyPendingRealVungTauCase`, `testRegionOnlyPendingStillShowsRegionCenterMap`, `testFindRegionCenterCoversEveryProvinceUsedByRegionOnlyProductionData`, `testDistanceSearchOnlyUsesVerifiedLocations`, `testMapShownForEveryLocationTier` |

## 9. 미구현 · 미확인 항목 (과장하지 않음)

- **미구현**: VietnamWorks의 `employer_coordinate`(원문 좌표 대조를 통한 `source_verified`/`location_verified=true` 승격 경로) — vieclam24h만 지원. VietnamWorks 근무지는 구조적으로 전부 `location_verified=false`다.
- **미구현**: VietnamWorks의 `--sample-offset`(반복 실행 시 다른 후보 구간 처리) — 이번이 첫 크롤이라 필요성 자체가 아직 없었음. 필요해지면 vieclam24h와 동일한 방식(`_select_sample_window`)으로 추가 가능.
- **설계상 로그 전용(DB 미저장)**: `_vietnamworks_title_extra_regions()`의 반환값(제목에만 있는 추가 지역)은 콘솔 로그에만 출력되고 `job_work_locations`/`recruitment_regions` 등 어떤 DB 컬럼에도 저장되지 않는다 — 사람이 로그를 보고 판단할 근거일 뿐, 이 로그가 실제로 검토됐는지는 별도 확인 대상이다.
- **미확인**: `JobDetail.tsx` 캡션 문구와 `resolveDistanceSearchPoints()`의 실제 포함/제외 결과 간 불일치(§7 주의 문단)의 문구 수정 필요 여부 — 이번 작업 범위에서 조사만 하고 수정하지 않음.
- **미확인**: 정기 수집 일정(cron/GitHub Actions)의 현재 활성 여부 — 이 문서와 연결된 기록(`crawler/README.md`)에는 설정 방법만 있고 실제 가동 여부를 확인한 기록은 없다. [`WORK_STATUS.md`](WORK_STATUS.md) 참고.
- **미확인**: Facebook 크롤러의 로그인/쿠키 유효 상태 — 이번 2일간 작업은 vieclam24h/VietnamWorks만 다뤘고 Facebook 경로는 건드리거나 확인하지 않았다.
