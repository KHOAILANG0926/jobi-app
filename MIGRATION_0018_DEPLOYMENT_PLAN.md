# Migration 0018 운영 적용 준비 계획

**상태: 계획 단계 — 이 문서 작성 시점까지 migration 실행/DB 쓰기/실제 공고
저장/cron·GHA 활성화는 전혀 하지 않았다.** 아래는 실행 전 최종 검토용
SQL과 실행 계획이다.

---

## 1. Migration 0018 최종 SQL (전체, 검토용)

파일: [`supabase/migrations/0018_replace_job_work_locations_wire_location_verified_draft.sql`](supabase/migrations/0018_replace_job_work_locations_wire_location_verified_draft.sql)

```sql
-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- (배경 주석 생략 — 원본 파일 참고)

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
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(r->'matched_recruitment_regions') as x),
      '{}'
    ),
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

-- Postgres는 CREATE OR REPLACE FUNCTION이 시그니처(이름+인자 타입)를 바꾸지
-- 않는 한 기존 GRANT를 자동으로 보존한다 — 그래도 이 파일만 보고도 권한이
-- 유지됨을 의심 없이 확인할 수 있도록 migration 0015와 동일한 REVOKE/GRANT를
-- 재선언한다(멱등 — 부작용 없음).
revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

commit;
```

전체 배경 주석(왜 이렇게 설계했는지, 3차례에 걸친 지시 이력)은 원본 파일에
그대로 있다.

---

## 2. SQL 기준 체크리스트 확인

| 항목 | 확인 | 근거 |
|---|---|---|
| 기존 데이터 변경·삭제 없음 | ✅ | 이 파일에 `update`/`delete`(DML) 문이 전혀 없다. 유일한 `delete`는 `replace_job_work_locations()` 함수 **본문 안**에 있고(0015부터 이미 존재, 이번에 새로 추가된 게 아님), 이는 `p_job_id` 1건 재처리 시 그 job의 job_work_locations만 원자적으로 교체하는 기존 로직 그대로다 — migration 실행 자체는 이 함수를 호출하지 않으므로 이 migration 실행만으로는 어떤 행도 지워지지 않는다. |
| nullable additive 컬럼만 추가 | ✅ | `add column if not exists ... text[]` 2건. `not null`/`default`/`check` 제약이 전혀 없다 — 기존 행은 자동으로 `NULL`이 된다(빈 배열 `{}`이 아님, 아래 "빈 배열/null 처리" 참고). |
| `local_jobs.recruitment_regions text[]` | ✅ | 58~62행. |
| `job_work_locations.matched_recruitment_regions text[]` | ✅ | 64~68행. |
| `location_verified` RPC INSERT 배선 | ✅ | INSERT 컬럼 목록(95~98행)에 `location_verified` 포함, `coalesce((r->>'location_verified')::boolean, false)`로 값 채움(111행) — 컬럼 자체는 migration 0010부터 이미 존재, 이번엔 RPC가 그 값을 실제로 쓰게 만드는 것뿐. |
| 기존 role 권한과 `security_definer`/`search_path` 유지 | ✅ | `create or replace function`이 함수 시그니처(`replace_job_work_locations(bigint, jsonb)`)를 바꾸지 않으므로 Postgres가 기존 GRANT를 자동 보존한다(문서화된 동작). `security definer`/`set search_path = public`도 새 정의에 동일하게 재선언되어 있다(70~76행). 추가로 REVOKE/GRANT를 명시적으로 재선언해(멱등) 파일만 보고도 확신 가능하게 함. RLS는 행 단위 정책이라 컬럼 추가와 무관 — `local_jobs`(0005)/`job_work_locations`(0010) 기존 정책 변경 없음. |
| 빈 배열/null 처리 | ✅ (아래 상세) | RPC INSERT는 `matched_recruitment_regions`가 없거나 빈 JSONB 배열이어도 `coalesce(..., '{}')`로 항상 빈 **배열**(`'{}'::text[]`, NULL 아님)이 된다. 반면 migration 실행 직후 **기존 행**(이미 있던 job_work_locations/local_jobs 레코드)의 새 컬럼값은 `NULL`이다(위 additive 항목 참고) — RPC를 통해 새로 쓰여진 행만 빈 배열, 과거 행은 NULL. 프론트(`matchedRecruitmentRegions`/`recruitmentRegions` 타입이 `string[] | undefined`)는 NULL과 빈 배열을 동일하게(`undefined` 또는 길이 0) 취급하므로 두 경우 모두 안전. |
| 기존 클라이언트와 하위호환 | ✅ | 순수 additive(컬럼 추가 2건 + 함수 재정의, 컬럼/함수 삭제·이름변경·타입변경 없음). 이미 배포된 프론트(어제 커밋 `80661ec`/`1d5a120`까지)는 `job_work_locations` select에 `matched_recruitment_regions`/`local_jobs` select에 `recruitment_regions`를 아직 포함하지 않으므로, 이 migration이 실행돼도 프론트 동작은 전혀 바뀌지 않는다(select하지 않는 컬럼이 새로 생기는 것뿐). 기존 크롤러 코드(migration 실행 전 버전)가 이 RPC를 호출해도 새 INSERT 컬럼 목록은 함수 내부에서만 쓰이므로 호출부 시그니처(`p_job_id`, `p_rows`)가 그대로라 깨지지 않는다. |

