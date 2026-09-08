# 크롤러 오류 수정 이력

[`CRAWLER_BASELINE.md`](CRAWLER_BASELINE.md)에 기록된 현재 기준이 왜 지금
형태가 됐는지의 근거 문서. 각 항목은 원인 / 실제 재현 사례 / 수정 내용 /
관련 테스트 / 커밋 / 남은 한계 순으로 적는다. **확인된 사실과 당시 추측은
구분해서 적는다** — 커밋 메시지에 실측 근거가 없는 내용은 만들어 넣지 않았다.

---

<a id="fix1"></a>
## 1. 서로 다른 구·군 근무지가 그룹핑으로 소실된 문제

- **원인**: `_group_candidates_by_core_location()`이 병합 판정에 쓰던 신호
  (`_SPECIFIC_PLACE_SIGNAL_RE`)에 두 가지 결함이 있었다. (1) bare `\d`가
  "GS25" 같은 브랜드명 속 숫자에도 걸려 서로 다른 매장을 하나로 병합했다.
  (2) 후보 전체에 신호가 전혀 없으면(순수 `region_only`) 마지막 남은
  세그먼트가 범용 필러 문구("toàn khu vực" 등) 하나로 수렴해, 서로 다른
  구·군이 병합됐다.
- **실제 재현 사례**: `job_id=4596`(GS25 편의점 5개 지점이 1개 행으로
  병합), `job_id=4500`("toàn khu vực, Tân Phú"/"Toàn khu vực, Quận 11" 등
  서로 다른 구가 병합), `job_id=4562`. 완전성 스캔 결과 표본 72개 공고 중
  22개에서 총 55건의 근무지가 이 패턴으로 소실된 것으로 확인됨.
- **수정 내용**: 병합 판정 전용 로컬 신호 `_MERGE_HOUSE_NUMBER_RE`/
  `_MERGE_STRONG_PLACE_SIGNAL_RE`를 새로 정의해 브랜드명 속 숫자를 신호로
  인정하지 않게 했다. `_strip_recruitment_region_suffix()`는 후보 전체에
  신호가 전혀 없으면 원문 전체를 그대로 core로 반환(꼬리를 지우지 않음)
  하도록 변경했다. 병합되며 사라질 수 있는 구·군 라벨은 `_trailing_
  district_label()`을 신설해 `matched_recruitment_regions`에 보존하도록
  했다. 기존 의도(동일 KCN/번지·도로 반복 + 모집지역 라벨만 다른 경우는
  여전히 병합)는 유지.
- **관련 테스트**: `test_group_candidates_by_core_location_kcn_facility_dedup`,
  `test_group_candidates_by_core_location_plain_address_region_suffix`,
  `test_group_candidates_by_core_location_does_not_merge_different_places`,
  `test_group_candidates_by_core_location_does_not_merge_different_region_only_districts`,
  `test_group_candidates_by_core_location_does_not_merge_chain_brand_different_districts`,
  `test_group_candidates_by_core_location_still_merges_real_repeated_physical_address`,
  `test_resolve_work_locations_keeps_distinct_region_only_districts_as_separate_rows`
  (`test_address_pipeline_integration.py`).
