# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**이번 세션: `job_duration`(근무기간 7구간) 컬럼 추가 + PostJob.tsx 필드 +
급구 페이지 "근무기간" 필터 + 상세조건 패널에 "고용형태" 섹션 이동, 코드는
구현·검증 완료. commit/push 전 상태.**

이전 세션들(A~I 라운드: 대분류/소분류 체계 전면 재설계, Khu vực 패널 UX 다수
수정, 옛 Quận/Huyện 중간 단계 복원, 검색창/그리드/글자크기 재조정)은 전부
master push + Vercel Production 배포까지 완료된 상태(`0a7af24`까지) — 자세한
내용은 git log(`0a7af24` 이전 커밋들)로 확인 가능, 이 문서는 최신 스냅샷만
유지하므로 과거 라운드 상세 내역은 누적하지 않는다.

## 변경 내용

### DB 마이그레이션 (적용 완료, Production)
- `ALTER TABLE local_jobs ADD COLUMN job_duration text;` — Supabase MCP로
  실제 운영 프로젝트(`edhuesdnuxlbcfephutq`)에 적용 완료, `information_schema`
  재조회로 컬럼 존재 확인함. nullable, CHECK 제약 없음.
- 마이그레이션 파일: [supabase/migrations/20260918112447_local_jobs_job_duration.sql](supabase/migrations/20260918112447_local_jobs_job_duration.sql)
  — 아직 커밋 전(git status 확인, add 필요).
- **주의**: 기존 `supabase/migrations/0016_local_jobs_work_duration_draft.sql`
  이라는 draft가 이미 있었음 — 이름이 비슷한(`work_duration`) 별개 컬럼으로,
  ViecLam24h 원문 자유텍스트 계약기간 개념(예: "Dài hạn")이었고 **사용자
  승인 전 상태로 한 번도 운영 DB에 적용된 적 없음**(grep으로 코드 전체에서
  참조 0건 확인, 순수 orphan draft). 이번에 추가한 `job_duration`은 알바몬
  스타일 고정 7구간이라 이름/값 체계가 다른 **별개의 새 컬럼**이다. 0016은
  지우지 않고 그대로 뒀음 — 지울지는 사용자 판단 필요(아래 "다음 결정사항"
  참고).

### 프론트엔드
- [src/data/jobDuration.ts](src/data/jobDuration.ts) — 근무기간 7종
  (`Một ngày`/`Dưới 1 tuần`/`1 tuần - 1 tháng`/`1 - 3 tháng`/`3 - 6 tháng`/
  `6 tháng - 1 năm`/`Trên 1 năm`) 공유 상수. PostJob.tsx와
  UrgentJobsPage.tsx 둘 다 이 파일 하나를 참조.
- [src/types/job.ts](src/types/job.ts) — `Job.jobDuration?: string` 추가.
- [src/lib/jobRows.ts](src/lib/jobRows.ts) — `rowToJob()`에 `job_duration`
  매핑 추가, `EMPLOYER_JOBS_SELECT_COLUMNS`에 컬럼 추가.
- [src/context/JobsContext.tsx](src/context/JobsContext.tsx) — 공개 목록
  select 컬럼에 `job_duration` 추가, `addPostedJob()` insert에
  `job_duration: draft.jobDuration ?? null` 추가.
- [src/pages/PostJob.tsx](src/pages/PostJob.tsx) — "Thời hạn làm việc"
  select 필드 추가(선택 안 함 기본값, 7종 옵션). 기존 "Thời gian làm việc"
  (근무시간 자유텍스트, `hours` 컬럼) 필드와 라벨이 겹치지 않도록 별도
  문구로 뺐다 — `hours`="근무시간"(예: "08:00–17:00"), `jobDuration`=
  "근무기간/계약기간"(하루~1년 이상 구간)으로 개념이 다름.
