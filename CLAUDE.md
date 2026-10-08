# Viecganban 자동 작업 규칙

이 파일은 GitHub Actions 등 자동화 환경에서 실행되는 Claude Code를 포함해,
이 저장소에서 작업하는 모든 Claude Code 세션이 지켜야 할 최소 규칙이다.

AI_DISCOVERY_STRATEGY.md는 참고용 배경 문서다. 이 문서를 근거로 임의 구현하지 말고, 사용자가 결정해 지시한 작업만 한다.

## 우선 원칙

1. **기존 설계 우선**: 코드를 수정하기 전에 `VIECGANBAN_STRUCTURE_BASELINE.md`를
   먼저 읽고, 거기 기록된 기존 구조/설계 의도를 최대한 유지한다. 이미 있는 구조를
   갈아엎거나 임의로 통합/삭제하지 않는다.
2. **작업 범위 준수**: 지시받은 범위 밖의 리팩터링, 기능 추가, 코드 스타일 변경을
   같이 하지 않는다. 범위를 벗어나는 게 필요해 보이면 먼저 멈추고 알린다.
3. **큰 구조 변경 전 중단**: DB 스키마 변경(DDL), 인증 방식 변경, 기존 테이블
   삭제/통합처럼 되돌리기 어렵거나 영향 범위가 넓은 변경은 실행하지 말고,
   무엇이 왜 필요한지만 정리해서 사람 판단을 기다린다.
4. **테스트 필수**: 코드를 수정했다면 `npx tsc --noEmit`과 `npm run build`가
   통과하는 것을 확인한 뒤에만 완료로 간주한다. 실패한 상태로 커밋하지 않는다.
5. **CHATGPT_HANDOFF.md 갱신 필수**: 실제 코드/설정 변경이 있었던 작업을 마칠
   때마다 `CHATGPT_HANDOFF.md`를 **1페이지 최신 스냅샷**으로 덮어쓴다(누적 금지).
   구성은 세 부분뿐: ① 현재 상태(코드·배포·DB) ② 다음 할 일 3개 ③ 필수 규칙.
   덮어쓰기 전에 지워지는 상세 기록·이전 본문은 `WORK_LOG.md`로 옮긴다(2026-10-08 사용자 지시).
6. **Secret 출력 금지**: API 키, Secret, 토큰, 비밀번호 등 민감한 값을 커밋,
   커밋 메시지, PR 설명, 로그, 응답 어디에도 실제 값으로 출력하지 않는다.
   필요하면 GitHub Secrets 등 안전한 저장소를 참조만 하고 값은 다루지 않는다.
7. **master 직접 push 금지(자동화 한정)**: 자동 실행 워크플로에서 만든 변경은
   반드시 새 브랜치로 커밋하고 PR을 생성한다. master에 직접 push하지 않는다.

## 보고 형식 — MANDATORY (2026-09-28 사용자 지시, 2026-10-06 강화)

사용량(토큰)을 아끼기 위해 모든 응답·보고는 아래를 지킨다. 매 세션 다시 약속하지 말고 그냥 지킨다.

- **모든 보고는 5줄 이내**(2026-10-06): ① 한 일 ② 바뀐 것 ③ 위험 ④ 예/아니오 질문 최대 2개.
  세부(표·건수·예시·근거)는 문서(`docs/`, `CHATGPT_HANDOFF.md`, `WORK_LOG.md`)에 쓰고 보고에는 경로만 적는다.
- 표·긴 섹션·배경 설명·"잘한 점" 나열 금지. 사용자가 "자세히"라고 할 때만 확장.
- 같은 내용 반복 금지(이미 보고한 사실, 이미 합의된 원칙 재설명 X).
- 진행 중 안내는 한 줄. 중간 보고로 흐름을 끊지 않는다.
- 이미 읽은 파일 재조회, 불필요한 탐색, 같은 명령 재시도를 최소화한다.

## ChatGPT 추적용 기록 — MANDATORY (2026-10-01 사용자 지시)

목적: 사용자가 ChatGPT를 거치지 않고 Claude Code에 직접 지시한 작업도 ChatGPT가 repo만 보고 따라오게 한다.
기존 규칙(우선 원칙 5의 HANDOFF 스냅샷, FAST/NORMAL 배포, 짧은 보고)은 그대로 유지한다.

- `CHATGPT_HANDOFF.md`: 1페이지 최신 스냅샷(현재 상태 / 다음 할 일 3개 / 필수 규칙). 누적 문서로 만들지 않는다.
  branch / HEAD / Production·DB 상태 / 구현 상태 / 미완료 / 다음 작업 중심. ChatGPT가 이 문서 하나로 현재 상태를 알 수 있어야 한다.
  사용자 직접 지시로 기존 설계 방향이 바뀌었으면 "기존 방향에서 무엇이 바뀌었는지"를 명시한다.
