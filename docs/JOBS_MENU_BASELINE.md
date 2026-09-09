# Việc làm 메뉴 기준 (Jobs Menu Baseline)

이 문서는 알바몬 벤치마킹으로 승인된 `Việc làm` 6개 메뉴(전체/저장/최근본/맞춤/추천/급구)의
구현 상태, 저장·필터·추천 기준, 알려진 한계를 기록한다. 크롤러 기준 문서
(`CRAWLER_BASELINE.md`, `WORK_STATUS.md`)와는 무관하며 그 문서들은 변경하지 않았다.

추석·시즌 알바(Tết/Trung Thu 등 계절성 채용) 관련 기능은 이번 범위에서 의도적으로
제외했다 — 어떤 메뉴에도 계절성 근무기간 옵션이나 전용 목록을 추가하지 않았다.

---

## 1. 메뉴별 구현 상태

| # | 메뉴 | 경로 | 상태 | 파일 |
|---|---|---|---|---|
| 1 | 전체 공고 (Tất cả việc làm) | `/` | 기존 구현 재사용 (변경 없음) | [`src/pages/Home.tsx`](../src/pages/Home.tsx) |
| 2 | 저장한 공고 (Việc làm đã lưu) | `/viec-lam/da-luu` | 신규 | [`src/pages/jobsMenu/SavedJobsPage.tsx`](../src/pages/jobsMenu/SavedJobsPage.tsx) |
| 3 | 최근 본 공고 (Việc làm đã xem) | `/viec-lam/da-xem` | 신규 | [`src/pages/jobsMenu/RecentlyViewedPage.tsx`](../src/pages/jobsMenu/RecentlyViewedPage.tsx) |
| 4 | 맞춤 공고 (Việc làm phù hợp) | `/viec-lam/phu-hop` | 기존 죽은 코드 부활 + 조건 확장 | [`src/pages/jobsMenu/MatchedJobsPage.tsx`](../src/pages/jobsMenu/MatchedJobsPage.tsx), [`src/components/RecommendSection.tsx`](../src/components/RecommendSection.tsx) |
| 5 | 추천 공고 (Gợi ý việc làm) | `/viec-lam/goi-y` | 신규 | [`src/pages/jobsMenu/SuggestedJobsPage.tsx`](../src/pages/jobsMenu/SuggestedJobsPage.tsx) |
| 6 | 급구 공고 (Tuyển gấp) | `/viec-lam/tuyen-gap` | 신규 | [`src/pages/jobsMenu/UrgentJobsPage.tsx`](../src/pages/jobsMenu/UrgentJobsPage.tsx) |

메뉴 링크는 [`src/components/Layout.tsx`](../src/components/Layout.tsx)의 `MENU_ITEMS`
"Việc làm" 드롭다운에 있다 — 기존 "Phổ biến" 열에 급구 링크를 새 페이지로 갱신하고,
"Việc làm của tôi" 열을 새로 추가했다. 별도 모바일 전용 메뉴 컴포넌트는 이 저장소에
존재하지 않으며(단일 `header-tabs__nav`가 CSS 미디어쿼리로만 반응형 처리), 새 링크도
동일한 구조를 그대로 쓴다.

