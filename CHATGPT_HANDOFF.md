# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**로그인 없이 채용공고 등록 기능 + 비밀번호 찾기 신설 완료(2026-09-20)**.
사용자 피드백("가입 자체가 너무 귀찮다는 의견이 많아")을 반영해 여러 라운드
논의 끝에 확정된 설계:
- "등록 없이 빠르게 게시": 계정 없이 즉시 공개, 무작위 관리 토큰 기반
  링크로만 셀프 수정/마감 가능(마감일 7일 기본값 — 관리자 개입 없이도
  자연히 정리됨, 관리자는 기존 `is_admin()` 우회로 언제든 개입 가능).
- "이메일로 등록": 화면엔 가입 단계 없이, 뒤에서 무작위 비밀번호로 계정을
  자동 생성 + 비밀번호 설정 이메일 발송, 공고는 즉시 그 계정 소유로 등록
  (기존 기업 대시보드로 그대로 관리 가능, 마감일 14일 기본값).
- 이 경로가 필요로 하는 "비밀번호 찾기" 기능 자체가 이 프로젝트에 아예
  없었다는 걸 설계 중 발견해 같이 신설.
IMPLEMENTED → VERIFIED(로컬+Production 양쪽 실제 DB로 두 경로 전부
end-to-end 검증) → MASTER PUSHED(`2aa5ef7`) → PRODUCTION DEPLOYED →
PRODUCTION VERIFIED 전부 완료.

## 변경 내용

### DB 마이그레이션 (적용 완료, Production)
[supabase/migrations/20260920120000_local_jobs_guest_posting.sql](supabase/migrations/20260920120000_local_jobs_guest_posting.sql)
- `local_jobs.guest_manage_token` 컬럼 신규(nullable) — 게스트 공고만 값
  있음, `anon`/`authenticated` 양쪽 다 컬럼 단위 SELECT REVOKE(비밀값이라
  일반 조회 응답에 절대 안 실리게 이중 방어).
- `local_jobs_guest_insert` 정책 신규 — `anon`이 INSERT 가능하되
  `employer_id is null AND guest_manage_token is not null`만 허용
  (토큰 없는 완전 익명 등록은 여전히 불가능).
- `get_guest_job(job_id, token)` / `update_guest_job(job_id, token, ...)`
  함수 신규(SECURITY DEFINER) — 토큰이 정확히 일치할 때만 그 공고를
  조회/수정(active 토글 포함) 가능.
- 기존 회원가입/로그인/관리자 권한/크롤링 공고 로직은 전혀 안 건드린
  순수 추가형 변경.

### 프론트엔드
- [PostJob.tsx](src/pages/PostJob.tsx): `/dang-tin`을 `RequireEmployer`
  게이트에서 풀고(App.tsx), 페이지 안에서 `checkIsEmployer()`로 실제
  기업 계정인지 확인 — 기업 계정이면 기존과 동일, 아니면(비로그인 포함)
  "Đăng nhanh"/"Đăng ký bằng email" 두 경로 선택 UI 노출. 성공 시 각각
  전용 안내 화면(관리 링크 복사 / 이메일 안내)을 보여주고 바로 상세
  페이지로 넘어가지 않음.
- [ManageGuestJob.tsx](src/pages/ManageGuestJob.tsx) 신규 — `/quan-ly-tin/:id?token=`.
  `get_guest_job`으로 조회, 폼 수정 후 `update_guest_job` 호출, "Ngừng
  đăng tin này" 버튼으로 active 토글. 잘못된 토큰이면 "찾을 수 없음" 안내.
- [ForgotPassword.tsx](src/pages/ForgotPassword.tsx)(`/quen-mat-khau`) /
  [ResetPassword.tsx](src/pages/ResetPassword.tsx)(`/dat-lai-mat-khau`)
  신규 — `supabase.auth.resetPasswordForEmail()`/`updateUser({password})`
  표준 플로우. 가입 여부와 무관하게 항상 같은 성공 문구(이메일 열거
  공격 방지). [Login.tsx](src/pages/Login.tsx)에 "Quên mật khẩu?" 링크 추가.
- [JobsContext.tsx](src/context/JobsContext.tsx): `addPostedJob()`이
  `guestManageToken` 옵션 필드를 받아 insert에 반영. insert 후 `.select()`
  를 bare(`select=*`)에서 명시적 안전 컬럼 목록(공개 조회와 동일)으로
  변경 — `guest_manage_token` 컬럼이 REVOKE돼 있어 bare select면 INSERT
  본인 응답에서조차 권한 오류가 날 수 있었음.

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- **로컬 dev(실제 Production Supabase 연결)로 실측**: 게스트 경로 —
  공고 즉시 공개(id=4669) → 관리 링크 재접속 → 폼에 값 정상 표시 →
  "Ngừng đăng tin này" 클릭 → 실제 마감 처리 확인 → **잘못된 토큰으로
  접속 시 정확히 차단(찾을 수 없음)** 확인. 이메일 경로 — 계정 자동
  생성(`account_roles.role='employer'` DB로 직접 확인) → 공고 즉시
  공개(id=4670, employer_id 연결, 마감일 14일) 확인. 두 테스트 행 +
  테스트 계정 전부 흔적 없이 정리.
- **Production 실측**: `viecganban.vn/dang-tin`에서 게스트 경로 실제 제출
  → "Đăng tin thành công!" → 관리 링크(`/quan-ly-tin/4671?token=...`)로
  실제 접속해 폼 정상 표시 확인 → 공개 상세페이지(`/viec-lam/sb-4671`)에
  마감일 7일 기본값 정상 반영 확인 → 콘솔 에러 없음 → 테스트 행 정리 완료.

## 발견된 문제

없음.

## 다음 결정사항

- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음.
- (별개 논의, 미정) 구글 로그인(OAuth) — 이번 세션 초반에 논의됐으나
  Google Cloud Console에서 OAuth 클라이언트를 사용자가 직접 만들어야
  하는 외부 설정이 필요해 보류. 필요해지면 그 설정부터 안내 필요.
- (별개 논의, 미정) 전화번호(SMS) 인증 — Twilio 등 외부 SMS 서비스 가입
  + 건당 비용 필요해 이번엔 보류, "등록 없이 빠르게 게시"로 사실상 같은
  목적(가입 장벽 제거) 달성.
- (별개 논의, 미정) 기업용 "인재 검색"(알바몬 "인재정보"에 해당) 기능
  부재 — AskUserQuestion으로 두 번 물었으나 응답 없이 스킵됨.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성 — korea_jobs 관련 기능은 가능하면 로컬 상태/프론트 레벨에서
  해결하고, 본체 DB 스키마와 깊게 엮는 선택은 지양할 것.