- `WORK_LOG.md`: 실제 변경이 있었던 작업마다 맨 위에 짧게 추가, **최근 10개만 유지**(넘으면 오래된 것 삭제, 장기 이력은 git).
  항목: `## YYYY-MM-DD HH:mm` + 요청 / 변경 / 수정 파일 / 검증 / commit / push / deploy / 남은 문제. 중요한 설계 변경만 이유 1~2줄.
- 단순 질문·탐색·설명만 했으면 두 문서 모두 갱신하지 않는다.
- 새 세션 시작: git status → branch/HEAD → `CHATGPT_HANDOFF.md` → 사용자 요청. `WORK_LOG.md`는 과거 이유·상세가 필요할 때만 읽는다.
- 배포: 사용자가 그 작업에서 "배포하지 마 / 로컬만 / 검토만 / 코드 수정하지 마 / Production 건드리지 마"라고 하면 그 지시가 FAST/NORMAL보다 우선한다.
- 채팅 완료 보고는 1~3줄. 세부는 두 문서에 기록하고 채팅에 반복하지 않는다. 민감정보는 두 문서에도 쓰지 않는다.

## 한국 일자리 모듈 분리 규칙 — MANDATORY (2026-10-01 사용자 지시)

한국 일자리 영역은 향후 별도 서비스로 분리될 수 있으므로 다음 원칙을 유지한다.
(근거 조사: 2026-10-01 — 현재 korea_* 객체는 local_jobs 계열과 FK·함수 결합 없음.)

- korea_jobs 및 한국 전용 데이터 구조는 local_jobs 계열과 분리 유지
- 한국 지원/메시지/면접 기능을 추가할 경우 기존 applications/message_threads/interviews에 섞지 않고 한국 전용 구조 사용
- 저장공고를 DB화할 경우 한국 저장공고는 별도 테이블 또는 별도 저장 구조 사용
- 기존 local_jobs FK를 풀거나 job_type 컬럼을 추가해 한국/베트남 공고를 한 테이블 흐름에 섞지 않음
- 한국 전용 DB 객체는 korea_ 접두어 사용
- 한국 SSR/sitemap/SEO 기능을 추가할 경우 한국 전용 모듈로 분리
- 베트남 전용 공용 함수(jobCoords/jobRows/jobUtils 등)는 한국 화면에 새로 직접 의존하지 않도록 주의
  (기존 의존: KoreaJobDetail → jobCoords.resolveMapLocations — 한국 상세 화면 작업 시 정리 대상)
- 장기 분리 보강(2026-10-01, 대량 데이터·별도 DB 전제):
  - 두 도메인이 한곳에 모이는 참조(통계·이벤트·API 응답·알림·외부 연동)에는 숫자 id 단독 금지 → `kr-123` 같은 도메인 접두 식별자 사용(korea_jobs.id·local_jobs.id는 각자 시퀀스라 합치면 충돌).
  - 한국 기업·구직자 역할/프로필은 `account_roles`(user_id당 역할 1개)·`user_profiles`·`user_cvs` 재사용 금지 → korea_ 전용 테이블. auth.users 공유는 허용하되 user_id 참조만.
  - 한국 대상 신고·관리자 감사로그·알림은 기존 `reports`/`admin_audit_logs`/`job_alert_*`에 넣지 않고 korea_ 전용 테이블(분리 시 WHERE 필터 없이 dump 가능해야 함).
  - 한국 파일은 korea- 접두 Storage bucket, DB에는 전체 URL이 아닌 bucket+상대 path 저장. 기존 cv-photos·job-images 재사용 금지.
  - 한국 페이지 URL은 `/viec-han-quoc/` 아래만 사용(도메인 이전 시 301 규칙 1개로 이동 가능하게).
  - 분석·이벤트 수집을 도입하면 처음부터 product(vn/korea) 구분 필수.
  - 관리자 UI는 공용 가능, 한국 데이터 조회/수정은 한국 전용 API 모듈(koreaJobsApi 등)만 경유.

## 원본 채용사이트 연결 금지 — MANDATORY (2026-09-30 사용자 지시)

크롤링·수집한 공고의 원본 채용사이트(vieclam24h, TopCV, VietnamWorks, WorkNet/고용24, 페이스북 등)로
사용자를 보내거나 노출하지 않는다. 우리 사이트가 다른 구인 사이트를 홍보하는 결과가 되기 때문이다.

