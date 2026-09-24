# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**크롤러 category 검증 버그 수정 + 신규 8건 실 수집 검증 + "조건 저장·매칭 알림" 서비스 설계 완료.** 이 노트북(LAPTOP-1GF55Q0D, 회사/집 어디서든 동일 경로 `C:\Users\HP\Downloads\jobi-app`)에서 진행. "조건 등록하면 계속 맞는 공고를 찾아주는" 신규 기능은 **설계만 완료, 코드/DB 구현은 아직 시작 안 함** — 다음 세션이 여기서 이어감.

- **IMPLEMENTED + VERIFIED + MASTER PUSHED(`77c4d8a`).** Production DB에는 신규 공고 8건만 저장됨(스키마 변경 없음).

## 변경 내용 (이번 라운드)

### 1. 크롤러 치명적 버그 발견·수정
- `job_quality.VALID_CATEGORIES`가 2026-09-17 도입된 새 13분류(`classifier.MAJOR_LABELS`) 대신 옛 7분류 그대로 하드코딩돼 있어서, **그 이후 크롤링된 공고가 전부 "invalid category"로 저장 직전 스킵되고 있었음**(실제 로그로 정확한 기간은 확정 못 함, 코드 경로상 확실). `VALID_CATEGORIES = set(classifier.MAJOR_LABELS.keys())`로 수정.
- 연쇄로 stale해진 테스트 3개 파일도 정리(job_quality/facebook_quality/address_pipeline_integration) — 전부 실제 최신 코드 동작에 맞게 정정, 회귀 테스트 1개 추가.
- `test_address_pipeline_integration.py`의 active=true 필터 검사가 SSR 리팩터링 이후 옮겨간 파일(`fetchJobsData.ts`)을 안 따라가서 엉뚱한 곳을 보고 있었음 — **보안 회귀 아님**, 실제 필터는 계속 정상 작동 중이었고 테스트 대상만 정정.

### 2. 실제 크롤 저장 검증 (신규 5건 → 통과 확인 후 계속)
- 이 노트북에서 Playwright가 실제로 동작함을 확인(이전 세션 실패는 이 환경 문제 아니었던 것으로 추정 — 원인 불명, 재확인 안 함).
- `crawler/.env` 신규 생성(사용자가 직접 service_role 키 입력, 저도 값은 안 보고 파일에만 반영) — **`.env`는 `.gitignore`로 제외 확인됨, 커밋 안 됨.**
- `--confirm-full-crawl --new-only` 4회 실행: 신규 3건→5건→0건→0건(같은 후보만 반복 발견돼 중단) = **총 8건**(273→281). 50건 목표는 못 채움 — 현재 크롤러가 도는 카테고리 페이지들의 신규 공급 자체가 소진된 것으로 보임.
- 5건 표본을 원문과 대조: 카테고리·급여원문·주소·중복 전부 정상. **단, salary_min/max·shift_type 등 어제 만든 구조화 컬럼은 신규 저장분에 전혀 안 채워짐**(어제 그 파서를 273건에 한 번만 백필했지, 상시 자동화 안 해둠) — 사용자가 "지금은 보류, 50건까지 먼저 채우고 나중에 일괄 백필"로 결정, 트리거 추가 안 함.

### 3. 구직자 7명 실제 매칭 가능성 조사 (DB + 실사이트 라이브 검색)
- 실제 인터뷰 프로필 7명 조건으로 DB(281건) 매칭 시도 → **7명 전원 완전 충족 후보 0건.**
- vieclam24h.vn 실시간 검색(기존 크롤러가 쓰는 것과 동일한 `tim-kiem-viec-lam-nhanh?q=` 패턴)으로 재확인 → 일부 근접 후보 발견(예: 물류영업 5번은 지역·직무 일치, 급여만 "협의"라 미확인 / 마케팅디자인 7번은 지역·급여 거의 일치). 회계(4번, Hải Phòng)는 실사이트 검색에서도 0건 — 진짜 공급 부족으로 판단.
- 결론: 원문 사이트에 `it-phan-mem`(IT), `quan-ly-tieu-chuan-va-chat-luong`(QA/QC) 카테고리가 실존하는데 현재 크롤러 `CATEGORY_URLS`에 없음 — 확장 여지 확인됨(아직 미구현).

### 4. "조건 저장 → 신규 공고 자동 매칭·알림" 서비스 설계 (코드/DB 미착수)
- 기존 `recommendStorage.ts`(RecommendPrefs/scoreJob/matchJobs)를 최대한 재사용하는 방향으로 설계 확정.
- 핵심 설계 결정: 필수조건은 `scoreJob` 점수가 아니라 **충족/불일치/미확인 3분류 판정(신규 함수 필요)**, 그 안에서만 `scoreJob`으로 선호조건 정렬. 미확인 공고는 알림에 안 섞음.
- 외부 알림 채널 **전부 미구현 확인**(이메일/SMS/푸시/Zalo 메시지 발송 전부 없음, Zalo는 로그인만 있음) — 1차로 이메일 제안(비용 낮음, 다만 이 사용자층엔 전달력 낮을 수 있음), Zalo OA는 다음 단계 후보로만 남김.
- 필요 테이블(제시만, 미생성): `saved_job_conditions`(필수/선호/조건부 태그 포함), `condition_match_notifications`(중복 알림 방지), `user_profiles.employer_visible_opt_in`/`stats_opt_in`(공개 동의와 통계 동의 분리).

## 테스트 결과

- `crawler/test_job_quality.py`(20/20), `test_facebook_quality.py`(7/7), `test_address_pipeline_integration.py`(54/54), `test_geocode.py`(6/6) — 전부 통과.
- 프론트엔드 코드 변경 없음 → `tsc`/`build` 재실행 불필요(안 함).

## 발견된 문제

1. 신규 크롤링분은 어제 만든 salary/shift 구조화 컬럼이 자동으로 안 채워짐(위 2번 참고, 의도적 보류).
2. 크롤러 신규 공급 소진(같은 카테고리 페이지 반복 시 0건) — 카테고리/지역 확장이나 재크롤 주기 조정 필요할 수 있음.
3. `test_geocode.py`의 예전 실패(사용자가 집 PC에서 보고한 "expected 2, got 0")는 이 환경에서 재현 안 됨(단독/연속 실행 둘 다 6/6 클린) — 원인 미상, 재발 시 재조사 필요.

## 다음 결정사항 (사용자 확인 필요)

1. **"조건 저장·알림" 기능 실제 구현 시작 여부** — 설계는 승인됐으나(재사용 방향 채택, 4가지 보완사항 반영 완료) 코드/DB 작업은 아직 안 함. 위 합의된 순서(saved_job_conditions 테이블 → 확정 UI → 판정 함수 → 알림)대로 시작할지 결정 필요.
2. 크롤러 카테고리 확장(`it-phan-mem`, `quan-ly-tieu-chuan-va-chat-luong` 등 검색어 URL 추가) 진행 여부.
3. 이메일 알림 채널(Resend 등) 실제 연동 착수 여부 — 계정/비용 확인 필요.
4. (계속 보류 중) Bắc Ninh/Bắc Giang 통근버스·기숙사 등 생활조건 컬럼 신설 — 25건 조사 결과(불안정) 기준 판단 필요.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
2. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
3. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
4. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** — MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서 실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
5. **2026-09-21 — 추천 공고 카드(Saramin 스타일 그라데이션 링) 완료** — MASTER PUSHED(`29d5f5b`) + PRODUCTION DEPLOYED.
