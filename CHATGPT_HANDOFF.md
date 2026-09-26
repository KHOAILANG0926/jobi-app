# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Zalo 로그인 검증/수정 — 진행 중, 중단 지점에서 이어받을 것.** 이 노트북
(LAPTOP-1GF55Q0D, 회사/집 어디서든 동일 경로 `C:\Users\HP\Downloads\jobi-app`)
에서 진행. **실제 Zalo 로그인 성공 검증 전까지 "완료"로 기록하지 말 것**
(사용자 명시 지시).

- **IMPLEMENTED + VERIFIED(부분) + MASTER PUSHED.** 아래 3번(보안 리뷰
  체크리스트)은 지시만 받고 **아직 시작 전** — 다음 세션이 여기부터 시작.

**2026-09-26 추가 — 이 세션과 별개로 claude.ai 채팅 + GitHub 웹 업로드로
Zalo 관련 작업이 더 진행됨(commit `f76ebc6`까지, 이 저장소에 fast-forward
pull로 반영·push까지 완료, 충돌 없음, tsc 통과 확인). 요약:**
- Zalo 도메인 인증(meta 태그) + 앱 설정(App ID/Callback URL 등록) 완료
  주장(Zalo 개발자 콘솔 쪽이라 이 세션에서 직접 확인 못함).
- Vercel Production 환경변수 추가 주장: `VITE_ZALO_APP_ID`,
  `ZALO_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ZALO_RELAY_URL`,
  `ZALO_RELAY_KEY`(값은 이 세션에서 안 보고 안 확인함).
- **아래 3번 보안 검토 항목 중 "state 검증"은 이미 반영된 것을
  코드로 직접 확인함**(`AuthContext.tsx`가 `zalo_state`를 sessionStorage에
  저장, `ZaloCallback.tsx`가 `state !== savedState`면 즉시 에러 처리 후
  `zalo_state` 삭제) — 나머지 4개 항목(신원 근거, 계정 충돌, redirect
  내부경로 제한, 취소/실패 시 정리)은 **아직 재확인 안 함**.
- `api/zalo-token.js`가 Zalo `/me` 조회를 AZDIGI VPS 중계 서버
  (`crawler/zalo_relay.py`, 103.221.223.71:8787) 경유로 바꿈 — 이유는
  "Zalo -501: 베트남 밖 IP는 개인정보 조회 제한, Vercel 함수가 미국 리전"
  이라는 설명(이 세션에서 직접 검증 안 함). 이 중계 서버는 HTTP 평문 —
  요약본 자체가 "추후 HTTPS 적용 검토" 필요 항목으로 남김.
- **GitHub 웹 업로드 실수로 생긴 더미 파일 3개가 저장소에 그대로 있음**
  (`index (1).html`, `src/context/AuthContext (1).tsx`,
  `src/pages/ZaloCallback (1).tsx`) — 파일명에 공백/괄호가 있어 빌드에는
  안 걸림(tsc 통과 확인됨), 하지만 정리 안 된 쓰레기 파일이라 다음 세션이
  삭제 여부 판단 필요.
- **다음 세션 시작 시 반드시 먼저 할 것**: 위 주장들(도메인 인증, Vercel
  환경변수, VPS 중계서버 동작)을 실제로 검증하고, 이 문서 3번의 보안 검토
  나머지 4개 항목을 새 코드 기준으로 이어서 진행. 실제 Zalo 로그인 성공
  여부는 여전히 미검증.

## 변경 내용 (이번 라운드)

### 1. Zalo 로그인 기존 구현 확인
기존에 이미 전체 흐름이 구현돼 있었음(Login.tsx/Layout.tsx 버튼 →
AuthContext.loginWithZalo(PKCE 시작) → ZaloCallback.tsx → api/zalo-token.js
(토큰 교환+Supabase 계정 생성)). HANDOFF 문서엔 이 존재 자체가 기록된 적
없었음 — 이번에 코드 읽어서 처음 파악.

### 2. 발견·수정한 버그 3개
- **로그인 후 항상 `/`로만 이동, 원래 화면 복귀 안 됨** — 이메일 로그인엔
  있는 기능이 Zalo 경로엔 없었음. `loginWithZalo(redirectTo?)`로 시그니처
  변경, `sessionStorage['zalo_redirect']`로 콜백까지 전달.
- **Layout.tsx 헤더 버튼의 숨은 버그**: `onClick={loginWithZalo}`로 함수를
  직접 넘겨서, 파라미터 추가 시 클릭 이벤트 객체가 redirectTo로 잘못
  들어갈 뻔함(`"[object Object]"`가 저장됨) — 화살표 함수로 감싸 수정.
