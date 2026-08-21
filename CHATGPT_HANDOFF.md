# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

P0 Foundation 보안·계정 저장 기반을 `codex/p0-foundation-security` 브랜치에 구현하고 로컬 검증했다. 운영 Supabase 적용은 이 Codex 환경에서 사용할 수 있는 기존 DB 인증 경로가 없어 보류한다. Production 배포는 하지 않았다.

작업 상태:

- `IMPLEMENTED`: account_roles/local_jobs RLS, interviews 검증 대상, user_profiles, user_cvs, private cv-photos, Profile/CV 서버 어댑터, 명시적 localStorage 가져오기 UX 완료
- `VERIFIED`: 정적 보안 계약, 계정 격리 회귀, 타입 검사, 빌드 완료
- `OPERATING DB APPLIED`: 미완료
- `SYNCED`: 이 문서의 최종 커밋/push 후 완료 여부 확인

## 변경 내용

- `0005_account_roles_local_jobs_rls.sql`: 기존 사용자 역할 충돌 시 전체 중단, 가입 역할 DB 고정, local_jobs 공개 조회와 기업 본인 소유 INSERT/UPDATE/DELETE 정책을 작성했다.
- `0006_user_profiles.sql`, `0007_user_cvs.sql`: auth.uid() 기준 1인 1행과 본인 전용 RLS를 작성했다.
- `0008_cv_photos_storage.sql`: 1.5MB JPEG/PNG/WebP 제한 private bucket과 사용자 경로 격리 정책을 작성했다.
- 로그인 구직자는 Profile/CV를 서버 우선으로 읽고 계정별 localStorage를 캐시/복구본으로 유지한다. 게스트는 기존 localStorage 저장을 유지한다.
- 서버에 데이터가 없을 때만 명시적 가져오기 선택을 표시하며, 성공 전 로컬 원본을 삭제하지 않고 다른 계정으로 재귀속하지 않는다.
- `scripts/e2e-p0-foundation.mjs`는 service-role 자격증명이 주어진 환경에서 합성 계정/RLS 검증과 finally 정리를 수행하도록 준비했다.

## 테스트 결과

- `node scripts/test-p0-migrations.mjs`: 통과
- `node scripts/test-profile-account-sync.mjs`: 통과
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과
- 원격 E2E: 자격증명 부재를 감지해 데이터 생성 전에 BLOCKED 종료 확인

## 발견된 문제

- 브라우저 OAuth 세션이 사용자 브라우저와 Codex 제어 브라우저 사이에 공유되지 않는다.
- 로컬 Supabase access token/config, DATABASE_URL/DB password, psql/CLI 인증, Vercel CLI 인증이 없다.
- GitHub Actions에는 크롤러용 `SUPABASE_SERVICE_ROLE_KEY` 참조만 있고 DDL migration workflow는 없다. Secret 값은 Codex가 읽을 수 없다.
- 따라서 기존 사용자 역할 충돌 감사, 0005/0003/0006/0007/0008 운영 적용, 실제 운영 RLS/E2E 및 합성 데이터 0건 확인은 미검증이다.

## 다음 결정사항

1. 운영 DB 자격증명이 안전하게 주입되는 실행환경에서 `supabase/audits/p0_foundation_readonly.sql`을 먼저 실행한다.
2. 역할 충돌이 1건이라도 있으면 자동 보정 없이 UUID 목록만 검토한다.
3. 충돌이 없을 때 migration을 0005 → 0003 → 0006 → 0007 → 0008 순서로 적용한다.
4. `scripts/e2e-p0-foundation.mjs`를 실행하고 합성 계정·공고·지원·면접·Profile/CV·Storage 객체가 모두 정리됐는지 확인한다.
5. Production 배포는 별도 승인 전 금지한다.
