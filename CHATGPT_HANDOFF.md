# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**"Việc làm của tôi" 4개 페이지 표 뷰 — 알바몬 "최근 본 알바" 캡처와
구성이 다르다는 재지적 반영 완료(2026-09-20, 같은 세션 두 번째 라운드)**.
1차 버전(카드↔표 전환, 등록일 필터, 표시개수, 저장/본 2곳 체크박스+
삭제)을 배포한 뒤 사용자가 다시 캡처를 보여주며 "이렇게 만들어
달라니까.... 구성을" — 1차 버전은 "Đang tuyển"/"Đã hết hạn" 상태를
섹션 제목으로 **쌓아서 전부 같이** 보여주는 구조였는데, 실제 알바몬은
표 하나를 **상태 탭(전체/게재중/마감)으로 전환**하는 구조였고, "등록일"
필터와 별개로 **정렬("최근본순") 드롭다운**도 빠져 있었음을 발견 →
이해한 내용을 먼저 설명해 확인받은 뒤 바로 수정. IMPLEMENTED →
VERIFIED(로컬+Production 4페이지 전부) → MASTER PUSHED(`b2fc265`) →
PRODUCTION DEPLOYED → PRODUCTION VERIFIED 전부 완료.

## 변경 내용

- [src/components/JobsStatusTabs.tsx](src/components/JobsStatusTabs.tsx)
  신규 — "Tất cả/Đang tuyển/Đã hết hạn" 밑줄 탭. 새 CSS를 만들지 않고
  [JobDetail.tsx](src/pages/JobDetail.tsx)가 이미 쓰던 `.jd2-tabs`/
  `.jd2-tab` 스타일을 그대로 재사용.
- [SavedJobsPage.tsx](src/pages/jobsMenu/SavedJobsPage.tsx): 로컬 공고
  (진행중/마감)+한국 공고(진행중/마감)+삭제된 공고 전부를 **하나의
  통합 행 배열**(`combinedRows`, 각 행에 `status: 'open'|'closed'`
  태그)로 합치고, 섹션별 `<ul>` 4~5개를 쌓던 구조를 탭으로 필터링하는
  **표(또는 카드 리스트) 하나**로 교체. 정렬 드롭다운("Lưu gần đây
  nhất"=저장 순서 역순/"Đăng gần đây nhất"=postedAt 내림차순) 추가.
  "Chọn tất cả" 체크박스는 이제 `JobsTable`의 헤더 체크박스(현재
  탭+필터+개수에 실제 보이는 행만 대상)로 교체 — 이전엔 필터와 무관하게
  항상 "저장된 것 전체"를 선택하는 별도 행이었음.
- [RecentlyViewedPage.tsx](src/pages/jobsMenu/RecentlyViewedPage.tsx):
  동일 패턴 — `status`는 해당 공고가 아직 존재하고 마감 전이면 'open',
  삭제됐거나 마감이면 'closed'. 정렬은 "Xem gần đây nhất"(열람순, 기존
  기본값)/"Đăng gần đây nhất"(postedAt). "Xóa tất cả lịch sử" 버튼은
  탭/필터와 무관하게 전체 기록을 지우는 별개 동작이라 그대로 유지.
- [RecommendSection.tsx](src/components/RecommendSection.tsx)(맞춤 공고)/
  [SuggestedJobsPage.tsx](src/pages/jobsMenu/SuggestedJobsPage.tsx)
  (추천 공고): 상태 탭은 안 넣음(둘 다 useJobs()가 이미 활성 공고만
  주는 "현재 매칭되는 결과" 개념이라 진행중/마감 구분 자체가 없음) —
  대신 정렬 드롭다운만 추가("Độ phù hợp cao nhất"/"Phù hợp nhất"=기존
  점수·가중치순 기본값, "Đăng gần đây nhất"=postedAt).
- [JobsListToolbar.tsx](src/components/JobsListToolbar.tsx): `sortOptions`/
  `sortValue`/`onSortChange` prop 신규(옵션 안 넘기면 정렬 드롭다운 자체가
  안 뜸 — 지금은 4곳 다 넘기지만, 나중에 정렬 의미가 없는 페이지가
  생기면 자연히 숨겨짐).

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- 로컬 dev 서버: "Việc làm đã lưu"에서 "Đang tuyển" 탭 클릭 → 마감된
  공고(EBOM)가 실제로 빠지고 진행중 2건만 남는 것 DOM 직접 확인,
  "Đã hết hạn" 탭 → 마감 1건만 남는 것 확인. 헤더 "전체선택" 체크박스가
  현재 필터된 행만 대상으로 정상 동작. "Việc làm đã xem"도 동일 구조로
  탭+정렬 정상 렌더. 맞춤/추천 공고 정렬 드롭다운("Độ phù hợp cao
  nhất"/"Đăng gần đây nhất") 정상 렌더 확인.
- **Production 실측**: `viecganban.vn/viec-lam/da-luu`에서 탭 클릭 →
  Tổng 3건→"Đang tuyển" 클릭 후 Tổng 2건으로 실제 필터링 확인(첫 클릭
  시도는 좌표 기반 클릭이 빗나가 실패했었는데, DOM에서 버튼을 직접 찾아
  `.click()`으로 재시도해 성공 — 코드 버그가 아니라 브라우저 자동화
  테스트 방식의 문제였음, 실제 사용자 클릭에는 영향 없음). 콘솔에 새
  에러 없음(기존 404 2건만). 테스트용 localStorage 값 전부 정리함.

## 발견된 문제

없음.

## 다음 결정사항

- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음.
- (별개 논의, 미정) 기업용 "인재 검색"(알바몬 "인재정보"에 해당) 기능
  부재 — AskUserQuestion으로 두 번 물었으나 응답 없이 스킵됨.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성 — korea_jobs 관련 기능은 가능하면 로컬 상태/프론트 레벨에서
  해결하고, 본체 DB 스키마와 깊게 엮는 선택은 지양할 것.
