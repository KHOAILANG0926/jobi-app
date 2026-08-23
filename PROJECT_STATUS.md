# Việc gần Bạn — 프로젝트 상태

> 이 파일은 프로젝트의 유일한 기준 문서입니다.
> **새 세션을 시작할 때는 이 파일부터 읽고 시작하세요.**
> **작업이 끝날 때는 이 파일을 최신 상태로 업데이트하고 commit/push 하세요.**

마지막 업데이트: 2026-08-23

---

## 1. 배포/브랜치 상태

- GitHub 기본 브랜치이자 실제 배포 기준: `master` (Vercel 자동배포)
- 그동안의 모든 작업 브랜치(`production`, `codex/*`, `cursor/*` 등)는 전부 `master`에 이미 병합 완료
- **새 세션은 작업 전에 반드시 `git checkout master && git pull`부터 할 것** — 로컬이 오래된 브랜치에 머물러 있으면 최신 코드보다 수십 커밋 뒤처질 수 있음 (8/23에 실제로 42커밋 뒤처졌던 사례 있음, fast-forward로 안전하게 해결됨)
- 로컬 master 동기화 기준: `origin/master` 커밋 `07aa0a3`

---

## 2. 완성되어 동작 중인 것

- 공고 검색/필터/상세조회/찜, CV 작성, 구직자·기업 회원가입/로그인 (Supabase Auth)
- `local_jobs` (국내 공고) — 4개 소스 모두 동작: VPS 크롤러(vieclam24h.vn, 매일 자동), Facebook 그룹 크롤러, 관리자 수동 등록, 기업 셀프 등록
- 기업 공고 등록(`/dang-tin`) — employer_id 정상 반영, 대시보드 "내 공고" 목록 동작
- `applications` / `message_threads` / `messages` / `interviews` — DB 테이블 전부 생성 완료. 지원→상태변경→취소, 메시지, 면접 일정 기능 코드 완성. (anon 키로 확인 시 `permission denied (42501)` 응답 — 이건 정상 신호: 테이블 존재 + RLS가 정상적으로 막고 있다는 뜻)
- 관리자(`/admin`) — `app_metadata.role==='admin'` 기반 인증, 공고/유저/신고/감사로그 관리 UI 완성
- P0 보안 기반 (계정 역할/RLS, 유저 프로필·CV의 Supabase 이전) — migration 0005~0008로 반영
- Facebook 크롤러 품질 개선 (스팸/모호 게시물 필터링, 급여·회사명 파싱 보정), 회귀 테스트 포함

### DB Migration 상태

| 파일 | 용도 | 상태 |
|---|---|---|
| 0001_applications.sql | 지원 기능 | 실행됨 (테이블 존재 확인) |
| 0002_messages.sql | 메시지 | 실행됨 |
| 0003_interviews.sql | 면접 일정 | 실행됨 |
| 0004_local_jobs_employer_id.sql | 기업 공고 소유권 | 실행됨 |
| 0005_account_roles_local_jobs_rls.sql | 계정 역할/RLS | 코드상 반영, Supabase 대시보드 최종 확인 권장 |
| 0006_user_profiles.sql | 유저 프로필 이전 | 상동 |
| 0007_user_cvs.sql | CV 이전 | 상동 |
| 0008_cv_photos_storage.sql | CV 사진 storage | 상동 |
| 0009_admin_operations.sql | 관리자 기능 | 상동 |

0005~0009는 저장소 내 검증 스크립트(`scripts/test-p0-migrations.mjs`, `scripts/e2e-admin-operations.mjs`)로 확인 가능 — 다음 세션은 새로 만들지 말고 이걸 먼저 실행할 것.

### 빌드/테스트
- `npx tsc --noEmit`: 통과
- `npm run build`: tsc까지만 확인됨, vite build는 42커밋 동기화 이후 재검증 필요

---

## 3. 크롤러 (AZDIGI VPS)