- [src/pages/jobsMenu/UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx):
  1. "Thời gian làm việc" 필터 패널의 "Hình thức" 섹션(work_period, 다이나믹
     값)을 제거하고, 그 자리에 "Thời hạn làm việc" 섹션(job_duration, 고정
     7구간 — work_period와 달리 실제 존재하는 값만 뽑지 않고 항상 7개 다
     보여줌, PostJob.tsx가 정해진 값만 넣게 하므로 가능)을 새로 추가.
  2. "Điều kiện khác"(상세조건) 패널에 "Loại hình công việc" 섹션 신설 —
     기존 work_period 다중선택(`workPeriods` state, `workPeriodOptions`
     다이나믹 목록)을 여기로 그대로 옮김. 라벨은 CHATGPT_HANDOFF.md 이전
     합의대로 "Hình thức làm việc"를 재사용하지 않고 "Loại hình công việc"
     로 새로 지음(person-centric 고용형태 프레임에 맞춤).
  3. `activeFilterCount`/`clearAllFilters`/각 패널 count·초기화 버튼에
     `jobDurations` 추가, `Điều kiện khác` 패널 count·초기화에 `workPeriods`
     포함되도록 이동.
  4. 상단 주석 2곳(컴포넌트 설명, 예전엔 "성별/연령/고용형태 데이터 없어
     상세조건에서 제외"라던 부분)을 실제 반영된 상태로 갱신.

## 테스트 결과

- `npx tsc --noEmit` 클린.
- `npm run build` 성공(`jobDuration-46umscL_.js` 청크 생성 확인).
- `npm test` 6/6 파일 전부 통과(회귀 없음, jobRows.test.ts 포함).
- 로컬 dev 서버(`http://localhost:63624/viec-lam/tuyen-gap`) 브라우저로
  직접 확인: "Thời gian làm việc" 패널에 "Thời hạn làm việc" 7개 칩 정상
  렌더, "Điều kiện khác" 패널에 "Loại hình công việc" 섹션(급구 공고 실제
  값 기준 "Bán thời gian cố định"/"Toàn thời gian cố định" 2개) 정상 렌더.
  콘솔 에러 없음(무관한 404 2건은 기존부터 있던 리소스, 이번 변경과 무관).
- **DB에 실제 job_duration 값이 채워진 공고가 아직 0건**이라(PostJob.tsx로
  아직 아무도 등록 안 함) 실제 필터링 동작(칩 선택 → 결과 줄어듦)은 로컬
  테스트로 검증 못 함 — 코드 로직은 기존 workPeriod 필터와 완전히 동일한
  패턴이라 구조적으로는 신뢰 가능.

## 발견된 문제

- 위 "주의" 참고 — `0016_local_jobs_work_duration_draft.sql`이 이번 작업
  전부터 존재했으나 아무도 적용하지 않은 orphan draft였음. 두 세션(회사/집
  PC) 사이에 이런 미적용 draft가 있었다는 걸 이번에 처음 발견 — 앞으로 새
  컬럼을 추가하기 전에는 `supabase/migrations/` 디렉토리에 관련 draft가
  이미 있는지 먼저 확인하는 습관이 필요함.
- (이전부터 있던 항목, 계속 유지) `applications_insert`의 tautology 조건,
  korea_jobs 구조 통합 미결정, 기업 계정 헤더에 구직자 메뉴 링크 없음,
  `.git/hooks/post-commit` 자동 push 훅, `jobCategoryRules.ts` 제거 완료
  (DB 값이 유일한 진실 공급원), truyen_thong/y_te_dieu_duong 분류 규칙
  미검증, PostJob.tsx에 소분류 선택 필드 없음, `categoryVisuals.ts` 신규
  대분류 5개 전용 이미지 없음.
- **근무기간(job_duration) 실데이터가 당장 0건**이라 급구 페이지 새 필터
  섹션은 한동안 "선택해도 결과가 안 줄어드는" 상태로 보일 수 있음 — 이건
  버그가 아니라 PostJob.tsx로 신규 등록이 쌓이길 기다려야 하는 정상 상태
  (work_period 때와 같은 논리, 사용자가 이미 승인한 방향).

## 다음 결정사항

1. **commit + master push + Vercel Production 배포**(이번 세션 마무리
   단계, FAST/NORMAL 흐름대로 별도 승인 없이 진행 — 사용자가 "일단 진행하는건
   왠만하면 허락받지말고 진행해줘"로 확인함, 2026-09-18).
2. `0016_local_jobs_work_duration_draft.sql`(미적용 orphan draft)을 그대로
   둘지, 삭제할지, 아니면 그 draft가 의도했던 "자유텍스트 계약기간" 개념을
   별도로 살릴지 — 사용자 판단 필요.
3. PostJob.tsx에 소분류 드롭다운 추가(우선순위 있음, 이전부터 미착수).
4. truyen_thong/y_te_dieu_duong 분류 규칙을 언제 실제 데이터로 재검증할지.
5. 지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도
   확대할지 — 여전히 보류 중.
6. `categoryVisuals.ts`에 신규 5개 대분류 전용 이미지 추가할지.
7. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부.
8. `applications_insert`의 tautology 조건 수정 여부.
9. 기업 계정 헤더에 "Việc làm" 링크 추가할지.
10. 급구 페이지 첫 방문 시 지역 기본값이 `VN_PROVINCES[0]`(Cần Thơ, 공고
    0건)인 문제 — 실제 공고 많은 지역으로 바꿀지 여전히 미정.
11. 구/현 "전체 선택" 원클릭 필터, 지역 검색창에 구/현 이름 인덱싱 — 보류.
12. `backup-home-2026-09-18-workperiod-panel` 브랜치의 근무기간 패널
    라벨/옵션 재배치 작업을 현재 코드베이스에 재적용할지 — 미결정.