**모바일 드롭다운 클리핑 결함(2026-09-09 실제 발견·수정)**: 최초 구현 때는
"데스크톱과 같은 코드"라는 이유로 실제 터치 상호작용을 검증하지 않고 넘어갔는데,
이후 실제 검증 과정에서 결함이 확인됐다 — 모바일(`@media max-width:640px`)에서
`.header-tabs__nav`에 가로 스크롤용 `overflow-x:auto`가 걸려 있고, CSS 스펙상
한쪽 축이 `auto`/`hidden`이면 다른 쪽(`visible`)도 `auto`로 강제되므로, 그 안에서
`position:absolute`로 뜨는 `.mega-menu` 드롭다운이 세로로 잘려 사실상 보이지
않았다(6개 신규 메뉴를 포함한 모든 드롭다운 항목에 영향). 근본 원인 수정: 모바일
에서만 `createPortal`로 드롭다운을 `document.body`로 옮겨 nav의 overflow 클리핑
밖에서 고정폭 패널(`.mega-menu--mobile`)로 띄운다(`Layout.tsx`, `index.css`) —
데스크톱은 기존 `position:absolute` 그대로 유지(포탈 미사용). 동시에, 모바일에서는
`onMouseEnter`/`onMouseLeave` 기반 120ms 자동 닫힘 타이머도 비활성화했다(터치에는
hover 개념이 없어 불필요하고, 자동화 검증 중 열자마자 닫히는 것처럼 보이는 원인이
될 수 있었음) — 클릭(탭) 기반 열기/닫기만 사용. 검증 방법·결과는 §10 참고.

라우트는 `App.tsx`에서 `/viec-lam/:id`(JobDetail) **앞에** 정적 경로로 등록했다 —
React Router v6가 정적 세그먼트를 동적 파라미터보다 우선 매칭하므로 충돌 없음
(실제 공고 id는 항상 `sb-<숫자>` 형식이라 실질적 충돌 가능성도 없음).

---

## 2. 저장한 공고 — 계정 분리 기준

- 저장 데이터는 여전히 `localStorage` 기반이다(새 DB 테이블 없음, 승인 불필요 범위로 진행).
- `src/lib/storage.ts`의 `loadSavedJobIds`/`toggleSavedJobId`/`isJobSaved`가 이제
  `scope?: string` 인자를 받는다 — 로그인 사용자는 `user.id`를 scope로 넘겨
  `vgb_saved_job_ids:<uid>` 키를 쓰고, 비로그인(게스트)은 기존 전역 키
  `vgb_saved_job_ids`를 그대로 쓴다(하위호환 — 기존 게스트 저장 데이터 보존).
- 검증: 브라우저 콘솔에서 `storage.toggleSavedJobId('sb-4369','user-a')`/
  `storage.toggleSavedJobId('sb-4392','user-b')` 실행 후 각각
  `vgb_saved_job_ids:user-a`/`vgb_saved_job_ids:user-b`로 완전히 분리 저장됨을 확인 —
  서로 다른 계정 저장 목록이 섞이지 않는다.
- **한계(사실 그대로 안내)**: 기기 간 동기화는 지원하지 않는다 — 계정 서버 동기화가
  아니라 "이 브라우저에서 로그인한 계정" 범위로만 분리된 localStorage다. 게스트로
  저장한 항목은 로그인 후에도 자동으로 이전되지 않는다(별도 scope). `SavedJobsPage`
  화면에도 이 사실을 그대로 안내 문구로 표시한다.
- 모집 중/마감 구분: `job.applicationDeadline`을 오늘 날짜와 비교해 "Đang tuyển"/
  "Đã hết hạn" 두 섹션으로 나눈다. `useJobs()` 목록에 없는 저장 id(공고가 내려갔거나
  비활성화된 경우)는 "Không còn tồn tại" 섹션에 별도 표시하고 저장 해제만 가능하다
  (상세 재구현 없음).

## 3. 최근 본 공고 — 저장 범위 기준

- 신규 `src/lib/viewHistoryStorage.ts` — `vgb_view_history` localStorage 키, 계정
  scope 없이 **이 브라우저에만** 보관(요구사항이 "이 브라우저에 보관"이라 명시했으므로
  계정 분리하지 않음).
- 최대 100건, 30일 경과분은 읽을 때마다 자동 제외. 동일 공고 재조회 시 기존 항목을
  지우고 맨 앞으로 옮겨 중복을 제거한다.
- 기록 시점: `src/pages/JobDetail.tsx`가 공고를 실제로 로드했을 때만
  `recordJobView(job.id)`를 호출한다(목록 카드 노출만으로는 기록하지 않음).
