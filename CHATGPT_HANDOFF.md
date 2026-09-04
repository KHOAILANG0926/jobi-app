# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

표준 근무지 주소 파이프라인(address_accuracy/coordinate_accuracy 분리, geocode 다단계
캐스케이드) 도입 후, `job_work_locations`가 0건인 공고에서 legacy fallback이 지역명 텍스트
추측 좌표로 여전히 지도·마커·길찾기를 그리던 버그를 수정하고, migration
`0015_address_pipeline_audit_fields.sql`을 운영 DB에 적용한 뒤 기존 3개 공고
(sb-4366/4367/4368)를 새 표준으로 재처리 완료.

## 변경 내용

- `src/pages/JobDetail.tsx`: `job_work_locations`가 없는 공고는 `local_jobs`에 직접
  저장된 실제 좌표(`mapLocation.source === 'exact'`)가 있을 때만 내부 지도·마커·길찾기를
  표시하도록 수정. 지역명 텍스트로 추측한 좌표(`source === 'region'/'default'`)는 더 이상
  지도를 그리지 않고, 주소 텍스트 + 외부 "Google 지도에서 주소 검색" 링크만 제공.
- `scripts/test-job-location-detail.mjs`: 실제 Supabase 데이터(job_work_locations 행 수,
  local_jobs.lat/lng)를 조회해 DOM과 대조하는 검증을 추가 — "검증된 근무지 0건이면
  마커·지도 컨테이너·길찾기도 반드시 0건"임을 자동 검증. GitHub Actions에도 포함됨.
- `supabase/migrations/0015_address_pipeline_audit_fields.sql`: 사용자가 Supabase SQL
  Editor에서 직접 실행, 운영 DB에 적용 완료(읽기 전용으로 컬럼 6개 + RPC 권한 확인함).
  - `job_work_locations.address_accuracy` / `.coordinate_accuracy` / `.address_evidence`
  - `local_jobs.crawler_version` / `.last_verified_at` / `.publish_gate_reason`
  - `replace_job_work_locations(p_job_id, p_rows)` RPC (security definer, service_role 전용)
- VPS(`/root/jobi`) 크롤러 코드를 `git pull --ff-only`로 master(`86a1dea`)까지 동기화.
  전체 재크롤(`crawl_topcv.py` 단독 실행)은 신규 공고를 수집하므로 실행하지 않음 —
  대신 기존 3건만 대상으로 하는 1회성 스크립트(`_reprocess_3jobs.py`, 실행 후 삭제)로
  `local_jobs.location` 텍스트를 새 파이프라인(`classify_work_location_candidate` →
  `resolve_work_locations` → `gate_auto_publish`)에 통과시켜 재처리.
- 크롤러 cron은 계속 비활성 상태 유지(`[DISABLED 2026-09-02]`) — 이번 작업으로 변경 없음.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`: 통과.
- 로컬 Playwright(`test-job-location-detail.mjs`, `test-jobcard-integrity.mjs`): 통과.
- GitHub Actions run `33789238750`: 성공(강화된 지도/길찾기 회귀 테스트 포함).
- Vercel Production 배포: Ready 확인.
- 운영 사이트(`viecganban.vn`) 실측 검증(migration 실행 전): sb-4366/4367/4368 3건 모두
  markerCount=0, mapContainerCount=0, directionsCount=0, gmapsLinkCount=1(검색 링크만) —
  legacy fallback 버그 수정 확인.
- DB 재처리 결과(3건 모두 동일 패턴):
  - `location` 텍스트("Bình Dương, TP.HCM" / "Hà Nội" / "Hồ Chí Minh")가
    `classify_work_location_candidate()`에서 `region_only`로 분류됨(구체적 장소 신호 없음).
  - `resolve_work_locations()` → 0건 반환 → `job_work_locations` 0행(RPC로 명시적 동기화).
  - `source_url`이 3건 모두 `null` → `has_application_path()` → `False`.
  - `gate_auto_publish(has_address_text=False, ...)` → `(False, 'no_address_text')`.
  - `active`: 3건 모두 `true → false`로 전환(`publish_gate_reason='no_address_text'`,
    `crawler_version='2026-09-03.address-pipeline-v1'`, `last_verified_at` 기록됨).
- 운영 사이트 재검증(재처리 후): sb-4366/4367/4368 3건 모두
  `/viec-lam/sb-XXXX` 직접 접속 시 "Không tìm thấy tin tuyển dụng"(비공개 처리 확인).

## 발견된 문제

- sb-4366/4367/4368 3건은 원래부터 `source_url`이 없고 위치 텍스트도 성/시 단위뿐이라,
  새 표준으로는 애초에 자동 공개 요건(상세주소 텍스트 + 유효한 지원 경로)을 만족하지
  못하는 공고였음 — 재처리 결과 3건 전부 `active=false`로 전환됨. 이 시점 기준
  `local_jobs`에 남아있던 크롤러 출처 공고가 이 3건이 전부였으므로, 운영 사이트에는
  현재 크롤러 출처 공개 공고가 0건인 상태.
- VPS `/root/jobi`는 이번 동기화 전까지 master 대비 약 130 커밋 뒤처져 있었음(주소
  파이프라인 전체가 없는 상태) — 지금은 `86a1dea`까지 fast-forward pull 완료.
- `local_jobs.crawler_version`/`.last_verified_at`은 migration 0015로 컬럼은 생겼지만
  `crawl_topcv.py`의 정규 크롤 경로(`crawl_vieclam24h`/`save_to_supabase`)는 아직 이 두
  컬럼을 쓰도록 연결돼 있지 않음(주석에 "컬럼 생기면 연결" 명시돼 있었음) — 이번
  1회성 재처리 스크립트에서만 채움. 정규 크롤 경로 연결은 범위 밖이라 손대지 않음.

## 다음 결정사항

- 현재 상태: **IMPLEMENTED → VERIFIED → MASTER PUSHED → PRODUCTION DEPLOYED →
  PRODUCTION VERIFIED** (legacy fallback 수정), migration/VPS 동기화/3건 재처리는
  **DB 적용 완료 + 운영 검증 완료**.
- 코드 커밋: `86a1dea` (`fix: 검증된 근무지 없는 공고의 legacy 지도/길찾기 fallback 제거`).
- 크롤러 cron: 계속 비활성 상태(변경 없음) — 재활성화는 별도 사용자 지시 필요.
- 운영 사이트에 현재 공개된 크롤러 출처 공고가 0건이라는 사실을 사용자가 인지하고
  있는지 확인 필요 — 신규 크롤링(활성화된 cron 또는 수동 실행)을 언제 재개할지는
  사용자 판단 대기.
- `crawl_topcv.py`에 `crawler_version`/`last_verified_at` 정규 연결은 향후 별도 작업으로
  고려 가능(이번 범위 밖).
