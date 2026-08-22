# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

NEXT PHASE 1 관리자 운영 기능을 `codex/admin-operations` 브랜치에 구현하고 운영 Supabase에 `0009_admin_operations.sql`을 적용·검증했다. Production 프론트 배포는 하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: 정적 계약, 타입/build, 운영 RLS/E2E 완료
- `OPERATING DB APPLIED`: 완료
- `SYNCED`: 최종 문서 커밋/push 후 local/remote 일치 확인
- `DEPLOYED`: 미완료, 사용자 승인 전 Production 배포 금지

## 변경 내용

- `local_jobs.origin`을 운영 근거대로 employer 3, crawler 643, legacy 3, admin 0으로 backfill하고 `admin_hidden`을 `active`와 분리했다. 관리자 신규 등록만 `admin`으로 기록한다.
- 관리자 화면은 Dashboard / Jobs / Users / Reports / Audit Logs 5개 탭이며 기존 통계와 수동 등록을 유지한다.
- 공고 hide/unhide, 신고 처리, 계정 active/suspended와 모든 관리자 등록은 명시적 admin JWT 재검증·고정 search_path SECURITY DEFINER RPC 및 append-only 감사 로그를 사용한다.
- `account_statuses`와 공통 `is_account_active(uuid)`를 추가했다. 기존 Foundation 소유권 조건은 그대로 두고 applications/messages/interviews/Profile/CV/private Storage 등 민감 정책에 활성 조건만 결합했다.
- 사용자 정지는 서버의 Supabase Admin API ban/unban과 DB 상태 RPC를 함께 사용한다. 정지 전 발급 JWT도 DB RLS에서 즉시 차단된다.
- 공고/커뮤니티 상세에 최소 신고 CTA를 추가했다. 게스트는 로그인으로 이동하고 로그인 사용자는 자기 신고 제출·상태 확인만 가능하다.
- `origin` 적용 뒤에도 기존 Vieclam24h/Facebook crawler가 중단되지 않도록 crawler payload에 코드상 확정 가능한 `crawler` 출처를 명시하고, 미확인 service 연동은 삭제/오분류 대신 `legacy` 기본값으로 보존한다. 품질/재공고 로직은 변경하지 않았다.

## 테스트 결과

- 운영 origin 적용 전 게이트: total 649 / employer 3 / crawler 643 / legacy 3 일치
- anon·일반 사용자 숨김 공고 차단, admin 조회, hide/unhide 즉시 공개 반영: 통과
- 기업 본인 공고 수정, 타 기업 차단, `admin_hidden` 열 변경 차단: 통과
- seeker/employer 관리자 RPC 차단, admin 공고 생성·사용자 조회·신고 처리 성공: 통과
- 신고 본인 조회/타인 차단, audit log 생성/비관리자 쓰기 차단: 통과
- 실제 `/api/admin-users` 처리 경로로 ban + suspended 적용 후 사전 발급 JWT 즉시 차단: 기업·구직자 모두 통과
- active 기능과 지원→메시지→면접 회귀, unsuspend 후 새 로그인 복구: 통과
- private CV 사진 정지 사용자 읽기 차단: 통과
- 합성 데이터 정리: 잔여 행 0건
- GitHub Actions 최종 성공 run: `32543576478`
- `node scripts/test-admin-operations.mjs`, `node scripts/test-admin-users-api.mjs`, 기존 P0 계약, `npx tsc --noEmit`, `npm run build`: 통과

## 발견된 문제

- Supabase 공식 Admin API는 이미 발급된 access JWT 자체를 사용자 ID로 즉시 폐기하지 않는다. 이 한계는 승인된 이중 방어에서 DB RLS의 공통 활성 검사로 보완했다.
- 관리자 프론트와 `/api/admin-users`는 작업 브랜치 상태이며 Production 배포 전에는 운영 화면에서 사용할 수 없다. 운영 DB 정책과 테이블은 적용 완료 상태다.
- 사용자 소유 미추적 HTML/PNG 파일은 건드리지 않았다.

## 다음 결정사항

1. 관리자 운영 프론트/API의 Production 배포는 별도 사용자 승인 후 진행한다.
2. Production 반영 후 실제 관리자 계정으로 5개 탭과 serverless 환경변수 주입을 최종 확인한다.
3. 커뮤니티 원본 서버화, 고급 신고 자동화, 역할 변경 절차는 NEXT PHASE로 유지한다.
4. crawler 품질/재공고 작업은 회사 PC 전용 `f6918ba` 범위이므로 재구현하지 않는다.
