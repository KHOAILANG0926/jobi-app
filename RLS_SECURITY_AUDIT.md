# RLS 보안 감사 — local_jobs / job_work_locations (P1)

**이 문서는 최초 읽기 전용 감사 기록이다(당시 상태: 감사만, migration
미실행).** 이후 사용자 승인을 받아 **RLS migration 0019를 실제로
적용하고 검증까지 완료**했다 — 적용된 SQL, 적용 전후 정책 스냅샷,
anon/기업/관리자 검증 결과는 [RLS_MIGRATION_0019_FINAL.md](RLS_MIGRATION_0019_FINAL.md)
참고. 이 문서는 그 이전 시점의 감사 근거 기록으로 그대로 남겨둔다.

**정정**: 지난 라운드 보고에서 "`local_jobs_public_select`는 `using(true)`"
라고 한 것은 **틀렸다** — 그건 migration 0005 원본 파일만 읽고 이후
migration 0009가 이 정책을 이미 갱신했다는 사실을 실제 운영 DB에 대조하지
않은 채 보고한 것이었다. 이번에 운영 DB에서 직접 조회해 바로잡는다.

---

## 1. 현재 RLS 정책표 (운영 DB 실측, 2026-09-04)

### `local_jobs`
| policy | cmd | roles | using / with check |
|---|---|---|---|
| `local_jobs_public_select` | SELECT | anon, authenticated | `admin_hidden = false OR is_admin()` |
| `local_jobs_employer_insert` | INSERT | authenticated | with check: `is_account_active(auth.uid()) AND employer_id = auth.uid() AND origin='employer' AND admin_hidden=false AND EXISTS(account_roles: role='employer')` |
| `local_jobs_employer_update` | UPDATE | authenticated | `is_account_active(auth.uid()) AND employer_id=auth.uid() AND EXISTS(account_roles: role='employer')`(양쪽 동일) |
| `local_jobs_employer_delete` | DELETE | authenticated | 위와 동일 |

**핵심 문제**: SELECT 정책이 `admin_hidden`만 보고 **`active`를 전혀 보지
않는다.** `active=false`(게이트 미통과/만료 등)이면서 `admin_hidden=false`인
행은 전부 공개 조회 가능 — 지금 운영 DB의 sb-4366~4368이 정확히 이 상태.

### `job_work_locations`
| policy | cmd | roles | using / with check |
|---|---|---|---|
| `job_work_locations_public_select` | SELECT | anon, authenticated | **`true`**(무조건 전체 공개) |
| `job_work_locations_owner_write` | ALL(INSERT/UPDATE/DELETE 포함) | authenticated | `EXISTS(local_jobs: employer_id=auth.uid()) OR is_admin()` |

**핵심 문제**: SELECT 정책이 부모 `local_jobs`의 `active`/`admin_hidden`을
**전혀 확인하지 않는다.** local_jobs 쪽에서 아무리 숨겨도 이 테이블을
직접 조회하면(`raw_address`/`lat`/`lng` 포함) 그대로 나온다.

### 그 외 관련 테이블(비교 확인용, 전부 정상)
`applications`/`messages`/`message_threads`/`interviews`/`user_profiles`/
`user_cvs`/`account_roles`/`account_statuses`/`admin_audit_logs`/`reports` —
전부 `roles: {authenticated}`만(anon 정책 없음) + `seeker_id`/`employer_id`/
`user_id`/`reporter_id 
 = auth.uid()`(소유권) 조건. 아래 4번에서 GRANT 레벨까지 실측 재확인.

---

## 2. anon/authenticated/service_role 권한 정리

### 테이블 GRANT (information_schema.role_table_grants + role_column_grants, 실측)
| 테이블 | anon | authenticated | service_role |
|---|---|---|---|
| `local_jobs` | SELECT(전 컬럼, `employer_phone` 포함) | SELECT/INSERT(전 컬럼) + UPDATE(컬럼 제한 — `admin_hidden`/`origin`/`employer_id`/`crawler_version`/`publish_gate_reason`/`last_verified_at`/`id` 제외) + DELETE | 전체(RLS bypass) |
| `job_work_locations` | SELECT(전 컬럼) | SELECT/INSERT/UPDATE/DELETE(전 컬럼) | 전체(RLS bypass) |
| `applications`/`messages`/`message_threads`/`interviews`/`user_profiles`/`user_cvs`/`account_roles`/`account_statuses`/`admin_audit_logs`/`reports` | **없음(GRANT 자체가 없어 RLS 이전에 이미 차단)** | 정책별로 소유권 스코프 | 전체(RLS bypass) |

