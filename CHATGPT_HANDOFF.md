# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**"Gần tôi"(내 주변) 검색+지도+리스트 기능을 Home.tsx 상시뷰에서 전용
페이지(`/ban-do`)로 완전히 분리 완료(2026-09-20)**. 사용자가 "메인화면
밑으로 하지말고 별도 화면은 만들어죠, Công cụ 이거처럼"이라고 지시 →
새 페이지를 만들려다가 이미 존재하지만 헤더 어디에도 연결 안 돼 방치돼
있던 `/ban-do`(MapView.tsx)를 발견해 그걸 재사용하기로 확정("ok").
IMPLEMENTED → VERIFIED(로컬) → MASTER PUSHED(`af3af90`) → PRODUCTION
DEPLOYED → PRODUCTION VERIFIED 전부 완료.

## 변경 내용

- [src/components/MapView.tsx](src/components/MapView.tsx): 기존의
  단순한(OSM 직접 호출) 버전을 Home.tsx에 있던 카카오맵 스타일 상시뷰
  전체(주소 검색창+검색 히스토리+GPS 버튼+반경 칩+거리순 결과 리스트+
  지도, 왼쪽 사이드바/오른쪽 지도 2컬럼)로 완전히 교체. 라우트(`/ban-do`)와
  `App.tsx`의 lazy import는 기존 것 그대로 재사용(변경 없음). Home.tsx와
  다른 점: 카테고리/브랜드/검색어 필터는 없고 거리+반경만(원래 이
  페이지의 단순한 스코프를 유지), `isApplied`는 항상 false(지원 여부
  추적은 이식 안 함 — 클릭 시 상세 이동만 하던 원래 동작과 동일).
- [src/pages/Home.tsx](src/pages/Home.tsx): `nearMe` 관련 state 10개,
  `jobDistances` useMemo, `filtered`의 near-me 분기, `handleQuickNearMe`/
  `handleAddressSearch`/`selectAddressSuggestion`/`renderAddressSearch`
  핸들러, `near-me-view` JSX 블록(지도+사이드바) 전부 제거 — 이제 항상
  "Tất cả kết quả" 그리드만 렌더링. `scrollToRefBelowHeader`(다른
  스크롤 대상들이 공유)와 `?sort=`/`?urgent=`/`?region=` 등 다른 URL
  동기화는 그대로 유지, `?near=1` 처리만 제거. "📍 Gần bạn" 퀵필터
  칩은 로컬 필터 토글 버튼에서 `<NavLink to="/ban-do">`로 변경.
- [src/components/Layout.tsx](src/components/Layout.tsx): 헤더 메가메뉴
  "📍 Gần tôi" 링크를 `/?near=1` → `/ban-do`로 변경.
- 새로 추가/변경된 CSS 없음 — Home.tsx가 쓰던 `.near-me-view__*` 클래스를
  MapView.tsx가 그대로 재사용(index.css 손 안 댐).

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공(Home.js 번들 축소,
  MapView 청크로 지도/geoapify 코드 분리 확인), `npm test` 6/6 파일 통과.
- 로컬 dev 서버: 홈 화면에 near-me 흔적 전혀 없이 정상 렌더 확인,
  `/ban-do` 직접 진입 시 사이드바+지도 레이아웃 정상, 검색 히스토리
  클릭 시 재검색 메커니즘 정상 동작 확인(로컬은 Geoapify 키가 없어
  "Không tìm thấy địa chỉ"만 뜸 — 이건 정상, 실제 검색은 Production
  전용).
- **Production 실측 완료**: `https://viecganban.vn/ban-do` 직접 진입
  정상, "Quan 1, TP.HCM" 검색 → 실제 Geoapify 결과 5개 반환 → 첫 결과
  클릭 → 반경 5km 내 20건 결과(거리순, ~0.7km~) + 지도 마커 21개(내
  위치 1+공고 20) 줌13로 정상 렌더 확인. 홈 화면 "Gần bạn" 칩 클릭 →
  `/ban-do`로 정상 이동, 헤더 메가메뉴 "Gần tôi" 클릭도 `/ban-do`로
  정상 이동 확인. 콘솔 에러는 기존부터 있던 무관한 404 4건뿐(신규 아님).

## 발견된 문제

없음. 이번 라운드는 기존에 검증된 기능을 페이지만 옮긴 순수 리팩터링이라
새 버그 없이 한 번에 배포·실측 완료됨.

## 다음 결정사항

- (낮은 우선순위, 아직 요청 안 됨) `index.css`에 예전 단순 버전
  MapView.tsx가 쓰던 `.mapview__*` 죽은 CSS 규칙 22개가 남아있음 —
  지금 정리 안 함, 필요하면 다음에.
- (별개 논의, 미정) 기업용 "인재 검색"(알바몬 "인재정보"에 해당) 기능
  부재 — 이전 세션에 발견됐고 AskUserQuestion으로 두 번 물었으나 응답
  없이 스킵됨. 사용자가 먼저 꺼내지 않으면 이쪽에서 다시 확인 필요.
- (별개 논의, 미정) korea_jobs 구조를 비엣간반 본체와 나중에 분리할
  가능성이 있다고 사용자가 언급한 바 있음 — 앞으로 korea_jobs 관련
  기능은 가능하면 로컬 상태/프론트 레벨에서 해결하고, 본체 DB 스키마와
  깊게 엮는 선택은 분리 결정이 확정되기 전까진 지양할 것.
