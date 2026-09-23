# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Viecganban 데이터/크롤러 개선 1차 작업 — 회사 PC에서 여기까지 완료, 집 PC로 인계.**
"생활조건 기반 일자리 매칭"을 위한 구조화 데이터 기반 마련(급여/근무시간
구조화, 지역 정규화, Bắc Giang 수집 경로 추가)까지 완료. 대량 크롤링은
아직 실행 안 됨 — 실행하려면 아래 "다음 결정사항" 확인 필요.

- **IMPLEMENTED + VERIFIED + MASTER PUSHED.** commit `4851389`까지 push
  확인됨. PRODUCTION DB(Supabase)에도 마이그레이션 전부 적용 완료.
  프론트엔드 코드 변경은 없음(DB/크롤러만 변경) — 별도 Vercel 배포 대상 아님.

## 변경 내용 (이번 라운드)

### 1. 커뮤니티 게시판 (localStorage → Supabase 공유 DB)
- `community_posts`/`community_comments`/`community_likes` 테이블 + RLS,
  `community-photos` storage 버킷, 조회수(`views_count`) + 자동 증가 RPC.
- 목록 UI를 카드형 → 전통 게시판형 리스트(분류/제목/글쓴이/조회/좋아요)로
  재구성(사용자가 카드형 반려 → A/B 목업 비교 후 결정).
- 표시 이름 자동완성(실명 노출) 제거.
- 공고 등록 폼(`PostJob.tsx`) 버그 2건 발견·수정: `field--row` CSS
  누락으로 체크박스 정렬 깨짐, 에러 메시지가 폼 맨 위에만 떠서 안 보이던
  문제(이제 해당 입력칸으로 자동 스크롤+포커스).
- `deactivate_expired_jobs()`(만료 공고 자동 비활성화 함수)가 스케줄러에
  연결 안 돼 있던 걸 발견해 pg_cron으로 매일 00:00(VN) 자동 실행되게 연결.

### 2. 데이터 구조화 (신규)
- `local_jobs`에 `salary_min/max/currency/period/negotiable` 추가 —
  기존 273건 100% 파싱 성공(원문 salary는 그대로 보존).
- `local_jobs`에 `shift_type/work_start_time/work_end_time` 추가 — 시간
  패턴이 명확한 경우만 채움(추측 금지 원칙), 나머지는 NULL.
- `job_work_locations.resolved_province` 정규화 버그 수정(지오코딩 결과의
  영문 "Province" 접미사 문제, 29건 영향) + 기존 데이터 백필.
- **중요 발견**: Bắc Giang은 2025-07-01 행정구역 개편으로 Bắc Ninh에
  통합되어 더 이상 별도 지역이 아님(`vietnam_provinces` 패키지가 이미
  이렇게 반영 중, 실측 확인) — "Bắc Giang 공고 0건"은 데이터 누락이
  아니라 애초에 지금은 독립 지역이 아니기 때문.
- `crawler/crawl_topcv.py`(실제로는 vieclam24h.vn을 크롤링하는 파일 —
  이름은 안 바꿈, 불필요한 리팩터링 지시로 유지)에 Bắc Giang 전용 목록
  URL 추가(실제 접근 확인됨, curl 200).

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`(SSR 포함), `npm test`(6/6 파일
  전부), `crawler/test_job_quality.py`(19/19), `crawler/
  vn_provinces_lookup.py` 자체 테스트(11/11) — 전부 통과.
- 급여 파서: 273건 전수 100% 파싱 성공(range/협의/달러 3패턴).
- 근무시간 파서: 실제 원문 6개 케이스(단일 구간/자정 넘김/교대/모호한
  다중 구간/day-night 경계) 전부 수작업 대조로 정확성 확인.
- 지역 정규화: Bắc Ninh/Bắc Giang 7개 표기 변형 전부 동일 지역으로
  정규화됨을 직접 확인.

## 발견된 문제

1. **이 PC(회사 PC)에서 Playwright 크롤러 실행 불가** — Python 3.14(너무
   최신, `greenlet` prebuilt wheel 없음) + Microsoft C++ Build Tools
   미설치로 소스 빌드도 실패. 그래서 이번엔 실제 크롤링(샘플조차)을 못
   돌렸고, 대신 이미 DB에 있는 source_url 25건을 `curl`로 읽어서 파서만
   검증했음.
2. AZDIGI VPS 접속 정보도 이 세션/이 PC에서 못 찾음(과거 인수인계 기록상
   "VPS 실접속 미확인" 상태로 남아있던 것도 확인됨).
3. dormitory 키워드("nhà ở")가 주소명과 충돌해 오탐 발생 — 통근버스/
   기숙사/식사/수당 컬럼은 이번에 일부러 추가 안 함(지시사항), 실제
   원문 출현율만 25건 샘플로 조사(dormitory 0%, meal 16%, allowance 44%,
   shuttle_bus 0% — 단, 표본이 사무직 위주라 공장직군엔 대표성 부족).

## 다음 결정사항 (사용자 확인 필요 — 집 PC에서 이어갈 것)

1. **대량 크롤링 실행 여부** — 코드/DB 준비는 끝났지만 아직 미실행.
   실행하려면 (a) AZDIGI VPS 접속 정보 확보, 또는 (b) 로컬 PC에 Visual
   C++ Build Tools 설치(시스템 변경이라 사전 확인 필요) 둘 중 하나가
   먼저 필요.
2. **기업 공고 유료 상품 정책** — "기간제 우선 노출" 1개만 우선 설계하기로
   방향은 잡았으나 구현 전 단계, 아직 보류 중.
3. **커뮤니티 초기 콘텐츠** — 운영자가 직접 작성하거나 지인에게 요청하는
   방식으로 채우기로 함(코드 작업 아님).
4. 통근버스/기숙사/식사/수당 구조화 여부 — 이번 조사 결과(불안정한 표현,
   샘플 부족)를 보고 진행할지 판단 필요.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

이 문서 위 본문은 매번 최신 작업으로 덮어써지므로, 두 PC를 오가며 세션이
여러 번 연달아 끝나면 직전 세션들의 "뭘 끝냈는지"가 통째로 사라지는 문제가
있었다(2026-09-23 실제 발생 — SSR 작업 완료 요약이 그 뒤 커뮤니티 게시판/
데이터 구조화 두 작업에 연달아 덮어써져서 다음 세션이 못 찾음). 아래는 그
사고 이후 추가한 최소 이력 — 상세 내용은 각 commit을 `git show <hash>`로.

1. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) +
   PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
2. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER
   PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음
   (필요하면 커밋/배포 로그로 직접 확인).
3. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** —
   MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서
   실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
4. **2026-09-21 — 추천 공고 카드(Saramin 스타일 그라데이션 링) 완료** —
   MASTER PUSHED(`29d5f5b`) + PRODUCTION DEPLOYED.