`service_role`은 `pg_roles.rolbypassrls = true`로 실측 확인 — RLS 정책과
무관하게 항상 전체 접근(크롤러가 SUPABASE_SERVICE_ROLE_KEY로 정상 동작하는
이유). `anon`/`authenticated`는 `rolbypassrls=false`(정상).

### 부수 발견(범위 밖, 보고만): `admin_*` RPC 함수
`admin_create_job`/`admin_handle_report`/`admin_list_users`/
`admin_set_account_status`/`admin_set_job_hidden` 5개 SECURITY DEFINER
함수의 EXECUTE 권한이 Supabase 자체 린터(`get_advisors`)에서
"anon/authenticated도 호출 가능"으로 WARN — 실제 함수 본문을 전부
확인한 결과, **전부 `public.require_admin()`을 첫 줄에서 호출하고**,
`require_admin()`은 `auth.uid() is null or app_metadata.role <> 'admin'`이면
즉시 예외(`errcode 42501`)를 던진다 — 즉 **현재 익스플로잇 가능한 취약점은
아님**(런타임에 확실히 막힘). 다만 GRANT 자체가 anon/authenticated까지
열려 있는 건 방어심층 원칙에 안 맞아, 별도 낮은 우선순위 하드닝 후보로만
기록한다(이번 migration 범위 밖 — 요청 범위인 local_jobs/job_work_locations
SELECT만 다룬다).

---

## 3. 사용자별 필요 접근 — 코드·화면 확인 (추측 없음)

| 사용자 | 코드 근거 | 필요한 접근 |
|---|---|---|
| 비로그인 구직자 | `JobsContext.tsx:151-153` `.from('local_jobs').select(...).eq('active', true)` — 활성 공고만 표시(Home/검색/지도 전부 `useJobs()` 공유) | `active=true AND admin_hidden=false` 공고만 |
| 로그인 구직자 | 동일 쿼리 + `applications`/`messages`/`interviews`(전부 `seeker_id=auth.uid()` 소유권 정책, 이미 안전) | 위와 동일(구직자는 local_jobs에 대해 비로그인과 권한 차이 없음) |
| 공고를 등록한 기업 | `RequireEmployer.tsx`는 `user_metadata.role==='employer'`만 확인(클라이언트가 자유롭게 설정 가능 — **인증 아님, 화면 진입 게이트일 뿐**). 실제 쓰기 권한은 `local_jobs_employer_*` 정책이 `account_roles` 테이블(`role='employer'`, 서버측 테이블)로 별도 검증 — 이게 진짜 권한 경계. **읽기는 별도 정책이 아예 없다** — `EmployerDashboard.tsx:64-65` `myJobs = jobs.filter(j => j.employerId === user.id)`가 `useJobs()`의 **공개(active=true) 목록**에서 걸러내는 구조라, 지금은 기업이 자기 공고라도 `active=false`/`admin_hidden=true`면 대시보드에서 아예 안 보인다(프론트 쿼리 자체가 안 가져옴 — RLS 이전 단계의 별개 문제, 4번 참고) | 자기 소유(`employer_id=auth.uid()`) 공고는 `active`/`admin_hidden` 무관하게 조회 가능해야 함(사용자 지시 요구사항) — **RLS만 고쳐서는 부족하고, 프론트 쿼리도 별도로 바꿔야 실제로 보임(이번 라운드 범위 밖, 아래 6번에 후속 과제로 기록)** |
| 관리자 | `RequireAdmin.tsx`가 `supabase.auth.getUser()`로 받은 `app_metadata.role==='admin'` 확인 — 이 값은 서버(service_role)만 설정 가능, 클라이언트 위조 불가(코드 주석 자체가 이 사실을 명시). RLS `is_admin()`도 정확히 같은 조건 | 전체 조회(이미 `is_admin()`으로 확보됨) |
| crawler(service_role) | `crawler/crawl_topcv.py`가 `SUPABASE_SERVICE_ROLE_KEY` 사용 | 전체 접근(이미 `rolbypassrls=true`로 확보됨, RLS 변경과 무관) |

---

