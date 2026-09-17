# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**커밋 완료(`7d24a5e`, push까지 나감 — 아래 "발견된 문제" 참고)**: Astra 조사
후속 8개 항목 전부 + "기업이 자기 공고 지원자의 제출 정보(이름·전화·CV)만
보는 기능" 구현·검증 완료.

**이번 라운드 — 아직 커밋 안 함**: 급구(Tuyển gấp) 페이지를 알바몬 급구 알바
페이지 구성으로 전면 재구성. "업종도 동일하게 근무기간도 동일하게 적용할 수
없으면 사유 보고"(사용자 지시) — **둘 다 완료**, 사유 보고할 항목 없음.
1. 지역 필터: 정확한 2단(성/시 34개→동/사) 구조, 2025-07-01 행정구역 개편
   정식 반영. 동/사도 성/시처럼 공식 전체 목록을 항상 표시하도록 이번
   라운드 안에서 한 번 더 수정(아래 C 참고).
2. 업직종 필터: 대분류(7개, 좁은 왼쪽 목록)|소분류(21개, 오른쪽 목록) 2단
   구조.
3. 근무기간 필터: 기존 자유텍스트 hình thức 선택 + 요일(7개)/시간대(4개)
   구조화 필터 + 자주 쓰는 조합 프리셋 + 주당 근무일수 필터(아래 D 참고) —
   work_days/hours 자유 문장을 실제 데이터 기준으로 파싱해서 만듦(처음엔
   불가능하다고 판단했다가 사용자 지시로 실제 데이터 확인 후 가능함을
   확인하고 구현).

**보류(미실행, 사용자 결정 필요)**:
- **korea_jobs 구조 통합** — `employer_id` 자체가 없는 순수 크롤링
  테이블이라 지원서/메시지/면접 흐름에 구조적으로 못 들어감. 선택지 4가지
  조사만 하고 실행 안 함.
- **공개 구직자 등록·인재검색(제안) 기능** — 명시적으로 범위 제외, 착수 안 함.
- **지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도 확대** —
  이번엔 급구 페이지만 적용. 나머지 화면은 여전히 예전 29개 `JOB_REGIONS`
  방식이라 화면마다 지역 필터 정밀도가 다름(사용자에게 이미 보고, 알바몬도
  페이지마다 다른 것 확인함 — 급구처럼 세분화가 중요한 페이지만 정밀,
  메인 탐색 페이지는 단순하게 가는 것도 실제 알바몬 패턴).
- `applications_insert` RLS의 `l.employer_id = l.employer_id`(자기 자신과
  비교, 항상 참) — 실질적으로 검증 기능 없음, 기존 정책이라 손 안 댐.
- PostJob.tsx(기업 직접 등록)에 소분류 로직 없음(아래 B 참고).

## 변경 내용

### A. 급구 페이지 재구성 — [UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)
알바몬 "급구 알바" 페이지 구성 참고. 패널형 필터(Khu vực/Ngành nghề/Thời
gian làm việc/Điều kiện khác) + 정렬/표시개수 툴바 + 표 형태 목록(지역/
제목+배지+기업명/급여/근무시간/등록일+원문링크/지원버튼). 알바몬에 있지만
이 앱 데이터로 실제로 못 거르는 항목(성별/연령/고용형태 — DB 컬럼 자체가
없음)은 제외 — 가짜 필터를 만들지 않음.

- **Khu vực**: `.jm-region-columns`(성/시 왼쪽 34개 전체 항상 표시 | 동/사
  오른쪽도 선택한 성/시의 **공식 전체 목록**을 항상 표시 — 아래 C 참고) —
  알바몬 스타일 2열 플레인 리스트(알약형 칩 아님).
