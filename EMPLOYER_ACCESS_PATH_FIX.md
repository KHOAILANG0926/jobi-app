# 기업 접근 경로 정리 (RequireEmployer / EmployerDashboard)

**상태: 코드 수정 완료, 테스트 통과, `tsc`/`build` 통과, 가능한 범위의
브라우저 검증 완료.** migration 0018/0020 실행, DB 데이터 생성·수정·삭제,
크롤러 실행, cron/GHA 활성화는 하지 않았다(모두 이번 라운드 금지 대상).

새 정책을 설계한 게 아니라, RLS migration 0019가 이미 허용한 접근을
**프론트가 실제로 요청하도록** 경로만 고쳤다.

---

## 1. `EmployerDashboard` — 공개 목록 필터링 → 전용 쿼리

**변경 전**: `useJobs()`의 공개(`active=true`) 목록에서
`jobs.filter(j => j.employerId === user.id)`로 걸러냄 — RLS가 본인 소유
비공개 공고를 허용해도, 이 쿼리 자체가 서버에 요청조차 안 해서 화면엔
안 보였다.

**변경 후**: `src/lib/jobRows.ts`에 새로 추가한 `fetchEmployerJobs(employerId)`가
`local_jobs`를 `employer_id`로만 직접 조회한다(`.eq('active', ...)` 없음).
`EmployerDashboard.tsx`는 이제 이 함수로 얻은 결과를 자체 state(`myJobs`)로
관리하고, `deleteJob`/`updateJob` 호출 뒤 `loadMyJobs()`로 다시 불러온다.

`rowToJob`/`rowToWorkLocation`(DB row → `Job` 매핑)도 `JobsContext.tsx`
안에 있던 걸 `src/lib/jobRows.ts`로 옮겨 두 곳(공개 목록/기업 전용 목록)이
공유하게 했다 — 매핑 로직이 둘로 갈라져 나중에 어긋나는 걸 막기 위함.
(부수 효과: `JobsContext.tsx`는 JSX가 있어 Node 단독 테스트 실행기가 못
읽는데, `jobRows.ts`는 순수 `.ts`라 테스트 가능해졌다.)

`Job` 타입에 `active`/`adminHidden` 필드를 추가하고, 대시보드 목록에
"⏳ Chưa công khai"(비공개)/"🚫 Bị quản trị viên ẩn"(관리자 숨김) 최소
표시를 붙였다 — 상태가 있다는 것 자체를 화면에서 구분 못하면 "볼 수
있다"는 요구사항이 실질적으로 의미가 없다고 판단해서 추가한 최소한의
표시(새 정책이 아니라 이미 있는 DB 값을 보여주는 것뿐).

## 2. `RequireEmployer` — `user_metadata.role` → `account_roles`

**변경 전**: `user.role !== 'employer'`(`AuthContext`의 `user_metadata.role`)만
확인 — 이 값은 로그인 후 `supabase.auth.updateUser({ data: { role:
'employer' } })`를 아무 사용자나 호출해 스스로 바꿀 수 있다(서버 검증 없음).

**변경 후**: `src/lib/accountRoles.ts`의 새 `checkIsEmployer(userId)`가
`account_roles` 테이블(`user_id=auth.uid()`, RLS로 본인 행만 조회 가능)을
직접 확인한다. `RequireAdmin.tsx`와 동일한 패턴(loading/checking 분리 +
`useEffect`로 서버 값 재확인)을 그대로 따랐다.

**정직하게 밝혀둘 것**: `account_roles`가 "관리자가 검증한 사업자"라는
뜻은 아니다 — `handle_new_auth_user_role()` 트리거가 가입 시 사용자가
스스로 고른 값을 그대로 1회 저장할 뿐이다(이후 사용자가 직접 못 바꾼다는
점만 `user_metadata`와 다름). 실제 쓰기 권한(`local_jobs_employer_*` RLS
정책)은 이미 이 테이블을 근거로 판단하고 있었다 — 이번 수정은 화면
게이트를 그 기준과 맞춘 것뿐, 새 신뢰 체계를 만든 게 아니다.

## 3. 일반 사용자가 화면을 조작해 들어가도 쓰기 권한을 못 얻는지 확인

**⚠️ 부분 검증(코드/DB 레벨, 실제 로그인 화면으로 조작해보지는 않음)**.
실제 seeker 계정 1개로 읽기 전용 세션 시뮬레이션(`set local role
authenticated` + `request.jwt.claims`, 트랜잭션은 `ROLLBACK`, 데이터
변경 없음)을 해서, `local_jobs_employer_insert/update/delete` RLS
정책이 실제로 요구하는 조건(`EXISTS(account_roles ar where ar.role=
'employer')`)을 직접 평가했다:

```
employer_rows_visible_to_self = 0  (실제 seeker 계정, account_roles에 employer 행 없음)
would_pass_employer_role_check = false
```

즉 이 seeker가 브라우저 개발자도구로 `RequireEmployer`를 우회해
`EmployerDashboard`/`PostJob` 화면에 억지로 들어가더라도, `deleteJob`/
`updateJob`/공고 등록이 실제로 DB에 쓰는 시도를 하면 RLS가 이미 이
조건으로 거부한다 — 프론트 가드는 UX용일 뿐 실제 보안 경계가 아니었고,
지금도 여전히 아니다(진짜 경계는 RLS). **다만 이건 정책 SQL을 직접
평가한 것이지, 실제로 로그인해서 화면을 조작해 쓰기를 시도해본 것은
아니다** — 그 실측은 실제 seeker 계정의 로그인 세션이 필요해 이번
라운드에서는 하지 않았다.

