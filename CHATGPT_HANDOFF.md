# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**`/ban-do`(Gần tôi 전용 페이지)에 카카오맵 "주변 탐색" 스타일 원클릭
반경 버튼 추가 완료(2026-09-20)**. 사용자가 카카오맵 초기 검색화면
캡처(히스토리+주변 탐색 아이콘 줄+내 장소)를 보여주며 "10km, 5km
차등을 두고 우리 올라와있는 공고가 자동반영되서 나열되는 식으로
만들고 싶다"고 지시 → 이해한 내용을 먼저 설명해 확인받은 뒤("맞아,
현실적으로 가능하고 대충 구현할거면 안하는게 맞고") 진행. IMPLEMENTED
→ VERIFIED(로컬) → MASTER PUSHED(`7db0e09`) → PRODUCTION DEPLOYED →
PRODUCTION VERIFIED 전부 완료.

## 변경 내용

- [src/components/MapView.tsx](src/components/MapView.tsx):
  - `handleUseCurrentLocation`이 이제 선택적 `radius` 인자를 받음 —
    넘기면 GPS 확보와 동시에 `nearRadius`를 그 값으로 설정, 안 넘기면
    (기존 "Dùng vị trí hiện tại" 버튼) 현재 `nearRadius` 그대로 유지.
    핸들러 하나를 재사용해 중복 없이 구현.
  - 위치를 아직 안 잡은 초기 화면(`!userCoords`)에만 노출되는
    `.near-me-explore` 블록 신설 — "Khám phá gần đây" 라벨 아래 원형
    핀 아이콘 버튼 2개("Trong 5km"/"Trong 10km"), 클릭 시
    `handleUseCurrentLocation(5)`/`(10)` 호출. 위치가 잡히면 이 블록은
    사라지고 기존 결과 화면(반경칩+리스트+지도)으로 자연스럽게 전환.
- [src/index.css](src/index.css): `.near-me-explore*` 신규 — 기존
  Home.tsx의 `.home-quick-filter`(원형 아이콘+라벨, 알바몬 벤치마킹
  때 만든 패턴)와 동일한 시각 언어를 재사용해 새 디자인 패턴을 발명하지
  않음. 이 페이지의 다른 `.near-me-*` 요소들처럼 다크모드 오버라이드
  없이 라이트 톤 그대로(기존 컨벤션).

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- 로컬 dev 서버: `/ban-do` 진입 시 "Khám phá gần đây" 줄 정상 렌더
  스크린샷 확인(카카오맵 캡처와 동일한 원형 아이콘+라벨 구조). "Trong
  5km" 클릭 → GPS 요청이 실제로 발동되는 것 확인(자동화 브라우저라
  권한 자동 거부로 에러 메시지 뜸 — 이건 이미 Production에서 검증된
  기존 GPS 버튼과 완전히 같은 코드 경로라 실제 브라우저에서 권한
  허용 시 정상 동작 예상).
- **Production 실측 완료**: `https://viecganban.vn/ban-do`에서
  "Khám phá gần đây" 줄 정상 렌더 스크린샷으로 확인. 콘솔 에러 없음.
  **단, 버튼 클릭 시 실제 GPS 권한 허용→위치확보→반경 자동 적용까지
  이어지는 전체 흐름은 자동화 브라우저의 geolocation 권한 제약상
  실사용자 기기에서 직접 눌러봐야 최종 확인 가능** — 로직은 기존
  Production에서 이미 실측 검증된 "Dùng vị trí hiện tại" 버튼과 100%
  동일한 경로(같은 `navigator.geolocation.getCurrentPosition` 호출,
  같은 성공/실패 핸들러)라 별도 버그 가능성은 낮음.

## 발견된 문제

없음.

## 다음 결정사항

- 사용자가 실기기(휴대폰/PC)로 "Trong 5km"/"Trong 10km" 버튼을 직접
  눌러 위치 권한 허용 후 결과가 정상 표시되는지 확인 필요(자동화
  브라우저 한계로 이 부분만 실사용자 확인 대기 중).
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
