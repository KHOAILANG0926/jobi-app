# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Zalo 로그인 — 라이브 계정탈취 결함 긴급 수정 + Production 배포 완료.**
집 PC 세션. **실제 사람이 진짜 Zalo 계정으로 로그인 성공/재로그인/타인
계정 충돌 거부까지 끝까지 확인하기 전까지는 "완료"로 기록하지 말 것**
(계속 유효한 사용자 지시) — 단, 오늘 발견된 라이브 취약점 자체는 수정·
배포·서버 레벨로 확인 완료.

- **IMPLEMENTED + VERIFIED(코드/서버 레벨) + MASTER PUSHED(`c5d7e8f`) +
  PRODUCTION DEPLOYED(`viecganban.vn`에 실제 반영 확인).** 사람이 진짜
  Zalo 계정으로 로그인하는 E2E만 미검증 — 이유는 아래 "발견된 문제" 참고
  (에이전트가 Zalo 계정을 가질 수 없어 직접 못 함).

### 오늘 있었던 일 (시간순)

1. 이 세션과 별개로 **claude.ai 채팅 + GitHub 웹 업로드**로 Zalo 작업이
   더 진행됨(`3a506b1`~`93a767b`, 14개 커밋) — Zalo 도메인 인증, App ID/
   Callback 등록, **Vercel Production에 실제 환경변수 5개 등록**
   (`VITE_ZALO_APP_ID`/`ZALO_APP_SECRET`/`SUPABASE_SERVICE_ROLE_KEY`/
   `ZALO_RELAY_URL`/`ZALO_RELAY_KEY`), state 파라미터 검증 추가, Zalo가
   베트남 밖 IP(Vercel=미국 리전)의 `/me` 조회를 -501로 막는 문제를
   피하려고 AZDIGI VPS 중계 서버(`crawler/zalo_relay.py`) 신설, 사이트
   타이틀 오타 수정("Việt Gần Bạn"→"Việc gần Bạn" — "Việt"는 베트남,
   "Việc"이 일/직업이라 도메인 viecganban.vn과 맞는 표기), + Production
   배포까지 실제로 완료.
2. 이 PC가 집에 돌아와 동기화하다가 발견: **위 세션이 배포한
   `api/zalo-token.js`는 어제(2026-09-25) 발견해 로컬에서만 고쳐뒀던
   계정탈취 결함이 전혀 반영 안 된 원본 그대로였고, 그 상태로 실제
   Production에 살아있는 채로 배포돼 있었음** — 즉 공격자가 피해자의
   Zalo id를 알면 `zalo_<id>@viecganban.vn`으로 먼저 가입해둬서 피해자의
   실제 Zalo 로그인을 가로챌 수 있는 상태가 **실제 라이브 사이트에서 열려
   있었음**(어제 로컬 수정은 push 전이라 반영 안 된 상태 그대로 묻혀있었음).
3. 사용자 승인으로 **즉시 수정 → 커밋 → push → Production 배포**까지 완료.

## 변경 내용 (오늘 긴급 수정, commit `c5d7e8f`)

기준: 오피스 세션이 배포한 relay 아키텍처(그대로 유지) 위에 아래 3개를
추가로 고침.

1. **계정 탈취 방지**: `api/zalo-token.js`의 `createUser()`가 이제
   `zalo_id`를 `app_metadata`(서비스 롤만 수정 가능)에 저장하고,
   `user_metadata`(로그인 사용자 본인이 `supabase.auth.updateUser()`로
   직접 바꿀 수 있어 신원 근거로 못 씀)는 안 쓴다. `generateLink()` 이후
   기존 계정의 `app_metadata.zalo_id`가 지금 로그인 중인 Zalo 사용자와
   정확히 일치할 때만 `hashed_token`을 응답한다(불일치 시 409, 토큰
   미응답 — `generateLink()` 자체는 이미 성공해서 유효한 토큰이 발급된
   뒤이므로 "미발급"이 아니라 "발급된 토큰을 응답에서 버림"이 정확한
   표현). 기존 계정 메타데이터는 검증 전에 절대 덮어쓰지 않는다.
2. **VPS relay 평문 전송 차단**: 지금 `crawler/zalo_relay.py`는 HTTPS가
   아니라 평문 HTTP만 서빙한다 — 그대로 두면 Zalo access_token과
   `X-Relay-Key`가 Vercel↔VPS 공인망 구간에서 암호화 없이 오간다. VPS에
   SSH 접근 권한이 없어 이번 세션에서 실제 TLS(nginx/caddy+인증서 등)를
   붙이는 작업은 못했다 — 대신 `api/zalo-token.js`에 `ZALO_RELAY_URL`이
   `https://`로 시작하지 않으면 503으로 막는 가드를 추가해, **HTTPS로
   전환되기 전까지는 Zalo 로그인 자체가 서버에서 거부되게(fail-closed)**
   했다. `ZALO_RELAY_URL`을 `https://`로 바꾸는 순간 자동으로 다시
   동작한다 — **다음에 VPS 작업 가능한 사람/세션이 relay 앞단에 실제
   TLS를 붙이는 게 필요함** (아래 "다음 결정사항" 참고).
