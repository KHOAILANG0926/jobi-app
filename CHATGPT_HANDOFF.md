# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**로그인 화면 간소화 완료(2026-09-20)**. 사용자가 헤더 "Đăng nhập"/
"Đăng ký" 캡처를 보며 "누르면 동일한 장면이 나온다"고 지적 — 실제
이동 페이지는 다르지만(`/dang-nhap` vs `/dang-ky`) 로그인 화면에
역할선택 칩("🔍 Tìm việc/🏢 Tuyển dụng")과 "Xác nhận mật khẩu"(비밀번호
재입력)이 회원가입 화면과 거의 동일하게 들어가 있어 그렇게 보였음을
발견 — 페이지를 합치는 대신 로그인에서 목적과 안 맞는 두 요소를
제거하는 방향으로 확정. IMPLEMENTED → VERIFIED(로컬, 실제 테스트
계정 2개로 리다이렉트 로직까지 end-to-end) → MASTER PUSHED(`33fe73f`)
→ PRODUCTION DEPLOYED → PRODUCTION VERIFIED 완료.

## 변경 내용

- [Login.tsx](src/pages/Login.tsx): 
  - **역할 선택 칩 제거** — 로그인 시 역할을 다시 고를 필요가 없음
    (이미 계정에 정해져 있음). 로그인 성공 후 `checkIsEmployer()`
    (account_roles 기반 서버 판정 — RequireEmployer.tsx와 동일한 신뢰
    기준, user_metadata.role은 클라이언트가 스스로 바꿀 수 있어 안 씀)
    로 실제 역할을 조회해 `/bang-dieu-khien`(기업) 또는 `/`(구직자)로
    자동 이동.
  - **"Xác nhận mật khẩu"(비밀번호 재입력) 제거** — 이미 있는 비밀번호를
    입력하는 로그인에는 오타 방지용 재입력이 의미 없음(새 비밀번호를
    만들 때만 유효한 패턴).
  - `?redirect=`/`state.from`(RequireEmployer·RequireAdmin·ReportButton
    등이 쓰는 명시적 이동 경로)은 역할 기반 자동 판정보다 항상 우선 —
    기존 동작 그대로 유지.
  - 푸터 "Đăng ký" 링크에서 `?role=` 쿼리파라미터 제거(더 이상 로그인
    화면에 역할 state가 없음) — Signup.tsx 자신의 "Tìm việc làm/Tuyển
    dụng" 선택 화면이 이미 그 역할을 하므로 중복 제거.

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- **로컬에서 실제 테스트 계정 2개로 end-to-end 검증**: 기업 계정
  로그인 → `/bang-dieu-khien` 자동 이동 확인, 구직자 계정 로그인 →
  `/` 자동 이동 확인, `?redirect=/cong-cu`를 붙인 상태로 로그인 →
  역할과 무관하게 `/cong-cu`로 이동(명시적 리다이렉트 우선순위 유지)
  확인. 테스트 계정 2개 전부 흔적 없이 정리.
- **Production 실측 완료**: `viecganban.vn/dang-nhap`에서 간소화된
  화면(이메일+비밀번호 1개+로그인 버튼만) 정상 렌더 확인.

## 발견된 문제

없음.

## 다음 결정사항

- (사용자가 명시적으로 미룸) 헤더 "Đăng ký"/로고 빨강을 포함한 전체
  색 체계 재검토 — 필요시 다음에 요청하기로 함.
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
