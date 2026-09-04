# Migration 0018 운영 적용 준비 계획

**상태: 검증 저장 모드(`--verify-write`) 구현 완료, migration 실행/DB 쓰기/
실제 공고 저장/recruitment_regions payload 활성화/cron·GHA 활성화는 전혀
하지 않았다.** 아래는 실행 전 최종 검토용 SQL과 실행 계획이다.

---

## 0. 이번 라운드에서 구현 완료된 것 (`--verify-write`)

커밋 [2c8b422](https://github.com/KHOAILANG0926/jobi-app/commit/2c8b422bc473a96d168f396bc9bbb7448506ad85).
`crawler/crawl_topcv.py`에 실제로 구현·테스트 완료 — **DB 쓰기는 아직 실행
안 함**(migration 0018이 없으면 어차피 CHECK 제약이 없는 컬럼들이라 저장
자체는 가능하지만, `matched_recruitment_regions`/`local_jobs.recruitment_
regions` payload는 여전히 비활성 상태로 남겨둠).

| 요구사항 | 구현 위치 | 확인 방법 |
|---|---|---|
| 1. `--verify-write` 플래그 | CLI `argparse` | `python3 crawl_topcv.py --help` |
| 2. `--confirm-write`+`--verify-write` 둘 다 있을 때만 검증 저장 | CLI 검증 4개 지점 + `WriteNotEnabledError` | `test_write_guard_blocks_unconfirmed_writes` 계열 |
| 3. 검증 저장 시 강제 active=false/admin_hidden=true/origin='crawler' | `upsert_job_record()` INSERT 경로 최종 단계 | `test_verify_write_forces_active_false_admin_hidden_true_even_when_caller_tries_to_override` |
| 4. 일반 크롤링/`--process-url`과 분리 | `verify_write` 기본값 `False`, `save_to_supabase()`는 아예 미참조 | `test_normal_crawl_path_never_references_verify_write` |
| 5. UPDATE 경로 금지, 신규 INSERT만 | `reprocess_jobs()`에 파라미터 자체 없음 + 기존 매칭 시 `VerifyWriteExistingMatchError` | `test_reprocess_jobs_has_no_verify_write_parameter`, `test_verify_write_rejects_existing_match_without_writing` |
| 6. 결과 JSON에 id 명확히 출력 | `upsert_job_record()` 반환값에 `"verify_write": true` 마커 + `id` | 위 3번 테스트에서 함께 확인 |
| 7. 부분 실패 시 정확한 원상복구용 manifest | `process_urls_verify_write()` + `--verify-write-urls` | `test_process_urls_verify_write_generates_manifest_with_created_ids` |
| 8. 공개 쿼리(홈·검색·지도) 미노출 회귀 테스트 | `JobsContext.tsx`의 `.eq('active', true)` 필터를 소스 검증 | `test_verify_write_created_jobs_excluded_from_public_home_search_map_query`(**API 자체의 한계는 아래 참고**) |
| 9. 강제값을 호출자가 덮어쓸 수 없음 | 3번과 동일 테스트(호출자가 반대 값을 넣어도 최종 payload는 강제값) | 위와 동일 |

**크롤러 전체 테스트 50/50 통과**(`job_quality.py` 15 + `test_address_pipeline_integration.py` 35, 신규 6건 포함) — VPS 격리 환경(전체 저장소 복사본, 종료 후 삭제)에서 확인.

**8번 관련, 확인된 기존 구조적 한계(수정 안 함, STRICT 등급이라 승인 필요)**:
`JobsContext.tsx`의 `.eq('active', true)` 필터는 **앱(Home/검색/지도)** 레벨
에서만 verify-write 공고를 가린다. 반면 `supabase/migrations/0005`의
`local_jobs_public_select` RLS 정책은 `using (true)`라, anon key로
PostgREST REST API(`/rest/v1/local_jobs`)를 직접 호출하면 `active`/
`admin_hidden`과 무관하게 모든 행이 조회된다 — 즉 "API" 노출까지는 이번
구현이 막지 못한다. 이 한계는 verify-write로 새로 생기는 게 아니라 이미
존재하던 모든 `active=false` 행에 동일하게 적용되는 기존 구조다. RLS
정책 변경은 CLAUDE.md 기준 STRICT 등급(Auth/RLS)이라 별도 승인 없이
고치지 않았다.

### 새 CLI 사용법 (아직 실행하지 않음 — 예시)
```bash
# 단건
python3 crawl_topcv.py --process-url "https://vieclam24h.vn/....html" --confirm-write --verify-write

# 3~5건 배치 + manifest
python3 crawl_topcv.py --verify-write-urls "url1,url2,url3" --confirm-write --verify-write
```

---

## 1. Migration 0018 최종 SQL (전체, 검토용 — 이번 라운드에 강화됨)

파일: [`supabase/migrations/0018_replace_job_work_locations_wire_location_verified_draft.sql`](supabase/migrations/0018_replace_job_work_locations_wire_location_verified_draft.sql)

```sql
-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
-- (배경 주석 3단계 이력 생략 — 원본 파일 1~54행 참고)

begin;

alter table public.local_jobs
  add column if not exists recruitment_regions text[];

comment on column public.local_jobs.recruitment_regions is
  '이 공고 전체가 모집한다고 밝힌 지역 라벨 전부(예: {"TP.HCM","Long An"}) — "Địa điểm làm việc" 섹션의 원본 후보 전체 기준(job_work_locations 행이 0건이어도 보존됨). 특정 근무구역에 매칭된 부분집합은 job_work_locations.matched_recruitment_regions를 본다.';

alter table public.job_work_locations
  add column if not exists matched_recruitment_regions text[];

comment on column public.job_work_locations.matched_recruitment_regions is
  '이 근무구역(1개의 물리적 장소)에 실제로 매칭된 모집지역 라벨의 부분집합(예: {"TP.HCM","Long An"}) — 크롤러가 geocode 이전에 같은 핵심 주소(모집지역 접미사만 다름)를 하나로 묶어 좌표 복제 없이 채운다. 공고 전체 모집지역은 local_jobs.recruitment_regions를 본다. 단일 지역 공고는 원소 1개짜리 배열.';

create or replace function public.replace_job_work_locations(
  p_job_id bigint,
  p_rows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origin text;
begin
  select origin into v_origin from public.local_jobs where id = p_job_id;

  if v_origin is null then
    raise exception 'replace_job_work_locations: local_jobs id % not found', p_job_id;
  end if;

  if v_origin <> 'crawler' then
    raise exception
      'replace_job_work_locations: local_jobs id % has origin=% (not crawler) — refusing to modify its job_work_locations',
      p_job_id, v_origin;
  end if;

  delete from public.job_work_locations where job_id = p_job_id;

  insert into public.job_work_locations (
    job_id, raw_address, normalized_address, lat, lng,
    geocode_status, geocode_source, address_accuracy, coordinate_accuracy, address_evidence,
    location_verified, matched_recruitment_regions, sort_order
  )
  select
    p_job_id,
    (r->>'raw_address'),
    (r->>'normalized_address'),
    (r->>'lat')::double precision,
    (r->>'lng')::double precision,
    coalesce(r->>'geocode_status', 'success'),
    (r->>'geocode_source'),
    coalesce(r->>'address_accuracy', 'exact_text'),
    (r->>'coordinate_accuracy'),
    (r->>'address_evidence'),
    coalesce((r->>'location_verified')::boolean, false),
    -- jsonb_array_elements_text()의 NULL/스칼라 처리를 추측하지 않고
    -- jsonb_typeof()로 명시적으로 배열일 때만 펼친다(키 없음/JSON null/
    -- 다른 타입은 전부 안전하게 빈 배열로).
    coalesce(
      (
        select array_agg(x) from jsonb_array_elements_text(
          case when jsonb_typeof(r->'matched_recruitment_regions') = 'array'
            then r->'matched_recruitment_regions'
            else '[]'::jsonb
          end
        ) as x
      ),
      '{}'
    ),
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

-- Postgres는 CREATE OR REPLACE FUNCTION이 시그니처를 바꾸지 않는 한 기존
-- GRANT를 자동 보존하지만, 이 파일만 보고도 확신할 수 있도록 재선언한다.
revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

commit;
```

---

## 2. SQL 기준 체크리스트 재확인 (이번 라운드 요구 항목)

| 항목 | 확인 | 근거 |
|---|---|---|
| nullable additive 컬럼만 추가 | ✅ | `add column if not exists ... text[]` 2건, `not null`/`default`/`check` 없음 — 기존 행은 전부 `NULL`. |
| 기존 `origin='crawler'` RPC 보호 유지 | ✅ | 81~91행 `v_origin` 조회 + `<> 'crawler'`면 예외 발생 로직이 0015와 **문자 그대로 동일**, 변경 없음. |
| `security definer`/`search_path` 유지 | ✅ | 74~76행에 명시적으로 재선언됨(0015와 동일). `create or replace`가 시그니처(이름+인자 타입)를 바꾸지 않으므로 GRANT도 Postgres가 자동 보존 — 142~143행에서 멱등하게 재확인까지 함. |
| `location_verified` null/default 처리 | ✅ | `coalesce((r->>'location_verified')::boolean, false)` — 키가 없으면 `r->>'x'`가 SQL NULL을 반환하고(→ 캐스트해도 NULL), `coalesce`가 `false`로 채운다. JSON `null` 값이어도 `->>` 연산자는 SQL NULL을 반환하므로 동일하게 안전(이 연산자는 `jsonb_array_elements_text`와 달리 스칼라/NULL 구분에서 항상 안전 — 별도 typeof 가드 불필요). |
| JSONB `recruitment_regions`(위치별 `matched_recruitment_regions`) → `text[]` 안전 변환 | ✅(이번 라운드에 강화) | 이전 버전은 `jsonb_array_elements_text(r->'matched_recruitment_regions')`를 바로 호출해, 키가 없거나 JSON `null` 스칼라일 때의 거동을 Postgres 내부 동작에 암묵적으로 의존하고 있었다. 이번에 `jsonb_typeof(...) = 'array'`로 **명시적으로 배열일 때만** 펼치도록 바꿔, 키 없음/JSON null/다른 타입 전부를 추측 없이 빈 배열로 확정 처리한다. |
| 빈 `p_rows` 처리 | ✅ | `p_rows = '[]'::jsonb`(크롤러가 근무지 0건일 때 실제로 보내는 값)이면 `jsonb_array_elements(p_rows)`가 0행을 반환 → INSERT가 0건 실행됨(에러 없음) — 0015부터 이미 이렇게 동작했고 이번 migration도 그대로 유지, 변경 없음. |
| 기존 데이터 DML 없음 | ✅ | 파일 전체에 `update`/`delete`(DML) 문 없음. 함수 **본문 안**의 `delete from job_work_locations where job_id = p_job_id`는 0015부터 있던 기존 로직이며, migration 실행 자체가 이 함수를 호출하지 않으므로 migration 실행만으로는 어떤 행도 지워지지 않는다. |
| 권한 REVOKE/GRANT 정확성 | ✅ | 142~143행이 0015의 `revoke all ... from public, anon, authenticated; grant execute ... to service_role;`과 정확히 동일(테이블/함수명/인자타입까지 일치). |
| rollback `DROP COLUMN`은 **코드 활성화 전까지만** 안전 | ⚠️ 아래 3-3 롤백 SQL에 명시 | `local_jobs.recruitment_regions`/`job_work_locations.matched_recruitment_regions`에 실제 값이 쓰이기 시작하는 건 (a) migration 실행 + (b) 5번 코드 변경(아직 미적용) + (c) 실제 저장이 전부 일어난 뒤부터다. 이번 라운드는 (b)/(c) 둘 다 안 했으므로 **지금 롤백하면 데이터 손실이 전혀 없다.** (b)가 배포된 뒤에는 롤백 전 반드시 "기존 행 전부 NULL"인지(섹션 3-2의 3번 SELECT) 확인해야 하며, 이미 값이 쓰였다면 DROP COLUMN은 그 파생 데이터를 지운다(원문 재크롤로 재계산 가능하므로 영구 손실은 아니지만 즉시 손실은 맞다). |

---

## 3. 실행 전후 검증용 SELECT + 롤백 범위 (변경 없음, 재확인)

### 3-1. 실행 전 베이스라인
```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('local_jobs', 'recruitment_regions'),
    ('job_work_locations', 'matched_recruitment_regions')
  );

select
  (select count(*) from public.local_jobs) as local_jobs_count,
  (select count(*) from public.job_work_locations) as job_work_locations_count;

select pg_get_functiondef('public.replace_job_work_locations(bigint, jsonb)'::regprocedure);

select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'replace_job_work_locations';
```

### 3-2. 실행 직후 검증
```sql
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('local_jobs', 'recruitment_regions'),
    ('job_work_locations', 'matched_recruitment_regions')
  );
-- 기대: data_type='ARRAY', udt_name='_text', is_nullable='YES' 2행

select
  (select count(*) from public.local_jobs) as local_jobs_count,
  (select count(*) from public.job_work_locations) as job_work_locations_count;
-- 기대: 3-1과 정확히 동일

select count(*) from public.local_jobs where recruitment_regions is not null; -- 기대: 0
select count(*) from public.job_work_locations where matched_recruitment_regions is not null; -- 기대: 0
select count(*) from public.job_work_locations where location_verified is null; -- 기대: 0(원래도 not null)

select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'replace_job_work_locations';
-- 기대: service_role만, EXECUTE

select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'replace_job_work_locations';
-- 기대: prosecdef=true, proconfig에 'search_path=public'

select tablename, count(*) from pg_policies
where schemaname='public' and tablename in ('local_jobs','job_work_locations')
group by tablename;
-- 기대: 3-1 실행 전과 정책 개수 동일(컬럼 추가가 RLS 정책 개수를 바꾸지 않음)
```

### 3-3. 롤백 SQL

**⚠️ 안전 범위 경고(사용자 지시로 재확인)**: 아래 롤백은 **5번 코드 변경이
아직 배포되지 않았고, 3-2의 3번 SELECT가 실제로 0을 반환하는 지금 이
상태에서만** 데이터 손실 없이 완전히 가역적이다. 5번 코드 변경 배포 후
실제 저장이 시작된 뒤에 롤백하면 그 사이 쓰인 값은 즉시 사라진다(단,
원문 재크롤로 재계산 가능한 파생 데이터라 영구 손실은 아님).

```sql
begin;

create or replace function public.replace_job_work_locations(
  p_job_id bigint,
  p_rows jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origin text;
begin
  select origin into v_origin from public.local_jobs where id = p_job_id;
  if v_origin is null then
    raise exception 'replace_job_work_locations: local_jobs id % not found', p_job_id;
  end if;
  if v_origin <> 'crawler' then
    raise exception
      'replace_job_work_locations: local_jobs id % has origin=% (not crawler) — refusing to modify its job_work_locations',
      p_job_id, v_origin;
  end if;
  delete from public.job_work_locations where job_id = p_job_id;
  insert into public.job_work_locations (
    job_id, raw_address, normalized_address, lat, lng,
    geocode_status, geocode_source, address_accuracy, coordinate_accuracy, address_evidence, sort_order
  )
  select
    p_job_id, (r->>'raw_address'), (r->>'normalized_address'),
    (r->>'lat')::double precision, (r->>'lng')::double precision,
    coalesce(r->>'geocode_status', 'success'), (r->>'geocode_source'),
    coalesce(r->>'address_accuracy', 'exact_text'), (r->>'coordinate_accuracy'),
    (r->>'address_evidence'), coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

alter table public.job_work_locations drop column if exists matched_recruitment_regions;
alter table public.local_jobs drop column if exists recruitment_regions;

commit;
```
롤백 후 3-1의 SELECT를 재실행해 원상태 확인.

---

## 4. `_job_recruitment_regions` 보호 — 유지 확인됨(변경 없음)

`test_job_recruitment_regions_stays_out_of_local_jobs_insert_payload_until_migrated`
(이전 라운드 추가, 이번에도 50/50에 포함되어 재통과 확인) — 가짜 Supabase로
실제 INSERT payload를 기록해 `recruitment_regions`/`_job_recruitment_regions`
둘 다 전혀 섞이지 않음을 검증. 이번 라운드의 `--verify-write` 구현도
이 값을 payload에 넣지 않는다(verify_write는 active/admin_hidden/origin
3개 필드만 건드림, recruitment_regions와는 무관).

---

## 5. Migration 실행 후 활성화할 두 번째 코드 변경 (diff, 여전히 미적용)

**변경 없음 — 이전 라운드와 동일, 아직 적용 안 함.**

`crawler/job_quality.py`:
```diff
 UPDATE_TRACKED_FIELDS = (
     "salary", "application_deadline", "description", "location", "source_url",
     "preference", "education", "work_period", "num_hires", "hours", "work_days",
+    "recruitment_regions",
 )
```

`crawler/crawl_topcv.py` — `build_job_record()`:
```diff
     job["_job_recruitment_regions"] = job_recruitment_regions
+    # migration 0018 실행 완료 후 활성화.
+    job["recruitment_regions"] = job_recruitment_regions or None
     quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
```

`job_work_locations.matched_recruitment_regions`는 이미 활성화되어 있음
(추가 코드 변경 불필요 — migration만 실행되면 다음 저장부터 자동으로 채워짐).

---

## 6. 검증용 실행 모드 — **구현 완료**(위 0번 참고)

설계만이 아니라 실제로 구현·테스트됨. 사용 예시는 0번 섹션 참고.

---

## 7. 검증 표본 3~5건 선정 기준 + 원상복구 절차 (변경 없음)

### 선정 기준
1. 이미 실측 대조 끝난 공고 우선(KCN Hiệp Phước — `matched_recruitment_regions` 확인용, DOJI Tower — `location_verified=true` 승격 확인용).
2. 기존 local_jobs 행과 매칭되지 않는 새 URL만(INSERT 경로만 타게).
3. 단일 근무지(병합 없음) 1건 이상(회귀 대조군).
4. 좌표가 전혀 안 잡히는 공고 1건 이상(`recruitment_regions`는 채워지고 `matched_recruitment_regions`는 비는 케이스 확인).
5. 총 3~5건, `--verify-write-urls`로 한 번에 저장 — manifest 자동 생성됨.

### 저장 직후 확인
```sql
select id, active, admin_hidden, origin, recruitment_regions, publish_gate_reason
from public.local_jobs where id in (<manifest의 created_ids>);

select job_id, raw_address, coordinate_accuracy, location_verified, matched_recruitment_regions
from public.job_work_locations where job_id in (<manifest의 created_ids>);
```

### 원상복구
manifest 파일의 `created_ids`를 그대로 사용(더 이상 수동으로 id를 받아
적을 필요 없음 — 이번 라운드에서 자동 생성됨):
```sql
delete from public.job_work_locations where job_id in (<manifest.created_ids>);
delete from public.local_jobs where id in (<manifest.created_ids>);
```
(둘 다 삭제는 STRICT 등급 — 실행 직전 위 SELECT로 `source_url`이 이번에 쓴 URL과 일치하는지 재확인 후 사용자 승인 받고 실행.)

---

## 8. 요약 — 아직 하지 않은 것

- migration 0018 실행 ❌
- 5번 코드 변경(local_jobs.recruitment_regions 실제 활성화) 적용 ❌
- 실제 DB 쓰기/공고 저장(`--verify-write-urls` 실행 포함) ❌
- cron/GHA 활성화 ❌

**이번 라운드에서 완료된 것**: `--verify-write` 모드 구현·테스트(50/50),
migration SQL 최종 강화 및 체크리스트 재확인.

승인 시 진행 순서: **migration 0018 실행 → 3-2 검증 → 5번 코드 변경 적용
→ `--verify-write-urls`로 표본 3~5건 저장 → manifest로 확인·정리 → 그
다음에만 cron/GHA 재개를 별도로 논의.**
