# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**구직 희망조건 저장 → 공고 매칭 → 새 공고 앱 내 알림 (1차)** — 2026-09-27.

- 상태: **IMPLEMENTED + VERIFIED(로컬) + PRODUCTION DB APPLIED + MASTER PUSHED
  (이 문서가 포함된 커밋 = 0dff280의 revert) + PRODUCTION DEPLOYED(배포 후 확인
  결과는 다음 세션/로그 참고)**. 실제 구직자 계정 흐름 확인은 사용자 몫(아래 다음
  결정사항).
- 경위(2026-09-27): 기능 커밋 `0c6366e`가 **post-commit 훅(`.git/hooks/post-commit`
  = `git push`)으로 의도치 않게 push → Vercel Production 배포**됨(DB 미적용 상태,
  약 7분 노출, Supabase API 로그상 그 사이 요청 0건). `0dff280`으로 revert해 복구.
  이후 사용자 승인으로 **Production DB에 migration 적용(`job_alerts`) → 검증 통과 →
  revert를 되돌리는 이 커밋으로 프론트 재반영**. ⚠ 이 저장소에서 master 커밋 =
  push = Production 배포.
- Production DB 적용 직후 검증값: 테이블 4 / RLS 4 / 정책 11 / 함수 10(파일과 동일
  목록) / cron `job-alert-notifications` `*/15 * * * *` active / 지역 키워드 191(29개
  지역) / 사용자 행 0 / anon REST 4개 테이블·배치 RPC 전부 거부(42501) / 판정 스모크
  (HCM 필수 + 월 10triệu 필수, 열린 공고 128) = match 39 · mismatch 63 · unknown 26 /
  security advisor 신규 항목은 `job_alert_is_active_seeker` authenticated 실행(RLS용,
  의도됨)뿐.
- **이동거리 조건은 1차 배포에서 선택 불가**(사용자 결정): 운영 공고에 거리 판정
  가능한 좌표가 0건이라 항상 "정보 미확인"이 되기 때문. 화면에 이유를 표시하고
  집 위치 동의/저장 UI도 숨김(쓰지 않는 개인 위치를 수집하지 않음). DB 스키마·판정
  함수는 거리 조건을 그대로 지원 → 후속 작업 후 `src/lib/jobAlerts.ts`의
  `DISTANCE_MATCHING_ENABLED`만 true로.
- 이 커밋에서 제외한 기존 로컬 미커밋 변경(건드리지 않음): Tuyển dụng 초록 버튼
  (`src/index.css`), `crawler/crawl_topcv.py`, `.claude/settings.local.json`,
  `tsconfig.tsbuildinfo`, 각종 untracked 백업/로그 파일.

### 범위 (사용자 지시)
포함: 로그인 구직자가 지역·업무·희망급여·근무시간(+이동거리는 스키마만)을 각각
필수/선호로 저장·수정·중지·삭제 / 조건별 충족·불일치·정보 미확인 판정(정보 없으면
충족 추정 금지) / 필수조건 전부 확인된 공고만 매칭·알림, 미확인은 별도 영역에 이유
표시 / 새 공고 앱 내 알림 + 중복 방지 + 마감·비활성 제외 / 0건 원인 구분 표시 /
RLS 본인만. 제외: 자연어 AI 입력, 조건부 허용, 이메일·Zalo 외부 알림, 기업용 구직자
검색, 통계 그래프, 기업에 구직자 조건/프로필 공개.

## 변경 내용

**DB — `supabase/migrations/20260927090000_job_alerts.sql` (Production 미적용)**
- 새 테이블 3개(기존 테이블 변경 없음): `job_alert_preferences`(사용자당 최대 5,
  active/paused, 조건별 importance, 필수 1개 이상 CHECK), `job_alert_home_locations`
  (numeric(6,3)/(7,3)로 ~100m 반올림 강제, 주소 컬럼 없음, 동의 시각),
  `job_alert_notifications`(UNIQUE(preference_id, job_id), 판정 스냅샷, read_at/
  dismissed_at). + 참조 테이블 `job_alert_region_keywords`(JOB_REGIONS와 동일, 테스트로
  동기화 검사).
