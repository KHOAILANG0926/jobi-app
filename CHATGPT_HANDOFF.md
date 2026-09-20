# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**`/ban-do`(Gần tôi 전용 페이지)에 마우스 휠 줌인/줌아웃 추가
완료(2026-09-20, 같은 세션 "주변 탐색" 버튼 바로 다음 라운드)**. 사용자가
지도 스크린샷을 보여주며 "주황색 동그라미는 주변 일자리인거지?" 질문 +
"지도에 마우스를 올려서 휠을 올리면 줌인 내리면 줌 아웃 기능도 넣고
싶은데"로 지시. 주황 동그라미 질문에 먼저 답변(정확한 위치 검증 안 된
공고+본인 위치 마커 = 반투명 주황 원, 검증된 공고 = 파란 핀)한 뒤
휠줌 기능 구현. IMPLEMENTED → VERIFIED(로컬+Production) → MASTER
PUSHED(`5c0a3b3`) → PRODUCTION DEPLOYED → PRODUCTION VERIFIED 전부 완료.

## 변경 내용

- [src/components/JobLocationMap.tsx](src/components/JobLocationMap.tsx):
  `scrollWheelZoom?: boolean`(기본 `false`) prop 신설 —
  `L.map(el, { scrollWheelZoom })`으로 Leaflet 지도 생성 시 그대로 전달.
  **의도적으로 기본값을 꺼둠**: 이 컴포넌트는 JobDetail/KoreaJobDetail
  (공고 상세페이지 본문 중간에 작게 끼어있는 지도)과 MapView(`/ban-do`,
  화면 전체가 지도인 전용 페이지) 셋이 공유하는데, 앞의 둘은 휠줌을 켜면
  사용자가 페이지를 스크롤하다 커서가 지도를 지나는 순간 스크롤이 줌으로
  먹혀버리는("scroll jail") 문제가 생겨서 그대로 둠.
- [src/components/MapView.tsx](src/components/MapView.tsx): `<JobLocationMap>`
  호출에 `scrollWheelZoom`(값 없는 shorthand = `true`) 추가 — `/ban-do`
  에서만 명시적으로 켬.

## 테스트 결과

- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- 로컬 dev 서버: `/ban-do`에서 JS로 합성한 `WheelEvent` 디스패치 →
  타일 zoom level이 5→7로 실제로 바뀌는 것 확인. 공고 상세페이지
  (`sb-4638`)에서 동일한 이벤트를 지도에 쐈을 때는 zoom level이
  그대로(변화 없음) — 의도대로 상세페이지 지도만 휠줌 비활성 유지됨을
  확인.
- **Production 실측**: 처음엔 JS `WheelEvent` 합성 디스패치로 테스트했더니
  타일이 안 바뀌어서(로컬과 다른 결과) 의아했는데, **원인은 실제 버그가
  아니라 테스트 방법의 한계**였음 — 배포된 청크(`MapView-DldxTXxS.js`)를
  직접 fetch해 `scrollWheelZoom` 문자열이 포함된 것으로 코드 반영은
  확인됐고, 브라우저의 진짜 휠 입력을 흉내 내는 `computer` 도구의
  `scroll` 액션(합성 JS 이벤트가 아니라 OS 레벨에 더 가까운 입력)으로
  재시도하니 스크린샷상 베트남 전체 보기 → Gia Lai/Kon Tum 지역 단위로
  실제 확대되는 것 확인됨. (교훈: Leaflet 휠줌은 `element.dispatchEvent
  (new WheelEvent(...))`로는 신뢰성 있게 재현 안 될 수 있음 — 검증 시
  `computer` 도구의 `scroll` 액션을 우선 쓸 것.)

## 발견된 문제

없음 — 위 "Production 실측" 항목의 초기 불일치는 실제 버그가 아니라
브라우저 자동화 테스트 방법의 한계였음이 재확인으로 밝혀짐.

## 다음 결정사항

- 사용자가 실기기(휴대폰/PC)로 `/ban-do`의 "Trong 5km"/"Trong 10km"
  주변 탐색 버튼을 직접 눌러 위치 권한 허용 후 결과가 정상 표시되는지
  최종 확인 필요(자동화 브라우저는 위치 권한을 자동 거부해 이 부분만
  실사용자 확인 대기 중 — 바로 위 라운드에서 이미 안내함).
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