- **PKCE `code_challenge_method=S256` 파라미터 누락** — SHA-256으로
  challenge를 만들면서 방식 명시를 안 하고 있었음. 추가.

### 3. 사용자가 추가로 요청한 보안 검토 항목 — **미착수, 다음 세션 시작점**
사용자가 다음 5가지를 확인/필요시 수정하라고 지시했고, 세션이 중단돼
**하나도 시작 못 함**:
- 서버가 Zalo에서 직접 확인한 사용자 ID만 신원 근거로 쓰는지(api/zalo-token.js
  가 클라이언트가 보낸 값이 아니라 Zalo API 응답의 `zaloUser.id`만 신뢰하는지
  재확인 필요).
- `zalo_<id>@viecganban.vn` 합성 이메일의 **기존 계정을 무조건 로그인시키지
  않는지** — 이전 라운드에서 "구조적으로 충돌 불가능"이라고 코드 검토만으로
  판단했는데, 사용자가 "그렇게 단정하지 말라"고 명시적으로 반려함. 더 엄격한
  검증(예: 기존 계정에 이미 다른 zalo_id가 연결돼 있는데 다른 Zalo 계정으로
  로그인 시도하는 경우 등)이 필요한지 다시 봐야 함.
- OAuth 요청↔콜백을 잇는 **state 파라미터 검증**이 있는지(현재 코드에는
  없어 보임 — CSRF 방지용, 이번에 다시 확인 필요) — PKCE(code_verifier/
  code_challenge)와는 별개의 항목.
- 로그인 후 복귀 경로(`zalo_redirect`)가 **사이트 내부 경로만 허용**하는지
  — 지금 구현은 `sessionStorage`에 넣은 값을 검증 없이 그대로
  `navigate()`에 넘김. open redirect류 문제 가능성 재검토 필요.
  (`redirectTo`를 어디서 받는지도 같이 볼 것: Login.tsx의 `explicitRedirect`
  는 `searchParams.get('redirect')`도 받으므로 외부에서 URL로 임의 값을
  주입할 수 있는 입력임.)
- 인증 취소·실패·성공 후 `sessionStorage`의 `zalo_cv`/`zalo_redirect`가
  각 경로에서 실제로 정리(삭제)되는지 — 성공 경로는 확인함(ZaloCallback.tsx
  가 `hashed_token` 받자마자 `zalo_cv` 삭제, 세션 생성 후 `zalo_redirect`
  삭제). **취소/실패 경로는 아직 확인 안 함** — 에러 시 `zalo_cv`/
  `zalo_redirect`가 sessionStorage에 남아있을 가능성 있음.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build` — 위 2번 수정 3건 반영 후 통과.
- 로컬 dev 서버 + 가짜 App ID로 프론트 흐름만 실제 브라우저 클릭으로 확인:
  PKCE code_verifier(43자) 생성, `zalo_redirect`에 원래 화면 경로 정확히
  저장, `oauth.zaloapp.com`으로 올바른 파라미터(`code_challenge_method=S256`
  포함)와 함께 리다이렉트되는 것까지 확인. **실제 Zalo 인증 완료·세션 생성은
  검증 안 됨**(진짜 App ID/Secret 없음).

## 발견된 문제

1. 위 3번 보안 검토 항목 5개 — 미착수.
2. `VITE_ZALO_APP_ID`/`ZALO_APP_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` 모두
   로컬에 없고, Vercel 쪽 설정 여부도 **확인 못함**(이 로컬 사본이 Vercel
   프로젝트에 연결 안 돼 있어 `vercel env ls` 실행 불가 — 로그인 필요해서
   진행 안 함).
3. Zalo 개발자 콘솔에 콜백 URL(`https://www.viecganban.vn/zalo-callback`,
   로컬 테스트용 `http://localhost:5173/zalo-callback`) 등록 여부 미확인
   (사용자가 직접 확인해야 하는 영역).

## 다음 결정사항 (사용자 확인 필요)

1. 위 5개 보안 검토 항목부터 이어서 처리(다음 세션 시작점).
2. Zalo 개발자 콘솔 설정(App ID/Secret 발급, 콜백 URL 등록) 완료 여부.
3. Vercel 환경변수(`VITE_ZALO_APP_ID`/`ZALO_APP_SECRET`) 설정 여부 — 설정
   후에만 실제 로그인 E2E 검증 가능.
4. (계속 보류 중, 이 작업과 무관) "조건 저장·알림" 기능 — 건드리지 않음,
   설계만 있고 코드/DB 미착수 상태 그대로.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-25 — Zalo 로그인 버그 3건 수정(부분 검증), 보안 검토 착수 전 중단** — 사용자 요청으로 여기서 중단, 완료 아님.
2. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
3. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
4. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
5. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** — MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서 실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
