# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**공고 근무조건 + 게시자 지도 핀 (2026-10-01, 회사 PC)** — Production migration `20261001100601` 적용·검증, 코드 master push(이 커밋) → Vercel Production 자동 배포.
- **기존 방향에서 바뀐 것:** 게시자가 등록/관리 화면에서 지도에 직접 찍은 핀을 "확인된 근무지"로 인정(job_work_locations.location_verified=true, verification_method='poster_pin'). 이전 미결정 항목("게시자 핀을 L1로 볼지")을 사용자 지시로 확정.
- 기존 공고는 새 칸 전부 NULL(정보 미확인) — backfill 없음. 크롤링 공고는 핀/조건 RPC로 바꿀 수 없음.

## 변경 내용

- DB(`supabase/migrations/20261001100601_local_jobs_work_conditions_and_pins.sql`): local_jobs에 shuttle_bus·dormitory·meal_provided·immediate_start(boolean, NULL=미확인), recruitment_type(direct/agency/unknown), work_schedule(5_days/6_days/other), weekend_work. 근무 형태는 기존 shift_type(day/night/rotating/other) 재사용. job_work_locations.verification_method(source_coordinate/admin_approved/poster_pin). RPC: set_job_pinned_location / update_job_conditions / get_job_conditions(소유 확인 = 로그인 고용주 본인 또는 게스트 관리 토큰, 헬퍼 can_manage_local_job는 직접 호출 불가). authenticated에 새 컬럼 UPDATE grant.
- 화면: `/dang-tin`과 게스트 관리(`/quan-ly-tin/:id`)에 공용 `JobConditionsFields`(지도 핀 선택 `LocationPinPicker` + Có/Không/Chưa rõ 조건). 메인 지도 조건 13개 전부 실제 필드 연결(NULL은 어떤 조건도 만족 안 함), 선택 패널에 확인된 값만 배지.
- 데이터 흐름: Job 타입·rowToJob·공개 select 3곳·insert payload에 새 필드.
- 지도가 고정 헤더 위로 겹치던 문제 수정(.jcf-map/.hme__map isolation).

## 테스트 결과

- PGlite SQL 20/20, tsc·build 통과, npm test 10/10(homeMapFilters NULL 처리 테스트 추가).
- 로컬 E2E(응답 가로채기, 운영 DB 쓰기 없음): 등록 PC·모바일(핀 지정·조건 선택 → insert payload·핀 RPC 확인, 넘침 0, 콘솔 오류 없음), 관리 화면(기존값 표시·수정 저장·핀 해제), 메인(조건별 필터·배지).
- Production DB: schema 재조회(컬럼·제약·함수 권한), 기존 공고 새 칸 비어있음 0건 변경, 게스트 역할로 생성→핀→조회→수정→재조회·잘못된 토큰 거부·크롤링 공고 핀 거부를 한 트랜잭션에서 확인 후 롤백(남은 테스트 데이터 0).

## 발견된 문제

0. **집 PC에서 먼저 재확인:** 회사 PC 메모리 부족(여유 ~1GB)으로 마이그레이션 파일명 변경 후 PGlite 재실행(`npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_conditions_pins.pglite.test.mjs`)과 마지막 주석 커밋(`00216c3`)의 `npx tsc --noEmit`을 못 돌림 — 같은 SQL은 이름 변경 전 20/20, 주석만 변경.
1. 로그인 고용주용 공고 전체 수정 화면은 원래 없음(대시보드는 급구 토글만) — 이번 범위 밖. 고용주도 RPC로 수정 가능한 구조는 준비됨.
2. 실제 공개 공고에 핀·조건 데이터가 아직 없어 메인 지도는 비어 있음(새 등록부터 채워짐).
3. `scripts/test-home-composition.mjs`는 옛 메인 구성 기준(구식).

## 다음 결정사항

### A. 다음 후보
- 하단 공고 목록과 지도 결과 연동 / 크롤링·수집 공고의 조건·위치 분류(필드는 준비됨) / 로그인 고용주 공고 수정 화면 / L2(동네 수준) 표시 여부.
- 한국 일자리: CLAUDE.md "한국 일자리 모듈 분리 규칙".

