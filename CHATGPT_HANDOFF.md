# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**집 PC 이어서 진행(2026-09-20, `ed5ef50`→`7eeb667`, commit/push/Production
배포 완료 + RLS 보안 수정 1건)**:
1. 신규 대분류 5개(cntt_ky_thuat/thiet_ke/truyen_thong/y_te_dieu_duong/
   giao_duc_giang_day) 전용 Unsplash 이미지 추가(`categoryVisuals.ts`) —
   전부 URL 실제 로드 확인 후 반영. `JobCard.tsx`의 폴백 카테고리가 폐기된
   `'other'`를 참조하던 죽은 코드도 같이 `'khac'`으로 수정.
2. **`applications_insert` RLS tautology 보안 수정(운영 DB 적용 완료)** —
   `l.employer_id = l.employer_id`(항상 참, 검증 무효)를
   `l.employer_id = applications.employer_id`(실제 소유 검증)로 교체.
   수정 전엔 로그인한 구직자가 API를 직접 조작해 임의의 employer_id로
   지원서를 위조해 저장할 수 있었음(데이터 무결성 문제). 마이그레이션
   [supabase/migrations/20260920043000_fix_applications_insert_employer_check.sql](supabase/migrations/20260920043000_fix_applications_insert_employer_check.sql).
   **검증**: 운영 DB에서 트랜잭션 롤백 기반 시뮬레이션(`set_config`+
   `set local role authenticated`, 끝에 `rollback`으로 흔적 없음)으로
   정상 지원(employer_id 일치) 성공·위조 지원(employer_id 불일치) 차단
   둘 다 실측 확인. Supabase MCP 쓰기 작업이 "Modify Shared Resources"로
   한 번 자동 차단됐다가 사용자 재승인 후 진행됨 — 운영 DB DDL은 항상 이
   확인 절차를 거칠 것.
3. korea_jobs 통합은 "제일 큰 안건이라 나중에"로 보류, applications_insert
   다음 순서로 categoryVisuals를 먼저 처리(사용자가 번호 순서대로 진행
   지시). **선택지 4가지를 이번에 재구성**(원본 상세는 과거 세션 문서
   스냅샷 정책으로 유실됨) — 아래 "다음 결정사항" 참고.
4. **기업 계정 헤더에 "Việc làm" 링크 추가**(`c68f235`) — 기업 로그인 시
   구직자 메뉴 전체가 사라져 급구 페이지 등에 URL 직접 입력 없이는 접근
   불가능했던 문제. 전체 메가메뉴 대신 홈("/")으로 가는 링크 1개만 추가.
   **미검증**: Claude in Chrome 연결이 이 세션에서 끊겨서 실제 기업
   계정으로 눈으로 확인은 못 함(코드는 기존 employer 전용 배열에 항목
   추가하는 동일 패턴이라 빌드/타입체크는 통과) — 다음 세션에서 실제
   기업 계정으로 한 번 확인 필요.
