# RLS Migration 0019 — 최종안 (실행 전 검토용)

**상태: 아직 실행하지 않음.** [RLS_SECURITY_AUDIT.md](RLS_SECURITY_AUDIT.md)의
읽기 전용 감사 결과를 근거로 작성한 최종 SQL. migration 0018, DB 쓰기,
표본 저장, cron/GHA 활성화도 전부 보류 상태.

파일: [`supabase/migrations/0019_local_jobs_public_select_rls_fix_draft.sql`](supabase/migrations/0019_local_jobs_public_select_rls_fix_draft.sql)(P1) + [`0020_admin_functions_revoke_anon_execute_draft.sql`](supabase/migrations/0020_admin_functions_revoke_anon_execute_draft.sql)(별도 하드닝, 독립 적용 가능)

---

## 1. RLS migration SQL 전체 (0019, P1)

```sql
-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
begin;

create or replace function public.local_job_is_visible(
  p_active boolean,
  p_admin_hidden boolean,
  p_employer_id uuid
) returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    (p_active is true and p_admin_hidden is false)
    or (auth.uid() is not null and p_employer_id is not null and p_employer_id = auth.uid())
    or public.is_admin();
$$;

comment on function public.local_job_is_visible(boolean, boolean, uuid) is
  '한 근무공고(local_jobs 행)를 지금 요청 중인 role(anon/authenticated)이 SELECT해도 되는지 — (1) 공개(active=true and admin_hidden=false) (2) 본인 소유(employer_id=auth.uid()) (3) 관리자(is_admin()) 셋 중 하나. local_jobs_public_select와 job_work_locations_public_select가 공유하는 단일 진실 공급원.';

revoke all on function public.local_job_is_visible(boolean, boolean, uuid) from public;
grant execute on function public.local_job_is_visible(boolean, boolean, uuid) to anon, authenticated;

drop policy if exists local_jobs_public_select on public.local_jobs;
create policy local_jobs_public_select on public.local_jobs
  for select to anon, authenticated
  using (public.local_job_is_visible(active, admin_hidden, employer_id));

drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.local_jobs l
      where l.id = job_work_locations.job_id
        and public.local_job_is_visible(l.active, l.admin_hidden, l.employer_id)
    )
  );

commit;
```

**변경하지 않는 것**: `local_jobs_employer_insert`/`_update`/`_delete`,
`job_work_locations_owner_write`, 다른 모든 테이블 정책, GRANT/REVOKE(테이블
레벨), `is_admin()`/`is_account_active()`/`require_admin()` 함수 정의.

**RLS 재귀 검토**: `job_work_locations_public_select`의 EXISTS가
`local_jobs`를 조회할 때 `local_jobs_public_select`가 다시 적용되지만,
그 정책은 `job_work_locations`를 전혀 참조하지 않는다 — 참조가
"job_work_locations → local_jobs" 단방향이라 순환 없음.

---

## 2. 별도 보안 강화 SQL (0020, admin_* EXECUTE 축소 — 독립 항목)

```sql
-- 초안(DRAFT) — 검토용으로만 작성. 사용자 승인 전에는 운영 DB에 실행하지 않는다.
begin;

revoke execute on function public.admin_create_job(jsonb) from anon;
revoke execute on function public.admin_handle_report(uuid, text, text) from anon;
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_set_account_status(uuid, text, text) from anon;
revoke execute on function public.admin_set_job_hidden(bigint, boolean, text) from anon;

revoke execute on function public.admin_create_job(jsonb) from public;
revoke execute on function public.admin_handle_report(uuid, text, text) from public;
revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_set_account_status(uuid, text, text) from public;
revoke execute on function public.admin_set_job_hidden(bigint, boolean, text) from public;
grant execute on function public.admin_create_job(jsonb) to authenticated;
grant execute on function public.admin_handle_report(uuid, text, text) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_job_hidden(bigint, boolean, text) to authenticated;

commit;
```
근거: 5개 함수 전부 `require_admin()`이 이미 실제로 막고 있어(app_metadata
위조 불가) 지금 익스플로잇 가능한 취약점은 아님 — 방어심층 차원의 GRANT
축소일 뿐. 관리자는 실제로 `authenticated` role 세션으로 이 RPC를 호출하므로
(Postgres에 별도 "admin" role은 없음) `authenticated`는 유지, `anon`만 제거.

---

## 3. Rollback SQL

### 0019 rollback
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

drop function if exists public.local_job_is_visible(boolean, boolean, uuid);

commit;
```

### 0020 rollback
```sql
begin;

