# JOBI P0 Foundation Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 Supabase에서 신뢰 가능한 계정 역할과 국내 공고 소유권을 확정하고, 면접 및 계정 기반 Profile/CV/사진 저장을 기존 UI와 연결한다.

**Architecture:** `account_roles`를 서버가 관리하는 권한 기준으로 만들고 `local_jobs` RLS가 이 역할과 `employer_id`를 함께 검증한다. Profile과 CV는 사용자별 단일 행으로 분리하고 CV 사진은 private Storage에 저장하며, 프론트는 로그인 사용자에게 서버 우선·로컬 캐시·명시적 가져오기 흐름을 제공한다.

**Tech Stack:** PostgreSQL/Supabase Auth·RLS·Storage·Realtime, React 18, TypeScript, Supabase JS, Node/Playwright 검증 스크립트

**Spec:** `docs/superpowers/specs/2026-08-21-p0-foundation-security-design.md`

## Global Constraints

- 회사 PC 전용 crawler 커밋 `f6918ba2b974999e075bdcc3bed6f49349e301d5`의 기능을 재구현하지 않는다.
- 기존 사용자 역할 충돌은 자동 결정하지 않는다.
- 실제 운영 데이터는 삭제하거나 임의 변경하지 않는다.
- 합성 E2E 데이터는 `VGB E2E P0` 식별자를 사용하고 성공·실패 후 모두 정리한다.
- 게스트 CV/localStorage와 기존 PDF·미리보기·작성 UI를 유지한다.
- 서버 저장 성공 전 localStorage 원본을 삭제하지 않는다.
- Production 배포는 하지 않는다.

---

### Task 1: 기존 사용자 역할 및 local_jobs 운영 권한 감사

**Files:**
- Create: `supabase/audits/p0_foundation_readonly.sql`
- Create: `scripts/test-p0-migrations.mjs`

**Interfaces:**
- Consumes: 운영 `auth.users`, `local_jobs`, `applications`, `message_threads` 메타데이터
- Produces: 역할 분포·충돌 목록과 현재 RLS/policy/grants/publication을 읽는 무변경 SQL

- [ ] **Step 1: 감사 SQL 정적 테스트를 먼저 작성**

  `scripts/test-p0-migrations.mjs`가 감사 SQL에 DML/DDL 키워드가 없고 다음 결과 집합을 포함하는지 검사한다: 사용자 역할 분포, 기업 공고 이력, 구직 지원 이력, 기업 지원/메시지 이력, 역할 충돌, `relrowsecurity`, `pg_policies`, `information_schema.role_table_grants`.

- [ ] **Step 2: 테스트가 감사 파일 부재로 실패하는지 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: 읽기 전용 감사 SQL 작성**

  SQL은 `SELECT`/CTE만 사용하고 이메일 등 개인정보를 출력하지 않으며 사용자 UUID와 충돌 사유만 반환한다. `auth.users.raw_user_meta_data->>'role'`과 공고·지원·스레드 이력을 비교한다.

- [ ] **Step 4: 정적 테스트 통과 확인 후 운영에서 읽기 전용 실행**

  Run: `node scripts/test-p0-migrations.mjs`

  운영 연결이 없으면 결과를 `UNVERIFIED`로 유지하고 다음 로컬 구현을 계속한다.

- [ ] **Step 5: 감사 결과 게이트**

  충돌 UUID가 1개라도 있으면 account_roles backfill 운영 적용을 중단한다. 충돌이 없을 때만 Task 2 운영 적용을 허용한다.

### Task 2: account_roles 및 local_jobs RLS

**Files:**
- Create: `supabase/migrations/0005_account_roles_local_jobs_rls.sql`
- Modify: `scripts/test-p0-migrations.mjs`
- Create: `scripts/e2e-p0-foundation.mjs`

**Interfaces:**
- Produces: `account_roles(user_id, role, created_at, updated_at)` 및 서버 관리 역할을 사용하는 local_jobs 정책

