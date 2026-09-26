# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Zalo 로그인 — 계정탈취 결함 수정 + VPS relay HTTPS 전환 + 실제 사람의
재로그인 E2E까지 전부 완료. 사용자가 직접 확인함.** 집 PC 세션.

- **IMPLEMENTED + VERIFIED(코드/서버/VPS 인프라) + MASTER PUSHED
  (`c5d7e8f`~`31b76fa`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(실제
  사용자가 실제 Zalo 계정으로 재로그인 성공 확인, 2026-09-26).** 이 작업
  전체를 완료로 기록함.

### 마지막 단계 — 실사용 중 발견된 계정 충돌 1건과 안전한 처리

사람이 처음 실제 로그인을 시도했을 때 "Email already in use by a
different account"(409) 에러가 났음. **공격이나 실제 두 계정 간 충돌이
아니었다** — 원인을 DB 직접 조회로 먼저 확인한 뒤에만 손을 댔다:
- 오늘 오전, 이 세션의 `app_metadata` 수정이 배포되기 전 잠깐 Zalo 로그인이
  실 자격증명으로 라이브였던 동안, **사용자 본인이 바로 이 Zalo 계정으로
  실제 로그인을 한 번 시도해서 성공**했었음 — 그때 코드(계정탈취 결함이
  안 고쳐진 버전)가 `user_metadata.zalo_id`만 심고 `app_metadata`는 전혀
  안 건드린 채 계정을 만들었음.
- 그 뒤 `app_metadata` 기준 소유권 검증을 배포하자, **이 계정 하나만**
  새 기준을 충족 못 해서 정당한 주인이 재로그인할 때 거부됨.
- DB로 직접 확인(`auth.users`/`auth.identities`): 이 이메일에 해당하는
  계정은 정확히 1개뿐이고, `user_metadata.zalo_id`가 이미 서버가 방금
  검증한 실제 Zalo id와 정확히 일치, 경쟁하는 다른 계정 없음 — 공격
  정황 없음, 사용자 본인 확인("제가 오늘 오전 처음 로그인했던 Zalo
  계정이 맞습니다")까지 받은 뒤에만 진행.
- **1회성 안전 백필**: 이 계정 1건에 한해 `app_metadata.zalo_id`만 채움
  (`raw_app_meta_data || jsonb_build_object('zalo_id', ...)`로 기존
  `provider`/`providers` 값은 보존, 이메일/비밀번호/`user_metadata`는
  전혀 안 건드림). 변경 전후 값을 직접 보여주고 확인받음. 코드의 검증
  로직 자체는 전혀 안 고침 — 이 계정 하나의 과거 데이터만 새 기준에
  맞게 정리한 것.
- 백필 후 **사용자가 실제로 같은 Zalo 계정으로 재로그인해서 기존 계정으로
  정상 진입하는 것까지 직접 확인함** — 기존 계정 재로그인 E2E 검증 완료.

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
2. **VPS relay 평문 전송 차단 → 실제 HTTPS 전환까지 완료**: `api/
   zalo-token.js`에 `ZALO_RELAY_URL`이 `https://`가 아니면 Zalo API를
   부르기도 전에 503으로 막는 가드를 추가했고(사용자 지적으로 위치를
   Zalo 토큰교환보다 앞으로 재배치, `0cc72e3`), **이번엔 실제로 이 저장소의
   SSH 키(`~/.ssh/jobi_vps`, `known_hosts`에 이미 등록돼 있었음)로 VPS
   접속에 성공해서 HTTPS까지 실제로 붙였다**(`31b76fa`):
   - VPS(`103.221.223.71`)엔 이 프로젝트용 도메인이 없고, DNS(Matbao)
     관리 권한도 이 세션엔 없어서, DNS를 새로 안 건드리고도 신뢰되는
     인증서를 받으려고 **sslip.io**(IP를 그대로 호스트명으로 매핑해주는
     공개 wildcard DNS)를 썼다 — 도메인: `103-221-223-71.sslip.io`.
   - Caddy를 설치해 `:443`에서 이 도메인으로 실제 Let's Encrypt 인증서를
     자동 발급받고 `localhost:8787`(zalo_relay.py)로 중계하도록 설정.
   - `ufw`를 활성화해 `22`/`80`/`443`만 외부에 열고 **8787(평문 relay
     포트)은 외부 차단** — 이전엔 `ufw`가 아예 비활성 상태라 8787이
     전세계에 그대로 열려 있었음(추가로 발견한 문제, 같이 고침).
   - Vercel Production의 `ZALO_RELAY_URL`을
     `https://103-221-223-71.sslip.io/zalo/me`로 갱신 후 재배포.
   - 자세한 절차는 `crawler/README.md`의 "Zalo relay TLS(Caddy)" 절,
     재설치 스크립트는 `crawler/install_zalo_relay.sh`(더 이상 8787을
     외부에 열지 않도록 같이 고침).
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
  - HTTPS 전환 전: 가짜 요청 → 503 "relay not HTTPS"(Zalo API를 부르기도
    전에 막힘) — `ZALO_RELAY_URL`이 그때 HTTP였다는 것을 값을 보지 않고
    동작만으로 확정.
  - HTTPS 전환 + 재배포 후: 같은 가짜 요청 → 503이 사라지고 Zalo 서버가
    직접 준 `Invalid appId`(-14002) 응답으로 바뀜 — 가드가 정상적으로
    풀렸고 새 코드가 실제로 Zalo API까지 도달한다는 것 확인.
  - `curl https://103-221-223-71.sslip.io/health` → 실제 신뢰되는 인증서로
    200 확인(`curl -k` 없이, 즉 진짜 공인 CA 체인). `/zalo/me`에 키 없이
    POST → 401 "unauthorized"(relay 자체 인증 로직이 HTTPS 뒤에서도 정상
    동작).
  - `curl http://103.221.223.71:8787/health`(외부에서 직접) → 타임아웃 —
    평문 포트가 이제 외부에서 완전히 막혔다는 것 확인.
  - 실제 사이트에서 "Đăng nhập bằng Zalo" 버튼 클릭 → 실제
    `id.zalo.me`의 진짜 로그인 화면까지 정상 도달(redirect_uri/App ID
    불일치 에러 없음) — 여기서 중단, 실제 계정으로 로그인 시도는 안 함
    (에이전트가 Zalo 계정을 가질 수 없음).
  - **사용자가 직접 확인(2026-09-26)**: 실제 Zalo 계정으로 로그인 →
    최초 시도는 위 "마지막 단계" 계정 충돌로 거부됐으나, 백필 후 **같은
    계정으로 재로그인 성공**까지 확인됨. 신규가입(한 번도 로그인한 적
    없는 새 Zalo 계정)과 서로 다른 두 Zalo 계정 간 비충돌은 코드 레벨
    회귀 테스트(`api/_zalo-token.test.ts`)로만 검증됨 — 별도로 사람이
    실사용으로 다시 확인하진 않았지만, 오늘 실제로 겪은 케이스(기존
    계정 인식 + 소유권 검증 + 정상 로그인)가 가장 핵심적인 경로라
    이걸로 충분하다고 판단.

## 발견된 문제

1. VPS(`103.221.223.71`)에 이 프로젝트용 도메인이 없고, DNS(Matbao)
   관리 권한도 이 세션엔 없었음 — sslip.io로 우회해서 해결(위 "변경
   내용 2" 참고), 앞으로 이 VPS의 IP가 바뀌면 sslip.io 도메인과
   `ZALO_RELAY_URL`을 새 IP 기준으로 다시 맞춰야 함.
2. VPS의 `ufw`가 이번 작업 전까지 **아예 비활성 상태**였음 — 8787뿐
   아니라 이론상 이 VPS의 다른 어떤 포트도 방화벽 보호가 없었다는 뜻.
   이번에 SSH/80/443만 열도록 활성화했지만, 이 VPS에서 크롤러 등
   다른 용도로 추가로 열어야 하는 포트가 있었는지는 확인 안 함 —
   크롤러(`run_daily.sh`)는 아웃바운드만 쓰는 걸로 보여 문제없을
   가능성이 높지만 다음에 크롤링이 갑자기 안 되면 이 방화벽 활성화가
   원인일 수 있다는 것 기억해둘 것.
3. Zalo 개발자 콘솔 설정(App ID/Secret, 콜백 URL) 자체는 오늘 다른
   세션이 등록 완료 주장 + 실제 로그인 화면 도달로 간접 확인됨(콘솔
   내부는 직접 못 봄) — 콜백 URL이 `www.viecganban.vn`과
   `viecganban.vn` 중 어느 쪽으로 등록됐는지는 불명확(아래 테스트
   순서에서 `www` 버전을 우선 권장하는 이유).

## 다음 결정사항 (사용자 확인 필요)

1. Zalo 로그인 작업 자체는 완료 — 추가 지시 없으면 다음 세션은 이걸
   다시 열지 않아도 됨.
2. (계속 보류 중, 이 작업과 무관) "조건 저장·알림" 기능 — 건드리지 않음,
   설계만 있고 코드/DB 미착수 상태 그대로.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-26 — Zalo 로그인 계정탈취 긴급수정 + VPS relay HTTPS 전환 + 실사용자 재로그인 E2E까지 완료** — MASTER PUSHED(`c5d7e8f`~`31b76fa`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자가 실제 Zalo 계정으로 재로그인 성공 확인). 도중 발견된 계정 충돌 1건은 DB 직접 조회로 원인 확인 후 사용자 승인 받고 `app_metadata.zalo_id` 1회성 백필로 안전하게 해결.
2. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
3. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
4. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
5. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** — MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서 실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
