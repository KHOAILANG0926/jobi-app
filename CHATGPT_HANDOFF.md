# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/home-cleanup-bottom-sections` 브랜치(master 기준)에서 Home 하단의 불필요한 탐색/추천
영역 5개를 제거하고 Highlands/WinMart 광고 2개(`.home-ad-cards`)를 브랜드/지역 섹션 바로
아래로 당겼다. Header/Hero/검색창/Samsung 광고/로그인·거북이 CTA/Thương hiệu tuyển dụng/
Việc làm theo khu vực/60:40 구조/JobDetail/JobCard/지도 코드는 전혀 건드리지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과(둘 다 1회만). 데스크톱(1280px)·
  모바일(375px) 각 1회 DOM 레벨 확인.
- `DEPLOYED`: 미완료 — 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 변경 내용

`src/pages/Home.tsx`에서 다음 5개 영역의 JSX를 삭제했다(모두 `.home-brands-region-grid`
와 `.home-ad-cards` 사이, 또는 `.home-ad-cards` 바로 뒤에 있던 것들):

1. `Việc làm mới nhất` 제목 + 정렬 select (`.home-reference-latest__head`)
2. `Tất cả` / `E-8` / `E-7` / `E-9` / `Việc làm trong nước` 필터 줄
   (`.home-reference-latest__filters`) — 위 1·2를 합쳐 `<section className=
   "home-reference-latest">` 전체 삭제.
3. `Danh mục ngành nghề` 전체(`.home-reference-categories`)
4. `Việc làm gợi ý cho bạn` 전체(`.home-reference-recommendation`) — 3·4를 합쳐
   `<section className="home-reference-content">` 전체 삭제.
5. `Gợi ý tìm kiếm` 전체(`<div className="home-suggestions-section">`, `Tuyển gấp`/
   `Gần tôi`/`Nhà máy`/`Nhà hàng`/`Giao hàng`/`Bán lẻ` 퀵필터 버튼 6개 포함) 삭제.

**함께 정리한 dead code** (삭제된 JSX에서만 쓰이던 것들, 안 지우면 `noUnusedLocals`로
tsc가 실패함):
- `Icon3DBell`/`Icon3DPin`/`Icon3DFactory`/`Icon3DCup`/`Icon3DTruck`/`Icon3DBag` — Home.tsx
  최상단에 정의돼 있던 3D SVG 아이콘 함수 6개(각 40~50줄), "Gợi ý tìm kiếm" 버튼에서만
  쓰였음.
- `handleRecClick` 함수 — 이 버튼들의 클릭 핸들러, 다른 호출처 없었음.
- `src/index.css`의 `.home-reference-*`(latest/content/categories/heading/job* 등),
  `.home-suggestions-section`, `.home-rec-grid`/`.home-rec-btn*` 규칙 전부(라이트 모드
  기준 규칙 + `@media` 내 override 3곳) 삭제.

**의도적으로 유지한 것**(제거된 UI가 쓰던 것이지만 다른 곳에서도 쓰여서 남김):
- `REFERENCE_CATEGORIES` 상수 — 삭제된 "Danh mục ngành nghề" 그리드 말고도 다른 곳(정렬
  select의 option 목록, 793번째 줄 근처)에서 여전히 씀.
- `activeRec`/`setActiveRec`, `recFilter`/`setRecFilter`, `urgentOnly`/`nearMe` state —
  실제 공고 필터링 로직(`filtered` useMemo)과 `resetFilters`/`hasOtherFilters`가 여전히
  참조함. "Gợi ý tìm kiếm" 버튼이 없어졌으니 `recFilter`/`activeRec`을 채우는 UI 진입점은
  없어졌지만, 상태 자체와 필터링 로직은 스코프 밖이라 손대지 않았다(요청 범위는 UI 정리
  까지).

## 상단 미변경 확인

Header/Hero/검색창/Samsung 광고(`.ad-slot--samsung`)/로그인·거북이 CTA
(`.home-discovery__card--account`)/`Thương hiệu tuyển dụng`(`.home-brands-section`, 높이
120px)/`Việc làm theo khu vực`(`.home-region-panel`)/브랜드 60·지역 40 구조는 모두 코드
자체를 건드리지 않았고, 브라우저에서 전부 정상 존재/렌더링됨을 확인했다(아래 검증 참고).

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과. Home JS 청크가 50.49kB → 32.74kB로
  줄어들어(삭제된 아이콘/섹션 코드가 실제로 번들에서 빠졌음을 방증) 의도한 정리가 됐음을
  확인.
- **데스크톱(1280px) 1회**: 삭제 대상 5개 셀렉터(`.home-reference-latest`,
  `.home-reference-content`, `.home-suggestions-section`, "Gợi ý tìm kiếm" 텍스트, 필터
  줄) 전부 DOM에 없음 확인. `.home-ad-cards`(Highlands/WinMart 텍스트 포함)는 정상 존재,
  `.home-brands-region-grid`와의 간격이 20px(기존 `margin-bottom: 1.25rem`과 동일, 추가
  빈 공간 없음) 확인. 가로 overflow 없음(scrollWidth 1265 < 1280). 상단 요소
  (header/hero/search/Samsung 광고/로그인 CTA/브랜드섹션 높이 120px/지역패널) 전부 정상
  존재 확인.
- **모바일(375px) 1회**: 삭제 대상 전부 없음, `.home-ad-cards` 존재, 가로 overflow 없음
  (scrollWidth 375 = innerWidth 375).
- 동일 화면 반복 검증은 하지 않았다(지시대로 1회씩만).

## 발견된 문제

- 없음. 삭제 대상이 서로 명확히 분리된 독립 섹션들이라 예상치 못한 사이드이펙트는 없었다.

## 다음 결정사항

1. 사용자 승인 후 master merge → Production 배포.
2. `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`)는 이번 작업과 무관하게 여전히 별도
   브랜치에 남아 있음 — master merge 여부 별도 결정 필요.