## 4~5. 기업 접근 범위 / 익명 접근 범위

- **기업**: 4-1(자기 공고, 공개/비공개/관리자숨김 전부 보여야 함)은
  코드 레벨(`fetchEmployerJobs`가 `active`/`admin_hidden` 필터를 아예
  안 건다는 것)과 유닛 테스트(합성 데이터로 3가지 상태 모두 반환됨을
  확인)로 검증했다 — **⚠️ 실제 기업 계정으로 브라우저에 로그인해 화면에
  뜨는지까지는 확인하지 못했다**(테스트 계정 없음, 계정 생성은 금지된
  행동). 4-2(타 기업 비공개는 안 보임)는 RLS migration 0019 적용 시
  실제 employer 계정 세션 시뮬레이션으로 이미 **실측** 확인됨
  (RLS_MIGRATION_0019_FINAL.md 0-4 참고).
- **익명**: `active=true AND admin_hidden=false`만 보이는 것은 RLS
  migration 0019 적용 시 anon key 실제 REST 요청으로 이미 **실측**
  확인됨(같은 문서 0-3 참고) — 이번 라운드에서 코드를 추가로 안 건드렸으므로
  재검증하지 않았다(회귀 원인이 없음).

## 6. 관리자 화면 / 기존 공개 사용자 화면 회귀 확인

- **`tsc --noEmit`**: 통과(오류 0건).
- **`npm run build`**: 통과.
- **브라우저(로컬 dev preview)**:
  - Home(`/`) — 정상 로드, 공개 공고(active=true 1건) 정상 표시,
    콘솔 에러는 기존에도 있던 것과 같은 패턴(OSM 타일 `ERR_FAILED`,
    이미지/파비콘류 `404`) + 원인 미추적 `401` 1건 관찰(정확한 요청
    URL은 브라우저가 크로스오리진 에러 상세를 숨겨 특정 못함,
    페이지 기능에는 영향 없음 — 이전 라운드들에서도 이 세션 내내
    반복 관찰된 것과 같은 성격이라 이번 변경이 새로 만든 문제로 보이지
    않지만, 확정은 못함).
  - `/bang-dieu-khien`(기업 대시보드 라우트)를 **비로그인** 상태로 열면
    로그인 화면으로 정상 리다이렉트됨(`RequireEmployer`의 `!user` 분기,
    `checkIsEmployer` 호출 자체가 안 일어남) — 실측 확인.
  - `/viec-lam/sb-4369`(공고 상세) — 정상 로드, 내용 동일(회귀 없음,
    `jobRows.ts` 리팩터가 매핑 결과를 바꾸지 않았음을 확인).
  - **⚠️ 관리자 화면(`/quan-tri` 등)과 로그인한 기업/구직자 화면은 실제
    계정이 없어 브라우저로 열어보지 못했다** — `tsc`/`build`가 이
    화면들의 코드도 함께 컴파일·번들링에 성공했다는 것과, 이번 라운드가
    그 파일들을 전혀 건드리지 않았다는 것(구조적 회귀 없음)만 근거로
    삼는다. **실제 화면 확인은 못함.**

## 7. 테스트 (코드 수정보다 먼저 작성)

| 파일 | 대상 | 결과 |
|---|---|---|
| `src/lib/accountRoles.test.ts` | `checkIsEmployer()` | 6/6 통과 |
| `src/lib/jobRows.test.ts` | `fetchEmployerJobs()`/`rowToJob()` | 5/5 통과 |
| `src/lib/jobCoords.test.ts`(회귀) | 무관한 변경 없음 확인 | 2/2 통과 |

둘 다 실제 Supabase 대신 가짜 클라이언트(호출 기록 + 미리 넣어둔 행만
반환)를 주입해서, "active로 필터링하지 않는다", "본인 소유는 상태
무관하게 반환된다", "타 employer_id는 절대 안 섞인다" 같은 것을
**코드 레벨에서** 확인했다 — 이것도 실제 DB/실제 로그인 세션 기반
검증이 아니라 유닛 테스트임을 명시한다.

---

## 요약 — 실측 vs 코드/함수 검증 구분

| 항목 | 상태 |
|---|---|
| anon은 공개 공고만 봄 | ✅ 실측(이전 라운드, RLS 0019 적용 시) |
| 비공개(active=false) anon 노출 차단 | ✅ 실측(이전 라운드) |
| 관리자는 전체 접근 | ✅ 실측(이전 라운드, 실제 관리자 계정) |
| 일반 사용자가 화면 조작해도 쓰기 권한 없음 | ⚠️ 부분 검증(실제 seeker 계정의 RLS 조건 직접 평가, 실제 로그인 조작 시도는 안 함) |
| 기업이 본인 비공개/관리자숨김 공고를 봄 | ⚠️ 부분 검증(코드 로직 + 유닛 테스트만, 실제 로그인 화면 확인 못함) |
| 기업이 타사 비공개 공고를 못 봄 | ✅ 실측(이전 라운드, 실제 employer 계정 세션) |
| 관리자 화면 회귀 없음 | ⚠️ 부분 검증(빌드 성공 + 무변경 근거만, 실제 화면 확인 못함) |
| 공개 사용자 화면(Home/공고상세) 회귀 없음 | ✅ 실측(브라우저로 직접 확인) |
| `tsc`/`build` | ✅ 실측 |
| 테스트(accountRoles/jobRows) | ✅ 실측(유닛 테스트 실행 결과) |

이번 라운드에서 migration 0018/0020 실행, DB 데이터 생성·수정·삭제,
크롤러 실행, cron/GHA 활성화는 하지 않았다.