- **커밋**: [`36a0ae1`](https://github.com/KHOAILANG0926/jobi-app/commit/36a0ae1)
- **남은 한계**: 커밋 당시 운영 DB 쓰기·Geoapify 실호출·push·배포는 하지
  않았다(함수 수준 재실행으로만 수정 전후 비교) — 이미 저장된 과거 데이터의
  실제 복구 여부는 이 커밋만으로는 확인되지 않는다.

---

<a id="fix2"></a>
## 2. 신규 또는 근무지 0행 공고가 일시 오류로 저장되지 않은 문제

두 차례에 걸쳐 수정됐다 — 1차 수정 기준이 실제로는 불충분했음이 재현으로
드러났다.

- **원인(1차)**: `upsert_job_record()`의 `"if job_id and not had_transient:
  _replace_job_work_locations(...)"` 가드는 재크롤 중 geocode API 일시
  오류로 기존 좋은 데이터를 불완전한 결과로 덮어쓰지 않기 위한 보호였는데,
  `existing`이 `None`(브랜드 뉴 잡)인 경우에도 동일하게 적용돼 지킬 기존
  데이터가 없는데도 저장을 건너뛰었다.
- **실제 재현 사례(1차)**: `job_id=4572`("Kỹ Sư Xây Dựng" — 원문 근무지
  "Số 471 Tam Trinh, phường Hoàng Mai (Trụ sở công ty), Hoàng Mai" 1건,
  추출/분류(`exact`) 전부 정상인데 `job_work_locations` 행 0건). 동일 원인으로
  영향받은 활성 공고 5건 확인(`job_id` 4390/4474/4478/4512/4572, 전부
  2026-09-05 같은 크롤 배치, 전부 실제 상세주소 있음/`classify=exact`,
  geocode 캐시 미존재 — 동일 시그니처).
- **수정 내용(1차)**: `existing`이 `None`이면 `had_transient`와 무관하게
  저장하도록 변경(신규는 지킬 데이터가 없으므로 보호 불필요). 기존 공고
  재크롤 시의 보호는 그대로 유지.
- **원인(2차, 1차 수정의 재현된 불충분함)**: 1차 수정을 `job_id=4572`에
  대해 실제 `--reprocess-ids`로 검증하던 중 재현됨 — 그 공고는 이미
  `local_jobs`에 존재하므로 `match_existing_row()`가 항상 `existing`을
  찾아 UPDATE 경로를 타고, "existing is None" 조건이 이 경로에서는 절대
  성립하지 않았다. 재처리 중 또 transient 오류를 만나 여전히
  `job_work_locations` 0건으로 남는 것을 직접 확인했다.
- **수정 내용(2차)**: "지킬 기존 데이터가 있는가"를 local_jobs 매칭 여부가
  아니라 `job_work_locations`에 실제 행이 있는가(`_has_existing_work_
  locations()`, 신설)로 판단하도록 교체 — 신규 INSERT든 기존 job 재처리든
  동일한 기준 적용.
- **관련 테스트**: `test_new_job_transient_geocode_failure_still_saves_
  work_locations`, `test_reprocessed_existing_job_with_zero_work_locations_
  still_saves_on_transient_failure`, `test_reprocessed_existing_job_with_
  existing_work_locations_still_protected_on_transient_failure`,
  `test_transient_geocode_failure_never_republishes_or_corrupts_existing_
  verified_job` (`test_address_pipeline_integration.py`).
- **커밋**: 1차 [`0f7d175`](https://github.com/KHOAILANG0926/jobi-app/commit/0f7d175),
  2차 [`6ad1a68`](https://github.com/KHOAILANG0926/jobi-app/commit/6ad1a68)
- **남은 한계**: 두 커밋 모두 로직 수정·테스트 검증만 하고 운영 DB 실제
  복구(위 5건 등)는 별도 승인 후 진행한다고 명시돼 있다 — 이 문서 작성
  시점에 그 5건이 실제로 복구됐는지는 이 커밋들만으로는 확인되지 않는다
  ([`WORK_STATUS.md`](WORK_STATUS.md)의 미확인 항목 참고).

---

<a id="fix3"></a>
## 3. `region_only`와 `pending`의 지도 표시 충돌

- **원인**: `addressAccuracy==='region_only'`인 근무지는 `geocodeStatus===
  'pending'`이어도 기존 `findRegionCenter()` 지역 대표 지도를 그대로
  보여줘야 하는데, 먼저 들어간 "모든 근무지가 pending이면 무조건
  `source:'pending'`" 처리가 이미 잘 동작하던 `region_only` 텍스트 매칭
  fallback을 가려버렸다.
- **실제 재현 사례**: 커밋 메시지에 특정 `job_id`는 명시돼 있지 않음 —
  코드 리뷰/논리 분석으로 발견된 회귀로 기록돼 있다(추측 아님, 다만
  실제 운영 사례 ID는 이 커밋에 남아있지 않다는 뜻).
- **수정 내용**: `jobCoords.ts`의 `resolveWorkLocationMapPoint()`가
  `addressAccuracy==='exact_text'` + `geocodeStatus==='pending'`일 때만
  임의 좌표 생성을 막도록 정정(`region_only` + `pending`은 기존처럼
  `findRegionCenter` fallback을 그대로 탐). `resolveMapLocations()`의
  `'pending'` 판정 시점도 "전부 pending이면 무조건"에서 "위 로직으로
  점을 하나도 못 만들었을 때"로 변경. `JobDetail.tsx`의 근무지별 안내문
  우선순위도 `"pending && !isRegionOnlyText"`로 정정 — `region_only`는
  `pending` 여부와 무관하게 "지역 대표 위치" 문구를 유지하고, `exact_text`
  + `pending`만 "위치 확인 중"을 보여준다.
- **관련 테스트**: `testPendingGeocodeStatusIsDistinctFromDefaultAndNeverFallsBackToText`
  (`src/lib/jobCoords.test.ts`, 기존 잘못된 가정을 전제한 테스트를 정정 +
  두 분기를 각각 검증하는 신규 테스트 2건 추가, 9/9 통과).
- **커밋**: [`00aed9b`](https://github.com/KHOAILANG0926/jobi-app/commit/00aed9b)
- **남은 한계**: 지역 대표 좌표는 `precise=false` 유지, 거리검색은 여전히
  제외(좌표 자체가 없어 `resolveDistanceSearchPoints` 대상이 아님) — 이
  동작 자체는 의도된 것이며 한계로 기록할 결함은 아니다.

---

<a id="fix4"></a>
## 4. 지역 대표 위치 매핑 누락

- **원인**: `findRegionCenter()`(`src/lib/jobCoords.ts`)의 `PLACES` 표에
  일부 실제 사용 중인 성·시가 없었다.
- **실제 재현 사례**: 읽기 전용 집계(`job_work_locations.address_
  accuracy='region_only'` 76건의 `matched_recruitment_regions`) 결과,
  실제 사용 중인 고유 성·시 26개 중 17개가 `findRegionCenter`에 없어
  지도 좌표를 전혀 못 받고 있었다 — 실측 사례: `job_id=436`
  "Toàn khu vực, Vũng Tàu"(`region_only`+`pending`).
- **수정 내용**: 임의 좌표를 만들지 않고 기존 백엔드 표준화 자료를 그대로
  재사용 — `crawler/vn_province_merger_2025.py`(2025년 성급 통합표,
  2025-07-01 시행)로 통합 대상을 확인하고 `crawler/job_quality.py`의
  `PROVINCE_COORDS`(그 새 성의 좌표)를 그대로 가져다 씀(예: Bà Rịa - Vũng
  Tàu → Hồ Chí Minh, Bến Tre/Trà Vinh → Vĩnh Long 등). `PROVINCE_COORDS`에
  없는 2개(Yên Bái→Lào Cai, Lạng Sơn — 두 표 다 실제로 등장한 성 위주로만
  채워져 있어 빠져 있었음)만 공개된 성도(省都) 좌표를 직접 추가. 26개
  전부가 실제 존재하는 알려진 성·시였고 판독 불가능한 문자열은 없었다.
- **관련 테스트**: `testRegionOnlyPendingRealVungTauCase`,
  `testFindRegionCenterCoversEveryProvinceUsedByRegionOnlyProductionData`
  (`src/lib/jobCoords.test.ts`, 11/11 통과).
- **커밋**: [`041267a`](https://github.com/KHOAILANG0926/jobi-app/commit/041267a)
- **남은 한계**: 이 26개는 "당시 실제 운영 데이터에 등장한" 성·시 집합
  기준이다 — 그 이후 새로 등장한 `region_only` 성·시가 이 표에 없을
  가능성은 이 커밋만으로는 배제되지 않는다(신규 크롤마다 재확인 필요).

---

<a id="fix5"></a>
## 5. `province=None`과 동명 지역으로 지역 검증이 통과된 문제

- **원인**: `regeocode_work_locations.py`가 `matched_recruitment_regions`
  (DB에 이미 저장된 신뢰할 수 있는 원문 지역 라벨) 대신 `guess_province_
  from_text(raw_address)`로 지역을 재추측했다. "Lạng Sơn"/"Thanh Trì"
  (하노이 구)/"Quận 10"(호치민 구)처럼 텍스트만으로 인식 안 되는 지역명은
  `province=None`이 됐고, `resolve_coordinate_accuracy()` 내부의
  `_region_text_matches(top, None)`은 무조건 `True`를 반환해 지역 검증이
  완전히 무력화됐다.
- **실제 재현 사례**: 그 결과 confidence와 무관하게 지리적으로 무관한
  동명 지점(예: "Lạng Sơn"이 Đắk Lắk의 동명 마을로 확신도 1.0으로 매칭)이
  `ward` 등급 `success`로 저장됐다. 최종 저장 관문에서도 오탐이 재현됨:
  `city="Lạng Sơn"`이 우연히 일치했지만 `state="Đắk Lắk Province"`는
  명백히 다른 경우가 통과됐다.
- **수정 내용**: `_resolve_province_hint()`가 `matched_recruitment_
  regions`을 최우선으로 쓰고 없을 때만 텍스트 추측으로 보조하도록 변경.
  `province`가 `None`이면 지역 검증을 건너뛰지 않고 무조건 `manual`로
  낮춤. `_region_matches_strictly()`를 신설해 `state` 필드를 최우선으로
  엄격히 비교(`geocode._region_text_matches()`의 "여러 필드 아무 곳에서나
  일치하면 통과"라는 의도적 관대함이 이 오탐의 실질 원인이었음).
- **관련 테스트**: `test_resolve_province_hint_prefers_matched_
  recruitment_regions`, `test_update_payload_forces_manual_when_province_
  unknown_even_with_real_coordinates`, `test_update_payload_forces_manual_
  when_region_mismatch`(Lạng Sơn/Đắk Lắk 실측 그대로 재현),
  `test_update_payload_still_succeeds_when_region_genuinely_matches`(정상
  케이스 대조군) — `test_regeocode_work_locations.py` 11/11 통과.
- **커밋**: [`8df0f46`](https://github.com/KHOAILANG0926/jobi-app/commit/8df0f46)
- **남은 한계**: 이 커밋에서 운영 DB의 `success` 234건 전체를 수정된
  로직으로 재검증해 `success` 172 / `failed` 139 / `manual` 78로
  재분류했다(캐시 재사용, 지역 불일치 시에만 신규 API 호출) — 이 재분류가
  이 문서 작성 시점까지 유지되고 있는지는 이후 재크롤/재지오코딩 실행
  이력과 별도로 대조해야 한다(예: VietnamWorks/vieclam24h 신규 배치는
  이 로직을 그대로 물려받아 정상 동작함을 별도로 확인했음, §5/§6 관련
  이력 참고).

---

<a id="fix6"></a>
## 6. `manual`/`failed`로 전환해도 이전 좌표가 남은 문제

- **원인**: `manual`/`failed`로 낮추는 다운그레이드 payload가 `lat`/`lng`/
  `coordinate_accuracy`/`geocode_source` 키를 아예 포함하지 않았다 —
  Supabase 부분 업데이트(partial update) 특성상, payload에 없는 키는
  기존 값을 그대로 둔다. `pending`에서 다운그레이드할 때는 원래 좌표가
  없었으므로 안전했지만, `success`였다가 다운그레이드되는 경우 예전의
  잘못된 좌표가 그대로 DB에 남았다.
- **실제 재현 사례**: `id=622`(`job_work_locations.id`)에서 이 잔재
  좌표가 실측으로 확인됨.
- **수정 내용**: `manual`/`failed`로 낮추는 모든 경로가 `lat`/`lng`/
  `coordinate_accuracy`/`geocode_source`를 payload에 명시적으로 `None`
  으로 넣도록 변경(`_build_update_payload()`).
- **관련 테스트**: `test_update_payload_on_failure_never_touches_address_
  fields`, `test_update_payload_routes_unverified_exact_candidate_to_
  manual_not_failed`, `test_failed_and_manual_are_distinguishable_
  outcomes`(`test_regeocode_work_locations.py`) — 이 커밋([`8df0f46`](https://github.com/KHOAILANG0926/jobi-app/commit/8df0f46))에서
  기존 3건의 payload 형태 검증을 갱신.
- **커밋**: [`8df0f46`](https://github.com/KHOAILANG0926/jobi-app/commit/8df0f46)
  (§5와 같은 커밋 — 지역 검증 근본 수정과 잔재 좌표 정리가 함께 이뤄짐)
- **남은 한계**: 운영 DB 전체에서 잔재 좌표 62건을 발견해 백업 후 명시적
  으로 제거했고, 최종적으로 `manual`/`failed` 217건 전부 좌표 없음,
  `success` 172건 전부 좌표 있음을 확인했다고 커밋 메시지에 기록돼 있다
  — 그 이후(예: 이번 VietnamWorks 배치)에 새로 생성된 행에 대해서도
  동일 원칙(다운그레이드 시 명시적 `None`)이 코드 재사용을 통해 그대로
  적용됨을 확인했다(`_enforce_region_confirmed_before_success()`가 같은
  패턴으로 `lat`/`lng`/`coordinate_accuracy`를 명시적으로 지움).

---

<a id="fix7"></a>
## 7. 동일 상위 후보 반복 방문 / 기존 공고 업데이트 / 신규 목표 건수 초과 문제

- **원인(반복 방문)**: `--sample-limit`(최대 10건 상한)만으로는 카테고리
  목록의 같은 상위 후보를 매번 재방문했다 — 카테고리 순회 루프가
  `len(all_raw) >= limit`이면 즉시 멈추므로 `limit≤10`일 때 사실상 첫
  카테고리 URL 하나만 방문했고, 매 실행마다 `unique_raw[:limit]`가 항상
  동일한 최상위 N개를 골랐다.
- **실제 재현 사례(반복 방문)**: `--sample-limit 10`을 연달아 두 번 실행—
  1차 신규 3건, 2차 신규 0건(전부 업데이트)이 실측으로 확인됨.
- **원인(기존 공고 불필요 업데이트)**: `--sample-offset`으로 서로 다른
  후보 구간을 처리하게 만든 뒤에도, 그 구간 안의 이미 존재하는 후보를
  똑같이 상세 수집·주소 처리(Geoapify 호출 포함)·업데이트했다.
- **실제 재현 사례**: 신규 13건을 모으는 과정에서 기존 공고 17건이 함께
  업데이트됨(불필요한 Geoapify 호출과 처리 시간 소모를 동반).
- **수정 내용**: `_select_sample_window(unique_raw, offset, limit)`을
  신설해 `--sample-offset`으로 후보 목록의 다른 구간을 고를 수 있게 했다
  (카테고리 순회의 중단 조건도 `offset+limit`을 채울 때까지로 확장).
  이어서 `_filter_new_only_candidates(candidates, existing_hrefs, limit)`
  를 신설해 `--new-only`가 이미 DB에 있는 `source_url`은 상세 수집 전에
  완전히 걸러내고, 신규 저장 성공 건수가 목표에 도달하면 배치 중간이라도
  정확히 멈추게 했다.
- **관련 테스트**: `test_sample_offset_10_with_sample_limit_10_is_allowed`,
  `test_select_sample_window_offset_10_covers_different_candidates_than_
  offset_0`, `test_new_only_requires_sample_limit`,
  `test_filter_new_only_candidates_skips_existing_and_stops_exactly_at_
  target`(`test_cli_safety.py`/`test_address_pipeline_integration.py`).
- **커밋**: `--sample-offset` [`fd9df33`](https://github.com/KHOAILANG0926/jobi-app/commit/fd9df33),
  `--new-only` [`8b432e8`](https://github.com/KHOAILANG0926/jobi-app/commit/8b432e8)
- **남은 한계**: `--sample-limit` 자체의 1~10 상한은 그대로라, 정확히
  N건(N>10)을 모으려면 여러 번의 배치 실행이 필요하고 배치 경계상
  정확히 N에서 멈추지 못하고 1건 초과할 수 있다(실측: 목표 12건 요청에
  13건 저장 — 배치 단위가 10건씩이라 마지막 배치가 7건을 채우고 끝났기
  때문).

---

<a id="fix8"></a>
## 8. VietnamWorks 단계적 화면 로딩으로 주소가 누락된 문제

- **원인**: VietnamWorks 상세페이지는 여러 단계로 나눠 그려진다 —
  `domcontentloaded` 직후엔 `h1`/일부 섹션만 있고, "Các phúc lợi dành cho
  bạn"/"Thông tin việc làm"/"Địa điểm làm việc"는 그 뒤에(실측: 목록
  페이지에서 이동해 온 경우 약 3초 후) 별도로 렌더링된다. 고정 2초
  대기만으로는 "Địa điểm làm việc" 렌더링 전에 읽어버려 근무지가 통째로
  빈 값으로 저장됐다.
- **실제 재현 사례**: 캐너리 실행 중 `job_id=4626`("Senior CAD Engineer",
  이후 삭제·재수집됨 → 최종 `job_id=4627`)이 실제로는 근무지가 있는데
  `no_address_text`로 저장됨을 직접 재현·확인. 진단 결과 목록 페이지에서
  navigate한 직후 poll: 1회차 헤딩 0개, 2회차 헤딩 2개("Mô tả công việc",
  "Yêu cầu công việc"만), 3회차(약 3초 경과)에야 5개 헤딩 전부 등장.
- **수정 내용**: 고정 `page.wait_for_timeout(2000)`을 제거하고,
  `page.wait_for_function()`으로 "Thông tin việc làm" 헤딩이 나타날
  때까지 최대 8초 폴링 후 진행하도록 변경 — 원문에 그 섹션 자체가 없는
  드문 경우를 대비해 타임아웃은 조용히 넘기고 있는 그대로 계속 진행한다
  (`fetchOk=False`로 처리하지 않음).
- **관련 테스트**: 오프라인 순수 함수 테스트로는 이 타이밍 문제 자체를
  재현할 수 없다(실제 브라우저/네트워크 타이밍 의존) — 수정 후 동일
  재현 스크립트(목록 → 상세 순서로 같은 페이지 재사용)로 `locationLines`
  가 정상 추출됨을 실행 확인했고, 이후 실제 배치(20건) 결과에서 근무지
  누락 0건으로 간접 확인됨.
- **커밋**: [`0458bf3`](https://github.com/KHOAILANG0926/jobi-app/commit/0458bf3)
- **남은 한계**: 8초 폴링도 네트워크 상황에 따라 부족할 가능성은
  이론적으로 남아있다(타임아웃 시 조용히 진행하므로 그 경우 근무지가
  다시 비어 저장될 수 있음) — 이 문서 작성 시점까지 실제로 8초를 넘긴
  사례는 관측되지 않았다.