- 검증: `sb-4369` 상세페이지 방문 후 `localStorage.vgb_view_history`에 해당 id·시각이
  기록되고, `/viec-lam/da-xem`에 즉시 반영됨을 확인.

## 4. 맞춤 공고 — 조건·판정 기준

- `src/lib/recommendStorage.ts`(기존, 이번에 비로소 실제 화면에 연결됨) +
  `src/components/RecommendSection.tsx`를 그대로 재사용한다 — 새로 만들지 않았다.
- 조건: 희망 지역(`regionId`), 최소 시급, 근무 시간대(아침/오후/저녁/주말/유연),
  **근무 요일**(신규: `workDays` — 평일/주말/무관), **근무 기간**(신규: `workPeriod`
  — 장기/단기/무관), 업종.
- **판별 불가 데이터는 일치로 간주하지 않음**: `detectWorkDaysCategory()`/
  `detectWorkPeriodCategory()`는 `job.workDays`/`job.workPeriod` 자유 텍스트에서
  명확한 키워드가 없으면 `undefined`를 반환하고, 이 경우 점수에 가산하지 않는다
  (거짓 일치를 만들지 않음 — 조건을 설정 안 했을 때만 baseline 점수를 준다).
- **지역 밖 공고를 점수로 섞지 않음**: `matchJobs()`는 `regionId`가 설정되면 다른
  조건 점수와 무관하게 그 지역과 매칭되지 않는 공고를 결과에서 아예 제외하는
  하드 필터를 먼저 적용한다(이전에는 지역 불일치가 감점만 되고 다른 점수가 높으면
  결과에 섞일 수 있었음 — 이번에 수정).
- 가중치: 지역 30 · 급여 25 · 시간대 15 · 업종 10 · 근무요일 10 · 근무기간 10
  (합 100, 임계값 60→그대로 40 유지 — `score >= 40`).
- 조건은 `localStorage`(`vgb_recommend_prefs`)에 저장되어 재사용·수정·초기화 가능
  (기존 UI 그대로). 결과 없음 안내도 기존 UI 그대로 재사용.
- 검증: 브라우저에서 지역=TP.HCM · 근무요일=평일로 설정 후 저장 → 결과 전부
  "Đúng khu vực"/"Ngày thường (T2–T6)" 이유 칩과 함께 TP.HCM/인근 지역 공고만
  표시됨을 확인(119건).

## 5. 추천 공고 — 근거·안내 기준

- "맞춤 공고"(사용자가 직접 설정)와 별개로, **실제 활동 신호**만 근거로 쓴다:
  저장했거나 지원한 공고들의 업종 빈도(`preferredCategories`), 그리고 맞춤 공고에서
  이미 설정한 지역(있을 때만).
- 급여 추정이나 확인되지 않은 조건으로 "일치"를 만들지 않는다 — 이유 칩은
  `Ngành quan tâm: <실제 업종>`, `Trong khu vực bạn đã chọn ở Việc làm phù hợp: <실제 지역>`
  두 가지뿐이며 둘 다 사용자가 실제로 남긴 데이터에서만 나온다.
- 맞춤 공고와 동일하게, 지역 조건이 있으면 그 지역 밖 공고는 결과에서 제외한다
  (다른 근거 점수가 높다는 이유로 섞지 않음).
- 활동(저장/지원)도 없고 맞춤 공고 지역 설정도 없으면(`hasSignal === false`) 일반
  목록을 대신 보여주지 않고 "저장/지원하거나 맞춤 공고 조건을 설정하라"는 안내와
  링크만 표시한다.
- 명칭에 "AI"라는 단어를 쓰지 않았다(제목 "Gợi ý việc làm", 리드 문구 모두 확인).
- 검증: 맞춤 공고에서 지역=TP.HCM 저장 직후 이동 시 "Trong khu vực bạn đã chọn..."
  이유 칩과 함께 TP.HCM/인근 공고 30건까지 표시됨을 확인. 저장/지원/지역설정이
  전혀 없는 상태에서는 안내 화면만 표시됨(별도 세션에서 확인).