---

## 3. 실행 전후 검증용 SELECT + 롤백 범위

### 3-1. 실행 **전** 베이스라인 스냅샷 (읽기 전용)

```sql
-- 두 컬럼이 아직 없는지 확인 (0행이어야 정상)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('local_jobs', 'recruitment_regions'),
    ('job_work_locations', 'matched_recruitment_regions')
  );

-- 롤백 시 비교할 행 수 스냅샷 (이 값이 migration 전후로 절대 달라지면 안 됨)
select
  (select count(*) from public.local_jobs) as local_jobs_count,
  (select count(*) from public.job_work_locations) as job_work_locations_count;

-- 현재 RPC 정의 백업(문자 그대로 저장해두면 롤백 시 붙여넣기용으로 재사용 가능)
select pg_get_functiondef('public.replace_job_work_locations(bigint, jsonb)'::regprocedure);

-- 현재 RPC 권한 스냅샷
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'replace_job_work_locations';
```

### 3-2. 실행 **직후** 검증 (읽기 전용)

```sql
-- 1) 두 컬럼이 정확한 타입/nullable로 생겼는지
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('local_jobs', 'recruitment_regions'),
    ('job_work_locations', 'matched_recruitment_regions')
  );
-- 기대: data_type='ARRAY', udt_name='_text', is_nullable='YES' 2행

-- 2) 행 수가 3-1과 정확히 동일한지 (한 행도 늘거나 줄지 않아야 함)
select
  (select count(*) from public.local_jobs) as local_jobs_count,
  (select count(*) from public.job_work_locations) as job_work_locations_count;

-- 3) 기존 행은 전부 NULL인지 (아직 아무 코드도 이 컬럼에 쓴 적이 없으므로)
select count(*) from public.local_jobs where recruitment_regions is not null;              -- 기대: 0
select count(*) from public.job_work_locations where matched_recruitment_regions is not null; -- 기대: 0

-- 4) location_verified는 컬럼 자체는 그대로(0010부터 not null default false) —
--    이 migration으로 기존 행 값이 바뀌지 않았는지
select count(*) from public.job_work_locations where location_verified is null; -- 기대: 0(원래도 not null)

-- 5) RPC 권한이 그대로인지
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'replace_job_work_locations';
-- 기대: service_role만, EXECUTE 하나

-- 6) security definer / search_path 유지 확인
select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'replace_job_work_locations';
-- 기대: prosecdef=true, proconfig에 'search_path=public' 포함

-- 7) 기존 RLS 정책 개수가 그대로인지(컬럼 추가로 정책이 늘거나 줄지 않음)
select tablename, count(*) from pg_policies
where schemaname='public' and tablename in ('local_jobs','job_work_locations')
group by tablename;
```

### 3-3. 롤백 SQL (완전히 되돌릴 수 있는 범위)

**전제**: 위 3-2의 3)번이 실제로 0(기존 행 전부 NULL)이고, "5. 운영 전 활성화할
두 번째 코드 변경"(아래)이 아직 적용/배포되지 않은 상태에서만 아래 롤백이
**데이터 손실 없이** 완전히 가역적이다. 두 번째 코드 변경까지 배포돼 실제로
이 컬럼에 값이 쓰이기 시작한 뒤에 롤백하면 그 사이에 쓰인 값은 사라진다
(단, 그 값들은 원문 재크롤로 다시 계산 가능한 파생 데이터이므로 영구
손실은 아님).

```sql
begin;

-- RPC를 0018 이전(0015) 정의로 되돌린다 — location_verified/
-- matched_recruitment_regions를 INSERT 목록에서 다시 뺀다.
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
    coalesce((r->>'sort_order')::int, 0)
  from jsonb_array_elements(p_rows) as r;
end;
$$;

revoke all on function public.replace_job_work_locations(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_job_work_locations(bigint, jsonb) to service_role;

-- 두 추가 컬럼 삭제 (nullable, additive였으므로 안전 — 위 전제 충족 시)
alter table public.job_work_locations drop column if exists matched_recruitment_regions;
alter table public.local_jobs drop column if exists recruitment_regions;

commit;
```

