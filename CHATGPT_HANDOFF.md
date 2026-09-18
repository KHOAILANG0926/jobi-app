# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**이번 세션: `job_duration`(근무기간 7구간) 컬럼 추가 + PostJob.tsx 필드 +
급구 페이지 "근무기간" 필터 + 상세조건 패널에 "고용형태" 섹션 이동 —
commit/push + Vercel Production 배포까지 완료, 실 사이트 확인함.**

**이어서(같은 세션)**: 사용자가 알바몬 "근무기간" 패널 실제 캡처본을 보여주며
"Thời gian làm việc" 패널 레이아웃 재구성 지시 — 라벨(Thời hạn làm việc/Ngày
làm việc/Khung giờ)을 왼쪽에 굵게 고정, "근무요일"/"근무시간"에 "목록에서
선택/직접선택" 전환(사각 버튼, 캡처본의 동그라미 라디오 대신) 추가. 1차
구현 후 사용자가 "동일하게 만들어달라는 말이 어려워?"로 불만 — 내가 모드
전환 시 한쪽 칩 그룹을 통째로 숨겼는데, 캡처본은 두 그룹(프리셋+개별 요일)
이 항상 같이 보이고 선택 안 된 쪽만 흐리다는 걸 놓쳤음. 흐림 처리 방식으로
재수정 + "협의 제외" 체크박스도 추가(캡처본엔 있는데 내가 임의로 뺐었음 —
가짜 필터가 되지 않도록 "일정 미기재 공고 제외"라는 실제 데이터 기반 필터로
구현). 전체 commit/push + Production 배포 완료, 실 사이트 확인함.

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

### "Thời gian làm việc" 패널 레이아웃 재구성 (같은 날, 알바몬 캡처본 참고)
- 새 CSS 클래스([src/index.css](src/index.css) `.jm-workhour-row` 계열,
  `.jm-keyword-group__label` 근처): 라벨을 그룹 위가 아니라 왼쪽(고정폭
  84px)에 굵게 배치, 옵션은 오른쪽 `.jm-workhour-row__body`에. 480px 이하
  모바일은 미디어쿼리로 세로 스택으로 전환.
- **"Ngày làm việc" 행**: 기존 "Ngày làm việc"(요일 프리셋)와 "Số ngày làm
  việc/tuần"(주N일) 두 섹션을 한 행으로 합침 — "Chọn từ danh sách" 모드에서
  프리셋 칩 + 주N일 칩을 같은 줄에, "Chọn thủ công" 모드에서 요일 하나씩
  (월~일) 직접 토글. **두 모드 다 기존 `selectedDays`/`selectedDayCounts`
  state를 그대로 써서 완전히 동작하는 진짜 기능**(가짜 UI 아님).
- **"Khung giờ" 행**: "Chọn từ danh sách" 모드는 기존 시간대 프리셋+버킷
  칩(그대로), "Chọn thủ công" 모드는 시작/종료 시각 드롭다운(00:00~23:00,
  `HOUR_OPTIONS`)을 보여주지만 **실제 필터링에는 반영하지 않는 순수 UI**
  — local_jobs.hours가 자유텍스트라 정확한 시/분 단위로 거를 데이터가
  없음(workScheduleParse.ts는 버킷 단위 파싱만 가능). 화면에 "Bộ lọc theo
  giờ chính xác chưa khả dụng..." 안내 문구로 명시해 사용자를 속이지
  않도록 함(사용자에게 이 트레이드오프 확인 후 진행 — AskUserQuestion으로
  확인함).
- "목록에서 선택/직접선택" 전환 버튼은 캡처본의 동그라미 라디오 대신
  기존 사각 버튼 스타일(`.jm-workhour-mode-btn`)로 — 사용자 지시
  ("동그라미 말고 네모칸 유지").
- **(수정판)** 처음엔 모드 전환 시 비활성 그룹을 완전히 숨겼는데, 사용자가
  캡처본을 다시 보여주며 "동일하게 만들어" — 캡처본은 두 칩 그룹이 항상
  같이 보이고 선택 안 된 쪽만 흐리다. `.jm-workhour-inactive`(opacity 0.4,
  DOM에서 제거 안 함 — 클릭도 계속 가능)로 교체. "Ngày làm việc" 행은
  프리셋+주N일 칩과 개별 요일 칩이 항상 같이 보임(모드에 따라 어느 쪽이
  흐려질지만 바뀜), "Khung giờ" 행은 프리셋+버킷 칩과 시작/종료 드롭다운이
  항상 같이 보임.
- **"협의 제외" 체크박스 추가**(1차에서 임의로 뺐던 것 — 사용자가 "뺄 건
  뺐는데"로 지적, 캡처본에 있는 요소는 그대로 살려야 함): 알바몬 원본을
  그대로 베끼면 대응 데이터가 없어 가짜 필터가 되므로, 같은 의도(정보
  불명확한 공고 제외)를 실제 데이터로 구현 — "Loại trừ tin chưa rõ ngày
  làm việc"(workDays 빈 공고 제외)/"Loại trừ tin chưa rõ giờ làm việc"
  (hours 빈 공고 제외), 둘 다 `parseWorkDays`/`parseWorkHourBuckets` 파싱
  결과가 0건인 공고를 제외하는 진짜 필터(`excludeUnspecifiedDays`/
  `excludeUnspecifiedHours` state, activeFilterCount·초기화 버튼에도 포함).

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
- 패널 레이아웃 재구성 후 재확인: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과(회귀 없음). 로컬 브라우저(데스크톱+375px
  모바일)로 라벨 왼쪽/굵게, "Chọn từ danh sách"↔"Chọn thủ công" 전환(요일
  칩↔개별 요일, 시간 프리셋↔시작/종료 드롭다운) 전부 정상 렌더 확인,
  콘솔 에러 없음(무관한 404 2건은 기존부터 있던 것).
- **수정판(흐림 처리 + 협의 제외) 재확인**: `npx tsc --noEmit` 클린,
  `npm run build` 성공, `npm test` 6/6 파일 통과. 브라우저로 "Chọn từ danh
  sách"/"Chọn thủ công" 전환 시 비활성 그룹이 숨겨지지 않고 흐려지기만
  하는 것 확인(`get_page_text`로 두 그룹 텍스트가 항상 같이 나오는 것
  확인), "Loại trừ tin chưa rõ..." 체크박스 렌더 확인.

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

1. **이번 레이아웃 재구성분 commit + master push + Vercel Production
   배포**(FAST/NORMAL 흐름대로 진행 — 2026-09-18 사용자 지시 유효).
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