grant execute on function public.admin_create_job(jsonb) to anon, public;
grant execute on function public.admin_handle_report(uuid, text, text) to anon, public;
grant execute on function public.admin_list_users() to anon, public;
grant execute on function public.admin_set_account_status(uuid, text, text) to anon, public;
grant execute on function public.admin_set_job_hidden(bigint, boolean, text) to anon, public;

commit;
```
둘 다 정책/GRANT 텍스트 교체일 뿐 데이터·스키마 변경이 전혀 없어 100%
가역적(migration 0018과 달리 "코드 활성화 전까지만 안전" 같은 제약 없음).

---

## 4. 정책별 접근표 (0019 적용 후 기준)

| 주체 | local_jobs SELECT | job_work_locations SELECT | 근거 |
|---|---|---|---|
| 비로그인(anon) | `active=true AND admin_hidden=false`만 | 위 조건을 만족하는 job_id에 연결된 행만 | `local_job_is_visible()` 1항목만 성립(auth.uid() 없음, is_admin() 없음) |
| 로그인 구직자 | 위와 동일(추가 권한 없음) | 위와 동일 | 동일 함수, seeker는 employer_id/is_admin() 어느 쪽도 해당 안 됨 |
| 로그인 기업(자기 공고) | `active`/`admin_hidden` 무관하게 조회 가능 | 자기 공고에 연결된 행 전부 | `p_employer_id = auth.uid()` 성립 |
| 로그인 기업(타사 비공개 공고) | 조회 불가(공개 조건도 소유 조건도 불성립) | 조회 불가 | 세 조건 모두 거짓 |
| 관리자(`app_metadata.role='admin'`) | 전체 | 전체 | `is_admin()` 성립 |
| service_role(크롤러/RPC) | 전체(RLS 자체가 적용 안 됨) | 전체 | `rolbypassrls=true`(실측 확인) |

INSERT/UPDATE/DELETE는 이 migration이 손대지 않아 기존과 완전히 동일
(local_jobs_employer_*, job_work_locations_owner_write 그대로).

---

## 5. 적용 후 실행할 검증 요청 (지금은 실행 안 함 — 0019 적용 승인 후)

### anon key (6번)
```bash
# 1) active=true, admin_hidden=false(4369) → 조회 가능
curl "$SUPABASE_URL/rest/v1/local_jobs?id=eq.4369&select=id,active,admin_hidden" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# 기대: 1건 반환

# 2) active=false(4366~4368) → 조회 불가
curl "$SUPABASE_URL/rest/v1/local_jobs?id=in.(4366,4367,4368)&select=id,active,admin_hidden" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# 기대: 빈 배열 []  ← 지금은 3건 노출됨(이게 사라져야 성공)

# 3) admin_hidden=true → 조회 불가(운영 DB에 해당 행이 아직 없어 승인 후
#    admin_set_job_hidden RPC로 실제 관리자 계정이 만든 뒤에만 검증 가능 —
#    이번 검증 요청 목록에 포함만 해두고, 실행은 별도 승인 필요한 쓰기이므로
#    이 라운드에서 진행하지 않는다)

# 4) active=false + admin_hidden=true(두 조건 모두 비공개) → 조회 불가
#    (3번과 동일한 사유로 승인 후 실제 행이 생긴 뒤에만 검증 가능)

# 5) 비공개 job의 job_work_locations 직접 조회 → 불가
curl "$SUPABASE_URL/rest/v1/job_work_locations?job_id=in.(4366,4367,4368)&select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# 기대: 빈 배열(4366~4368은 지금 근무지 행 자체가 없어 이미 빈 배열이지만,
#       0019 적용 후에도 계속 빈 배열이어야 함 — 회귀 없음 확인용)

