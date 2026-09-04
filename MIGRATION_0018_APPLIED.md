# Migration 0018 — 적용 완료 + 검증 결과

**상태: migration 0018을 운영 DB(edhuesdnuxlbcfephutq)에 실제로 실행
완료(2026-09-05). 코드 활성화(local_jobs.recruitment_regions 저장)까지
마치고 커밋함.** migration 0020, 실제 공고 저장, 기존 공고 재처리,
cron/GHA 활성화는 하지 않았다.

파일: [`supabase/migrations/0018_replace_job_work_locations_wire_location_verified.sql`](supabase/migrations/0018_replace_job_work_locations_wire_location_verified.sql)(적용됨)

---

## 1~6. 적용 전 사전 대조 결과

| 확인 항목 | 결과 |
|---|---|
| `local_jobs.recruitment_regions`/`job_work_locations.matched_recruitment_regions` 존재 여부 | 적용 전 둘 다 **없음**(정보스키마 조회로 실측 확인) — 예상과 일치 |
| SQL에 포함된 항목이 딱 이 3가지뿐인지 | ✅ 컬럼 2개 추가 + RPC 재정의(location_verified/matched_recruitment_regions INSERT 목록 추가) + GRANT 재선언(멱등, 실질 변경 없음) — 그 외 없음 |
| 기존 컬럼·데이터·RLS·정책을 삭제/변경하는 SQL 여부 | ✅ 없음 — `drop column`/`drop policy`/RLS 변경 문 전혀 없음. 함수 본문 안의 `delete from job_work_locations`는 0015부터 있던 기존 로직(이 RPC가 **호출될 때만** 실행, migration 실행 자체로는 실행 안 됨) |
| RPC 안전장치(origin='crawler'만 허용, delete+insert 원자적, 빈 배열 명시적 처리, 잘못된 JSON 타입 안전 처리, service_role만 실행, SECURITY DEFINER + search_path=public) | ✅ 전부 유지 — 적용 전 운영 RPC 정의를 `pg_get_functiondef()`로 직접 조회해 그 위에 정확히 2개 컬럼만 추가된 것을 대조 확인. `matched_recruitment_regions`의 JSONB→text[] 변환은 `jsonb_typeof(...) = 'array'` 명시 검사로 키 없음/JSON null/잘못된 타입을 전부 안전하게 빈 배열로 처리(지난 라운드에 강화된 부분, 이번에 그대로 유지 확인) |
| 배포 코드가 적용 전후 모두 안 깨지는지 | ✅ 배포된 프론트(`JobsContext.tsx`/`jobRows.ts`)는 이 두 컬럼을 select에 넣지 않아 무관, 배포된 크롤러의 `_work_location_rpc_rows()`는 이미 이 payload 키를 보내고 있었음(RPC가 갱신되기 전까진 조용히 무시하던 forward-compatible 설계) — 적용은 이 payload가 **처음으로 실제 저장되기 시작**하는 것뿐, 깨지는 게 없음 |
| rollback SQL이 최신 RPC 정의를 정확히 복원하는지 | ✅ 적용 전 `pg_get_functiondef()`로 조회한 실제 운영 정의(migration 0015 버전, location_verified/matched_recruitment_regions 없음)를 그대로 사용해 rollback SQL을 준비(아래 6번 참고) |

**부수 발견(0018과 무관, 별도 기록만)**: `supabase/migrations/0017_publish_gate_reason_add_no_verified_coordinate_draft.sql`
(아직 draft, 미실행)도 확인했다 — 운영 DB의 `local_jobs_publish_gate_reason_check`
CHECK 제약이 지금도 `('ok','no_address_text','no_application_path')`만
허용하고 `'no_verified_coordinate'`는 없다(실측 확인). 이번 세션 내내
크롤러가 실제로 계산하는 gate_reason 값 대부분이 `'no_verified_coordinate'`
(C1 검증 미통과 — 이번 세션 표본의 절대다수)이므로, **0017을 먼저 적용하지
않으면 실제 공고 저장 시 이 값이 CHECK 위반으로 즉시 실패한다.** 0018과는
완전히 독립된 별도 migration이라 이번 승인 범위 밖에서 손대지 않았지만,
다음 단계(비공개 표본 저장) 전에 반드시 확인/승인이 필요한 항목이다 —
아래 "비공개 표본 검증 준비 여부"에 반영.

---

## 7~9. 적용 실행 + 읽기 전용 검증

**적용**: `mcp__.../apply_migration`으로 위 SQL 전체를 한 트랜잭션으로
실행 — `success: true`.

### 컬럼 존재/타입/nullable/CHECK
```
local_jobs.recruitment_regions            : ARRAY(text[]), nullable, default 없음
job_work_locations.matched_recruitment_regions : ARRAY(text[]), nullable, default 없음
```
새 CHECK 제약 없음(추가하지 않았으므로 당연, 확인만).

### RPC 정의·권한·search_path (적용 후 재조회)
- `pg_get_functiondef()`: `location_verified, matched_recruitment_regions`가
  INSERT 컬럼 목록에 포함됨. origin='crawler' 가드, delete+insert 순서,
  jsonb_typeof 안전 처리 전부 그대로.