- 서버: `crawler.viecganban.vn` / `103.221.223.71` / root
- `crawl_topcv.py`: crontab 매일 20:30 (베트남 시간) 자동 실행, 정상 동작
- `crawl_facebook.py`: crontab 미등록, 수동 실행만. **쿠키 만료 반복 중** (구조적 문제 — 아래 4번 참고)
- `run_daily.sh`: topcv + (쿠키 있으면) facebook 순서 실행하는 통합 스크립트, master에 포함됨

---

## 4. Facebook 크롤러 — 알려진 문제 및 대응 방향

**문제**: 개인 계정 쿠키 기반 자동 로그인 방식은 Facebook이 봇으로 감지해 몇 시간 내 세션을 차단함. 코드 자체는 정상 — 쿠키가 유효할 때는 수집→저장→노출까지 확인됨.

**결정된 대응 방향: 반자동 운영으로 전환**
- 완전 무인 자동화는 포기
- 크롤러 전용 Facebook 신규 계정 생성함 (기존 개인 계정과 완전 분리)
- "로그인 → 쿠키 갱신 → 실행"을 주기적으로 사람이 트리거
- VPS SOCKS proxy로 VPS IP에서 로그인 → 쿠키 발급 (로그인 IP와 크롤러 실행 IP 일치시키기 위함)

### 신규 Facebook 계정 신뢰도 로드맵 (진행 중, 8/23 시작)

새 계정은 친구 0명 상태로 시작 — 봇으로 의심받기 가장 쉬운 상태이므로 아래 순서로 천천히 진행:

| 주차 | 기간 | 할 일 |
|---|---|---|
| 1주 | 8/24~8/30 | 개인 계정에서 친구 요청, 지인 몇 명 추가, 프로필 채우기, 매일 5~10분 정상 활동 |
| 2주 | 8/31~9/6 | 친구 20명 이상 확보, 일반 게시물 몇 개, 페이지 팔로우 (그룹 가입 아직 X) |
| 3주 | 9/7~9/13 | 구인구직 그룹 하루 1~2개씩 가입 신청 시작 |
| 4주 | 9/14~9/20 | 나머지 그룹 가입 마무리, VPS 프록시로 첫 크롤링 테스트 (소규모) |
| 5주 | 9/21~9/27 | 며칠 연속 크롤링해서 세션 유지 시간 확인, 반자동 루틴 정착 |
| 6주 | 9/28~10/4 | 지역별/카테고리별 데이터 볼륨 점검, 부족하면 Vieclam24h로 임시 보완 |

**10월 앱 출시 시점에는 이 파이프라인이 안정 궤도여야 함.**

---

## 5. 다음 할 일 (우선순위순)

1. `npm run build` 전체 재검증 (42커밋 fast-forward 이후 vite build까지 확인 필요)
2. `scripts/test-p0-migrations.mjs`, `scripts/e2e-admin-operations.mjs` 실행해서 migration 0005~0009 실제 적용 여부 확인
3. Facebook 신규 계정 로드맵 진행 (위 주차별 계획)
4. Facebook 쿠키 재발급 시 VPS `crawler/.env`의 `FB_C_USER`/`FB_XS`/`FB_DATR`/`FB_FR` 갱신 (값은 절대 커밋/출력 금지)
5. 기존 저품질 Facebook row 정리 여부 결정 (최근 품질 개선은 신규 수집분에만 적용, 기존 저장분은 자동 정리 안 됨)
6. Job quality audit 스크립트 만들기 (운영 상태 한 번에 확인용, 아직 미생성)
7. `cursor/*` 임시 브랜치 정리 (선택, 급하지 않음 — 이미 전부 master 병합됨)

---

## 6. 보안 / 운영 주의사항

