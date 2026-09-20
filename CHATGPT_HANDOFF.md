# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**"Việc làm của tôi"(저장한 공고/최근 본 공고/맞춤 공고/추천 공고) 4개
페이지에 알바몬 스타일 표 뷰 추가 완료(2026-09-20)**. 사용자가 알바몬
"찜한 공고함" 캡처(체크박스+지역/제목/급여/근무시간/등록일 열+정렬+개수
선택+목록·그리드 전환+삭제)를 보여주며 "이렇게 표기해줘" → "여기(4개
페이지) 다 적용 가능해" → 체크박스+삭제 기능을 4곳 다 넣을지 물었을 때
"맞춤/추천 공고는 저장된 목록이 아니라 조건 계산 결과라 삭제 대상이
없다"고 설명해 저장/본 2곳에만 적용하기로 합의 → "ok 스타일은 알바몬하고
최대한 동일하게"로 확정. IMPLEMENTED → VERIFIED(로컬+Production 4페이지
전부) → MASTER PUSHED(`521b71b`) → PRODUCTION DEPLOYED → PRODUCTION
VERIFIED 전부 완료.

## 변경 내용

- [src/lib/jobsListView.ts](src/lib/jobsListView.ts) 신규 — 카드↔표 뷰
  모드(4개 페이지가 localStorage 키 하나로 공유, 한 번 고르면 어느
  페이지든 유지) + 등록일 필터(`all`/`today`/`7d`/`30d`, Home.tsx/
  UrgentJobsPage.tsx가 이미 쓰던 날짜 문자열 비교 패턴 재사용).
- [src/components/JobsTable.tsx](src/components/JobsTable.tsx) 신규 —
  [UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)가 이미 쓰고
  있던 `.jm-urgent-table*`(지역/제목+기업명/급여/근무시간/등록일 열) 표
  스타일을 그대로 재사용하는 공용 표 렌더러. 체크박스 선택(`selectable`)은
  옵션이고, 헤더 "전체선택" 체크박스는 `onToggleAll`을 넘겼을 때만 렌더
  (안 넘기면 빈 칸 — 안 그러면 동작 안 하는 체크박스가 남아 React
  `checked`-without-`onChange` 경고가 뜨는 걸 로컬 테스트로 발견해 수정).
- [src/components/JobsListToolbar.tsx](src/components/JobsListToolbar.tsx)
  신규 — "Tổng N건" 카운터, 등록일 필터, 표시 개수(20/50/100/전체),
  카드·표 전환 아이콘(lucide-react `LayoutGrid`/`List`), 선택삭제 버튼
  (옵션 — 넘길 때만 렌더). 4개 페이지가 전부 이 토글바 하나를 재사용.
- [SavedJobsPage.tsx](src/pages/jobsMenu/SavedJobsPage.tsx): 위 3개를
  적용, 구간(진행중/마감/한국/삭제된 공고)별로 표·카드 전환 + 체크박스
  선택 상태는 페이지 전체(모든 구간)에 걸쳐 공유, "Xóa (N)"가 어느
  구간이든 선택된 것 전부를 `toggleSavedJobId()`로 일괄 해제.
- [RecentlyViewedPage.tsx](src/pages/jobsMenu/RecentlyViewedPage.tsx):
  동일 패턴 적용, 마지막 열은 "Ngày đăng"(공고 게시일)이 아니라
  "Đã xem lúc"(열람 시각)로 명확히 구분 — 등록일 필터 자체는 그래도
  공고 게시일(`job.postedAt`) 기준으로 통일.
- [RecommendSection.tsx](src/components/RecommendSection.tsx)(맞춤 공고가
  쓰는 컴포넌트): 기존 "Xem thêm/Thu gọn"(4개씩 더 보기) 방식을 새
  표시개수 드롭다운으로 대체(같은 목적의 두 컨트롤이 공존하지 않게 정리).
  표 뷰에서는 배지에 매칭 점수(`55%`) 표시, 마지막 열은 지원 버튼+저장
  버튼(`RecommendRowActions` 신규 — 기존 카드용 `RecommendCard`와 같은
  저장/지원 로직을 표 셀 크기에 맞게 분리).
- [SuggestedJobsPage.tsx](src/pages/jobsMenu/SuggestedJobsPage.tsx):
  기존 결과 개수 하드 상한(`.slice(0, 30)`)을 제거하고 새 표시개수
  드롭다운으로 대체. 표 뷰 배지는 첫 번째 추천 근거(예: "Ngành quan
  tâm: Khác") 표시.
- [src/index.css](src/index.css): `.jm-view-toggle*`/`.jm-urgent-toolbar__delete`/
  `.jm-select-all-row`/`.jm-table-row-actions`/`.jm-urgent-table__title--muted`
  신규 — 기존 `.jm-urgent-table*`/`.admin-table` 톤 그대로 확장, 새
  디자인 패턴 발명 없음. 이 표들은 다른 `.jm-urgent-table*`처럼 다크모드
  오버라이드 없음(기존 컨벤션 — 이 앱 다크모드는 카드류만 뒤집고 표 같은
  요소는 라이트 톤 유지).

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- 로컬 dev 서버에 실제 저장/열람/조건 데이터를 localStorage로 주입해
  4개 페이지 전부 실측: 카드→표 전환, 체크박스 선택→"Xóa (N)" 카운트
  반영→실제 삭제(저장 해제/열람기록 삭제) 확인, 맞춤 공고 표에서 북마크
  버튼 클릭→`vgb_saved_job_ids`에 실제로 반영 확인, 모바일(375px)
  가로 스크롤 정상, 다크모드 회귀 없음.
- **버그 1건 발견·즉시 수정**: 체크박스 선택 기능이 없는 하위 구간
  (예: 저장한 공고의 "Đã hết hạn" 섹션)에서 표 헤더의 "전체선택"
  체크박스가 `onChange` 없이 `checked`만 있어 React 경고 + 클릭해도
  아무 반응 없는 죽은 체크박스로 남던 것 — `onToggleAll`을 실제로 넘긴
  경우에만 헤더 체크박스 자체를 렌더하도록 수정, 재검증으로 경고 사라짐
  확인(새 탭에서 콘솔 완전히 깨끗함 확인).
- **Production 실측 완료**: `viecganban.vn`의 4개 페이지(`/viec-lam/da-luu`,
  `/viec-lam/da-xem`, `/viec-lam/phu-hop`, `/viec-lam/goi-y`) 전부
  실제 공고 데이터로 표 뷰 렌더 확인, "Việc làm đã lưu"에서 체크박스
  선택→삭제까지 실제로 동작(총 2건→1건으로 줄어드는 것 확인). 콘솔에
  새 에러 없음(기존 404 2건만). 테스트용으로 주입한 localStorage 값은
  전부 정리함.

## 발견된 문제

없음 — 위에서 발견한 체크박스 경고는 같은 라운드에 수정·재검증 완료.

## 다음 결정사항

- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음.
- (별개 논의, 미정) 기업용 "인재 검색"(알바몬 "인재정보"에 해당) 기능
  부재 — AskUserQuestion으로 두 번 물었으나 응답 없이 스킵됨.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성 — korea_jobs 관련 기능은 가능하면 로컬 상태/프론트 레벨에서
  해결하고, 본체 DB 스키마와 깊게 엮는 선택은 지양할 것.
