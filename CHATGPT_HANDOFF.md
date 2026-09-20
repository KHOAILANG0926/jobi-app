# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**관리자 화면에 "미가입 등록"(게스트 공고) 확인 기능 추가 + 회원가입
트리거 버그 발견·수정 완료(2026-09-20)**. "등록 없이 빠르게 게시" 기능을
막 배포한 뒤 사용자가 "그럼 미가입 등록은 어디서 확인하지" → "내가 봐야
확인을 하지"로 실제 눈으로 보는 관리 화면을 요청. 기존 AdminDashboard의
"Jobs" 탭(`/admin`)이 이미 모든 공고를 보여주고 있었지만 게스트 공고를
구분할 방법이 없었음 — 새 화면을 만들지 않고 그 탭에 필터/배지만 추가.
검증 중 실제 회원가입 자체가 깨지는 별개의 진짜 버그를 우연히 발견해
같이 수정. IMPLEMENTED → VERIFIED(로컬, 실제 admin 테스트 계정으로
end-to-end) → MASTER PUSHED(`2b10ff0`) → PRODUCTION DEPLOYED(배포 폴링
중) 진행.

## 변경 내용

### DB 마이그레이션 (적용 완료, Production)
[supabase/migrations/20260920130000_fix_handle_new_auth_user_role_null.sql](supabase/migrations/20260920130000_fix_handle_new_auth_user_role_null.sql)
- `handle_new_auth_user_role()` 트리거 버그 수정 — SQL에서
  `NULL not in ('seeker','employer')`가 거짓이 아니라 NULL(알 수 없음)로
  평가되는 특성 때문에, `raw_user_meta_data`에 `role` 키 자체가 없는
  가입(=NULL)에서는 "기본값 seeker로" 처리가 건너뛰어지고 `account_roles.
  role` NOT NULL 제약 위반으로 **회원가입 자체가 500 에러로 실패**하던
  버그. `coalesce(..., 'seeker')`로 NULL을 먼저 처리하도록 수정.
  **발견 경위**: 오늘 만든 게스트 등록(항상 `role:'employer'`를 명시)은
  전혀 영향 없었지만, admin 테스트 계정을 만들려고 role 없이
  `signUp()`을 호출했다가 실제로 재현됨 — Supabase `auth_logs`에서
  정확한 SQLSTATE(23502) 원인 확인. 실패한 트랜잭션은 정상 롤백돼
  DB 오염 없었음(직접 확인).

### 프론트엔드
- [AdminJobs.tsx](src/components/admin/AdminJobs.tsx)(`/admin` → Jobs 탭):
  `isGuestPost(job)` = `origin==='employer' && employer_id===null`로
  게스트 공고 판정(새 쿼리/컬럼 불필요, 이미 있던 `employer_id`만 활용).
  "Chỉ tin đăng nhanh (không đăng ký)" 체크박스로 필터, 목록에 "⚡ Không
  đăng ký" 배지 표시. **SĐT(전화번호) 열 신규 추가** — 관리 링크를
  잃어버린 사용자가 문의해오면 전화번호 대조로 본인확인하는 용도(이전
  라운드에서 정한 지원 절차 그대로).
- [adminOperations.ts](src/lib/adminOperations.ts): `AdminJob` 타입/
  `listAdminJobs()` select에 `employer_phone` 추가.

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- **로컬에서 실제 admin 테스트 계정으로 end-to-end 검증**: 임시 테스트
  계정 생성(수정된 트리거로 정상 가입 확인) → `app_metadata.role='admin'`
  임시 부여 → 재로그인으로 JWT 갱신 → `/admin` Jobs 탭 정상 접근 →
  SQL로 게스트 공고 테스트 행 직접 삽입 → 새 체크박스 켜니 264건 중
  정확히 1건(그 테스트 행)만 필터링, "⚡ Không đăng ký" 배지와 전화번호
  정상 표시 확인 → 테스트 계정+행 전부 흔적 없이 정리.
- **트리거 수정 자체도 직접 재현·검증**: 수정 전 `role` 없이 `signUp()`
  → 500 에러 재현 확인 → 마이그레이션 적용 → 동일 호출 재시도 →
  성공 + `account_roles.role='seeker'` 정상 확인.
- Production 배포는 폴링 중 — 다음 세션 시작 시 배포 상태 먼저 확인 필요
  (배포 후 실사이트 재확인 아직 안 함).

## 발견된 문제

없음 — 이번에 발견한 트리거 버그는 같은 라운드에 수정·검증까지 완료.

## 다음 결정사항

- **Production 배포 확인 필요**(다음 세션 최우선) — 이 문서 갱신 시점엔
  배포 폴링이 아직 끝나지 않았음.
- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음.
- (별개 논의, 미정) 구글 로그인(OAuth) — Google Cloud Console 외부
  설정이 필요해 보류.
- (별개 논의, 미정) 전화번호(SMS) 인증 — 외부 SMS 서비스 필요해 보류,
  "등록 없이 빠르게 게시"로 사실상 같은 목적 달성.
- (별개 논의, 미정) 기업용 "인재 검색" 기능 부재 — 응답 없이 스킵됨.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성 — 관련 기능은 로컬 상태/프론트 레벨에서 해결, 본체 DB 스키마와
  깊게 엮는 선택 지양.