## 4. anon key 실제 REST 재현 테스트 (읽기 전용 GET만, 실측)

운영 DB의 실제 `local_jobs` 4건 상태:

| id | active | admin_hidden |
|---|---|---|
| 4366 | false | false |
| 4367 | false | false |
| 4368 | false | false |
| 4369 | true | false |

**주의**: 운영 DB에 `admin_hidden=true`인 행이 현재 0건이라(아무도 아직
숨긴 적 없음), "active=false + admin_hidden=true" 조합은 실제 행으로
재현하지 못했다 — 이번 라운드는 DB 쓰기 금지라 테스트용 행도 만들지
않았다. 이 조합은 정책 SQL 자체(`admin_hidden=false OR is_admin()`)를
근거로 논리적으로 판단했다(`admin_hidden=true`면 `is_admin()`이 아닌 한
결과에서 제외됨 — 이 부분은 실측이 아니라 정책 텍스트 근거임을 명시).

**anon key로 `GET /rest/v1/local_jobs?id=in.(4366,4367,4368,4369)` 실행 결과**:
```json
[
  {"id":4369,"active":true,"admin_hidden":false,"title":"Công Nhân May – Đi Làm Ngay"},
  {"id":4366,"active":false,"admin_hidden":false,"title":"Kỹ Sư Điện - Lương Từ 20Tr"},
  {"id":4367,"active":false,"admin_hidden":false,"title":"Lái Xe B2 / D Chở Nhật / Hàn (Kcn / Sân Bay / Văn Phòng)"},
  {"id":4368,"active":false,"admin_hidden":false,"title":"Quản Lý Cửa Hàng Cà Phê"}
]
```
**→ 실측 확인: `active=false` 3건 전부 anon key만으로 그대로 노출됨.**
앱 UI(`JobsContext.tsx`의 `.eq('active', true)`)는 이 요청을 절대 만들지
않지만, anon key 자체로 직접 REST를 호출하면(Postman, curl, 브라우저
개발자도구 등 무엇으로든) 앱 UI를 거치지 않고 그대로 받아진다 —
**UI 필터는 보안 경계가 아니다**(사용자 지시 7번 원칙, 실측으로 확인).

| 확인 대상 | 결과 |
|---|---|
| `active=true, admin_hidden=false`(4369) | 노출됨(정상 — 공개돼야 하는 공고) |
| `active=false`(4366~4368, `admin_hidden=false`) | **실측: 노출됨(문제)** |
| `admin_hidden=true` | 실측 불가(운영 DB에 해당 행 없음) — 정책 텍스트 근거로는 차단됨(`admin_hidden=false OR is_admin()`) |
| `active=false + admin_hidden=true` | 실측 불가(위와 동일 사유) — 정책 텍스트 근거로는 차단됨 |

---

## 5. `job_work_locations` 직접 조회 — local_jobs를 숨겨도 주소가 새는지

**anon key로 `GET /rest/v1/job_work_locations?job_id=in.(4366,4367,4368,4369)` 실행 결과**:
```json
[{"id":255,"job_id":4369,"raw_address":"Lô F1, Khu F, Đường số 1, Cụm công nghiệp Lợi Bình Nhơn, Phường Khánh Hậu, Tây Ninh","lat":null,"lng":null,"coordinate_accuracy":"unresolved"}]
```
4366~4368은 job_work_locations 행 자체가 없어(이번 세션 내내 실제 저장을
안 했으므로) 결과가 없을 뿐이고, 4369(이미 공개된 공고)는 정상 노출된다 —
**이 결과 자체는 새로운 유출이 아니다.** 하지만 정책(`using(true)`)을 텍스트
그대로 읽으면 **local_jobs 쪽에서 아무리 admin_hidden=true로 숨겨도
job_work_locations는 그 사실을 전혀 확인하지 않으므로 계속 노출된다** —
지금 당장 실제로 숨겨진 근무지 주소가 없어서 "무해해 보일 뿐"이지,
구조적으로는 **어떤 job_id를 지정해도 무조건 조회되는 완전히 열린
정책**이다. 이게 이번 감사에서 가장 심각한 항목이다: local_jobs를 제대로
고쳐도 이 테이블을 별도로 안 고치면 여전히 정밀 주소가 샌다.

---

## 6. applications/messages/기업 연락처 등 연결 데이터 노출 점검 (읽기 전용)