롤백 후에는 3-1의 SELECT를 다시 실행해 원래 상태(컬럼 없음, 행 수 동일,
RPC가 0015 정의)로 돌아왔는지 재확인한다.

---

## 4. `_job_recruitment_regions` 보호가 유지되는지 확인

`crawl_topcv.py`의 `upsert_job_record()`는 신규 삽입 시
`insert_payload = {k: v for k, v in job.items() if not k.startswith("_")}`
로 `"_"`로 시작하는 모든 임시 필드(`_job_recruitment_regions` 포함)를
제외한다. 이번에 이 보호를 **엔드투엔드로 검증하는 회귀 테스트**를 추가했다
(가짜 Supabase 클라이언트로 실제 INSERT payload를 기록해 확인):

- [`test_job_recruitment_regions_stays_out_of_local_jobs_insert_payload_until_migrated`](crawler/test_address_pipeline_integration.py) —
  `job["_job_recruitment_regions"] = ["TP.HCM", "Long An"]`를 채운 신규
  공고를 `upsert_job_record()`에 넣고, 실제 INSERT payload 키에
  `recruitment_regions`도 `_job_recruitment_regions`도 전혀 없음을 확인.
  크롤러 전체 테스트에 포함해 **29/29 통과** 확인(기존 28건 + 이번 1건).

즉 migration이 실행되기 전까지는 지금 배포된 코드로 어떤 실행 경로를 타도
`local_jobs.insert()`/`.update()` payload에 `recruitment_regions`가 섞여
들어갈 수 없다 — 컬럼이 없는 지금 이 상태로 실제 크롤/재처리가 재개돼도
안전하다.

---

## 5. Migration 실행 후 활성화할 두 번째 코드 변경 (diff, 아직 미적용)

**주의: 아래 diff는 이번 라운드에서 실제 파일에 적용하지 않았다.** 미리
검토용으로만 제시한다 — migration 0018이 운영 DB에 실제로 실행된 뒤에만
적용해야 한다(지금 적용하면 컬럼이 없어 매 insert가 즉시 실패한다).

### 5-1. `local_jobs.recruitment_regions` 활성화 (신규 diff 필요)

`crawler/job_quality.py`:
```diff
 UPDATE_TRACKED_FIELDS = (
     "salary", "application_deadline", "description", "location", "source_url",
     "preference", "education", "work_period", "num_hires", "hours", "work_days",
+    "recruitment_regions",
 )
```

`crawler/crawl_topcv.py` — `build_job_record()`에서, 기존
`job["_job_recruitment_regions"] = job_recruitment_regions` 줄 바로 뒤에
실제 컬럼 키를 추가로 채운다(둘 다 유지 — `_job_recruitment_regions`는
계속 디버깅/JSON 덤프용으로 남겨도 무해함):
```diff
     job["_job_recruitment_regions"] = job_recruitment_regions
+    # migration 0018 실행 완료 후 활성화 — local_jobs.recruitment_regions
+    # 실제 컬럼에 채울 값(compute_job_updates()의 UPDATE_TRACKED_FIELDS에도
+    # "recruitment_regions" 추가돼 있어야 재처리 시에도 갱신됨).
+    job["recruitment_regions"] = job_recruitment_regions or None
     quality_errors = validate_job_payload(job, source="vieclam24h", today=TODAY)
```

`insert_payload`(신규 삽입 경로)는 `job.items()`를 그대로 필터링해서 쓰므로
(`{k: v for k, v in job.items() if not k.startswith("_")}`), 위처럼
`job["recruitment_regions"]`를 채우기만 하면 INSERT 경로는 **추가 코드
변경 없이** 자동으로 포함된다. UPDATE 경로는 `compute_job_updates()`가
`UPDATE_TRACKED_FIELDS`만 비교하므로 위 job_quality.py 변경이 반드시
함께 있어야 한다.

### 5-2. `job_work_locations.matched_recruitment_regions` RPC 전달

