# Viecganban 프로젝트 현재 상태

작성: 2026-08-23 · 이 문서는 여러 코딩 에이전트(Claude Code / ChatGPT·Codex / Cursor Cloud Agent)가
같은 저장소를 동시에 건드리는 상황에서 "지금 실제로 뭐가 어디까지 됐는지" 한 곳에서 파악하기
위한 스냅샷입니다. 세부 작업 로그는 `CHATGPT_HANDOFF.md`(최신 세션 1개만 기록, 누적 안 함),
전체 구조 설명은 `VIECGANBAN_STRUCTURE_BASELINE.md`, 자동화 세션 규칙은 `CLAUDE.md`/`AGENTS.md`
참고.

---

## 1. 지금까지 상태

### 배포/브랜치
- GitHub 기본 브랜치이자 실제 배포 기준: **`master`** (Vercel 자동배포, `origin` 기본 HEAD).
- `production`, `codex/home-hero-composition`, `codex/p0-foundation-security`,
  `codex/admin-operations`, `cursor/*` (facebook/crawler 관련 11개) 브랜치 전부 **`master`에
  이미 병합 완료** — 별도로 다시 병합할 필요 없음. 로컬 워킹 디렉터리가 예전 브랜치(예:
  `codex/admin-operations`)에 오래 머물러 있으면 `master`보다 수십 커밋 뒤처질 수 있으니,
  새 세션은 작업 전에 `git checkout master && git pull`부터 할 것.
- 로컬 `master`는 이번 세션에서 `origin/master`(커밋 `07aa0a3`)까지 fast-forward 동기화 완료.

### 완성되어 동작 중인 것
- 공고 검색/필터/상세조회/찜, CV 작성, 구직자·기업 회원가입/로그인(Supabase Auth).
- `local_jobs`(국내 공고) — VPS 크롤러(vieclam24h.vn, 매일 자동), Facebook 그룹 크롤러,
  관리자 수동 등록, 기업 셀프 등록 4개 소스 모두 동작.
- 기업 공고 등록(`/dang-tin`) — `employer_id` 정상 반영, 대시보드 "내 공고" 목록 동작.
- `applications`/`message_threads`/`messages`/`interviews` — **DB 테이블 전부 생성 완료**
  (이전엔 미생성이었으나 이후 세션에서 적용됨). 지원→상태변경→취소, 메시지, 면접 일정
  기능 코드 완성. anon 키로 라이브 확인 결과 `permission denied for table ...`
  (`42501`) 응답 — 테이블은 존재하고 RLS/권한이 정상적으로 막고 있다는 뜻(정상 동작 신호).
- 관리자(`/admin`) — `app_metadata.role==='admin'` 기반 인증, 공고/유저/신고/감사로그 관리
  UI(`AdminJobs`/`AdminUsers`/`AdminReports`/`AdminAuditLogs`) 추가됨(`0009_admin_operations.sql`).
- P0 보안 기반(계정 역할/RLS, 유저 프로필·CV의 Supabase 이전) — `0005~0008` migration으로 반영.
- Facebook 크롤러 품질 개선(스팸/모호 게시물 필터링, 급여·회사명 파싱 보정) 다수 반영,
  회귀 테스트(`crawler/test_facebook_quality.py`, `crawler/test_job_quality.py`) 포함.

### DB migration 파일 vs 실행 상태 (`supabase/migrations/`)
| 파일 | 용도 | 상태 |
|---|---|---|
| `0001_applications.sql` | 지원 기능 | **실행됨**(테이블 존재 확인) |
| `0002_messages.sql` | 메시지 | **실행됨** |
| `0003_interviews.sql` | 면접 일정 | **실행됨** |
| `0004_local_jobs_employer_id.sql` | 기업 공고 소유권 | **실행됨** |
| `0005_account_roles_local_jobs_rls.sql` | 계정 역할/RLS | 코드상 반영, 실행 여부는 Supabase 대시보드에서 최종 확인 권장 |
| `0006_user_profiles.sql` | 유저 프로필 Supabase 이전 | 상동 |
| `0007_user_cvs.sql` | CV Supabase 이전 | 상동 |
| `0008_cv_photos_storage.sql` | CV 사진 storage | 상동 |
| `0009_admin_operations.sql` | 관리자 기능 | 상동 |

(0005~0009는 이번 세션에서 anon 키로 직접 재확인하지 않음 — `scripts/test-p0-migrations.mjs`,
`scripts/e2e-admin-operations.mjs` 같은 검증 스크립트가 이미 저장소에 있으므로 다음 세션은
새로 만들지 말고 이걸 먼저 실행해 확인할 것.)

