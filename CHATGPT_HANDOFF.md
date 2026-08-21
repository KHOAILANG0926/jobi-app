# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

P0 Foundation 보안·계정 저장 기반을 `codex/p0-foundation-security` 브랜치에 구현하고 운영 Supabase에 적용·검증했다. Production 프론트 배포는 하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: 로컬 계약/타입/build 및 운영 RLS/E2E 완료
- `OPERATING DB APPLIED`: 완료
- `SYNCED`: 최종 문서 커밋/push 후 local/remote 일치 확인
- `DEPLOYED`: 미완료, Production 배포 금지 유지

## 변경 내용

- 기존 사용자 역할 충돌 0건을 확인한 뒤 `0005_account_roles_local_jobs_rls.sql`을 적용했다.
- 가입 역할은 `account_roles`에 고정되고 local_jobs는 공개 조회, 기업 본인 소유 INSERT/UPDATE/DELETE, admin/service-role 경로만 허용한다.
- `0003_interviews.sql`, `0006_user_profiles.sql`, `0007_user_cvs.sql`, `0008_cv_photos_storage.sql`을 순서대로 적용했다.
- 로그인 구직자의 Profile/CV는 서버 우선, 계정별 localStorage 캐시/복구본, 명시적 기존 데이터 가져오기 구조다. 게스트 localStorage와 PDF/미리보기 흐름은 유지한다.
- private `cv-photos` bucket은 1.5MB JPEG/PNG/WebP와 사용자별 경로 RLS를 적용했다.
- GitHub Actions의 DB URL/service-role Secret을 사용하는 감사 게이트·migration·E2E 자동화 경로를 추가했다.

## 테스트 결과

- 운영 역할 충돌: 0건
- 운영 migration 적용: 0005 → 0003 → 0006 → 0007 → 0008 통과
- local_jobs seeker/타 기업/metadata 역할 위조 차단: 통과
- interviews 소유 기업/해당 seeker 조회, outsider/타 기업/크롤링 공고/application 없음/소유권 위조 차단, 상태 변경, Realtime: 통과
- user_profiles/user_cvs 본인 저장·타 사용자 격리: 통과
- cv-photos 본인 업로드·다운로드/타 사용자 접근·업로드 차단: 통과
- 합성 데이터 정리: 남은 행 0건
- `node scripts/test-p0-migrations.mjs`, `node scripts/test-profile-account-sync.mjs`, `npx tsc --noEmit`, `npm run build`: 통과
- GitHub Actions 성공 run: `32501094960`

## 발견된 문제

- 최초 운영 E2E에서 Realtime access token이 채널에 명시적으로 전달되지 않아 타임아웃이 발생했다. 토큰 전달을 최소 수정하고 재실행해 통과했다.
- Profile/CV 프론트 코드는 작업 브랜치에만 있으며 Production 배포는 승인 전 금지다.
- 사용자 소유 미추적 HTML/PNG 파일은 건드리지 않았다.

## 다음 결정사항

1. P0 Foundation 핵심 운영 DB blocker는 해소됐다.
2. 작업 브랜치의 Profile/CV 프론트를 Production에 반영하려면 별도 사용자 승인과 배포 검증이 필요하다.
3. 관리자 사용자/신고 관리, 커뮤니티 서버화, 해외 국가 확장은 NEXT PHASE로 유지한다.
4. crawler 품질/재공고 작업은 회사 PC 전용 `f6918ba` 범위이므로 이 브랜치에서 재구현하지 않는다.