- `applications`/`messages`/`message_threads`/`interviews`: `anon`
  GRANT 자체가 없음(2번 표 확인) — REST로 직접 조회 시도해도 PostgREST가
  "permission denied"로 즉시 거부(GRANT 단계에서 막힘, RLS까지 갈 필요도
  없음). **실제 curl 테스트는 인증 토큰이 필요해 이번 라운드에서는
  생략**(정상적인 요청이라도 세션 토큰을 만드는 것 자체가 계정 생성/로그인
  같은 "쓰기성" 동작에 가까워, 이번엔 GRANT 부재라는 구조적 근거만으로
  충분히 확신 가능하다고 판단 — 필요하면 다음 라운드에 별도 승인받아
  진행).
- `local_jobs.employer_phone`: anon SELECT 컬럼 목록에 포함돼 있고,
  `JobDetail.tsx:566-569`/`JobCard.tsx:135`에서 실제로 비로그인 사용자에게도
  "전화 걸기"(`tel:`) 버튼으로 **의도적으로** 공개 표시된다 — 이건
  오탐이 아니라 제품 설계(전화로 바로 지원 가능하게 하는 것이 이 서비스의
  핵심 기능)다. 다만 지금 정책 하에서는 `active=false`인 미공개 공고의
  `employer_phone`까지 함께 새는 게 문제이지, `employer_phone` 컬럼
  자체를 막아야 하는 건 아니다(활성 공고에서는 계속 공개돼야 함).
- `account_roles`/`account_statuses`/`user_profiles`/`user_cvs`/
  `admin_audit_logs`/`reports`: 전부 `anon` GRANT 없음 + `authenticated`도
  전부 소유권(`user_id`/`reporter_id = auth.uid()`) 또는 `is_admin()`
  스코프 — 교차 사용자 노출 경로를 찾지 못했다.

**결론**: 이번 감사의 실질적 노출 범위는 **local_jobs(active 필터 누락)와
job_work_locations(필터 전무) 둘로 한정된다.** 나머지 연결 테이블은 이미
안전하게 격리돼 있음을 GRANT 실측으로 확인했다.

---

## 7. 발견된 별도 문제(이번 migration 범위 밖, 기록만)

1. **기업 대시보드가 자기 소유 비공개 공고를 못 본다**(3번 표 참고) —
   RLS를 고쳐도 `JobsContext.tsx`/`EmployerDashboard.tsx`가 여전히
   `active=true` 필터가 걸린 공개 목록에서만 `myJobs`를 걸러내므로, 프론트
   쿼리를 별도로 바꿔야(예: 로그인한 기업이면 `employer_id=auth.uid()`
   조건의 자기 소유 전용 쿼리를 추가로 호출) 실제로 대시보드에 뜬다.
   **RLS migration만으로는 이 기능이 자동으로 고쳐지지 않는다** — 승인
   시 별도 프론트 작업으로 진행.
2. `admin_*` SECURITY DEFINER 함수 5개의 EXECUTE 권한이 anon/authenticated
   까지 열려 있음(런타임 방어는 확인됐으나 GRANT 자체는 과함) — 하드닝
   후보, 이번 범위 밖.
3. `korea_jobs`/`korea_job_work_locations`: RLS는 켜져 있지만 정책이
   아예 없음(Supabase 린터 INFO) — `korea_jobs_public`/`korea_job_work_
   locations_public`이라는 별도 SECURITY DEFINER 뷰로 우회 노출하는
   구조로 보임(뷰 정의까지는 확인 안 함) — local_jobs와 무관한 별개
   기능이라 이번 범위 밖.
4. `postgis`/`unaccent` 확장이 `public` 스키마에 설치됨, 비밀번호 유출
   보호(leaked password protection) 비활성, 트리거 함수 2개의
   `search_path`가 mutable — 전부 Supabase 린터 기본 출력, 이번 요청
   범위(local_jobs/job_work_locations RLS) 밖이라 손대지 않음.

---

## 8. 권장 RLS migration 초안 (미실행, additive — 정책 REPLACE만)

**설계 원칙**: 스키마 변경 없음(컬럼/테이블 추가·삭제 없음), 기존
INSERT/UPDATE/DELETE 정책 변경 없음(요청받은 SELECT 노출 문제만 수정),
`account_roles`/`is_admin()`/`employer_id` 등 **실제 확인된** 인증
구조만 사용(추측 없음).

