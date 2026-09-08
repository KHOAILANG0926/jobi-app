# Vieclam24h 크롤러 기준 (Baseline)

이 문서는 Vieclam24h 크롤러(`crawler/crawl_topcv.py`)의 현재 확정된 동작 기준을
기록한다. 이 문서에 적힌 기준을 바꾸는 코드 변경은 먼저 이 문서를 갱신한 뒤에
진행한다.

- **기준 커밋**: [`8b432e8`](https://github.com/KHOAILANG0926/jobi-app/commit/8b432e8)
- **상태**: Vieclam24h 신규 공고 21건(job_id 4605~4625) 실수집·저장·전수 검증 완료
  (운영 사이트 viecganban.vn 표시 검증 포함)

## 1. 동작 기준

| # | 기준 | 구현 위치 |
|---|---|---|
| 1 | `--new-only` 모드에서 이미 DB에 있는 source_url은 상세 수집·주소 처리·업데이트를 하지 않고 즉시 건너뛴다 | `crawl_topcv._filter_new_only_candidates()` |
| 2 | `--new-only`는 목표 신규 건수(`--sample-limit`)에 도달하면 배치 중간이라도 정확히 멈춘다 | `crawl_topcv._filter_new_only_candidates()`, `crawl_topcv.crawl_vieclam24h()` |
| 3 | success 조건: 원문 주소 → DB `raw_address` → 좌표의 행정구역(시·성)이 서로 일치해야 한다 | `regeocode_work_locations._resolve_province_hint()`, `_region_matches_strictly()`, `_build_update_payload()` |
| 4 | 지역(성·시)을 확정하지 못하면(province=None) success로 자동 승격하지 않는다 — `manual`로 처리 | `regeocode_work_locations._build_update_payload()` |
| 5 | `region_only`/`manual`/`failed`는 거리검색(내 주변)·거리순 정렬에서 제외한다 | `src/lib/jobCoords.ts` `resolveDistanceSearchPoints()` — `coordinateAccuracy`가 `exact`/`ward`이고 `lat`/`lng`가 실수인 행만 포함 |
| 6 | `manual`/`failed` 행의 `lat`/`lng`는 반드시 `null`이어야 한다(잘못된 좌표를 절대 저장하지 않음) | `crawl_topcv._coordinate_accuracy_for_db()`, `regeocode_work_locations._build_update_payload()`(다운그레이드 시 명시적 null 처리) |
| 7 | 신규 공고 처리 후 `job_work_locations.geocode_status='pending'`으로 남는 행은 없어야 한다 — 반드시 `success`/`region_only`(manual 판정 포함)/`failed` 중 최종 상태로 처리한다 | `regeocode_work_locations.py` (`--regeocode-work-location-ids`/`--geocode-status pending --apply`) |
| 8 | `--sample-limit`은 1~10건으로 고정 상한(사고 재발 방지), `--sample-offset`은 이미 처리한 상위 후보를 건너뛰어 반복 실행 시 서로 다른 후보를 처리하게 한다 | `crawl_topcv.resolve_cli_mode()`, `crawl_topcv._select_sample_window()` |

## 2. 관련 자동 테스트 파일 대응 관계

| 테스트 파일 | 대응하는 기준 | 확인된 결과 |
|---|---|---|
| `crawler/test_cli_safety.py` | 기준 1, 2, 8 — `--new-only`/`--sample-limit`/`--sample-offset` 조합의 CLI 안전장치(인자 검증, SystemExit) | 17/17 통과 |
| `crawler/test_address_pipeline_integration.py` | 기준 1, 2, 8 — `_filter_new_only_candidates()`, `_select_sample_window()` 등 순수 로직 회귀 테스트 및 주소·근무지 파이프라인 전반 | 54/54 통과 |
| `crawler/test_regeocode_work_locations.py` | 기준 3, 4, 6 — province 확정 실패 시 manual 처리, 지역 불일치 시 success 금지, 다운그레이드 시 좌표 null 처리 | 11/11 통과 |
| `crawler/test_geocode.py` | 기준 3 — 일시적 API 오류만 제한적으로 재시도(무한 재시도 금지), 정상 no_results는 재시도하지 않음 | 6/6 통과 |
| `crawler/test_job_quality.py` | 기준 6 — 좌표 정확도 등급(exact_candidate 등)이 DB CHECK 제약과 호환되지 않는 값으로 새어나가지 않는지 | 17/17 통과 |

## 3. 대표 검증 URL (2026-09-08 확인)

Vieclam24h 신규 21건 중 5건을 대표로 골라 운영 사이트(viecganban.vn)에서 지도까지
직접 확인했다 — 지도 타일 좌표를 역산해 DB 좌표와 실제 일치 여부를 검증.

| 구분 | job_id | URL | 확인 결과 |
|---|---|---|---|
| success (검증된 ward) | 4613 | https://viecganban.vn/viec-lam/sb-4613 | "Vị trí chính xác" 배지, 지도 중심이 DB 좌표와 일치(Nhân Chính, Thanh Xuân, Hà Nội) |
| success (미검증 ward) | 4619 | https://viecganban.vn/viec-lam/sb-4619 | 지도 중심이 DB 좌표와 같은 구·시 내(Nam Từ Liêm, Hà Nội) |
| region_only | 4607 | https://viecganban.vn/viec-lam/sb-4607 | 행정구역 단위 근사 위치 캡션 표시, 지도 중심이 TP.HCM/Bình Thạnh과 일치, 거리검색 제외 확인 |
| manual | 4616 | https://viecganban.vn/viec-lam/sb-4616 | manual 행(Phú Quốc)은 좌표가 없어 지도에 마커가 표시되지 않음(잘못된 좌표 없음), 거리검색 제외 확인 |
| failed | 4609 | https://viecganban.vn/viec-lam/sb-4609 | 좌표 없이 원문 텍스트 기반 지역(Đà Nẵng) 근사 표시, 다른 성·시로 잘못 표시된 사례 없음, 거리검색 제외 확인 |

21건 전수: 필수 필드/근무지 행/주소 상태/URL 중복 검사 통과, 화면 깨짐·공고별 콘솔
오류 없음.

## 4. 포함하지 않는 내용

이 문서와 저장소에는 API 키, 서비스 계정 키, 비밀번호, 운영 DB 백업 파일, 개인정보를
포함하지 않는다. `.env`/백업 JSON/좌표 백업 파일 등은 `.gitignore` 대상이며 이 문서에서도
값을 인용하지 않는다.