**이미 활성화되어 있다 — 추가 코드 변경 불필요.** `_work_location_rpc_rows()`는
지난 라운드부터 이미 `"matched_recruitment_regions": loc.get("matched_recruitment_regions") or []`를
매 행마다 RPC payload에 포함해 보내고 있다(job_work_locations는 JSONB
경유 RPC라 컬럼이 없어도 지금까지 안전하게 무시됨). migration 0018이
RPC 함수의 INSERT 목록에 이 컬럼을 추가하는 순간, **코드 변경 없이 그
다음 저장부터 자동으로 채워지기 시작한다.** `location_verified`도 동일 —
이미 payload에 포함돼 있고 RPC만 갱신되면 된다.

### 5-3. 적용 순서

1. migration 0018 실행(섹션 3-2 검증 통과 확인).
2. 위 5-1 diff(job_quality.py + crawl_topcv.py 2개 파일) 적용 → `npx tsc`
   해당 없음(Python) → 크롤러 테스트 재실행(`test_job_recruitment_regions_stays_out_of_local_jobs_insert_payload_until_migrated`는
   이 시점부터 **의도적으로 실패해야 정상**이므로, 이 테스트 자체를
   "컬럼이 있을 때는 반대로 포함돼야 한다"는 새 테스트로 교체하거나
   전제 주석을 갱신해야 함 — 다음 라운드에서 처리).
3. 아래 6번 "검증용 실행 모드"로 3~5건 저장 → 7번 절차로 확인/정리.
4. 문제 없으면 이 강제-비공개 오버라이드(6번)를 제거하고 정상 크롤/재처리
   경로로 전환.

---

## 6. 검증용 실행 모드 설계 — 저장되는 모든 공고를 강제로 `active=false`

**목표**: migration 0018 + 5번 코드 변경이 배포된 뒤, 처음 몇 건을 실제로
저장해볼 때 게이트 판정 결과와 무관하게 **절대 공개(active=true)되지
않도록** 이중 안전장치를 코드 레벨에 둔다.

**설계(diff, 아직 미적용)** — 새 CLI 플래그 `--verify-write`를 `--process-url`/
`--reprocess-ids`와 반드시 함께 써야만 동작하고, `--confirm-write`와도
별개로 필요하다(플래그 3개 조합이어야 실제로 저장 + 강제 비공개):

`crawler/crawl_topcv.py`:
```diff
 async def process_single_url(url: str, *, confirm_write: bool = False) -> dict:
+async def process_single_url(url: str, *, confirm_write: bool = False, verify_write: bool = False) -> dict:
     if not confirm_write:
         raise WriteNotEnabledError(...)
     by_source_url, by_key = load_existing_lookup_maps()
     async with browser_page() as page:
         job = await process_job_url(page, url)
+    if verify_write:
+        # 검증 저장 모드 — 게이트 판정 결과와 무관하게 절대 공개하지 않는다
+        # (2026-09-04 사용자 지시: "저장되는 모든 공고가 처음에는 active=false
+        # 가 되도록 검증용 실행 모드를 설계"). admin_hidden까지 같이 켜서
+        # active가 어떤 이유로든 true가 되어도 목록/검색에 노출되지 않는
+        # 이중 안전장치로 만든다.
+        job["active"] = False
+        job["admin_hidden"] = True
     with enable_writes():
         result = upsert_job_record(job, by_source_url, by_key)
     return {**job, **result}
```
`reprocess_jobs()`에도 동일한 `verify_write` 파라미터 + 오버라이드를
동일하게 추가한다(대칭).

CLI 파서:
```diff
     parser.add_argument(
         "--confirm-write", action="store_true",
         help="...",
     )
+    parser.add_argument(
+        "--verify-write", action="store_true",
+        help="--confirm-write와 함께 쓰면, 실제로 저장은 하되 active=false + "
+             "admin_hidden=true를 강제해 절대 공개되지 않게 한다. migration "
+             "0018 배포 직후 3~5건 검증 저장에만 쓴다.",
+    )
     args = parser.parse_args()

     if args.process_url:
         if not args.confirm_write:
             raise SystemExit(...)
-        report = asyncio.run(process_single_url(args.process_url, confirm_write=True))
+        report = asyncio.run(process_single_url(args.process_url, confirm_write=True, verify_write=args.verify_write))
```

**실행 예시(적용 후, 아직 실행하지 않음)**:
```bash
python3 crawl_topcv.py --process-url "https://vieclam24h.vn/....html" --confirm-write --verify-write
```

이 모드는 `--confirm-write`(실제 저장 자체를 허용)와 `--verify-write`
(그 저장을 강제 비공개로 만듦)를 **둘 다** 요구하므로, 실수로 하나만
켜서 검증 목적과 다르게 동작할 위험이 낮다. `--dry-run-urls`는 애초에
저장을 안 하므로 이 플래그와 무관.

---