- RLS: 본인(`seeker_id = auth.uid()`)만. 쓰기는 활성 구직자만. 컬럼 grant로
  seeker_id 위조 불가, 알림은 클라이언트 INSERT/DELETE 불가(read_at/dismissed_at만
  UPDATE). anon/기업 접근 경로 없음.
- 판정 `job_alert_evaluate()` 단일 소스(화면 RPC `job_alert_match_jobs` + 알림 배치
  공용). 규칙: 지역(텍스트+근무지에서 지역 추출, 단어 경계·긴 키워드 우선) / 업무
  (category) / 급여(VND·같은 지급주기만, 최저≥희망 충족, 최고<희망 불일치, 걸침·협의·
  없음 미확인) / 근무시간(시각이 희망 구간 안이면 충족, 교대는 허용 체크 시 충족) /
  거리(신뢰 좌표만). 필수 불일치 1개→mismatch, 필수 미확인→unknown, 나머지 match.
- 알림: **pg_cron `job-alert-notifications` 15분 배치**
  (`job_alert_generate_notifications()`, SECURITY DEFINER, 클라이언트 실행 불가).
  대상 = active 조건 × 활성 구직자 × (active·미숨김·마감일≥베트남 오늘 공고 중 조건
  생성/재개 이후 & 최근 14일 생성) × overall=match. 트리거 대신 배치인 이유: 크롤러가
  근무지(지역)를 공고보다 나중에 넣음.

**프론트**
- `src/lib/jobAlerts.ts`, `src/lib/jobAlerts.test.ts`(신규)
- `src/components/JobAlertsPanel.tsx`, `src/components/jobAlerts.css`(신규)
- `src/pages/jobsMenu/MatchedJobsPage.tsx`: 로그인 구직자만 새 패널, 게스트·기업은
  기존 localStorage 화면(게스트엔 로그인 안내 추가)
- `src/context/NotificationContext.tsx`: 기존 60초 체크에 서버 알림 합침(job_match),
  읽음/모두읽음/모두지우기(=숨김) 서버 기록. localStorage 알림은 그대로.
- `src/components/NotificationBell.tsx`: job_match 아이콘 + "Xem tin →"
- `src/lib/notificationsStorage.ts`: 타입에 'job_match'만 추가
- 로컬 검증 전용: `supabase/tests/job_alerts_local_bootstrap.sql`,
  `supabase/tests/job_alerts_rls_test.sql`(Production에서 실행 금지)

## 테스트 결과

- `npx tsc --noEmit` 통과, `npm run build`(클라이언트+SSR) 통과, `npm test` 8/8.
- 로컬 Supabase(빈 DB → bootstrap + 최종 migration, `db reset`) SQL 검증 **19/19
  PASS**: 구직자 2명 격리, 기업·anon 차단, 조건별 충족/불일치/미확인, 마감·비활성·
  숨김 제외, 중복 알림 0, 미확인→정보 보강 후 1회 알림, 중지 조건·정지 계정 알림
  없음, 알림 삭제·재작성 불가, 최대 5개, cron 등록.
- 로컬 화면: 조건 저장→3영역 결과→새 공고 배치→벨 알림→읽음 DB 기록→중지 시 알림
  없음, 구직자 B 격리, 0건 진단(범위 공고 부족/정보 부족), 375px 가로 스크롤 없음.
  최종본에서 거리 조건 "Bắt buộc/Ưu tiên" 비활성 + 이유 문구 + 위치 박스 미노출 +
  안내문에서 "khoảng cách" 제거 확인.

## 발견된 문제 (2026-09-27 Production read-only 조사)

1. 공고 수 기준: 전체 281 / `active=true` 135 / 공개(관리자 숨김 제외) 133 / 베트남
   날짜 기준 마감 전(매칭·알림 대상) 128. 이전 "281"은 전체 행 수, 차이 146은 비활성
   (144건은 마감 자동 비활성화). 135→128 차이 7 = 관리자 숨김 2 + 마감 09-26인데 아직
   active 5(`deactivate_expired_jobs`가 UTC 날짜 기준이라 하루 늦게 끔).