- [ ] **Step 1: migration 계약 실패 테스트 작성**

  다음을 정적으로 검사한다: `account_roles` PK/FK/check, 신규 사용자 trigger, 기존 사용자 충돌 시 exception, 일반 클라이언트 쓰기 grant 부재, public SELECT, employer 자기 행 INSERT/UPDATE/DELETE, admin app_metadata 허용, employer_id UPDATE 권한 제외.

- [ ] **Step 2: 새 migration 부재로 실패 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: 최소 migration 작성**

  migration은 transaction 안에서 충돌 탐지 후 중단하고, 충돌이 없을 때만 기존 사용자를 backfill한다. 신규 trigger는 허용 역할만 저장한다. local_jobs anon은 SELECT만, authenticated는 필요한 권한만 부여하고 RLS 정책으로 소유권을 제한한다. service role 기본 bypass는 변경하지 않는다.

- [ ] **Step 4: migration 계약 테스트 통과**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 5: 운영 적용 및 격리 E2E**

  합성 employer A/B와 seeker로 자기 공고 생성·수정·삭제, 타 기업 차단, seeker 차단, user_metadata 변조 차단을 확인한다. 합성 행만 정리한다.

- [ ] **Step 6: 회귀 검증 및 단위 커밋**

  Run: `npx tsc --noEmit`

  Run: `npm run build`

  Commit: `feat: enforce server-backed job ownership`

### Task 3: interviews 운영 적용 및 E2E

**Files:**
- Modify only if required: `supabase/migrations/0003_interviews.sql`
- Modify: `scripts/test-p0-migrations.mjs`
- Modify: `scripts/e2e-p0-foundation.mjs`

**Interfaces:**
- Consumes: `applications`, `local_jobs`, `account_roles`
- Produces: 기업 소유 공고의 실제 지원자만 연결하는 `interviews`

- [ ] **Step 1: 0003 계약 테스트 작성**

  PK/FK/unique/status check, actual application 존재 검증, 기업 소유 공고 검증, 소유권 열 UPDATE 차단, authenticated 전용 권한, Realtime publication을 검사한다.

- [ ] **Step 2: 기존 0003에서 빠진 역할·열 권한 조건이 있으면 실패 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: 필요한 경우에만 0003 최소 보강**

  기존 applications/local_jobs 키 구조를 유지한다. 기업 역할은 `account_roles`로 확인하고 소유권 열은 UPDATE grant에서 제외한다.

- [ ] **Step 4: 운영 적용**

  최신 0003을 적용하고 PostgREST schema cache에서 테이블 존재를 확인한다.

- [ ] **Step 5: 격리 E2E와 정리**

  employer A 생성/조회, seeker 조회, outsider·employer B 차단, crawler 공고·application 없는 사용자 차단, employer/job/seeker 위조 차단, pending/confirmed/cancelled, Realtime 이벤트를 검증한다. `VGB E2E P0` 데이터와 합성 계정만 정리한다.

- [ ] **Step 6: UI 실패 처리·tsc·build 및 단위 커밋**

  Run: `npx tsc --noEmit`

  Run: `npm run build`

  Commit: `feat: activate secure interview scheduling`

### Task 4: user_profiles

**Files:**
- Create: `supabase/migrations/0006_user_profiles.sql`
- Create: `src/lib/accountProfileStorage.ts`
- Modify: `scripts/test-p0-migrations.mjs`
- Modify: `scripts/e2e-p0-foundation.mjs`

**Interfaces:**
- Produces: `loadAccountProfile(userId): Promise<SeekerProfile | null>` 및 `saveAccountProfile(userId, profile): Promise<void>`

- [ ] **Step 1: profile migration·adapter 실패 테스트 작성**

  사용자별 PK/FK, 본인 SELECT/INSERT/UPDATE, anon 및 타 사용자 차단, delete 미부여, 어댑터가 `user_id`를 명시하는지 검사한다.