- 링크·버튼·아이콘(↗ Xem tin gốc 등)·지원 버튼·SSR/JSON-LD·sitemap 어디에도 원문 URL을 쓰지 않는다.
- 브라우저로 원문 URL을 내려보내지 않는다(공개 조회 select에 `source_url` 넣지 않음). 원문 URL은
  크롤러의 중복 판정·관리자 내부 확인 용도로 DB에만 둔다.
- 연락 방법은 공고에 적힌 전화·Zalo 등 사이트 안 정보로만 안내한다.
- **정정(2026-10-07 사용자 지시)**: 이 금지는 **경쟁 채용사이트 공고 링크**에만 해당한다. Google 지도 등
  지도·길찾기 링크는 허용한다. 단 지도·길찾기 링크는 **반드시 좌표**(`destination=lat,lng` 등)로 만들고
  이름·주소 글자 검색으로 만들지 않는다(2026-09-29 'KCN VSIP, Bắc Ninh'을 Google이 논 한가운데로 안내한 오안내 재발 방지).
  - 길찾기는 3단계로만 연다(좌표 링크 `destination=lat,lng`만, 이름·주소 검색·공단 사무실 좌표 금지).
    ① 승인 좌표 있음: "Chỉ đường" ② 승인 좌표 없고 KCN 정문 좌표(출처 id 있는 OSM gate/VietMap POI, 위성 확인분)만 있음:
    "Đến cổng KCN"(공장 정문이 아님을 한 줄 안내) ③ 둘 다 없음: "Gọi hỏi đường"(공고 전화번호 `tel:` 버튼).
    공단 도형(영역) 중심·지역 중심·미확인 좌표는 목적지로 쓰지 않는다. 구현: `src/lib/directionsPlan.ts`.
- 이 규칙을 좁게 해석하지 않는다("지원 버튼만" 등 X). 예외가 필요하면 먼저 사용자에게 묻는다.
- 규칙을 저장했다고 보고할 때는 커밋 ID와 이 파일의 해당 줄을 함께 보여준다
  (2026-09-29 '저장했다'는 보고와 달리 이 파일에 없던 사고 이후).

## 공고 수집 소스 규칙 — MANDATORY (2026-10-07 사용자 지시)

1. **공개 기준**: 사이트 안 연락처(전화·Zalo·이메일)가 없는 크롤링 공고는 비공개
   (근거: `docs/ops/2026-09-29_hide_crawled_no_contact.md`). 수집 목표 건수는 항상
   **"연락처 있는 공고" 기준**으로 센다(연락처 없는 공고는 건수에 넣지 않는다).
2. **소스 순서(사용자 확정)**: Muaban → Chợ Tốt → Facebook → Vieclam24h → TopCV →
   CareerViet → VietnamWorks → 기업 공식채널.
3. **실측 기록**: Vieclam24h·VietnamWorks는 전화번호가 숨겨져 연락처가 약하다.
   TopCV·CareerViet은 플랫폼 지원형 위주. Chợ Tốt은 로그인 후 박닌 5/5건 연락처 확인,
   Muaban은 로그인 후 연락처 확인, Facebook은 연락처 있는 글 확보 가능성이 높다.
4. **연락처 약한 소스는 보조용**: 연락처 소스로 목표를 못 채웠을 때만 쓰고,
   쓰기 전에 사용자에게 확인한다.

## 영구 운영 원칙 — MANDATORY (2026-10-08 사용자 지시, 매번 말하지 않아도 자동 적용)

Claude Code·Cursor·Codex 모두 적용한다(`.cursor/rules/project-rules.mdc`에도 같은 내용).

### 1. 저장 원칙
- PC(회사 PC는 사용자 소유가 아님)에 키·데이터·결과 파일을 저장하지 않는다. PC `.env` 저장을 안내하지 않는다.
- 서비스 키는 Vercel 환경변수에만 둔다(GitHub Actions용은 GitHub Secrets에만).
- 수집·검토 데이터와 백업은 Supabase 비공개 테이블(RLS로 공개 접근 차단) 또는 비공개 Storage 버킷에 둔다.
  CSV·바탕화면·`backups`·`scripts/research/out` 폴더로 내보내지 않는다.
- DDL은 dry-run으로 보여주고 사용자 승인 후에만 적용한다(승인 전 SQL은 `supabase/pending/`).
- 현장 방문(직접 돌아다니며 확인)을 해결책으로 제안하지 않는다. 1인 운영이다.