## 6. 급구 공고 — urgent 기준

- `local_jobs.urgent` 컬럼값만 신뢰한다. `src/lib/jobUtils.ts`의
  `ensureJobFields()`는 `urgent: j.urgent ?? inferredUrgent`로 **이미 boolean 값이
  들어온 뒤에는(?? 연산자)** 제목 키워드("gấp" 등) 추론이 적용되지 않는다 —
  `jobRows.ts`가 DB 값을 항상 `(r.urgent as boolean) ?? false`로 boolean 확정해
  넘기므로, 실질적으로 이 페이지는 DB의 명시적 `urgent=true`만 급구로 판정한다
  (제목의 모호한 단어로 기존 공고를 임의 급구 전환하지 않음 — 기존 로직 변경 없이
  현재 동작을 그대로 문서화).
- 지역은 버튼 목록(`JOB_REGIONS`)에서 수동 선택만 제공한다 — `navigator.geolocation`을
  호출하지 않는다(위치 권한 강제 없음). 선택은 `?region=` 쿼리에도 반영되어
  새로고침/공유해도 유지된다.
- **"모집 중"인 급구만 표시(2026-09-09 실제 발견·수정)**: 최초 구현은 `job.urgent`
  값만 보고 마감일은 확인하지 않아, 지원 마감일이 이미 지난 급구 공고도 목록에
  섞여 나오는 결함이 있었다(로컬 테스트 데이터로 재현·확인, 아래 §10). 수정 후
  `urgentJobs = jobs.filter(j => j.urgent && (!j.applicationDeadline ||
  j.applicationDeadline >= 오늘날짜))`로 마감된 급구는 제외한다(마감일 없음 =
  상시모집으로 간주해 포함 — `SavedJobsPage`의 모집중/마감 판정과 동일 기준).
- 검증(운영 데이터 기준): 현재 운영 DB에는 `urgent=true` 공고가 0건이라 이 메뉴와
  기존 Home의 `?urgent=1` 필터 둘 다 "0건" 결과를 보여준다 — 동일하게 비어 있음을
  교차 확인해 이 페이지의 필터 로직 자체가 문제가 아님을 검증했다(데이터 상태
  문제). 실제 로직(급구만/마감제외/지역필터) 검증은 로컬 테스트 데이터로 진행했다
  — §10 참고.

## 7. 내 주변 — 기준 위치·반경 표시/변경 (기존 기능 개선)

- 기존 `내 주변`/지역별·업종별 메뉴는 유지했다(요구사항). `MapView.tsx`(`/ban-do`)는
  이미 반경(1/3/5/10km) 버튼과 위치 확보 여부 안내가 있어 변경하지 않았다.
- `Home.tsx`의 "Gần bạn" 빠른 필터는 기존에 반경이 5km로 고정돼 있고 UI가 없었다 —
  이번에 `nearRadius`를 실제 `useState` 세터로 바꾸고, near-me 활성 시
  "📍 Vị trí hiện tại của bạn · Bán kính Xkm"와 1/3/5/10km 변경 버튼, "Cập nhật vị trí"
  재확인 버튼을 추가했다(`.near-me-controls*` CSS, `src/index.css`).
- 거리 계산은 기존 검증 기준(`resolveDistanceSearchPoint()`, `docs/CRAWLER_BASELINE.md`
  §7)을 그대로 재사용한다 — 지역 대표 좌표나 미검증 좌표를 거리검색에 새로 넣지
  않았다(코드 변경 없음, 기존 함수 그대로 호출).

## 8. 변경/미변경 범위 확인