## 7. 검증 표본 3~5건 선정 기준 + 원상복구 절차

### 7-1. 선정 기준

1. 이번 세션에서 **이미 실제 라이브 페이지 대조까지 끝난** 공고를
   우선한다(신규 조사 불필요, 재현성 높음):
   - KCN Hiệp Phước 공고(반복주소 병합 케이스 — `matched_recruitment_regions`
     2개 이상 채워지는지 확인용)
   - DOJI Tower 공고(원문 좌표 검증 성공 케이스 — `location_verified=true`,
     `coordinate_accuracy='exact'`로 실제 승격되는지 확인용)
2. **기존 local_jobs 행과 매칭되지 않는, 완전히 새로운 URL**을 우선한다
   (INSERT 경로만 타게 해서 기존 행을 건드릴 위험 자체를 없앤다) — 위
   두 건이 이미 local_jobs에 있다면(과거 세션에서 저장됐을 수 있음)
   `--reprocess-ids`가 아니라 아직 DB에 없는 **새 URL**로 대체 선정한다.
3. 단일 근무지(병합 없음) 공고를 최소 1건 포함해 회귀 대조군으로 삼는다.
4. 근무지 텍스트는 있지만 좌표가 전혀 안 잡히는(`unresolved`) 공고를
   최소 1건 포함해 `recruitment_regions`(job 레벨)는 채워지고
   `matched_recruitment_regions`(위치 레벨)는 비는 케이스를 확인한다.
5. 총 3~5건, 전부 `--verify-write`로 저장(6번 모드) — **이 단계에서
   저장되는 모든 행은 이 설계 자체가 `active=false`+`admin_hidden=true`를
   강제하므로 공개 위험이 없다.**

### 7-2. 저장 직후 확인할 것

각 건마다 반환된 `id`를 즉시 기록하고:
```sql
select id, active, admin_hidden, origin, recruitment_regions, publish_gate_reason
from public.local_jobs where id in (<확인용으로 저장된 id들>);

select job_id, raw_address, coordinate_accuracy, location_verified, matched_recruitment_regions
from public.job_work_locations where job_id in (<위 id들>);
```
- `active`가 전부 `false`인지(강제 오버라이드가 실제로 먹혔는지)
- `recruitment_regions`/`matched_recruitment_regions`가 기대한 값으로
  채워졌는지(DB CHECK 위반 없이 insert 성공했는지)
- `location_verified`가 DOJI 케이스에서 `true`로 찍히는지

### 7-3. 원상복구 절차

검증이 끝나면(성공/실패 무관) 이 표본 행들은 **테스트 목적으로 만든
행이므로 운영 데이터가 아니다** — 다음 중 하나로 정리한다(**둘 다 실행은
사용자 승인 후에만**, STRICT 등급 — 삭제는 별도 승인 필요):

- **옵션 A(권장, 삭제)**: 기록해둔 id로 정확히 지정 삭제.
  ```sql
  delete from public.job_work_locations where job_id in (<확인용 id들>);
  delete from public.local_jobs where id in (<확인용 id들>);
  ```
  (`job_work_locations`가 `on delete cascade`라 `local_jobs`만 지워도
  자동으로 같이 지워지지만, 순서를 명시해 의도를 분명히 한다.)
- **옵션 B(보존)**: `active=false`+`admin_hidden=true`인 채로 그대로
  둔다 — 공개 노출 위험이 없으므로 굳이 안 지워도 안전하지만, 운영
  데이터와 테스트 데이터가 섞여 나중에 감사할 때 헷갈릴 수 있어 A를
  권장한다.

이 정리 작업(옵션 A) 자체도 `delete`이므로, 실행 직전에 반드시 위 7-2의
SELECT로 "이 id들이 정확히 우리가 만든 검증용 행이 맞는지"(예:
`source_url`이 이번에 쓴 URL과 일치하는지) 재확인한 뒤 사용자 승인을
받고 실행한다.

---

## 8. 요약 — 아직 하지 않은 것

- migration 0018 실행 ❌ (계획만)
- 5번 코드 변경(로컬 recruitment_regions 활성화) 적용 ❌ (diff만 제시)
- 6번 `--verify-write` 플래그 구현 ❌ (diff만 제시)
- 실제 DB 쓰기/공고 저장 ❌
- cron/GHA 활성화 ❌

승인 시 진행 순서: **migration 0018 실행 → 3-2 검증 → 5번 코드 변경 적용
→ 6번 검증 모드 구현 → 7번 표본 3~5건 저장·확인·정리 → 그 다음에만
cron/GHA 재개를 별도로 논의.**