### 3. 위치·길찾기 기준
- 회사명 정확 일치 + 주소(구·KCN) 안이면 자동 승인 핀. 아니면 핀 없음. 관리자 Vị trí 입력은 예외용이다.
- 길찾기는 3단계: 승인 좌표 "Chỉ đường" / KCN 정문 좌표 "Đến cổng KCN" / 둘 다 없으면 "Gọi hỏi đường"(전화 버튼).
- 지도·길찾기 링크는 좌표(`destination=lat,lng`)만. 이름·주소 검색 링크 금지.

### 5. 가짜 공고·화면 영향 확인
- 예시·가짜 공고(DEMO·샘플·placeholder 공고)를 공개 화면에 표시하지 않는다. 공개 0건이면 빈 상태 안내를 보여준다.
- DB 변경(공개/비공개 전환, 삭제, 정리 포함)을 할 때는 화면에 미치는 영향(0건·빈 목록 등)까지 확인한다.

## 필수 작업 상태 규칙

모든 UI/기능 작업은 아래 상태를 명시적으로 구분한다.

1. **IMPLEMENTED**: 코드 구현 완료
2. **VERIFIED**: 테스트, build, 실제 로컬 화면 검증 완료
3. **APPROVED**: 사용자가 결과를 확인하고 승인 완료
4. **DEPLOYED**: commit/push, Production 배포, 실제 운영 URL 반영 확인 완료

- 이미 `IMPLEMENTED` 또는 `VERIFIED`인 동일 작업을 이유 없이 다시 구현하지 않는다.
- 사용자가 승인한 구현은 다시 만들거나 재설계하지 않고 다음 상태로 진행한다.
- 사용자가 “적용해”, “반영해”, “실제 사이트에 넣어”라고 하면 현재 `VERIFIED`
  결과에 대한 배포 요청으로 처리한다.
- commit/push가 안 된 상태와 구현이 안 된 상태를 혼동하지 않는다.
- 운영 사이트에 결과가 안 보이면 재구현보다 commit/push/배포 상태를 먼저 확인한다.
- 기존 완료 상태를 확인하기 전에 동일 작업을 처음부터 다시 시작하지 않는다.
- 새 세션은 `AGENTS.md`, `CLAUDE.md`, `CHATGPT_HANDOFF.md`를 먼저 읽고 상태를 복원한다.
- 화면 캡처가 제공되면 추측보다 실제 화면을 우선하며, 확인되지 않은 상태를 완료로 보고하지 않는다.
- 반복 작업으로 사용자 시간과 토큰을 낭비하지 않는다.

## MANDATORY WORK MODE — 작업 등급별 배포 규칙

모든 작업을 시작하기 전에 아래 세 등급 중 하나로 분류하고, 그 등급의 흐름을 따른다.
(2026-08-27 사용자 지시로 영구 반영)

### FAST 작업

사용자가 현재 대화에서 수정 내용을 명확히 승인/지시한 단순 UI/CSS/텍스트/배치 작업.

흐름: 구현 → 최소 검증(`tsc`/`build` 등) → commit → master 반영 → master push →
Vercel Production 배포 → 실제 사이트 대표 화면 1회 확인 → 완료.

- 중간에 "승인 대기", "Production 배포해도 될까요?"를 다시 묻지 않는다.
- 사용자의 구체적인 구현 지시 자체를 해당 FAST 작업의 승인으로 본다.

### NORMAL 작업

일반적인 기능 수정. 사용자가 "수정해", "적용해", "바로 해"처럼 명확하게 지시한 경우에는
구현/검증 후 별도의 중복 승인을 요구하지 않고 master/Production까지 진행한다.

- 단, 예상하지 못한 범위 확대나 중요한 제품 결정이 새로 필요해지면 멈추고 질문한다.

### STRICT 작업

다음은 기존처럼 별도 승인/안전 절차를 유지한다 — FAST/NORMAL 흐름을 적용하지 않는다:

- Production DB migration
- 데이터 삭제/대량 수정
- Auth/RLS/권한
- 보안/secret
- 결제
- 사용자 데이터에 영향을 주는 작업
- destructive operation
- 되돌리기 어려운 변경
- 예상하지 못한 대규모 구조 변경

### 공통 원칙

- Git branch push와 Production 배포 상태는 항상 구분해서 보고한다.
- 하지만 안전을 이유로 모든 사소한 UI 작업을 branch에서 멈추는 방식은 쓰지 않는다 —
  FAST/NORMAL 작업은 위 흐름대로 Production까지 끝맺는다.

## TWO-PC WORKFLOW — MANDATORY