- **과거 사고 이력**: 이 저장소는 `service_role` 키가 하드코딩되어 유출됐던 사고가 있었음. 이후 전량 교체 + `app_metadata` 기반 관리자 인증으로 전환 완료. **→ 다음 세션에서 "키가 실제로 완전히 rotate됐는지, git history에 옛날 키가 남아있는지" 명시적으로 재확인 필요.**
- Secret 관리: `crawler/.env`(VPS, gitignore 처리됨)에 `SUPABASE_SERVICE_ROLE_KEY`, `FB_C_USER`, `FB_XS`, `FB_DATR`, `FB_FR` 보관. 절대 코드/커밋/로그에 값으로 남기지 말 것.
- GitHub Actions 자동화(`.github/workflows/claude-auto.yml` 등) — `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` secret 미등록으로 아직 실행된 적 없음. 사용할 계획 없으면 방치해도 무방.
- VPS SSH 공개키 등록 — Cursor Cloud Agent가 등록 요청은 받았으나 보안상 직접 수행하지 않음. **실제 등록 여부 별도 확인 필요.**
- VPS와 로컬 저장소는 별개. VPS `/root/jobi`는 크롤러 실행 전용 클론이며 `git pull`로만 코드 반영 (직접 편집 지양). `.env`는 VPS에만 존재.

---

## 7. 앱 출시 타임라인 (비즈니스 계획, 코드 작업과 별개 트랙)

| 시기 | 내용 |
|---|---|
| 2026년 10월 | 안드로이드 앱 출시 |
| 2026년 11월 | iOS 앱스토어 신청 (심사 ~3개월 소요 예상) |
| 2027년 2월 | 본격 광고 시작 (월 50~100만 원) |

### 출시 전 남은 것
- [ ] 로고 적용 (앱 이름 "Việc gần Bạn" 확정, 변경 없음 — 파트너 제작 베트남 지도 로고 대기 중)
- [ ] iOS 개발자 계정 신청 (9월 중 시작 필요, 법인/개인 명의 결정 필요)
- [ ] 상표 등록 진행 중 (트란 티 하 명의)
- [ ] 개인정보처리방침 / 이용약관 작성 (베트남 Nghị định 13/2023 기준 확인 필요)
- [ ] 결제/수익화 모델 결정 여부 (미정)
- [ ] 출시 시점 공고 데이터 볼륨 점검 (Facebook 로드맵 6주차까지 안정화 안 되면 Vieclam24h 비중 임시 확대)

---

## 8. 작업 원칙

1. 확인 가능한 건 AI가 직접 확인 (GitHub, CI, 배포 상태, 코드, 빌드, 테스트, 공개 URL 등). 사용자에게는 권한/계정/비밀키/수동 클릭처럼 정말 필요한 것만 요청.
2. 작업 승인 후에는 중간에 계속 묻지 않고 진행. 막히는 경우에만 이유와 필요한 사용자 액션 요청.
3. 작업 시작 시 순서를 먼저 정리하고, 각 단계가 끝날 때마다 완료된 순서를 보고.
4. GitHub을 유일한 동기화 기준으로 사용. 작업 종료마다 commit → push → local/remote 동일 확인.
5. 미완성이라도 중요한 작업이면 WIP commit + push해서 한 PC에만 작업을 남기지 않기.
6. 워크플로우: `IMPLEMENTED → VERIFIED → SYNCED → APPROVED → DEPLOYED`
7. **새 세션은 이 파일부터 읽고 시작. 작업 종료 시 이 파일 업데이트 후 commit.**
8. 여러 에이전트(Claude Code / Codex / Cursor)가 같은 저장소를 건드리는 중이므로, 새 세션 시작 시 반드시 `git checkout master && git pull`부터 할 것.

---

## 9. 참고 정보

- GitHub: `KHOAILANG0926/jobi-app`
- 배포: Vercel, 운영 도메인 `https://viecganban.vn`
- VPS: AZDIGI, `103.221.223.71`, SSH key `C:\Users\Admin\.ssh\jobi_vps`
- 관련 문서: `CHATGPT_HANDOFF.md`(최신 세션 1개 스냅샷, 누적 안 함), `VIECGANBAN_STRUCTURE_BASELINE.md`(전체 구조), `CLAUDE.md`/`AGENTS.md`(자동화 세션 규칙)