5. **구/현 "전체 선택" 원클릭 필터 + 지역 검색창에 구/현 이름 인덱싱**
   (`ad1b587`) — Xã/Phường 열 맨 위에 업직종 패널과 동일한 "Tất cả
   <구/현명>" 항목 추가(클릭 시 그 구/현의 동/사 전체를 selectedWards에
   합침). 지역 검색창도 성/시+동/사뿐 아니라 구/현 이름으로도 검색되게
   확장. 로컬 개발 서버에서 검색("Binh Thuy" → "Cần Thơ · Quận Bình
   Thuỷ" 클릭)과 3열 UI 직접 클릭 둘 다 "Khu vực (6)"로 정확히 반영되는
   것 실측 확인.

**추가 반영(다른 PC 세션, `f2c5da7`→`f1c5068`, commit/push/Production 배포
완료)**:
1. 급구 페이지 지역 기본값(Cần Thơ 자동 선택)을 제거 — 아무 필터도 선택 안
   한 초기 상태에서 전체 급구 공고 목록이 바로 보이도록 함. 아래 "다음
   결정사항" 10번 항목이 이걸로 해결됨(상세는 맨 아래 새 절 참고).
2. 필터 패널이 열릴 때 아래 공고 목록을 덮던 문제 수정 — 패널을
   `position:absolute`로 띄우던 방식에서 `createPortal`로 필터 줄 바로
   아래 일반 문서 흐름에 그리는 방식으로 변경, 패널이 열리면 목록이 자연
   스럽게 밀려 내려감(상세는 맨 아래 새 절 참고).
3. **성별/연령 조건 실제로 작동하게 만듦** — "발견된 문제"에 있던 "UI만
   있고 필터링 안 됨" 항목 해결. `local_jobs`에 `gender_requirement`/
   `age_requirement` 컬럼 추가(Production 적용 완료), 급구 페이지 Giới
   tính/Độ tuổi를 실제 filtered 로직에 연결, PostJob.tsx에 성별/연령
   조건 입력란 + 그동안 없던 소분류 드롭다운도 같이 추가(상세는 맨 아래
   새 절 참고).

이 커밋들을 push할 때 origin/master가 이미 15개 커밋 앞서있어(아래
job_duration 라운드 등) 일반 `git push`가 한 번 거부됨 → `git fetch` +
`git rebase origin/master`로 안전하게 합침(충돌 없음, 강제 push 안 씀) —
두 PC가 동시에 작업할 때는 세션 시작 시 `git fetch origin && git status`로
먼저 동기화 여부 확인 필요.

**이전 라운드 세션 최종 상태(여러 라운드 거쳐 완료, commit/push/Production 배포
전부 끝남 — 라운드별 상세 경위는 아래 요약만 유지, 코드가 실제 근거):**

- `job_duration`(근무기간 7구간) 컬럼 추가 + PostJob.tsx 필드 + 급구 "Thời
  gian làm việc" 패널 필터.
- "Thời gian làm việc" 패널: 라벨 왼쪽-굵게 행 레이아웃(`.jm-filter-row`),
  "근무요일"/"근무시간"에 "목록에서 선택/직접선택"(사각 버튼) 전환 — 비활성
  쪽은 숨기지 않고 흐리게(`jm-workhour-inactive`)만, 두 모드 다 항상 같이
  보임. "협의 제외"는 workDays/hours 빈 공고를 제외하는 실제 필터로 구현.
- "Điều kiện khác" 패널도 동일한 `.jm-filter-row` 레이아웃으로 통일, 알바몬
  캡처본과 같은 4행 구성: **Giới tính**(Nam/Nữ 칩, "Không giới hạn" 없음)/
  **Độ tuổi**(드롭다운)/**Loại hình công việc**(work_period, 급구 공고에
  실제 존재하는 값만 동적 — job_duration과 달리 크롤러 자유텍스트라 고정
  목록 아님, 한 번 고정 목록으로 시도했다 사용자 지시로 되돌림)/**Từ
  khóa**(Bao gồm+Loại trừ 통합). **성별/연령은 DB 컬럼이 없어 실제 필터링에
  반영 안 되는 UI만**(genderFilter/ageFilter state, activeFilterCount·
  clearAllFilters 미포함) — 알바몬과 "동일하게" 만들라는 명시적 지시로
  구조만 맞춤, 추후 실데이터 생기면 연결 필요.
- 0016 orphan draft migration 삭제(`job_duration`/`work_period`가 이미
  같은 개념 커버, 운영 DB에 한 번도 적용 안 됐던 파일).
- **Home.tsx + 맞춤공고(RecommendSection.tsx)에 소분류 필터 추가**(급구
  페이지 지역/업종 2단 구조를 다른 화면에도 확대하는 안건 중, 사용자가
  "지금 UX 유지 + 소분류만 추가"로 확정): Home은 기존 대분류만 있던(실은
  UI 자체가 없어 죽어있던 categorySelectRef까지 같이 고침) 곳에 대→소분류
  select 2단 추가 + 안 쓰던 F&B(cafe/restaurant, 구 카테고리 체계 잔재)
  특수 그룹핑 dead code 제거. RecommendSection은 categories(소프트 스코어링
  10점)에 subcategories(추가 5점) 매칭 보너스로 추가 — 지역(하드 필터)과
  달리 소프트 조건이라 URL 필터가 아니라 점수 가산. 저장한 공고/지도는
  원래 지역·업종 필터 자체가 없던 화면이라 이번 확대 범위에서 제외(사용자
  확인).

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

### "Điều kiện khác" 패널도 같은 행 레이아웃으로 통일 (세 번째 라운드)
- CSS 클래스 일반화: `.jm-workhour-row`/`__label`/`__body` → `.jm-filter-row`/
  `__label`/`__body`(sed로 전체 치환, "Thời gian làm việc"/"Điều kiện khác"
  둘 다 이제 이 클래스를 공유). `.jm-workhour-mode-toggle` 등 근무시간
  패널 전용 요소는 이름 그대로 유지(다른 패널에서 안 씀).
- "Loại hình công việc" 행: 기존 `jm-keyword-group`(라벨 위) → `jm-filter-row`
  (라벨 왼쪽) 변경, 내용물(work_period 다중선택 칩)은 그대로.
- "Chỉ hiện tin chứa từ khóa"/"Loại trừ tin chứa từ khóa" 두 개 별도
  `jm-keyword-group`을 "Từ khóa" 라는 하나의 `jm-filter-row`로 합침(알바몬
  캡처본의 "키워드" 행이 포함/제외 둘 다 한 라벨 아래 있는 구조와 동일) —
  내부에 `jm-keyword-group__label`(작은 서브라벨) "Bao gồm (n)"/"Loại trừ
  (n)"로 구분, 기존 카운트가 없던 것에 개수 표시만 추가(알바몬처럼 "0/20"
  같은 임의 상한은 만들지 않음 — 우리 쪽엔 실제 글자수 제한이 없어서).
- 더 이상 아무 데서도 안 쓰는 `.jm-keyword-group + .jm-keyword-group` CSS
  규칙(이전엔 옛 구조의 그룹 간 여백용)도 같이 제거.

### "Loại hình công việc" 고정 목록 시도 → 되돌림 (네 번째 라운드)
- job_duration과 같은 원칙(고정 목록 항상 표시)을 work_period에도 적용해봤다가,
  사용자 지적("근무기간하고 왜 동일하게 하지?")으로 되돌림 — work_period는
  크롤러 자유텍스트(닫힌 enum 아님)라 job_duration의 "우리가 정의한 닫힌
  값 집합"과 성격이 다름. 원래대로 급구 공고에 실제 존재하는 값만 동적으로
  보여주는 방식 유지(+"데이터 없음" hint 문구도 복원).

### "Điều kiện khác" Giới tính/Độ tuổi 행 추가 (다섯 번째 라운드)
- 사용자가 "상세조건 상단에 성별/연령/고용형태/키워드 이렇게 구성해달라고
  알바몬하고 동일하게 만들어달라고 캡처해서 보내줬잖아"로 명확히 지시 —
  이전엔 "DB 컬럼 없어 가짜 필터가 됨"이란 이유로 성별/연령을 제외했었는데,
  이번엔 구조를 알바몬과 동일하게 맞추라는 명시적 지시라 그대로 따름.
- **Giới tính**: "Nam"/"Nữ" 칩 버튼(`genderFilter` state, 토글).
- **Độ tuổi**: `AGE_OPTIONS`(18-24/25-34/35-44/45-54/55+ tuổi) select
  드롭다운(`ageFilter` state).
- **둘 다 local_jobs에 대응 컬럼이 없어 `filtered` 계산에는 반영 안 함** —
  UI 상태만 존재(activeFilterCount/clearAllFilters에도 미포함, "Điều kiện
  khác" 패널 초기화 버튼에서만 같이 리셋). 나중에 성별/연령 데이터가 생기면
  실제 필터로 연결 필요.

### 지역 기본값 제거 — 무필터 상태에서 전체 목록 표시 (`f2c5da7`)
[UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)의 `selectedProvince`
초기값을 `VN_PROVINCES[0]`(Cần Thơ)에서 다시 `null`로. 배경: 이전 라운드에서
Khu vực 패널을 기본으로 열어두는 수정(`openPanel` 초기값 `'region'`)을
했었는데, 그것과 "Cần Thơ 자동 선택" 로직이 같이 있으면 처음 들어왔을 때
패널은 열려있지만 그 뒤의 목록은 계속 0건으로 보이는 상태였다. 사용자가
캡처본 2장(우리 사이트의 빈 목록 vs 알바몬의 실제 목록)을 비교해서 "아무것도
선택하지 않아도 기본테이블 보이게 해줘"로 명확히 지시 — 지역을 아예 선택 안
한 무필터 상태를 기본값으로 되돌려 전체 급구 공고가 바로 보이게 했다.
(참고: 이 지시 전에 사용자가 알바몬 캡처의 "서울 전체 ✕" 칩을 보여주며
칩 바 부활을 원하는 건지 확인차 되물었는데, 그건 아니었고 순수히 "목록이
안 보인다"는 지적이었음 — 칩 바는 이전 결정대로 계속 제거된 상태 유지.)

### 필터 패널이 공고 목록을 덮던 문제 수정 (`f1c5068`)
위 수정 후 사용자가 실제로 패널을 열어보고 "상단 클릭하면 공고가 가려지지?"
로 새 문제를 지적 — `.jm-filter-dropdown__panel`이 `position: absolute`로
떠 있어서(2026-09-17에 "필터 줄 전체 폭에 맞추려고" 도입한 방식), 패널이
열릴 때마다 그 아래 있는 공고 목록을 덮어버리고 있었다(알바몬은 패널이
열리면 목록이 밀려 내려감, 덮지 않음).

**원인**: 각 `FilterDropdown`이 자기 버튼 바로 밑에 패널을 `position:
absolute`로 렌더 — `.jm-urgent-filters`(필터 4버튼 한 줄) 안의 한 버튼
DOM 서브트리에 속해있어서, 일반 문서 흐름으로 바꾸면 그 버튼 하나만 커지고
나머지 3버튼이 옆으로 밀리는 이상한 레이아웃이 됨.

**해결**: `FilterDropdown`이 패널을 자기 자리에 직접 렌더하지 않고,
`createPortal`로 `.jm-urgent-filters` 줄 바로 다음에 있는 공유 DOM 노드
(`panelSlot`, `<div ref={setPanelSlot} className="jm-urgent-panel-slot" />`)
에 그리도록 변경 — 버튼 4개는 그대로 한 줄에 남고, 열린 패널만 그 줄 밑에
일반 블록으로 나타나 아래 내용을 자연스럽게 밀어낸다. CSS도
`position:absolute`+`left/right:0` 조합을 제거하고 `width:100%`인 평범한
블록으로 바꿈. 바깥 클릭 감지(`FilterDropdown`의 `useEffect`)도 버튼
DOM(`btnRef`)뿐 아니라 포털된 패널(`panelSlot`) 안쪽 클릭까지 "안쪽"으로
인식하도록 같이 고쳤다(안 그러면 패널 안을 클릭해도 바로 닫혀버림).

### 성별/연령 조건 실제 필터로 연결 + PostJob 소분류 추가 (`543cafa`)
사용자가 "다음 뭐하지?" 질문에 대한 답으로 남아있던 미결정 항목("Giới
tính/Độ tuổi UI는 있는데 DB 컬럼이 없어 실제 필터링 안 됨")을 골랐고, "8개
항목 중 같이 할 만한 거 있나?"에 PostJob 소분류 드롭다운(우선순위 있던
별도 미착수 항목)을 같이 묶는 걸로 확정했다.

- **DB(Production 적용 완료)**: `local_jobs`에 `gender_requirement`/
  `age_requirement` text 컬럼 추가(job_duration과 동일 패턴 — nullable,
  CHECK 제약 없음, `information_schema` 재조회로 존재 확인).
  [migration 파일](supabase/migrations/20260919030243_local_jobs_gender_age_requirement.sql).
- **[data/jobRequirements.ts](src/data/jobRequirements.ts)** 신규 —
  `AGE_REQUIREMENT_OPTIONS`(급구 필터에 있던 5구간, `UrgentJobsPage.tsx`
  로컬 상수에서 이동)/`GENDER_REQUIREMENT_OPTIONS`("Nam"/"Nữ"). PostJob.tsx
  ·UrgentJobsPage.tsx 둘 다 공유(job_duration.ts와 동일 패턴).
- **[UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)**: 지금까지
  클릭만 되고 결과에 아무 영향 없던 `genderFilter`/`ageFilter`를 `filtered`
  useMemo에 실제로 연결. **다른 필터(workPeriod/jobDuration 등)와 다르게
  설계** — 성별/연령은 "공고 자체의 성질"이 아니라 "누가 지원 가능한가"라는
  조건이라, 조건 값이 비어있는(null) 공고는 "제한 없음"을 뜻하므로 어느
  값을 선택해도 계속 보여야 한다(반대로 strict 매칭했다면 지금 이 값을
  채운 공고가 0건이라 필터를 건드리는 순간 결과가 전부 사라져버렸을 것).
  `genderFilter` 내부 타입도 `'male'|'female'`에서 DB 값과 그대로 같은
  `'Nam'|'Nữ'`로 바꿔 번역 레이어 없앰. "Điều kiện khác" 버튼 자체의 카운트
  배지(`count` prop)도 gender/age 반영하도록 같이 수정(빠뜨렸으면 배지에는
  안 뜨는데 실제로는 필터가 걸리는 어긋남이 생겼을 것 — 직접 브라우저로
  발견해서 수정).
- **[PostJob.tsx](src/pages/PostJob.tsx)**: 대분류만 있고 없던 **소분류
  드롭다운** 추가(`SUBCATEGORY_LABELS[category]` 기반, 대분류 바꾸면 초기화,
  'khac'은 소분류 규칙 자체가 없어 select 숨김) + **Giới tính/Độ tuổi
  조건 선택란** 추가. 겸사겸사 `category` 기본값이 2026-09-17에 폐기된
  구 8분류 잔재 `'other'`로 남아있던 걸 발견해 `'khac'`으로 수정(대분류를
  안 건드리고 등록하면 DB에 유효하지 않은 값이 들어가던 잠재 버그 —
  `as JobCategory` 타입 단언 때문에 tsc가 못 잡고 있었음).
- 크롤러 소스는 이 정보를 안 주므로(job_duration과 동일 이유) 값은 앞으로
  PostJob.tsx로 직접 등록하는 공고부터만 채워진다.

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
- **"Điều kiện khác" 레이아웃 통일 재확인**: `npx tsc --noEmit` 클린,
  `npm run build` 성공, `npm test` 6/6 파일 통과. 브라우저 900px 폭에서
  "Loại hình công việc"/"Từ khóa" 라벨이 왼쪽에 굵게, 내용은 오른쪽에
  나란히 배치되는 것 스크린샷으로 확인(480px 이하에서는 기존 미디어쿼리로
  세로 스택 — "Thời gian làm việc" 패널과 동일 반응형 규칙 공유).
- **되돌림(동적 목록) + Giới tính/Độ tuổi 추가 재확인**: `npx tsc --noEmit`
  클린, `npm run build` 성공, `npm test` 6/6 파일 통과. `get_page_text`로
  "Điều kiện khác" 패널이 Giới tính/Độ tuổi/Loại hình công việc(급구 공고
  실제 값 기준 2개, 동적)/Từ khóa 4행으로 렌더되는 것 확인.
- **지역 기본값 제거 재확인**: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과(회귀 없음, rebase로 합쳐진 job_duration
  라운드 코드까지 포함해서 재검증). 로컬+Production 둘 다 브라우저로
  `get_page_text` 확인 — 필터 버튼이 "Khu vực"(카운트 없음)로 뜨고, 패널
  닫으면 "Tổng 3 việc làm tuyển gấp"로 전체 목록이 즉시 표시됨 확인.
- **패널 오버레이 수정 재확인**: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과. 로컬 브라우저로 패널 연 상태에서 스크린샷
  → 목록이 패널 밑으로 정상 표시(가려지지 않음) 확인, 패널 안(지역 선택)
  클릭해도 안 닫히는 것 확인(Hà Nội 선택 후 "Khu vực (1)"로 정상 반영),
  바깥 클릭 시 정상적으로 닫히는 것 확인, 375px 모바일에서도 레이아웃
  정상 확인. Production 배포 후 `getBoundingClientRect()`로 실측 —
  `panelBottom: 780.9px`, `toolbarTop: 794.5px`(목록이 패널보다 아래)로
  실제 반영 확인.
- **성별/연령/소분류 확인**: `npx tsc --noEmit` 클린, `npm run build` 성공,
  `npm test` 6/6 파일 통과. Production DB `information_schema` 재조회로
  `gender_requirement`/`age_requirement` 컬럼 실제 생성 확인. 로컬+
  Production 둘 다 브라우저로 "Điều kiện khác" 패널에서 "Nam" 칩 클릭 →
  버튼 배지가 "Điều kiện khác (1)"로 반영됨을 `querySelector`로 직접 확인,
  현재 이 값을 채운 공고가 0건이라 "Tổng 3 việc làm"으로 결과가 그대로
  유지되는 것도 확인(strict 매칭이었다면 0건이 됐을 것 — null-passthrough
  로직이 의도대로 동작). PostJob.tsx는 `RequireEmployer` 라우트 가드 뒤에
  있어(로그인 필요, 테스트 계정 없음) 브라우저 직접 조작 검증은 못 했고
  `tsc`/`build` 통과로만 구조적 정합성을 확인함 — 다음에 실제 기업 계정으로
  한 번 등록해보고 소분류/성별/연령 값이 DB에 제대로 들어가는지 확인 필요.

## 발견된 문제

- **PostJob.tsx 실사용 미검증** — 로그인(`RequireEmployer`) 필요해서
  테스트 계정 없이는 브라우저로 폼 제출까지 직접 확인 못 함. 소분류/
  성별/연령 select가 화면에 잘 뜨는지, 실제 제출 시 DB에 값이 정확히
  들어가는지 기업 계정으로 한 번 실등록 테스트 필요.
- `PostJob.tsx`의 `category` 기본값이 2026-09-17에 폐기된 구 8분류 잔재
  `'other'`로 남아있던 잠재 버그 발견·수정(2026-09-19, `'khac'`으로) —
  `as JobCategory` 타입 단언 때문에 tsc가 못 잡았던 사례. 다른 파일에도
  비슷하게 타입 단언으로 숨겨진 구 타입값이 더 있을 수 있음(전수조사는
  안 함, 필요하면 별도 지시).
- 위 "주의" 참고 — `0016_local_jobs_work_duration_draft.sql`이 이번 작업
  전부터 존재했으나 아무도 적용하지 않은 orphan draft였음. 두 세션(회사/집
  PC) 사이에 이런 미적용 draft가 있었다는 걸 이번에 처음 발견 — 앞으로 새
  컬럼을 추가하기 전에는 `supabase/migrations/` 디렉토리에 관련 draft가
  이미 있는지 먼저 확인하는 습관이 필요함.
- ~~`applications_insert`의 tautology 조건~~ — 해결(2026-09-20, 위 새 절
  참고, 운영 DB RLS 정책 수정 + 트랜잭션 시뮬레이션 검증 완료).
- ~~`categoryVisuals.ts` 신규 대분류 5개 전용 이미지 없음~~ — 해결
  (2026-09-20, 위 새 절 참고). **다만 이미지 URL이 실제 로드되는 것만
  확인했고, 화면에 그 이미지가 fallback으로 뜨는 것 자체는 못 봄**(당시
  노출된 카드가 전부 자기 이미지가 있는 공고라 fallback 케이스가 화면에
  없었음) — 언젠가 이 5개 카테고리 중 이미지 없는 공고가 화면에 뜨면
  실제로 잘 보이는지 한 번 확인하면 좋음.
- **기업 계정 헤더 "Việc làm" 링크(위 새 절 4번) 실제 화면 미검증** —
  Claude in Chrome 확장이 이 세션에서 연결 끊겨서 실제 기업 계정으로
  못 봄. 코드/빌드는 정상.
- (이전부터 있던 항목, 계속 유지) korea_jobs 구조 통합 미결정(방금 "제일
  큰 안건"으로 뒤로 미룸), 기업 계정 헤더에 구직자 메뉴 링크 없음,
  `.git/hooks/post-commit` 자동 push 훅, `jobCategoryRules.ts` 제거 완료
  (DB 값이 유일한 진실 공급원), truyen_thong/y_te_dieu_duong 분류 규칙
  미검증(2026-09-20 재확인해도 여전히 실표본 0건 — 위 "다음 결정사항" 4번
  참고), PostJob.tsx에 소분류 선택 필드 없음.
- **근무기간(job_duration) 실데이터가 당장 0건**이라 급구 페이지 새 필터
  섹션은 한동안 "선택해도 결과가 안 줄어드는" 상태로 보일 수 있음 — 이건
  버그가 아니라 PostJob.tsx로 신규 등록이 쌓이길 기다려야 하는 정상 상태
  (work_period 때와 같은 논리, 사용자가 이미 승인한 방향).

## 다음 결정사항

1. ~~Giới tính/Độ tuổi 실제 데이터 연결~~ — 해결(2026-09-19). "실제로 작동
   하게 만들기"로 확정, gender_requirement/age_requirement 컬럼 추가 +
   필터 연결 완료(위 새 절 참고). 크롤러는 안 채우므로 PostJob.tsx 직접
   등록 공고에 값이 쌓이는 걸 계속 지켜볼 것.
2. ~~`0016_local_jobs_work_duration_draft.sql`~~ — 삭제 완료(2026-09-18).
   의도했던 두 개념(근무기간/고용형태)이 job_duration·work_period로 이미
   커버됨, 원본 데이터도 이 정보를 거의 안 줘서 실익 낮다고 판단.
3. ~~PostJob.tsx에 소분류 드롭다운 추가~~ — 해결(2026-09-19, 성별/연령
   작업과 같이 진행, 위 새 절 참고).
4. truyen_thong/y_te_dieu_duong 분류 규칙을 언제 실제 데이터로 재검증할지
   (2026-09-20 재확인: 현재 active category='khac' 55건 전수 재조사해도
   두 카테고리 매칭 0건, 이전과 동일 — "R&D 산업 연구직을 헬스케어로
   오분류하는지"도 같이 확인했는데 `_Y_TE_DIEU_DUONG` 정규식이 y tá/
   điều dưỡng/hộ lý 등 구체적 의료 용어만 매칭해서 오분류 없음 확인).
   **추가로 발견한 별개 이슈**: `_TRUYEN_THONG` 정규식이 quay phim/
   dựng phim/biên tập video/phóng viên/đạo diễn(촬영·편집·기자·감독) 등
   **영상 제작 용어만** 잡고 마케팅/PR/광고는 전혀 안 잡음 — 카테고리
   이름("미디어")이 암시하는 범위보다 실제 정규식 범위가 훨씬 좁음.
   마케팅/PR 관련 공고가 들어와도 이 카테고리로 못 걸러짐. 실제 표본이
   없어 지금 정규식을 넓힐 근거가 약하다고 판단해 보류했지만, 사용자가
   "미루다가 잊어버릴까봐"로 명시적으로 남겨달라고 함 — **다음에 이
   카테고리 관련 얘기 나오면 이 마케팅/PR 누락부터 먼저 확인할 것**.
5. ~~지역/업종 2단 구조 확대~~ — Home/맞춤공고에 소분류 완료(2026-09-18).
   저장한 공고/지도는 원래 지역·업종 필터가 없던 화면이라 범위에서 제외
   (필요하면 별도 지시).
6. ~~`categoryVisuals.ts`에 신규 5개 대분류 전용 이미지 추가~~ — 해결
   (2026-09-20, 위 새 절 참고).
7. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부. **2026-09-20 재구성한
   선택지**(원본 "4가지 조사"의 상세 내용은 과거 세션 문서 스냅샷 정책으로
   유실돼서 이번에 구조 사실 기반으로 다시 정리함, 사용자는 "제일 큰
   안건이라 다른 거 먼저"로 실행은 보류):
   1) 현행 유지(조회+번역+외부 링크만, 리스크 없음)
   2) 가벼운 통합(korea_jobs에도 "저장한 공고" 기능만 추가, FK 하나 추가
      정도로 리스크 낮음)
   3) 상세조건 연결(기존 `KoreaConsultModal`의 일반 상담 신청을 공고별
      리드캡처로 확장, 중간 난이도)
   4) 전체 통합(local_jobs와 스키마 합쳐 지원/메시지/면접 파이프라인 공유
      — `job_id bigint → local_jobs(id)` FK 전체 재설계 필요, STRICT 등급
      최대 리스크).
8. ~~`applications_insert`의 tautology 조건 수정~~ — 해결(2026-09-20, 위
   새 절 참고, 보안 관련 수정이라 트랜잭션 시뮬레이션으로 검증까지 완료).
9. ~~기업 계정 헤더에 "Việc làm" 링크 추가~~ — 구현·배포 완료(2026-09-20,
   위 새 절 참고). **실제 기업 계정 화면 확인은 아직 안 됨**(Claude in
   Chrome 연결 끊김) — 다음 세션에서 확인 필요.
10. ~~급구 페이지 첫 방문 시 지역 기본값이 Cần Thơ(공고 0건)인 문제~~ —
    해결(2026-09-19). "실제 공고 많은 지역으로 바꾸기" 대신 "지역 필터
    자체를 기본 미선택 상태로" 방식으로 확정 — 무필터 상태에서 전체 급구
    공고 목록이 바로 보임(위 새 절 참고).
11. ~~구/현 "전체 선택" 원클릭 필터, 지역 검색창에 구/현 이름 인덱싱~~ —
    둘 다 구현·배포 완료(2026-09-20, 위 새 절 참고).
12. `backup-home-2026-09-18-workperiod-panel` 브랜치의 근무기간 패널
    라벨/옵션 재배치 작업을 현재 코드베이스에 재적용할지 — 미결정.