- `prosecdef = true`, `proconfig = ["search_path=public"]` — 실측 확인.
- GRANT: `service_role`(+ 소유자 `postgres`)만 EXECUTE — `anon`/
  `authenticated` 없음, 적용 전과 동일.
- RLS 정책(`local_jobs_public_select`/`job_work_locations_public_select`,
  migration 0019): `local_job_is_visible(...)` 기반 그대로, 이 migration이
  전혀 건드리지 않았음을 재확인.

### 기존 데이터 불변 확인 (행 수 + 내용 체크섬)
| 항목 | 적용 전 | 적용 후 |
|---|---|---|
| `local_jobs` 행 수 | 4 | 4 |
| `job_work_locations` 행 수 | 1 | 1 |
| `local_jobs`(기존 컬럼만) MD5 체크섬 | `a90951de6a7b52d32e7fb55f06279b93` | `a90951de6a7b52d32e7fb55f06279b93` (**일치**) |
| `job_work_locations`(기존 컬럼만) MD5 체크섬 | `2d57e5039ff2b7e80151d3a489c2c9e2` | `2d57e5039ff2b7e80151d3a489c2c9e2` (**일치**) |
| 새 컬럼 값 | — | 전부 NULL(0건 not-null) — additive, 기본값 없음과 일치 |

행 수·기존 컬럼 값 전부 바이트 단위로 동일 — 기존 데이터 변경 없음을
체크섬으로 확인(단순 카운트보다 엄격한 확인).

브라우저로 Home(`/`) 재확인 — 정상 로드, 공개 공고(4369) 그대로 표시,
기능 회귀 없음(실측).

---

## 10. 코드 활성화 — `local_jobs.recruitment_regions` 저장 경로

migration 성공 확인 후 다음 2개 파일만 수정(커밋 [이 문서 하단 참고]):

- `crawler/job_quality.py`: `UPDATE_TRACKED_FIELDS`에 `"recruitment_regions"`
  추가 — 재처리 시 이 값도 갱신 대상이 되도록.
- `crawler/crawl_topcv.py`: `build_job_record()`에서 기존
  `job["_job_recruitment_regions"] = job_recruitment_regions`(디버깅용,
  `_` 접두사라 payload 자동 제외) 바로 뒤에
  `job["recruitment_regions"] = job_recruitment_regions or None` 추가 —
  이제 실제 컬럼 키로도 채워져 `upsert_job_record()`의 INSERT/UPDATE
  payload에 실제로 실린다.

**테스트 갱신**: 이전 라운드의
`test_job_recruitment_regions_stays_out_of_local_jobs_insert_payload_until_migrated`
(컬럼이 없던 시절 "payload에 절대 없어야 한다"를 검증하던 테스트)를
`test_job_recruitment_regions_reaches_insert_payload_after_migration_0018`
로 교체 — 이제 반대로 "실제 payload에 올바른 값으로 실려야 한다"를
검증하고, `_`-접두사 임시 필드는 여전히(영구 규칙으로) 제외됨도 함께
확인한다.

**테스트/빌드 결과**: 크롤러 전체(VPS 격리 환경, 전체 저장소 복사본)
`job_quality.py` 15/15 + `test_address_pipeline_integration.py` **35/35**
(신규/교체 테스트 포함) 통과. 프론트는 이번에 안 건드렸지만 `tsc --noEmit`
+ `npm run build` 재확인 — 통과(회귀 없음).

---

## 11~12. 실행하지 않은 것

- 실제 공고 저장(`--verify-write-urls` 포함), 기존 공고 재처리 ❌
- migration 0020(admin_* EXECUTE 축소) ❌
- cron/GHA 활성화 ❌

---

## 최종 요약

| 항목 | 상태 |
|---|---|
| migration 0018 적용 완료 여부 | ✅ **완료**(운영 DB, 2026-09-05) |
| 기존 데이터 불변 여부 | ✅ **확인됨**(행 수 + MD5 체크섬 일치) |
| RPC 보안·원자성 확인 결과 | ✅ **확인됨**(origin 가드/delete+insert 원자성/JSON 타입 안전 처리/service_role 전용/SECURITY DEFINER+search_path 전부 유지) |
| 코드 활성화 커밋 | ✅ **완료**(아래 커밋 해시 참고) |
| 비공개 표본 검증을 시작할 준비가 됐는지 | **조건부 NO** — migration 0018 자체는 준비됐지만, **별도 발견된 migration 0017(publish_gate_reason CHECK에 'no_verified_coordinate' 추가, 현재 draft·미실행)이 먼저 적용되지 않으면 이번 세션 대부분의 실제 공고가 그 값으로 저장을 시도하다 CHECK 위반으로 즉시 실패한다.** 0017 검토·승인·적용(또는 이 시나리오를 피하는 대안 확인) 전까지는 표본 저장을 시작하지 않는 것을 권한다. |

migration 0020, DB 데이터 생성·수정·삭제, 크롤러 실행, cron/GHA 활성화는
하지 않았다. 실패나 스키마 불일치는 없었으므로 rollback은 실행하지 않았다.