```sql
-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
--
-- 배경(2026-09-04, 사용자 지시 — RLS 보안 감사 P1): 운영 DB 실측 결과
-- local_jobs_public_select(admin_hidden=false OR is_admin())가 active를
-- 확인하지 않아 active=false인 크롤러 공고가 anon key만으로 REST에서
-- 그대로 노출됨을 실제로 재현했다(sb-4366~4368). job_work_locations_
-- public_select는 아예 using(true)라 local_jobs를 아무리 숨겨도 정밀
-- 주소/좌표가 무조건 노출된다. 이 migration은 두 SELECT 정책만
-- REPLACE한다 — INSERT/UPDATE/DELETE 정책, 테이블 구조, 다른 테이블은
-- 전혀 건드리지 않는다.
--
-- 새 조건(둘 다 employer_id/is_admin()은 이미 운영 중인 is_admin()/
-- account_roles 기반 권한 체계를 그대로 재사용 — 새 role/JWT 필드를
-- 추측해서 만들지 않았다):
--   * 공개: active = true AND admin_hidden = false (기존 admin_hidden
--     단독 조건에 active를 추가)
--   * 소유자: employer_id = auth.uid() — 자기 공고는 비공개 상태도 조회
--     가능(사용자 지시 요구사항, 지금까지 이 SELECT 경로 자체가 없었음)
--   * 관리자: is_admin()(기존과 동일, 변경 없음)
-- job_work_locations는 위 조건을 local_jobs와 조인해서 그대로 반영한다
-- — "동일한 공개 조건 또는 소유권 조건으로 확인할 때만 조회"(사용자 지시).

begin;

drop policy if exists local_jobs_public_select on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (
    (active = true and admin_hidden = false)
    or (auth.uid() is not null and employer_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.local_jobs l
      where l.id = job_work_locations.job_id
        and (
          (l.active = true and l.admin_hidden = false)
          or (auth.uid() is not null and l.employer_id = auth.uid())
          or public.is_admin()
        )
    )
  );

commit;
```

**변경하지 않는 것(명시적으로 그대로 둠)**: `local_jobs_employer_insert`/
`_update`/`_delete`, `job_work_locations_owner_write`, 다른 모든 테이블의
정책, GRANT/REVOKE, `is_admin()`/`is_account_active()`/`require_admin()`
함수 정의, `admin_*` RPC 함수.

### 기존 기능이 깨지지 않는지 사전 점검
- **비로그인/일반 구직자**: 지금과 동일하게 `active=true AND admin_hidden
  =false`만 보임 — Home/검색/지도(`.eq('active',true)`)는 애초에 이보다
  더 좁게 요청하므로 결과가 정확히 같은 부분집합(변화 없음).
- **크롤러(service_role)**: `rolbypassrls=true`라 이 정책 자체가 적용되지
  않음 — 크롤러 쓰기 경로는 영향 없음.
- **관리자**: `is_admin()` 조건 그대로 유지 — 영향 없음.
- **기업**: 지금까지 못 보던 자기 소유 비공개 공고가 **RLS 레벨에서는**
  보이게 됨(개선) — 다만 7-1에서 확인했듯 프론트 쿼리가 별도로 안 바뀌면
  대시보드 화면에는 여전히 안 뜬다(후속 작업 필요, 이 migration만으로는
  화면이 바뀌지 않음 — 회귀 아님, 미완성 상태로 문서화).
- **기존 공개 공고(4369) 노출 범위**: 변경 없음(계속 노출).
- **기존 비공개 공고(4366~4368) 노출 범위**: **더 이상 anon/타인에게
  노출 안 됨**(의도한 수정) — 단, 이 3건이 크롤러 소유(`employer_id=
  NULL`)라 "소유자" 조건도 해당 없음 → `is_admin()`만 해당 → 관리자만
  조회 가능해짐(의도대로).

---

## 9. Rollback SQL

```sql
begin;

drop policy if exists local_jobs_public_select on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (admin_hidden = false or public.is_admin());

drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (true);

commit;
```
정책 REPLACE만이라 롤백도 100% 가역적이다(데이터/스키마 변경이 전혀
없으므로 "코드 활성화 전까지만 안전" 같은 제약 자체가 없음 — migration
0018과 달리 이건 순수 정책 텍스트 교체).