- **Ngành nghề**: 같은 `.jm-region-columns` 틀에 `--category` 변형 추가 —
  대분류(7개, 좁은 고정폭 132px 왼쪽) | 소분류(남는 폭 전부 차지, grid로
  여러 칸 줄바꿈되는 오른쪽 — 처음엔 Khu vực와 동일한 50/50 두 칼럼으로
  만들었다가 "세부 항목칸을 넓게 구성해줘"라는 지적으로 알바몬 실제 화면
  (좁은 대분류|넓은 그리드형 소분류)에 맞춰 수정). 소분류 없는 대분류
  (`other`/Khác)는 "Khác chưa có phân loại chi tiết." 안내만 표시.
  선택 상태는 `${category}:${subId}` 복합키로 저장 — 소분류 id가
  대분류마다 겹칠 수 있어서(예: `thu_ngan`이 cafe/restaurant/retail 전부에
  있음) 복합키 없이는 다른 대분류의 동명 소분류와 섞임.
- **Thời gian làm việc**: 기존 hình thức(자유텍스트, 있는 값만 동적) +
  요일(7개 고정)/시간대(4개 고정) — 아래 D 참고, 자주 쓰는 조합 프리셋과
  주당 근무일수까지 추가해 알바몬처럼 한 화면에서 바로 조합 선택 가능.

### B. 업직종 소분류 — 크롤러/DB/프론트 전부 연결
- [classifier.py](crawler/classifier.py) — 대분류 7개 밑에 소분류 21개(키워드
  규칙 기반, 대분류 분류기와 같은 방식). 셀프 테스트 17/17.
- [subcategories.ts](src/data/subcategories.ts)(신규) — `classifier.py`의
  `SUBCATEGORY_LABELS`를 그대로 미러링한 프론트 값(21개, 값 문자 하나까지
  동일하게 유지해야 함 — 어긋나면 필터가 잘못 작동함).
- [crawl_topcv.py](crawler/crawl_topcv.py)(vieclam24h/VietnamWorks 두 경로),
  [crawl_facebook.py](crawler/crawl_facebook.py) — 앞으로 크롤링되는 공고는 자동으로
  소분류까지 채워짐.
- Migration [`20260916221446_local_jobs_subcategory.sql`](supabase/migrations/20260916221446_local_jobs_subcategory.sql)
  (Production 적용 완료) — `local_jobs.subcategory` 컬럼 추가.
- 기존 활성 공고 263건 중 **129건(49%)** 백필 완료(SQL 직접 계산).
- [types/job.ts](src/types/job.ts)/[jobRows.ts](src/lib/jobRows.ts)/[JobsContext.tsx](src/context/JobsContext.tsx) —
  `subcategory` 필드 프론트까지 연결.
- **미해결**: 기업 직접 등록 폼([PostJob.tsx](src/pages/PostJob.tsx))은 소분류 로직이
  전혀 없음 — 기업이 직접 올리는 공고는 소분류가 영원히 비어있음. 결정 필요.

### C. 베트남 2025년 행정구역 개편 정식 반영
**배경**: Geoapify(크롤러가 쓰는 지오코딩 서비스)가 2025-07-01에 폐지된
옛날 군/구 이름과 새 동/사 이름을 섞어서 반환하는 게 실측으로 확인됨(같은
시점에 크롤링해도 "Quận 8"/"Phường Long An"이 섞여 나옴) — 군/구 자체가
이제 존재하지 않는 행정단위.

**해결**: `vietnam-provinces` PyPI 패키지(통계총국 공식 자료,
`__data_version__` 2026-02-21) 도입 — 옛 이름으로 검색해도 지금 유효한
성/시(34개)·동/사로 정확히 매핑해주는 `search_from_legacy`/
`search_from_legacy_district` 기능 내장.
- [vn_provinces_lookup.py](crawler/vn_provinces_lookup.py)(신규) —
  `resolve_current_province()`/`resolve_current_wards()`. 검색어가 너무
  흔해서(예: "Tân"만 있으면 전국 100건+ 매칭) 후보가 8개 넘으면 노이즈로
  보고 버림(실제로 이 문제 발견하고 수정함). 셀프 테스트 11/11.
- Migration [`20260916231310_job_work_locations_resolved_admin.sql`](supabase/migrations/20260916231310_job_work_locations_resolved_admin.sql)
  (Production 적용 완료) — `job_work_locations.resolved_province`(text)/
  `resolved_wards`(text[]) 추가. 기존 `province`/`district`(Geoapify 원문,
  옛/새 이름 혼재)는 그대로 보존, 새 컬럼만 확정된 현재 값 담음.
