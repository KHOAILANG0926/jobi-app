# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/job-detail-scroll-to-top` 브랜치(master 기준)에서 "공고 클릭 후 JobDetail이 이전 스크롤
위치(하단)에서 열리는" 버그를 앱 공통 route-change scroll 처리로 수정했다. JobDetail/Home
디자인, 공고 데이터/지원 기능은 건드리지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 로컬 dev 서버에서 실제 클릭 이벤트
  (`.home-card-wrap`)로 Home/지역필터/브랜드필터 각각 하단 → JobDetail 진입 및 뒤로가기
  왕복을 데스크톱 + 모바일(375px)에서 확인.
- `DEPLOYED`: 미완료 — 브랜치 push까지만, Production 배포는 사용자 승인 전.

## 원인

`src/App.tsx`가 `BrowserRouter`(선언형 API)를 쓰는데, 이 API는 라우트 전환 시 스크롤 위치를
자동으로 관리하지 않는다(`pushState`는 브라우저가 현재 스크롤을 그대로 들고 있음). 앱 어디에도
`ScrollRestoration`, `window.scrollTo`, 전역 scroll handler가 없었고(`Home.tsx`/`Layout.tsx`
등 확인), hash 기반 네비게이션도 쓰지 않는다 — 즉 라우트 전환 스크롤을 다루는 로직 자체가
전무했다. 그래서 Home 하단의 공고 카드를 누르면 JobDetail이 그 스크롤 위치 그대로 열렸다.

## 수정 위치

- 신규 `src/components/ScrollToTop.tsx` (공통 컴포넌트, `App.tsx`의 `<BrowserRouter>` 바로
  아래에 한 번 마운트 → 모든 라우트에 적용, `/admin`처럼 `Layout` 밖에 있는 라우트도 포함).
  - `history.scrollRestoration = 'manual'`로 브라우저 기본 복원을 끄고 직접 관리한다(기본
    `'auto'` 상태로 뒀더니 실제 동작이 타이밍에 따라 불안정했다 — 아래 "발견된 문제" 참고).
  - 각 history entry(`location.key`)를 떠나기 직전(effect cleanup)에 그 시점의
    `window.scrollY`를 기록해둔다. `scroll` 이벤트 리스너 방식은 이벤트가 지연/누락될 수
    있어 쓰지 않았다.
  - PUSH/REPLACE(카드 클릭 등 일반 이동)이고 `#hash`가 없으면 `window.scrollTo({top:0,
    behavior:'instant'})`로 즉시 맨 위로 이동. `scroll-behavior: smooth`(index.css)가
    애니메이션을 걸지 않도록 `instant`를 명시했다.
  - POP(뒤로/앞으로가기)이면 기록해둔 위치로 복원. `#hash`가 있으면 아무것도 하지 않고
    브라우저/앵커에 맡긴다.
- `src/App.tsx`: `<ScrollToTop />`을 `<BrowserRouter>` 바로 아래(라우트 트리 밖)에 추가.

## 검증

- **Home→JobDetail**: Home 최하단까지 스크롤(모의 클릭이 아닌 실제 `.home-card-wrap` DOM
  클릭) 후 진입 시 `window.scrollY === 0` 확인.
- **검색결과(지역/브랜드 필터)→JobDetail**: `/?region=hanoi`, `/?brand=Jollibee` 각각 결과
  최하단에서 진입 시 `window.scrollY === 0` 확인.
- **뒤로가기**: 위 각 케이스에서 JobDetail 진입 전 스크롤 위치(예: 900px, 12418px, 700px)가
  뒤로가기 시 그대로 복원됨을 확인. 단, `?region=` 필터는 `Home.tsx`에 원래 있던(이번 작업과
  무관한 기존) `useEffect(() => cityResultRef.scrollIntoView(...), [selectedCity])`가 URL
  복원 시 `selectedCity`를 다시 채우면서 복원 직후 "지역 결과" 섹션으로 스크롤을 한 번 더
  옮긴다 — 브랜드 필터(해당 effect 없음)는 정확히 복원된다. Home 자체의 필터 스크롤 동작은
  이번 작업 범위 밖이라 손대지 않았다.
- **모바일 375px**: 위 Home 케이스를 375px에서 재확인, 가로 스크롤 없음.

## 발견된 문제

- 처음에는 "PUSH일 때만 scrollTo(0), POP은 아예 손대지 않고 브라우저 기본 복원에 맡긴다"로
  구현했는데, 실제로 이 컴포넌트를 마운트한 것만으로 뒤로가기 시 브라우저의 기본
  `scrollRestoration`이 `scrollY=0`으로 깨지는 현상을 재현했다(컴포넌트를 빼면 정상 복원됨 —
  A/B로 직접 확인). 원인을 더 파고들기보다, 브라우저 기본 동작에 기대지 않고 직접 저장/복원
  하는 방식(위 "수정 위치" 참고)으로 바꿔 결정론적으로 해결했다.
  - 참고로 `scroll` 이벤트 기반으로 위치를 기록하는 첫 시도는 로컬 dev 서버 브라우저 자동화
    환경에서 `scroll` 이벤트 자체가 전혀 발생하지 않아(‘Browser pane is not displayed’ 상태
    — 컴포지팅이 안 됨) 검증이 불가능했다. effect cleanup 시점에 읽는 방식으로 바꾸니 이
    제약과 무관하게 동작해 최종적으로 이 방식을 채택했다(실제 사용자 브라우저에서는 scroll
    이벤트가 정상 발생하지만, cleanup 방식이 더 결정론적이라 그대로 유지).
- 이 컴퓨터에 `node`/`npm`이 PATH에 없고 `D:\새 폴더 (2)\node.exe`에만 존재해 검증 시
  `.claude/launch.json`을 그 경로로 임시 변경했다가 검증 후 원복했다(커밋 미포함).

## 다음 결정사항

1. 사용자 승인 후 PR → master merge → Production 배포.
2. `?region=` 필터의 뒤로가기 시 "지역 결과 섹션으로 재스크롤"되는 기존 동작이 실제로
   거슬리면 별도 작업으로 `Home.tsx`의 `selectedCity` 이펙트를 조정할지 결정.