- [ ] **Step 2: 구현 전 실패 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: migration과 어댑터 최소 구현**

  `user_profiles`는 기본 필드와 timestamps를 갖고 본인만 upsert한다. 서버 오류를 빈 프로필이나 성공으로 변환하지 않는다.

- [ ] **Step 4: 운영 적용 및 사용자 A/B 격리 확인**

  A의 저장·조회, B의 A 접근 차단, anon 차단을 확인하고 합성 행을 정리한다.

- [ ] **Step 5: tsc·build 및 단위 커밋**

  Commit: `feat: add account profile storage`

### Task 5: user_cvs

**Files:**
- Create: `supabase/migrations/0007_user_cvs.sql`
- Create: `src/lib/accountCvStorage.ts`
- Modify: `src/lib/cvStorage.ts`
- Modify: `scripts/test-p0-migrations.mjs`
- Modify: `scripts/e2e-p0-foundation.mjs`

**Interfaces:**
- Produces: `loadAccountCv(userId)`, `saveAccountCv(userId, cv, photoPath)`와 base64 제거 직렬화 함수

- [ ] **Step 1: CV 직렬화 실패 테스트 작성**

  현재 CvData의 모든 텍스트·배열 필드는 보존하고 `profilePhotoDataUrl`은 JSONB payload에서 제외되는지 검사한다.

- [ ] **Step 2: 구현 전 실패 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: migration·adapter·직렬화 구현**

  `user_cvs`는 사용자별 1행, JSONB 객체 check, `photo_path`, timestamps를 갖고 본인만 SELECT/INSERT/UPDATE한다.

- [ ] **Step 4: 운영 적용 및 사용자 A/B 격리 확인**

  A upsert/조회, B·anon 차단, base64 미저장을 확인하고 합성 행을 정리한다.

- [ ] **Step 5: tsc·build 및 단위 커밋**

  Commit: `feat: add account cv storage`

### Task 6: private cv-photos Storage

**Files:**
- Create: `supabase/migrations/0008_cv_photos_storage.sql`
- Modify: `src/lib/accountCvStorage.ts`
- Modify: `scripts/test-p0-migrations.mjs`
- Modify: `scripts/e2e-p0-foundation.mjs`

**Interfaces:**
- Produces: `uploadCvPhoto(userId, dataUrl)`, `loadCvPhoto(path)`, `deleteCvPhoto(path)`

- [ ] **Step 1: bucket/policy 실패 테스트 작성**

  private bucket, MIME/크기 제한, 첫 경로 segment와 auth.uid 일치, 본인 SELECT/INSERT/UPDATE/DELETE 정책을 검사한다.

- [ ] **Step 2: 구현 전 실패 확인**

  Run: `node scripts/test-p0-migrations.mjs`

- [ ] **Step 3: Storage migration과 클라이언트 구현**

  data URL을 Blob으로 변환하고 `<uid>/profile.<ext>`에 upsert한다. 저장된 DB 경로만 사용하며 로드 실패를 원본 CV 손실로 처리하지 않는다.

- [ ] **Step 4: 운영 파일 격리 E2E와 정리**

  A 업로드·조회, B·anon 접근 차단, 허용되지 않은 경로·MIME·크기 차단을 확인하고 합성 객체를 삭제한다.

- [ ] **Step 5: tsc·build 및 단위 커밋**

  Commit: `feat: secure cv photo storage`

### Task 7: Profile/CV 서버 어댑터 연결