---

## 10. anon/기업/관리자/service_role 통합 테스트 계획 (승인 후 실행, 이번엔 실행 안 함)

migration 적용 후, 실제 계정(테스트 계정 필요 — 신규 생성 여부는 별도
승인) 또는 이미 있는 계정으로 다음을 확인한다. 전부 **읽기(SELECT) 또는
이미 존재하는 세션으로 하는 조회**만 — 새로 쓰기를 검증하는 항목은 없다.

| # | 주체 | 요청 | 기대 결과 |
|---|---|---|---|
| 1 | anon key | `GET local_jobs?id=in.(4366,4367,4368)` | **빈 배열**(현재는 3건 노출 — 이게 사라져야 성공) |
| 2 | anon key | `GET local_jobs?id=eq.4369` | 그대로 노출(공개 공고는 계속 보여야 함) |
| 3 | anon key | `GET job_work_locations?job_id=eq.4369` | 그대로 노출 |
| 4 | anon key | `GET job_work_locations?job_id=in.(4366,4367,4368)`(추후 이 job들에 주소 행이 생긴다면) | 빈 배열이어야 함 |
| 5 | 로그인 구직자 토큰 | 1~4와 동일 | anon과 결과 동일(구직자는 local_jobs에 대해 추가 권한 없음) |
| 6 | 로그인 기업(4366~4368의 employer_id가 자신인 계정, 현재는 전부 employer_id=NULL이라 **해당 없음 — 실제 기업 소유 비공개 공고가 생기면 재검증 필요**) | `GET local_jobs?employer_id=eq.<자기 id>` | 자기 소유는 active/admin_hidden 무관하게 전부 노출 |
| 7 | 로그인 기업 | `GET local_jobs?id=eq.<다른 기업의 비공개 공고>` | 빈 배열(소유자 아니면 여전히 안 보임) |
| 8 | 관리자 토큰(`app_metadata.role='admin'`) | `GET local_jobs?id=in.(4366,4367,4368)` | 전부 노출(관리자는 항상 전체) |
| 9 | 관리자 토큰 | `GET job_work_locations` 전체 | 전부 노출 |
| 10 | service_role(크롤러 키) | 기존 크롤러 dry-run/실제 저장 경로 | 변경 없이 정상 동작(RLS bypass, 이 migration과 무관) |
| 11 | 회귀 | 로그인 구직자로 `applications`/`messages`/`interviews` 조회 | 이번 migration이 안 건드린 테이블이므로 기존과 동일하게 소유권 스코프 유지 |
| 12 | 회귀 | 앱 UI(Home/검색/지도/공고 상세)를 실제 브라우저로 열어 육안 확인 | 공개 공고 표시/지도/길찾기 등 기존 동작 전부 그대로(이 migration은 `active=true` 조건을 만족하는 기존 공개 집합을 전혀 좁히지 않으므로 회귀 없어야 함) |

6~7번은 지금 운영 DB에 employer_id가 있는 비공개 공고 자체가 없어
**실제 데이터로는 검증 불가** — migration 적용 후 실제 기업 계정으로 새
비공개 공고를 하나 만들어야 검증 가능한데, 이는 DB 쓰기이므로 별도 승인
필요(이번 라운드 대상 아님).

---

## 11. 요약

- **P1 확인됨(실측)**: `local_jobs`가 `active`를 안 봐서 비공개(inactive)
  크롤러 공고 3건이 anon key로 그대로 노출.
- **P1 확인됨(정책 텍스트 근거)**: `job_work_locations`는 필터가 전혀
  없어 어떤 job_id든 무조건 노출 — local_jobs를 고쳐도 이거 안 고치면
  여전히 샘.
- **안전 확인됨**: applications/messages/interviews/user_profiles 등은
  GRANT 자체가 anon에 없어 안전. `admin_*` RPC는 GRANT는 과하지만
  `require_admin()`이 실제로 막고 있어 익스플로잇 불가.
- **부수 발견**: 기업 대시보드가 이미(RLS와 무관하게) 자기 소유 비공개
  공고를 못 보는 프론트 쿼리 구조 — RLS 수정만으론 안 고쳐짐, 후속 필요.
- RLS migration, migration 0018, DB 쓰기, 검증 공고 저장, 기존 데이터
  변경, cron/GHA 활성화는 전혀 하지 않았다.