- **기존 근무지 데이터 454건 중 233건 백필 완료**(province 133건, ward
  후보 202건) — 순수 로컬 계산(외부 API 호출 없음, 비용 0).
- [regeocode_work_locations.py](crawler/regeocode_work_locations.py) — 앞으로 이 스크립트가
  실행될 때마다(재지오코딩 시) resolved_province/resolved_wards 자동 계산.
- [requirements.txt](crawler/requirements.txt)에 `vietnam-provinces==2026.3.0` 추가.
- [vnProvinces.ts](src/data/vnProvinces.ts)(신규) — 성/시(1단계) 34개는 공고
  존재 여부와 무관하게 **항상 전부** 표시(2026-09-16 사용자 지시 — "공고
  없는 지역도 선택은 가능해야 하고 0건으로 보여주면 된다"). `crawler`의
  `vietnam-provinces` 패키지에서 그대로 추출해 크롤러·프론트 양쪽 값이
  어긋나지 않게 함.
- [vnWards.ts](src/data/vnWards.ts)(신규, 2026-09-17 추가) — 동/사(2단계)도
  1단계와 같은 원칙으로 바꿈. 원래는 "전국 동/사가 3,321개라 프론트에 다
  못 담는다"고 보고 실제 공고 근무지에 있는 값만 동적으로 보여줬는데,
  사용자가 "2차 지역은 왜 다 안보여?"라고 지적 — 실측해보니 Hà Nội 같은
  대도시도 급구 공고가 워낙 적고(현재 급구 3건뿐) 근무지 재지오코딩
  백필도 51%만 돼 있어서(454건 중 233건) 하나의 Phường만 나오는 등
  사실상 필터가 텅 비어 보이는 문제였음. 성/시 하나를 고르면 그 안의
  동/사만 보여주면 되므로(성/시당 평균 100개 이하) `vietnam-provinces`
  패키지에서 성/시별 전체 동/사 목록을 뽑아 정적 파일로 만듦 — 이제
  province와 동일하게 선택은 항상 가능하고, 실제 매칭되는 공고가 없으면
  0건으로 정직하게 보여줌(목록 자체를 job 데이터로 줄이지 않음). 34개 키가
  `vnProvinces.ts`와 문자 하나까지 정확히 일치하는지 스크립트로 교차
  검증함. 번들 크기: UrgentJobsPage 청크 5.87KB → 22.19KB(gzip, 지연 로드
  라우트라 초기 로드엔 영향 없음).

### D. 근무기간 요일/시간대 구조화 필터(신규)
**배경**: `local_jobs.work_days`/`hours`는 크롤러가 "FreeText"로 저장한
자유 문장(요일 배열/시작-종료 시각 같은 구조화 컬럼이 아님). 처음엔 이
변수명만 보고 "구조화 안 된 데이터라 요일/시간대별 필터는 못 만든다"고
판단했으나, 사용자 지시("하라고 하면해")로 실제 DB 샘플을 직접 확인한 결과
요일 표현은 정해진 어휘(Thứ 2~7/Chủ nhật, "đến"/"-"/"–" 범위, "nghỉ" 제외)라
규칙 기반 추출이 가능함을 확인 → 실제로 구현.

- [workScheduleParse.ts](src/lib/workScheduleParse.ts)(신규) —
  `parseWorkDays()`: 요일 어휘 정규식 + "A đến B" 범위 확장 + "nghỉ X" 근처
  요일 제외. `parseWorkHourBuckets()`: 실제 시계 시각 패턴(`8h00`, `17:30`
  등)이 있는 것만 sáng(05-11)/chiều(11-17)/tối(17-22)/đêm(22-05) 4개
  버킷으로 분류 — "8 tiếng/ngày" 같은 순수 기간 표현이나 크롤러가 잘못
  넣은 노이즈 텍스트는 시계 시각이 없으니 빈 결과(절대 추측하지 않음).
- [workScheduleParse.test.ts](src/lib/workScheduleParse.test.ts)(신규) —
  2026-09-17 실제 DB 샘플 14개 기준 테스트, 14/14 통과. 범위+추가("Thứ 2 -
  Thứ 6, thứ 7"), 부정("nghỉ ngày Chủ nhật" 제외), 5교대 나열, 순수 기간
  텍스트/노이즈 텍스트 → 빈 결과 등 실제로 까다로웠던 케이스 전부 포함.
- `UrgentJobsPage.tsx`의 "Thời gian làm việc" 패널에 Ngày làm việc(7개)/
  Khung giờ(4개) 칩 섹션 추가, `filtered` useMemo에 OR 매치 필터 클로즈 추가.
- **2026-09-17 추가("한눈에 보이게")**: 개별 요일/시간대 칩만으로는 알바몬
  실제 패널만큼 밀도가 안 나온다는 지적 — 자주 쓰는 조합 프리셋(Mỗi ngày/
  Thứ 2-Thứ 7/Thứ 2-Thứ 6/Cuối tuần, Sáng-Chiều/Chiều-Tối/Tối-Đêm/Đêm-Sáng/
  Cả ngày)을 추가. 클릭하면 기존 selectedDays/selectedTimeBuckets를 그
  조합으로 세팅하는 UI 단축키일 뿐이라 새 데이터가 필요 없음. 추가로
  "Số ngày làm việc / tuần"(주당 근무일수 1~7) 필터 신설 —
  `parseWorkDays(job.workDays).size`로 실제 파싱된 요일 개수를 계산해
  매칭하는 진짜 데이터 기반 필터(요일이 몇 개인지는 알지만 어떤 요일인지
  불명확한 공고까지 잡아낼 수 있음). 알바몬의 최상단 "근무기간(하루/1주일~
  1개월/...)" 섹션(고용 기간)은 여전히 안 만듦 — local_jobs에 고용 기간
  데이터 자체가 없음(workPeriod는 전일제/시간제 구분일 뿐).

## 테스트 결과

- `npx tsc --noEmit` / `npm run build` / `npm test`(6개 파일) 전부 통과.
- `crawler/classifier.py` 자체 실행 — 대분류 22/22, 소분류 17/17 정확.
- `crawler/vn_provinces_lookup.py` 자체 실행 — 11/11 정확.
- `crawler/test_job_quality.py` 19/19, `crawler/test_regeocode_work_locations.py`
  11/11 — 전부 회귀 없이 그대로 통과 확인.
- `src/lib/workScheduleParse.test.ts` 14/14(실제 DB 샘플 기준).
- 급구 페이지 로컬 개발 서버 실제 확인(스크린샷/텍스트 덤프로):
  - Khu vực: Hà Nội 선택 → 오른쪽에 공식 동/사 전체(134개) 스크롤 목록 표시,
    "Phường Hoàn Kiếm" 선택 시 URL 동기화 + 실제 매칭되는 공고 1건으로
    정확히 좁혀짐(DB에서 이 조합이 진짜 1건뿐인 것 SQL로 먼저 확인 후 UI
    검증).
  - Ngành nghề: "Quán cà phê" 클릭 → 오른쪽에 Pha chế/Phục vụ quán/Thu ngân
    3개 소분류 표시, "Thu ngân" 클릭 → 카운트 "Ngành nghề (2)"로 정확히
    반영, "Khác" 클릭 → "Khác chưa có phân loại chi tiết." 안내 정상 표시,
    ↻ Đặt lại 클릭 → 카테고리/소분류 전부 초기화되고 3건 전체 복원 확인.
  - Thời gian làm việc: 프리셋 버튼(Mỗi ngày/Thứ 2-Thứ 7/...,
    Sáng-Chiều/...), 주당 근무일수(1~7 ngày) 칩까지 전부 렌더링 확인.
- 소분류/지역 백필 전부 SQL로 직접 건수 재확인(129/263, 233/454).
- `vnWards.ts` 34개 성/시 키가 `vnProvinces.ts`와 정확히 일치하는지 Node
  스크립트로 교차 검증(양쪽 다 34개, 어긋나는 키 0개), 전체 3,321개 동/사
  카운트도 재확인.

## 발견된 문제

- **이전 커밋(`7d24a5e`)이 의도치 않게 push됐음** — 이 저장소에
  `.git/hooks/post-commit`이 `git push`를 자동 실행하도록 설정돼 있어서,
  "push하지 말라"는 지시에도 커밋 직후 자동 push됨. **이번 라운드도
  커밋하면 똑같이 자동 push될 것** — 커밋 전에 훅을 끌지 결정 필요.
- PostJob.tsx(기업 직접 등록)에 소분류 로직 없음(위 B 참고).
- `applications_insert`의 tautology 조건(위 "보류" 참고).
- Geoapify가 지금도 옛/새 지역명을 섞어서 반환 중 — `resolve_current_*`로
  흡수하고 있지만, 근본적으로 Geoapify/OSM 쪽 데이터가 개편을 완전히
  반영할 때까지는 계속 섞여 들어올 것(코드로 막아둔 상태 유지만 하면 됨,
  추가 조치 불필요).
- 이번 라운드 작업 중 카테고리 "소분류 없음" 안내 문구를 한 번 한국어로
  잘못 써서(`은(는) 별도 세부 분류가 없습니다`) 실제 화면 확인 중 발견,
  즉시 베트남어("chưa có phân loại chi tiết.")로 수정함 — 재발 방지 차원에서
  기록.
- `vnWards.ts` 생성 스크립트를 bash -c 안에서 실행하면서 주석 문자열 안의
  백틱(`` `vietnam-provinces` ``)이 셸 커맨드 치환으로 해석돼 주석 한 줄이
  깨짐(데이터 자체는 Python 실행 결과라 영향 없음, 주석만 손상) — 생성 직후
  파일을 다시 읽어서 발견, 수동으로 고침. 앞으로 bash -c로 백틱 포함
  텍스트를 파일에 쓸 때는 이 점 주의.
- **Khu vực/Ngành nghề 패널이 내용을 가로로 자르는 문제 발견·수정** —
  사용자가 "두번째 지역 구분란에 왜 지역이 다 안보이냐"고 지적해서 실제
  DOM을 계측해보니(getComputedStyle/getBoundingClientRect) 동/사 이름
  자체는 잘리지 않고 전체가 들어있었음(`rowText`가 풀네임). 문제는
  `.jm-filter-dropdown__panel`의 기본 폭이 트리거 버튼 폭 기준(`width: max
  (320px, 100%)`)이라 실제로 320px로 고정되는데, `.jm-region-columns`(2열
  레이아웃)는 `min-width: 420px`라서 패널보다 넓어져 가로 스크롤이 필요한
  상태였음(스크롤바가 잘 안 띄어서 마치 이름이 잘린 것처럼 보임). 지역 2열
  이 필요한 패널만 `:has(.jm-region-columns)`로 잡아 466px로 넓혀서 해결 —
  데스크톱에서 `scrollWidth === clientWidth`(가로 스크롤 완전히 사라짐)
  확인함. 다만 375px 이하 좁은 모바일에서는 420px짜리 2열 자체가 화면에 다
  안 들어가는 게 물리적 한계라 여전히 가로 스크롤 필요(별도 과제, 이번
  지적과는 무관).

## 다음 결정사항

1. **`post-commit` 훅**(자동 push) — 끌지 그대로 둘지 결정 필요.
2. 이번 라운드 변경사항(급구 페이지 지역/업종/근무기간 2단·구조화 필터
   전면 재구성) 커밋할지.
3. 지역/업종 2단 구조를 다른 화면(홈/저장한 공고/맞춤 공고/지도)에도
   확대할지.
4. PostJob.tsx에 소분류 로직 추가 방식(드롭다운 vs 자동 추정).
5. korea_jobs 통합 / 공개 구직자 검색 — 착수 여부.
6. `applications_insert`의 tautology 조건 수정 여부.