- 변경(1차): `src/lib/storage.ts`, `src/lib/recommendStorage.ts`,
  `src/components/RecommendSection.tsx`, `src/pages/JobDetail.tsx`(조회 기록 +
  scope 반영), `src/pages/Home.tsx`(near-me 반경 UI + scope 반영),
  `src/pages/Profile.tsx`(scope 반영), `src/components/Layout.tsx`(메뉴 링크),
  `src/App.tsx`(라우트), `src/index.css`(신규 클래스 추가만, 기존 규칙 미변경).
- 신규(1차): `src/lib/viewHistoryStorage.ts`, `src/pages/jobsMenu/*.tsx` 5개.
- 변경(2차, 2026-09-09 미검증 3항목 마무리 — §10): `src/components/Layout.tsx`
  (모바일 드롭다운 포탈 렌더링 결함 수정), `src/index.css`(`.mega-menu--mobile`
  클래스 추가), `src/pages/jobsMenu/UrgentJobsPage.tsx`(마감된 급구 제외 필터
  추가), `src/context/NotificationContext.tsx`(저장 목록 계정 scope 누락 수정 —
  1차 작업에서 `loadSavedJobIds()`를 이 파일 한 곳에서 scope 없이 호출하던 것을
  이번 검증 중 발견해 수정, 아래 §10-2 참고).
- 미변경(요구사항대로 유지): 로고·배너·메인 디자인, 한국 공고 기능
  (`KoreaHome`/`KoreaJobs`/`KoreaJobDetail`), 크롤러/지오코딩 코드
  (`crawler/`, `src/lib/jobCoords.ts`의 거리검색 함수 자체), 알바몬 관련 계정/설정,
  운영 Supabase DB(스키마·데이터 전부 변경 없음 — §10 검증은 전부 로컬 브라우저
  메모리 상태 조작으로 진행, 네트워크 요청·DB 쓰기 없음).

## 9. 테스트/검증 결과 (1차, 2026-09-09 초기 구현)

- `npx tsc --noEmit` 통과, `npm run build` 통과(오류 없음).
- 브라우저(Vite dev, `localhost:5173`) 실검증: 6개 메뉴 전부 직접 URL 접근으로
  정상 렌더, 빈/비어있지 않은 상태, 게스트 안내 문구, 모바일 375×812 스크린샷
  레이아웃 확인. 상세는 git 이력 참고 — 이번 갱신(§10)이 그중 3개 항목(모바일
  메뉴 실제 상호작용, 계정 전환 시 분리, 급구·지역 필터)을 실제로 재현·수정했으므로
  이 섹션의 해당 결론은 §10으로 대체된다.

## 10. 후속 검증 — 미검증 3항목 마무리 (2026-09-09)

1차 구현 보고에서 "코드 경로상 안전"으로만 판단하고 실제로 재현하지 않았던 3가지를
이번에 실제로 검증했다. 운영 DB는 전혀 건드리지 않았다 — 아래 각 항목에 실제 검증
방법을 정확히 구분해 기록한다.

### 10-1. 모바일 메뉴 — 결함 발견·수정 (통과)

- **결함**: §1에 기록한 `.header-tabs__nav`의 `overflow-x:auto` → `overflow-y`
  강제 `auto` → 절대위치 `.mega-menu` 드롭다운 세로 클리핑. 실제로 모바일
  375×812 뷰포트에서 재현됨(드롭다운 DOM은 생성되지만 화면에 실질적으로
  보이지 않음).
- **수정**: `Layout.tsx`에서 모바일에서만 `createPortal`로 `document.body`에
  드롭다운을 렌더링, `.mega-menu--mobile`(고정폭 패널, `position:fixed`)로
  표시. `onMouseEnter`/`onMouseLeave` 기반 자동 닫힘 타이머도 모바일에서는
  비활성화(클릭만 사용).