2. **신규 공고 입력이 09-24 이후 0건**(09-18 이후 신규는 09-24의 8건뿐,
   last_verified_at 최신도 09-24). 원인 미조사 — 이대로면 배포해도 새 공고 알림이
   거의 생기지 않음.
3. 거리 좌표: 활성 공고 근무지 261행 중 좌표 저장 102행(75건) **전부 `ward`+미검증**,
   `exact` 0행, `location_verified=true` 2행은 좌표가 null(09-07 수정, 원인 미확인).
   즉 크롤러는 좌표를 저장했지만 새 판정 기준(exact 또는 ward+검증)에서 전부 제외.
   기존 "Gần tôi" 거리검색은 미검증 ward도 "근사 거리"로 사용 중(기준이 다름).
4. 주소→좌표 변환은 외부 Geoapify로 주소 텍스트가 전송됨(1차에선 UI가 꺼져 있어
   해당 없음).

## 후속 작업 (기록)

- **[후속] 공고 위치 데이터 보강 후 거리 매칭 활성화**: 판정 가능한 근무지 좌표를
  확보(원문 고용주 좌표 검증 확대, 또는 미검증 ward를 "근사 거리"로 인정할지 제품
  결정 — 동 단위 좌표는 최대 ~15km 오차 실측 기록 있음), `location_verified=true`인데
  좌표가 null인 2행 원인 확인 → 판정 가능 공고 수 확인 후 `DISTANCE_MATCHING_ENABLED`
  를 true로(스키마 변경 불필요).
- **[후속] 크롤러 신규 공고 입력 중단(09-24 이후) 원인 확인.**
- **[후속] `deactivate_expired_jobs`를 베트남 날짜 기준으로 맞출지.**

## 다음 결정사항 (사용자 확인 필요)

1. 실제 구직자 계정으로 `/viec-lam/phu-hop` 최소 흐름 확인(패널 표시, 거리 조건
   비활성+이유, 조건 저장→3영역 결과, 수정·중지·재개·삭제, 알림벨 오류 없음).
   기업 계정은 기존 화면 유지 확인.
2. 새 공고 알림 실제 발생은 크롤러 신규 입력 재개 후에만 확인 가능(09-24 이후 0건).
   cron 실행 이력(`cron.job_run_details`)은 succeeded 여부로 확인.
3. Tuyển dụng 초록 버튼 배포 여부(별개, 여전히 로컬 미커밋).

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-09-26 — Zalo 로그인 계정탈취 긴급수정 + VPS relay HTTPS 전환 + 실사용자 재로그인 E2E까지 완료** — MASTER PUSHED(`c5d7e8f`~`31b76fa`) + PRODUCTION DEPLOYED + PRODUCTION VERIFIED(사용자가 실제 Zalo 계정으로 재로그인 성공 확인). 도중 발견된 계정 충돌 1건은 DB 직접 조회로 원인 확인 후 사용자 승인 받고 `app_metadata.zalo_id` 1회성 백필로 안전하게 해결.
2. **2026-09-24 — 크롤러 category 버그 수정 + 신규 8건 검증 + 매칭서비스 설계** — MASTER PUSHED(`77c4d8a`). PRODUCTION DB에 신규 8건 저장(273→281), 스키마 변경 없음.
3. **2026-09-23 — 데이터 구조화 1차 완료** — MASTER PUSHED(`4851389`) + PRODUCTION DB 마이그레이션 적용 완료. 프론트엔드 변경 없음(DB/크롤러만).
4. **2026-09-23 — 커뮤니티 게시판 Supabase 전환 완료** — MASTER PUSHED(`4be84e8`). PRODUCTION DEPLOYED 여부는 이 로그에 기록 안 남아있음(필요하면 커밋/배포 로그로 직접 확인).
5. **2026-09-22~23 — GEO/AI 검색 대응 SSR(공고상세/급구/공개검색) 완료** — MASTER PUSHED(`76693ad`) + PRODUCTION DEPLOYED(`viecganban.vn`에서 실측 검증 완료: 대표 페이지 20개, sitemap 286개 URL).