# 6) 공개 job의 job_work_locations → 가능
curl "$SUPABASE_URL/rest/v1/job_work_locations?job_id=eq.4369&select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# 기대: 1건 반환(지금과 동일 — 회귀 없음 확인용)
```

### authenticated 기업/관리자 테스트 계획 (7번)
| # | 주체 | 요청 | 기대 결과 | 비고 |
|---|---|---|---|---|
| 1 | 기업 A(자기 소유, employer_id=A) | `GET local_jobs?employer_id=eq.A` | active/admin_hidden 무관 전부 조회 | 지금 운영 DB에 employer_id가 채워진 공고가 없어(전부 크롤러 소유) **실제 검증은 테스트 기업 계정 + 실제 공고 1건이 있어야 가능** — 이번 라운드는 계정/공고 생성(쓰기)이라 보류, 승인 후 진행 |
| 2 | 기업 A | `GET local_jobs?id=eq.<기업 B 소유 비공개 공고>` | 빈 배열 | 위와 동일 사유로 보류 |
| 3 | 기업 A | `GET job_work_locations?job_id=eq.<자기 공고>` | 조회 가능 | 위와 동일 |
| 4 | 관리자 | `GET local_jobs?id=in.(4366,4367,4368)` | 전부 조회 가능 | 실제 관리자 계정의 세션 토큰 필요 — 기존에 관리자 계정이 있다면 즉시 검증 가능(신규 생성 불필요) |
| 5 | 관리자 | `GET job_work_locations` 전체 | 전부 조회 가능 | 위와 동일 |
| 6 | 회귀 | 로그인 구직자로 `applications`/`messages`/`interviews` 조회 | 기존과 동일(이 migration이 안 건드림) | 즉시 검증 가능 |
| 7 | 회귀 | 실제 브라우저로 Home/검색/지도/공고 상세 열람 | 기존과 동일하게 동작(공개 집합을 좁히지 않으므로 회귀 없음) | 즉시 검증 가능 |

1~3번은 "기업이 자기 비공개 공고를 본다"는 시나리오라 **실제 기업 계정 +
비공개 공고 1건**이 있어야 진짜 검증이 된다 — 지금 운영 DB엔 그런 데이터가
없다(전부 크롤러 소유, employer_id=NULL). 승인 후 (a) 기존 기업 테스트
계정이 있으면 그걸로, 없으면 신규 계정 생성 여부를 먼저 확인하고 진행한다.

---

## 6. 프론트 후속 수정 diff 계획 (아직 적용하지 않음)

### 6-1. `EmployerDashboard.tsx` — 공개 `useJobs()` 대신 자기 소유 전용 쿼리

**문제**: `myJobs = jobs.filter(j => j.employerId === user.id)`가
`useJobs()`(= `JobsContext`의 `.eq('active', true)` 공개 목록)에서
걸러내는 구조라, 0019가 RLS를 고쳐도 **이 프론트 쿼리가 애초에
비공개 공고를 서버에 요청조차 안 해서** 화면엔 여전히 안 보인다.

**계획**:
```diff
--- a/src/pages/EmployerDashboard.tsx
+++ b/src/pages/EmployerDashboard.tsx
@@
 import { useAuth } from '../context/AuthContext'
 import { useJobs } from '../context/JobsContext'