- **검증 방법**: `mcp__Claude_Browser__computer`(OS 레벨 클릭 시뮬레이션)는
  이 세션 내내 "Browser pane is currently hidden"으로 반복 실패했다 —
  이는 클라이언트 UI가 Browser 패널을 보여주지 않는 상태에서 OS 레벨 입력을
  보낼 수 없는 자동화 환경 제약이며, 앱 결함이 아니다. 대신
  `element.dispatchEvent(new MouseEvent('click', {bubbles:true}))`로 실제
  렌더링된 모바일 DOM의 버튼에 진짜 클릭 이벤트를 발생시켜(React의 `onClick`이
  받는 것과 동일한 네이티브 이벤트) 열기→대기→선택→이동 전 과정을 검증했다 —
  실제 터치가 아니라 이 방식으로 검증했음을 명확히 구분해 기록한다.
- **결과**:
  - `Việc làm` 탭 클릭 → `.mega-menu--mobile` 생성, `rect`가 뷰포트 안(375×812)에
    완전히 들어옴(클리핑 없음, `top:165.6 left:12 width:351 height:471.6`) 확인.
  - 드롭다운 안에 6개 신규 메뉴 링크(`Việc làm đã lưu/đã xem/phù hợp`,
    `Gợi ý việc làm`, `Tuyển gấp` 포함) 전부 존재 확인.
  - 연 뒤 1.5초 대기(사람이 고민하는 시간 시뮬레이션) → 메뉴가 스스로 닫히지
    않고 그대로 열려 있음 확인(자동 닫힘 결함 재발 없음).
  - "Việc làm đã lưu/đã xem/phù hợp/Gợi ý việc làm/Tuyển gấp" 5개 링크 각각
    클릭 → `location.pathname`이 해당 경로로 정확히 이동, 메뉴는 선택 즉시
    닫힘을 전부 확인.
  - 메뉴 바깥(본문) 탭 → 메뉴가 정상적으로 닫힘(외부 클릭 처리 유지) 확인.

### 10-2. 계정 전환 시 저장 목록 분리 (통과 — 실제 화면·실제 저장 버튼까지 확인, 2026-09-09 재검증으로 격상)

- **실제 로그인 계정 미사용 이유**: 이 저장소의 dev 서버가 접속하는 Supabase는
  `edhuesdnuxlbcfephutq` 프로젝트 하나뿐이며(`src/lib/supabase.ts`에 URL/키가
  하드코딩, 별도 dev/test 프로젝트 분리 없음) — 이는 `CHATGPT_HANDOFF.md`에
  기록된 "운영 Supabase"와 동일 프로젝트다. 지시대로 운영 계정을 생성하지
  않았다.
- **모의 전환 방법(강화)**: 처음엔 `storage.ts` 함수만 직접 호출해 데이터
  계층만 검증했으나, 재요청에 따라 **실제 `AuthContext`의 `user` 상태 자체를
  모의 전환**해 실제 화면·실제 버튼까지 검증했다 — React Fiber에서
  `AuthProvider`의 `useState` 디스패처(`setUser`)를 직접 찾아
  `window.__authSetUser(...)`로 노출시키고, 이 함수로 `user` 값을 바꿔
  `useAuth()`를 쓰는 모든 실제 컴포넌트가 진짜로 재렌더링되게 했다(Supabase
  네트워크 요청·세션·계정 생성 전혀 없음 — 순수 클라이언트 메모리 상태만
  바뀜, 새로고침하면 사라짐).