사용자는 이 프로젝트를 두 PC에서 번갈아 작업한다.
(2026-08-28 사용자 지시로 영구 반영. 특정 작업이 아니라 Viecganban 프로젝트의
모든 향후 작업에 적용되며, 위 MANDATORY WORK MODE와 충돌하지 않고 함께 적용된다 —
WORK MODE는 "언제 다음 단계로 진행하는가"를, 이 섹션은 "다음 단계가 두 PC 모두에서
동일하게 이어지려면 무엇이 GitHub/Production에 실제로 반영돼 있어야 하는가"를 규정한다.)

- 회사 PC
- 집 PC

따라서 한 PC에만 존재하는 변경은 절대 "완료"로 간주하지 않는다.

### 영구 변경 원칙

1. 모든 코드 변경
   → GitHub master까지 push

2. 모든 Production DB 변경
   → shared Supabase Production에 migration으로 적용
   → migration 파일도 GitHub master에 반드시 포함

3. 서비스 변경
   → Vercel Production 배포 및 실제 반영 확인

4. 작업 시작 전
   → git status 확인
   → git fetch origin
   → local과 origin/master 상태 비교

5. local이 clean하고 fast-forward 가능한 경우
   → origin/master 기준으로 안전하게 동기화

6. uncommitted/local-only 작업이 있으면
   → 절대 reset/overwrite하지 말고 먼저 보호

7. 회사 PC에서 작업했더라도
   집 PC가 이후 origin/master를 pull하면
   동일한 코드/migration 상태를 이어받을 수 있어야 한다.

8. 집 PC에서 작업한 경우도 동일하다.

9. PC-local 항목:
   - access token
   - local .env
   - CLI login/session
   - machine-specific path

   은 GitHub에 올리지 않는다.

10. PC-local credential이 필요한 작업과
    프로젝트의 영구 상태를 명확히 구분한다.

11. 한 PC에서만 작동하는 설정/변경이라면
    Production 작업 완료로 보고하지 않는다.

12. 작업 완료 기준:

    IMPLEMENTED
    → VERIFIED
    → MASTER PUSHED
    → PRODUCTION DEPLOYED
    → PRODUCTION VERIFIED

    를 구분해서 보고한다.

13. 회사/집 PC 간 전달해야 할 현재 작업 상태가 있으면
    CHATGPT_HANDOFF.md를 최신 snapshot으로 갱신하고
    GitHub master에 포함한다.

중요:
이 규칙은 특정 작업에만 적용되는 것이 아니라
Viecganban 프로젝트의 모든 향후 작업에 적용한다.

## 작업 브랜치·Preview·Git 종료 게이트 — MANDATORY (2026-10-05 사용자 지시)

재발 방지 근거: VietMap 최종 Preview(`dpl_5vVjSum6NNQYVyFBf9vif4p8kgYE`)가 미커밋 CLI 배포 소스에서
만들어졌다. 검증은 끝났지만 GitHub/master에 최종 소스가 남지 않아 Vercel deployment source를
다시 회수해야 했다. 그래서 Preview 승인 이후 Git 보존을 강제하는 종료 게이트를 둔다.

1. 모든 작업은 시작 전에 기준 branch/worktree를 명확히 고정한다.
2. 다른 오래된 branch나 임시 worktree를 기준으로 새 기능을 이어서 개발하지 않는다.
3. 표준 순서는 반드시:
   기준 branch 고정 → 수정 → tsc/build/tests → Preview 배포 → 사용자 검증/승인
   → commit → push → git status clean 확인 → HANDOFF/WORK_LOG 기록 → 다음 작업
4. 사용자에게 승인된 Preview가 있는데 그 소스가 아직 commit/push되지 않았다면
   다음 기능 작업을 시작하지 않는다.
5. 미커밋 상태로 CLI/API Preview를 배포할 수는 있지만, 그 Preview가 승인되면
   동일 소스를 즉시 Git branch에 보존한다.
6. Preview만 존재하고 GitHub/정식 working tree에 소스가 없는 상태를 만들지 않는다.
7. 여러 branch/worktree가 존재하면 작업 시작 전에 어느 것이 canonical source인지 확인한다.
8. 기존 미커밋 변경이 있는 다른 worktree를 임의로 merge/reset/rebase/checkout 하지 않는다.
9. Production 배포 전에는 반드시 다음을 거친다:
   - 승인된 Preview와 Git 소스 일치
   - commit/push 완료
   - git status 확인
10. 실험 provider/임시 코드/acceptance fixture는 정식 기준 branch에 합칠 때
    포함/제외를 명시적으로 판단한다.