### 크롤러(AZDIGI VPS: `crawler.viecganban.vn`, `103.221.223.71`, root)
- `crawl_topcv.py`: crontab 매일 20:30(베트남 시간) 자동 실행, 정상 동작 중.
- `crawl_facebook.py`: crontab 미등록(수동 실행만). **Facebook 쿠키가 이전 확인 시점 기준
  만료된 상태로 보였음**(로그인 페이지로 리다이렉트) — 재수집 전에 쿠키 재발급 필요할 수 있음.
- `crawler/run_daily.sh` — topcv + (쿠키 있으면) facebook을 순서대로 실행하는 통합 스크립트,
  master에 이미 포함됨.

### 빌드/테스트
- `npx tsc --noEmit`: **통과** (예전에 있던 `CATEGORY_LABELS.office` 누락 에러는 다른 세션에서
  이미 수정됨 — `0a263fa fix: add office category to admin dashboard`).
- `npm run build`(`tsc -b && vite build`): 이번 세션에서 tsc까지만 재확인, vite build는 최신
  동기화 이후 재검증 필요(아래 다음 할 일 참고).

---

## 2. 다음 할 일 (우선순위순)

1. **`npm run build` 전체 재검증** — `master`를 방금 42커밋 fast-forward했으므로, vite 빌드까지
   끝까지 통과하는지 새로 확인 필요(이번 세션은 시간 관계상 `tsc --noEmit`까지만 확인함).
2. **`scripts/test-p0-migrations.mjs`, `scripts/e2e-admin-operations.mjs` 실행** — `0005~0009`
   migration이 실제로 의도대로 적용됐는지 기존에 만들어진 검증 스크립트로 확인.
3. **Facebook 크롤러 쿠키 재발급** — VPS `crawler/.env`의 `FB_C_USER`/`FB_XS`/`FB_DATR`/`FB_FR`
   갱신 필요(사람이 직접 로그인 후 쿠키 추출 — 값은 절대 커밋/출력 금지).
4. **기존 저품질 Facebook row 정리 여부 결정** — 최근 크롤러 품질 개선은 앞으로 수집되는 데이터에만
   적용되고, 이미 저장된 저품질 row는 자동 정리되지 않음(`CHATGPT_HANDOFF.md` 이전 기록 참고).
5. **cursor/* 임시 브랜치 정리(선택)** — 11개 `cursor/*` 브랜치 전부 이미 `master`에 병합
   완료라 로컬/원격에서 삭제해도 안전. 급하지 않음.

---

## 3. 알아둘 정보

- **멀티 에이전트 작업 중**: 이 저장소는 Claude Code, ChatGPT/Codex, Cursor Cloud Agent가 각자
  브랜치를 만들어 작업 → PR → `master` 병합하는 방식으로 동시에 개발되고 있음. 새 세션 시작 시
  항상 `git checkout master && git pull`로 최신화부터 할 것 — 오래된 로컬 브랜치에서 작업을
  이어가면 이미 처리된 문제를 다시 만들거나 최신 코드를 놓칠 수 있음.
- **`CHATGPT_HANDOFF.md`는 최신 세션 1개 스냅샷만 유지**하는 규칙이라, 과거 작업 이력을 보려면
  `git log`를 봐야 함(이 문서 자체는 누적 로그가 아님).
- **Secret 관리**: `crawler/.env`(VPS, gitignore 처리됨)에 `SUPABASE_SERVICE_ROLE_KEY`,
  `FB_C_USER`, `FB_XS`, `FB_DATR`, `FB_FR` 보관. 절대 코드/커밋/로그에 값으로 남기지 말 것 —
  이 저장소는 과거 service_role 키가 하드코딩되어 유출됐던 사고 이력이 있음(이후 전량 교체·
  `app_metadata` 기반 관리자 인증으로 전환 완료).
- **GitHub Actions 자동화**: `.github/workflows/claude-auto.yml`(Claude, workflow_dispatch,
  PR 생성 방식), `admin-operations.yml`, `p0-foundation.yml` 존재. `ANTHROPIC_API_KEY`/
  `CLAUDE_CODE_OAUTH_TOKEN` secret 미등록 상태라 `claude-auto.yml`은 아직 실행된 적 없음.
- **Cursor Cloud Agent**: VPS(`103.221.223.71`) root에 SSH 공개키 등록을 요청받았으나, 시스템/
  보안 설정 변경에 해당해 에이전트가 직접 수행하지 않고 사용자에게 안내만 함(등록 여부 별도 확인 필요).
- **VPS와 로컬 저장소는 별개** — VPS `/root/jobi`는 크롤러 실행 전용 클론이며, 코드 반영은
  `git pull`로만 가져감(직접 편집 지양). `.env`는 VPS에만 존재, 저장소엔 `.env.example`만 커밋.