3. **open redirect + 정리 안 된 sessionStorage**: `AuthContext.tsx`에
   `sanitizeInternalRedirect()`를 추가해 `zalo_redirect`(및 그 출처
   `?redirect=`)가 `/`로 시작하는 내부 절대경로일 때만 저장/사용되게
   하고, `ZaloCallback.tsx`가 `zalo_cv`/`zalo_state`/`zalo_redirect`
   3개를 읽는 즉시(가드 통과 여부 무관) 전부 지우도록 고쳐서 성공/취소/
   실패 전 경로에서 1회용 인증정보가 안 남게 했다.
4. **회귀 테스트 신설**: `api/_zalo-token.test.ts` — 실제
   `api/zalo-token.js` 핸들러를 `node:test`의 `mock.module()`로 Zalo/
   relay/Supabase 외부 호출만 모킹한 채 그대로 실행. 6개 시나리오(신규
   가입 시 app_metadata 저장 확인, 기존 계정 미변조+재로그인 성공, 위조/
   연결없음/타계정 거부+토큰 미응답 3건, HTTP relay 차단) 전부 통과 —
   `npm test`에 영구 편입(`scripts/run-tests.mjs`가 `api/`도 스캔하도록
   확장).
5. GitHub 웹 업로드 실수로 남아있던 더미 파일 3개(`index (1).html` 등,
   실제 파일과 내용 동일 확인됨) 삭제.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`(클라이언트+SSR), `npm test`(7/7
  파일, 새 relay/app_metadata 테스트 6/6 포함) — 전부 통과.
- 로컬 `vite preview` + 가짜 App ID로 브라우저 직접 재현: 외부 redirect
  차단, 내부 redirect 정상 저장, 취소 시나리오에서 3개 sessionStorage 키
  전부 정리 — 전부 확인.
- **Production(`viecganban.vn`) 서버 레벨 확인**(비밀값/토큰 출력 없이):
  - `curl -X POST https://www.viecganban.vn/api/zalo-token`에 가짜
    `app_id`로 요청 → "Server misconfigured"가 아니라 Zalo 서버가 직접
    돌려준 `Invalid appId`(-14002) 응답을 받음 — `ZALO_APP_SECRET`/
    `SUPABASE_SERVICE_ROLE_KEY`가 실제로 설정돼 있고 새 코드가 정말
    Zalo API를 호출한다는 것 확인.
  - 실제 사이트에서 "Đăng nhập bằng Zalo" 버튼 클릭 → 실제
    `id.zalo.me`의 진짜 로그인 화면까지 정상 도달(redirect_uri/App ID
    불일치 에러 없음) — 여기서 중단, 실제 계정으로 로그인 시도는 안 함
    (에이전트가 Zalo 계정을 가질 수 없음).
  - **미검증**: 실제 사람이 진짜 Zalo 계정으로 로그인 완료 → Supabase
    세션 생성 → 재로그인 → 서로 다른 Zalo 계정이 같은 합성 이메일에서
    충돌 안 하는지, 이 4가지는 사람이 직접 해봐야 확인 가능.

## 발견된 문제

1. **VPS relay가 여전히 평문 HTTP** — 위 503 가드로 로그인 자체가 막혀
   있어 당장 위험하진 않지만, 실제 로그인을 켜려면 VPS(103.221.223.71)에
   SSH로 들어가서 relay 앞단에 실제 TLS를 붙이고 `ZALO_RELAY_URL`을
   `https://`로 바꿔야 한다 — 이 세션은 그 VPS에 대한 SSH 접근 권한이
   없어서 여기까지만 함.
2. 사람이 직접 하는 실제 로그인 E2E(신규가입/재로그인/계정충돌 거부) —
   위 1번이 해결돼야 시도라도 가능. 그 전까진 "완료"로 기록 안 함.
3. Zalo 개발자 콘솔 설정(App ID/Secret, 콜백 URL) 자체는 오늘 다른
   세션이 등록 완료 주장 + 실제 로그인 화면 도달로 간접 확인됨(콘솔
   내부는 직접 못 봄).

## 다음 결정사항 (사용자 확인 필요)

1. **VPS relay HTTPS 전환** — SSH 접근 가능한 사람/세션이 이어서 처리.
   전환 후 `ZALO_RELAY_URL`을 `https://...`로 바꾸면 로그인이 자동으로
   다시 켜진다(코드 추가 변경 불필요).
2. 1번이 끝나면 실제 Zalo 계정으로 신규가입·재로그인·계정충돌 거부
   E2E를 사람이 직접 확인.
3. (계속 보류 중, 이 작업과 무관) "조건 저장·알림" 기능 — 건드리지 않음,
   설계만 있고 코드/DB 미착수 상태 그대로.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-26 — Zalo 로그인 라이브 계정탈취 결함 긴급 수정** — MASTER PUSHED(`c5d7e8f`) + PRODUCTION DEPLOYED(서버 레벨 확인 완료). 사람의 실제 로그인 E2E는 VPS relay HTTPS 전환 후로 보류.
2. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
3. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
4. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
5. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** — MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서 실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