- **검증 절차와 결과(전부 실제 페이지 렌더링 + 실제 버튼 클릭 이벤트)**:
  1. **게스트**로 `sb-4369` 상세페이지의 실제 저장 버튼(`.jd2-save-btn`,
     "Lưu tin") 클릭 → 버튼 상태 "Bỏ lưu"로 전환 → 실제 `/viec-lam/da-luu`
     화면에 "Công Nhân May – Đi Làm Ngay" 1건 표시, 게스트 안내 문구 확인.
  2. **A로 로그인 모의 전환** → 같은 세션에서 즉시 저장한 공고 화면이
     "Chưa có tin nào được lưu"(빈 목록)로 재렌더링 — 게스트의 저장 흔적이
     전혀 남지 않음, 안내 문구도 로그인 버전으로 바뀜을 확인.
  3. A로 `sb-4386` 상세페이지에서 실제 저장 버튼 클릭 → 저장한 공고 화면에
     "Nhân Viên Bếp - Nam - ..." 1건만 표시(게스트의 공고는 안 보임).
  4. **A 로그아웃 모의 전환**(같은 화면 유지) → 화면이 다시 게스트의
     "Công Nhân May" 1건으로 정확히 복귀, A가 저장한 공고는 전혀 안 보임.
  5. **B로 로그인 모의 전환** → 저장한 공고 화면이 다시 빈 목록(게스트/A
     흔적 없음) → `sb-4392` 상세페이지에서 실제 저장 버튼 클릭 → 저장한 공고
     화면에 "Nhân Viên Sale Điều Hành Tour..." 1건만 표시.
  6. **저장 해제(unsave)도 실제 화면에서 검증**: 저장한 공고 화면의 실제
     "✕"(저장 해제) 버튼을 B로 클릭 → 화면이 즉시 "Chưa có tin nào được lưu"로
     바뀜(B만 비워짐).
  7. **최종 교차 확인**: A로 다시 전환 → 화면에 "Nhân Viên Bếp..." 그대로 남아
     있음(B의 저장/해제로 전혀 영향받지 않음). 게스트로 다시 전환 → "Công Nhân
     May" 그대로 남아 있음. `localStorage` 직접 조회로도 최종 상태 교차
     확인: `guest=["sb-4369"]`, `A=["sb-4386"]`, `B=[]`(해제됨) — 화면에서
     본 결과와 정확히 일치.
  - 결론: 계정 전환 시 이전 사용자의 저장 목록·저장 표시가 화면에 전혀 남지
    않고, 저장·해제 모두 전환 시점의 현재 사용자에게만 적용됨을 **실제
    페이지 렌더링과 실제 버튼 클릭으로** 확인했다. 이번 검증에서는 결함이
    발견되지 않았다(코드 수정 없음).
  - 테스트 후 `localStorage`의 테스트 키(`vgb_saved_job_ids`, `:mock-user-A`,
    `:mock-user-B`) 전부 삭제해 정리함.
- **실제 로그인 UI와의 구분(명확화)**: 위 검증은 `AuthContext`의 `user` 값을
  React 상태 레벨에서 직접 바꾼 것이며, 로그인 폼에 이메일/비밀번호를
  입력하고 제출하는 실제 로그인 절차(Supabase Auth 이메일/비밀번호 검증,
  세션 발급) 자체는 거치지 않았다 — "저장 목록이 계정별로 올바르게
  분리·재렌더링되는가"라는 이번 검증 대상에는 `user` 값이 실제 로그인에서
  왔는지 모의 전환에서 왔는지가 무관하다(두 경우 모두 동일한 `useAuth()` →
  컴포넌트 재렌더링 경로를 탄다). 다만 이메일/비밀번호 로그인 폼 자체의 동작
  (오류 처리, 세션 발급 등)은 이번 검증 범위가 아니다.
- **1차 검증에서 발견·수정한 결함(유지)**: `src/context/
  NotificationContext.tsx:50`이 `loadSavedJobIds()`를 scope 없이 호출하던
  것을 이전 라운드에서 발견·수정 완료(§8 참고) — 이번 재검증에서도 회귀
  없음을 위 시나리오 전체가 정상 동작하는 것으로 간접 확인.

### 10-3. 급구 목록과 지역 필터 (통과 — 결함 발견·수정)