**Files:**
- Modify: `src/pages/Profile.tsx`
- Modify: `src/components/CvBuilder.tsx`
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/cvStorage.ts`
- Create: `scripts/test-profile-account-sync.mjs`

**Interfaces:**
- Consumes: Tasks 4~6 어댑터
- Produces: 로그인 서버 우선, 게스트 localStorage 유지, 명확한 저장 실패 UI

- [ ] **Step 1: 브라우저 회귀 테스트 작성**

  게스트 CV 작성, 로그인 서버 프로필/CV 로드, 저장 실패 표시, PDF 버튼·미리보기 유지, 사진 경로 로드를 검증한다.

- [ ] **Step 2: 기존 local-only 동작 때문에 로그인 서버 테스트가 실패하는지 확인**

  Run: `node scripts/test-profile-account-sync.mjs`

- [ ] **Step 3: Profile 비동기 서버 연결 구현**

  로그인 seeker 변경 시 서버 프로필을 로드하고 저장은 서버 성공 후 로컬 캐시를 갱신한다. 계정 변경 중 이전 요청 결과가 새 계정 상태에 반영되지 않도록 취소 플래그를 둔다.

- [ ] **Step 4: CvBuilder 비동기 서버 연결 구현**

  userId를 받아 서버 CV/사진을 로드하고 저장 시 사진 업로드 후 CV 행을 upsert한다. 게스트는 기존 loadCv/saveCv를 그대로 사용한다.

- [ ] **Step 5: 회귀·tsc·build 및 단위 커밋**

  Run: `node scripts/test-profile-account-sync.mjs`

  Run: `npx tsc --noEmit`

  Run: `npm run build`

  Commit: `feat: sync profile and cv by account`

### Task 8: 명시적 localStorage 가져오기와 계정 전환 격리

**Files:**
- Create: `src/lib/accountMigrationStorage.ts`
- Modify: `src/pages/Profile.tsx`
- Modify: `src/components/CvBuilder.tsx`
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/cvStorage.ts`
- Modify: `scripts/test-profile-account-sync.mjs`

**Interfaces:**
- Produces: 계정별 import decision과 실제 사용자 저장 데이터 존재 검사

- [ ] **Step 1: migration UX 실패 테스트 작성**

  서버 행 없음+실제 로컬 키 있음에서만 제안, 데모 기본값 제외, 승인 전 서버 저장 없음, 실패 시 원본 유지, 사용자 A 결정이 B에 적용되지 않음을 검증한다.

- [ ] **Step 2: 구현 전 실패 확인**

  Run: `node scripts/test-profile-account-sync.mjs`

- [ ] **Step 3: 계정별 migration 상태와 확인 UI 구현**

  `vgb_account_import:<uid>`에 accepted/declined만 저장한다. 가져오기 성공 후에도 원본 CV/Profile 키는 삭제하지 않는다.

- [ ] **Step 4: Desktop/Mobile 및 계정 전환 검증**

  사용자 A/B 전환, 새 탭, 새로고침, 가져오기 거절·실패·성공을 확인한다.

- [ ] **Step 5: tsc·build 및 단위 커밋**

  Commit: `feat: add safe local profile import`

### Task 9: 전체 회귀 및 인수인계

**Files:**
- Modify: `CHATGPT_HANDOFF.md`
- Modify only if facts changed: `VIECGANBAN_STRUCTURE_BASELINE.md`

**Interfaces:**
- Produces: 최신 상태 스냅샷과 작업 브랜치 SYNCED 상태

- [ ] **Step 1: 전체 관련 테스트**

  Run: `node scripts/test-p0-migrations.mjs`

  Run: `node scripts/test-profile-account-sync.mjs`

  Run: `node scripts/e2e-p0-foundation.mjs`

- [ ] **Step 2: 타입·빌드**

  Run: `npx tsc --noEmit`

  Run: `npm run build`

- [ ] **Step 3: 합성 데이터 정리 재확인**

  E2E 식별 공고·지원·스레드·메시지·면접·profile·CV·Storage 객체·합성 auth 사용자가 모두 0인지 확인한다.

- [ ] **Step 4: 문서 갱신**

  `CHATGPT_HANDOFF.md`를 현재 작업/변경 내용/테스트 결과/발견된 문제/다음 결정사항으로 덮어쓴다.

- [ ] **Step 5: 최종 커밋·push·SYNCED 확인**

  Commit: `docs: record p0 foundation status`

  local HEAD와 `origin/codex/p0-foundation-security` 일치를 확인한다. Production에는 반영하지 않는다.
