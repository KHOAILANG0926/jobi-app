# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-01 (회사 PC) — 공고 근무조건 + 게시자 지도 핀

- 요청: 메인 지도 필터가 실제 데이터로 동작하도록 공고 데이터 구조 확장(조사→migration→등록/수정 UI→타입/API→필터→검증→배포)
- 변경: migration 20261001100601(근무조건 7칸 + verification_method + 소유 확인 RPC 3개), JobConditionsFields·LocationPinPicker·jobConditions 신규, PostJob·ManageGuestJob·JobsContext·jobRows·fetchJobsData·types·homeMapFilters·HomeMapExplorer 연결
- 설계 이유: NULL=정보 미확인(추정 금지). 좌표는 job_work_locations 한 곳, 게시자 핀은 verified poster_pin. 게스트는 테이블 직접 쓰기 권한이 없어 소유 확인 SECURITY DEFINER RPC만 허용.
- 수정 파일: supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql, supabase/tests/job_conditions_pins.pglite.test.mjs, src/components/job-form/*, src/lib/jobConditions.ts, src/lib/homeMapFilters.ts(+test), src/components/home/HomeMapExplorer.tsx, src/pages/PostJob.tsx, src/pages/ManageGuestJob.tsx, src/context/JobsContext.tsx, src/lib/jobRows.ts, src/lib/fetchJobsData.ts, src/types/job.ts, src/index.css
- 검증: PGlite 20/20, tsc·build, npm test 10/10, 로컬 E2E(등록 PC/모바일·관리·메인), Production schema 재조회 + 롤백 트랜잭션 생성/수정/조회·권한 거부 확인(잔여 데이터 0)
- commit: 이 커밋 / push: master / deploy: Vercel 자동
- 남은 문제: 고용주 전체 수정 화면 없음, 실제 핀 데이터 0, test-home-composition.mjs 구식

## 2026-10-01 (회사 PC) — PC 메인 중간 영역 지도 탐색 개편

- 요청: 한국 입구 아래 ~ Việc làm nổi bật 위 중간 영역을 "내 주변 일자리 지도 + 선택 공고 패널"로 교체(조사→구현→검증→문서→배포)
- 변경: HomeMapExplorer·HomeMapCanvas·homeMapFilters 신규, Home.tsx 중간 블록 교체·전용 코드 정리, index.css `.hme*` 추가
- 설계 이유: 지도·거리는 확인된 근무지만(기존 원칙). 데이터 없는 조건은 가짜 판정 없이 비활성, `match`만 채우면 활성화되는 구조. 직접채용은 employer_id로 단정하지 않음.
- 수정 파일: src/components/home/HomeMapExplorer.tsx, src/components/home/HomeMapCanvas.tsx, src/lib/homeMapFilters.ts, src/pages/Home.tsx, src/index.css, CHATGPT_HANDOFF.md, WORK_LOG.md
- 검증: tsc·build 통과, npm test 9/9, vite preview + 응답 가로채기로 PC 1366/1920·모바일 375 동작 확인(반경·원·급여·업종·조건·핀↔패널·위치 허용/거부·빈 상태·넘침 0·콘솔 오류 없음)
- commit: 이 커밋 / push: master / deploy: Vercel 자동(Production 확인은 HANDOFF·채팅 보고)
- 남은 문제: test-home-composition.mjs 구식, 실제 데이터 핀 0(등록 양식·위치 확인 필요), 하단 목록 연동 미구현

## 2026-10-01 (회사 PC) — 한국 영역 장기 분리 점검

- 요청: 대량 데이터·별도 DB 전제로 한국 영역 결합 점검 → MUST FIX NOW 수정, 규칙 문서화
- 판단: MUST FIX NOW 없음(데이터 축적에 따라 비용이 커지는 결합이 현재 존재하지 않음 — korea_* 는 local_jobs 계열·account_roles·reports·storage와 FK/함수/트리거 결합 없음, korea 전용 트리거 1개뿐, 공개 접근은 korea_*_public 뷰만). 코드 수정 없음.
- RULE NOW: CLAUDE.md 한국 분리 규칙에 "장기 분리 보강" 7줄 추가(도메인 접두 식별자, account_roles/user_cvs 재사용 금지, reports/audit/alert 전용화, korea- bucket+상대 path, /viec-han-quoc/ 고정, 이벤트 product 구분, 관리자 query는 한국 API 경유).
- SAFE TO DEFER: KoreaJobDetail→jobCoords.resolveMapLocations(코드 결합, 데이터 비용 무관 — 한국 상세 작업 시 분리), 저장공고 localStorage 단일 키+kr- 접두(브라우저 데이터, DB화할 때 분리), 한국 SSR/sitemap/canonical 공백(간판화 시 한국 전용 모듈로), 분석 도구 없음(도입 시 규칙 적용).
- 별건 발견: local_jobs 이미지가 vieclam24h CDN URL을 직접 참조(외부 원본 사이트 자원 의존) — 한국과 무관, 별도 판단 필요.
- 수정 파일: CLAUDE.md, WORK_LOG.md, CHATGPT_HANDOFF.md
- 검증: 문서만 변경 — typecheck/build 해당 없음
- commit: 이 커밋 / push: master / deploy: 해당 없음

## 2026-10-01 (회사 PC)

- 요청: 한국 일자리 분리 가능성 전제로 코드·DB 결합 상태 읽기 전용 조사 → 분리 규칙을 CLAUDE.md에 저장
- 변경: CLAUDE.md에 "한국 일자리 모듈 분리 규칙" 섹션 추가
- 조사 요약: korea_* 테이블·뷰는 local_jobs 계열과 FK·DB 함수 결합 없음. korea_jobs 4건, applications/threads/interviews 0건(모두 FK→local_jobs). 저장공고는 localStorage 같은 키에 kr- 접두어. 한국 페이지는 SSR/sitemap/canonical 미포함. KoreaJobDetail이 jobCoords.resolveMapLocations 공유(베트남 위치 규칙이 한국 지도에 적용됨).
- 수정 파일: CLAUDE.md, WORK_LOG.md, CHATGPT_HANDOFF.md
- 검증: 문서만 변경 — typecheck/build 해당 없음
- commit: 이 커밋 / push: master / deploy: 해당 없음
- 남은 문제: 지도 함수 공유 정리(한국 상세 작업 시), 한국 SEO 공백(간판화 시 결정)

## 2026-10-01 (집 PC)

- 요청: ChatGPT가 Claude Code 직접 작업도 추적할 수 있도록 기록 규칙 추가
- 변경: CLAUDE.md에 "ChatGPT 추적용 기록" 섹션 추가, WORK_LOG.md 생성, CHATGPT_HANDOFF.md 스냅샷 갱신(메인 지도 논의 반영)
- 수정 파일: CLAUDE.md, WORK_LOG.md(신규), CHATGPT_HANDOFF.md
- 검증: 문서만 변경 — typecheck/build 해당 없음
- commit: 이 커밋
- push: master
- deploy: 해당 없음(문서)
- 남은 문제: 없음