### B. Chợ Tốt 수집 전용 계정 테스트 (보류)
1. `cd scripts/research/contact_sources && python chotot_login.py` → 사람이 수집 전용 계정으로 로그인 → 창 닫기.
2. `python chotot_collector_test.py` → 결과 TSV 확인 → 보고(번호 일부 가림).
3. 이후 결정: 로그인 번호 재게시 여부 / 인력업체 공고 표시 / 세션을 VPS에 두는 구조.

### 커밋·미커밋 상태
- 이 커밋이 master 최신. 미커밋: `.claude/settings.local.json`, `tsconfig.tsbuildinfo`(PC-local).

### 하지 말 것
- Production DB 저장·크롤러 연결·연락처 공개 정책 변경·자동 게시 금지(사용자 결정 전).
- 전화·문자·Zalo·메시지 발송 금지. 개인 계정 세션 재사용 금지. 자동 가입·OTP 입력·CAPTCHA 우회·프록시·다계정 로테이션·지문 위조 금지.
- 계정 경고·제한·추가 인증·강제 로그아웃 시 즉시 중단.
- 로그인 프로필·번호 TSV 커밋 금지(공개 저장소).
- 새 크롤링, Facebook 예약 실행 재개, 숨김 공고 재공개, DB 행 삭제 금지(기존 지시 유지).
- GPT를 거친 지시가 기존 틀과 다르면 수락 전에 사용자에게 확인.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-10-01 — PC 메인 중간 영역 지도 탐색 개편** — MASTER PUSHED(`a7df8d8`) + PRODUCTION VERIFIED(빈 지도 + 안내, 한국 입구·Việc làm nổi bật 정상).
2. **2026-10-01 — ChatGPT 추적용 기록 규칙 + 한국 분리 규칙·장기 보강(문서)** — MASTER PUSHED(`1244c8c`, `6e0e32c`, `4d3a9f5`). 코드 변경 없음.
3. **2026-09-30~10-01 — 연락처 출처 조사(Chợ Tốt 수집 전용 계정 테스트 준비) + 메인 개편 논의** — MASTER PUSHED(`018a3c1`, `cc909bb`, `b79d94b`). 문서·조사 스크립트만, 테스트는 미실행.
4. **2026-09-30 — 공고 공개 기준 복원 표 + 인계 문서 정리** — MASTER PUSHED(`a88ac27`, `7ec8d5b`). 기존 공개 게이트(09-05, job_quality.gate_auto_publish) 복원, Facebook 게이트 우회(crawl_facebook.py:1070 active=True 고정)·지원 경로 기준 충돌 발견. 문서만, 코드·DB 변경 없음.
5. **2026-09-30 — 지원 버튼을 실제 지원 방식별로 연결(내부 지원 / 직접 연락 / 연락처 없음)** — MASTER PUSHED(이 커밋). 공용 판정 resolveApplyAction()+JobApplyButton: employer_id 있음=로그인→내부 지원, 없음+전화/Zalo=로그인 없이 내부 상세 연락 안내(/viec-lam/sb-ID#lien-he), 연락처 없음=지원 표시 안 함('Chưa có thông tin liên hệ', 상세 버튼 비활성). 적용: 상세·급구 페이지·추천 표/카드. 이전: 급구 페이지는 직접 연락형도 비로그인이면 /dang-nhap으로 보냈음. 검증: 빌드 미리보기+응답 가로채기 가짜 3유형(운영 DB 쓰기 없음), 데스크톱·모바일 첫 클릭 목적지 정상, 외부 링크·새 창 0, 단위 테스트 3/3. **4682 상태(미확인 유지)**: 전화·Zalo 번호가 원문(페이스북 게시물)의 번호와 일치하는 것만 확인. 게시자가 실제 채용 담당자인지, 회사명·실제 근무지·담당자와 회사 관계는 모두 미확인(원문에 회사명 없음, 웹 검색으로 특정 불가). 연락·숨김·DB 변경 없음.