- **로컬 테스트 데이터 준비 방법**: 운영 DB를 전혀 조회/변경하지 않기 위해,
  React의 `JobsProvider`가 내부적으로 쓰는 `useState`의 dispatch 함수를 DOM에
  남는 React Fiber 참조를 통해 직접 찾아(devtools 확장 불필요) `setJobs([...])`
  로 순수 로컬 배열을 주입했다 — 네트워크 요청 자체가 발생하지 않는다(Supabase
  REST 호출 없음). 준비한 4건:
  - `sb-90001` 하노이(Hà Nội) · urgent=true · 마감일 내일(모집 중)
  - `sb-90002` 호치민(TP. Hồ Chí Minh) · urgent=true · 마감일 내일(모집 중)
  - `sb-90003` 하노이 · urgent=**false**(일반 공고)
  - `sb-90004` 하노이 · urgent=true · 마감일 어제(**마감된 급구**)
- **수정 전 재현된 결함**: `/viec-lam/tuyen-gap`(전체 지역)에서 "3 việc làm tuyển
  gấp"로 `sb-90004`(마감된 급구)까지 포함해 표시됨 — "모집 중인 급구만" 요구사항
  위반. `sb-90003`(일반 공고)은 정상적으로 제외돼 urgent 필터 자체는 문제없었음.
- **수정**: `UrgentJobsPage.tsx`에 마감일 비교 필터 추가(§6). 수정 후 재확인 —
  "2 việc làm tuyển gấp"로 `sb-90001`/`sb-90002`만 표시, `sb-90004` 정상 제외.
- **지역 필터 검증**(버튼을 실제 클릭 이벤트로 조작, URL 쿼리까지 함께 확인):

  | 선택 | 결과 건수 | 표시된 공고 | URL |
  |---|---|---|---|
  | Hà Nội | 1 | `sb-90001`만 | `?region=hanoi` |
  | TP. Hồ Chí Minh | 1 | `sb-90002`만 | `?region=hcm` |
  | Đà Nẵng(매칭 0건 지역) | 0 | 없음, "Chưa có việc làm tuyển gấp tại khu vực này." 안내 정상 표시 | `?region=danang` |
  | Tất cả khu vực(초기화) | 2 | `sb-90001`+`sb-90002` | 쿼리 제거됨 |

  지역 변경·초기화(전체 보기로 복귀)·결과 없음 상태 전부 정상 동작 확인.
- **운영 데이터 기준 결과(참고, §6에도 기록)**: 현재 운영 DB는 `urgent=true`
  공고가 0건이라 이 페이지는 평소 빈 상태로 보인다 — 위 로컬 테스트로 로직
  자체(급구만/마감제외/지역필터)가 정상임을 별도로 검증했다.
- 테스트 후 페이지를 벗어나면(혹은 새로고침 시) 주입한 로컬 데이터는 사라지고
  다음 로드부터 다시 실제 운영 데이터를 정상적으로 가져온다 — 어떤 상태도
  영구 반영되지 않았다.

### 10-4. 남은 제한

- 모바일 메뉴는 실제 `computer` 툴 기반 OS 레벨 터치 시뮬레이션으로는 검증하지
  못했다(자동화 환경의 Browser 패널 가시성 제약) — DOM 클릭 이벤트 디스패치로
  대체 검증. 실제 물리 기기(iOS Safari/Android Chrome)에서의 최종 확인은 아직
  없음.
- 계정 전환 분리는 실제 저장한 공고 화면·실제 저장/해제 버튼까지 포함해
  검증했지만(§10-2 재검증), `AuthContext`의 `user` 상태를 React 레벨에서
  직접 모의 전환한 것이며 이메일/비밀번호 로그인 폼 자체(Supabase Auth 실제
  인증·세션 발급)를 통한 진입은 운영 계정 생성 금지 지시에 따라 수행하지
  않았다 — 로그인 폼 자체의 동작은 이번 검증 범위 밖.
- 급구·지역 필터는 로컬 주입 데이터로 로직을 확인했고, 운영 DB에 실제
  `urgent=true`이면서 마감된 공고가 유입된 뒤의 재확인은 하지 않았다(현재
  운영 데이터에 그런 사례가 없음).