+import { supabase } from '../lib/supabase'
+import { rowToJob } from '../context/JobsContext' // 또는 별도로 export되는 매핑 헬퍼
@@
 export function EmployerDashboard() {
   const { user } = useAuth()
-  const { jobs, deleteJob, updateJob } = useJobs()
+  const { deleteJob, updateJob } = useJobs()
+  const [myJobs, setMyJobs] = useState<Job[]>([])
+
+  // 공개 목록(.eq('active', true))이 아니라 자기 소유 전용 쿼리 —
+  // 0019 적용 후 local_jobs_public_select가 employer_id=auth.uid()도
+  // 허용하므로, active/admin_hidden과 무관하게 자기 공고가 전부 온다.
+  useEffect(() => {
+    if (!user) return
+    let cancelled = false
+    supabase
+      .from('local_jobs')
+      .select('<필요 컬럼 전체>')
+      .eq('employer_id', user.id)
+      .then(({ data }) => {
+        if (cancelled || !data) return
+        setMyJobs(data.map((r) => rowToJob(r)))
+      })
+    return () => { cancelled = true }
+  }, [user])
@@
-  const myJobs = useMemo(
-    () => jobs.filter((j) => j.employerId === user.id),
-    [jobs, user.id],
-  )
```
`deleteJob`/`updateJob`은 `JobsContext`의 것을 그대로 재사용하되(DB
쓰기는 그대로 유효), 호출 후 이 페이지 로컬 `myJobs` state도 함께
갱신하도록 콜백에서 `setMyJobs`를 같이 호출하는 wrapper를 추가한다
(현재 `deleteJob`/`updateJob`은 `JobsContext`의 공개 `jobs` state만
낙관적 갱신하므로, 이 페이지의 로컬 `myJobs`는 별도로 갱신해야 함).
`rowToJob`이 현재 `JobsContext.tsx` 내부에만 있고 export 안 돼 있다면
export를 추가하거나, 이 페이지가 직접 동일한 매핑을 하는 소규모 헬퍼를
따로 둔다 — 정확한 구현은 승인 후 실제 착수 시 확정.

### 6-2. `RequireEmployer.tsx` — `user_metadata.role` 대신 `account_roles` 사용

**문제**: `user.role !== 'employer'`가 `AuthContext.tsx`의
`u.user_metadata?.role`을 그대로 쓰는데, 이 값은 로그인 후
`supabase.auth.updateUser({ data: { role: 'employer' } })`를 아무 사용자나
호출하면 스스로 바꿀 수 있다(서버 검증 없음) — DB 쓰기 권한
(`local_jobs_employer_*` 정책)은 이미 `account_roles` 테이블로 별도
검증되고 있어 실제 데이터 조작까지 뚫리진 않지만, 이 라우트 가드 자체는
스푸핑된 값으로 통과된다.

**실제 구조 확인(추측 아님)**: `account_roles`는 `handle_new_auth_user_role()`
트리거(SECURITY DEFINER, auth.users INSERT 시 1회만 실행, `on conflict
do nothing`)가 채우고, 이후 사용자가 직접 쓸 수 있는 INSERT/UPDATE 정책이
`account_roles`에 전혀 없다(RLS 실측 확인) — 즉 가입 시점 이후로는
불변이다. **다만 가입 시점의 값 자체는 사용자가 signup 폼에서 스스로
선택한 것**(`AuthContext.tsx`의 `signup(..., role)`)이라, `account_roles`도
"관리자가 검증한 사업자"라는 의미는 아니다 — 차이는 오직 "가입 후에도
계속 바꿀 수 있는지(user_metadata, 가능) vs 가입 시점에 고정되는지
(account_roles, 불가능)"이다. 이 문서에서도 이 구분을 과장하지 않는다.

**계획**:
```diff
--- a/src/components/RequireEmployer.tsx
+++ b/src/components/RequireEmployer.tsx
@@
-import { Navigate, useLocation } from 'react-router-dom'
+import { useEffect, useState } from 'react'
+import { Navigate, useLocation } from 'react-router-dom'
 import { useAuth } from '../context/AuthContext'
-import type { ReactNode } from 'react'
+import { supabase } from '../lib/supabase'
+import type { ReactNode } from 'react'

 export function RequireEmployer({ children }: { children: ReactNode }) {
   const { user, loading } = useAuth()
   const location = useLocation()
+  const [checking, setChecking] = useState(true)
+  const [isEmployer, setIsEmployer] = useState(false)
+
+  useEffect(() => {
+    if (loading) return
+    if (!user) { setChecking(false); return }
+    let cancelled = false
+    // user_metadata.role 대신 서버측 account_roles 테이블(가입 이후
+    // 사용자가 직접 바꿀 수 없음, RLS로 본인 행만 조회 가능)을 확인한다.
+    supabase
+      .from('account_roles')
+      .select('role')
+      .eq('user_id', user.id)
+      .eq('role', 'employer')
+      .maybeSingle()
+      .then(({ data }) => {
+        if (cancelled) return
+        setIsEmployer(!!data)
+        setChecking(false)
+      })
+    return () => { cancelled = true }
+  }, [user, loading])

-  if (loading) return null
+  if (loading || checking) return null

   if (!user) {
     return (
       <Navigate
         to={`/dang-nhap?role=employer&redirect=${encodeURIComponent(location.pathname)}`}
         replace
       />
     )
   }
-  if (user.role !== 'employer') {
+  if (!isEmployer) {
     return <Navigate to="/" replace />
   }
   return <>{children}</>
 }
```
`RequireAdmin.tsx`가 이미 정확히 이 패턴(loading/checking 분리, `useEffect`
+ 서버 값 확인)을 쓰고 있어 그대로 따른 것 — 새 패턴을 만들지 않았다.

두 diff 모두 **이번 라운드에서 실제 파일에 적용하지 않았다** — 0019가
먼저 승인·실행되고, 그 위에서 프론트가 실제로 동작하는지 확인해야
의미가 있기 때문(0019 없이 6-1을 먼저 적용해도 RLS가 여전히 막아서
비공개 공고가 안 보임).

---

## 7. 요약 — 아직 하지 않은 것

- RLS migration(0019, 0020) 실행 ❌
- migration 0018 실행 ❌
- DB 쓰기, 검증 공고 저장 ❌
- 프론트 diff(6-1, 6-2) 적용 ❌
- cron/GHA 활성화 ❌

승인 순서 제안: **0019(P1) 검토·승인·실행 → 5번 anon 검증(즉시 가능한
1/2/5/6번) → 6-1/6-2 프론트 적용 → 기업 테스트 계정으로 나머지 검증 →
그 다음에만 migration 0018/표본 저장 재개 논의.** 0020은 0019와 별개로
아무 때나(먼저·나중·동시 전부 가능) 승인 시 진행 가능.
