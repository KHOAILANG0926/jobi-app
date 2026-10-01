# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**메인 지도 Google Native provider + Geoapify fallback (2026-10-02).** 상태: VERIFIED, Production 배포 대기. Google 키가 없는 현재 환경에서는 Geoapify가 즉시 선택되며 Google SDK 요청이 발생하지 않는다.

## 변경 내용

- `HomeMapCanvas`는 provider 선택·12초 초기화 timeout·마지막 center/zoom 승계만 관리한다. `GoogleMapCanvas`는 Google Maps JavaScript API ROADMAP/HYBRID를, `GeoapifyMapCanvas`는 기존 MapLibre + Geoapify `osm-bright/style.json`을 담당한다.
- Google loader reject, 초기화 예외, `gm_authFailure`, timeout에서 Geoapify로 한 번만 전환한다. 전역 인증 callback은 기존 handler 보존·다중 구독·Strict Mode·외부 handler 교체를 안전하게 처리한다.
- 공고 marker는 job id identity의 독립 `GoogleJobMarkerLayer`로 분리했다. 동일 좌표 공고도 별도 record이며 향후 clustering/spiderfy/다른 renderer로 교체할 수 있다. 이번 작업에는 clustering을 추가하지 않았다.
- 검색 반경은 1/3/5/10km를 정확히 1000/3000/5000/10000m로 유지한다. 최초 진입·지역 선택·현재 위치에서만 원 지름이 화면의 약 65%가 되도록 zoom을 계산하며, radius 변경은 circle과 결과만 갱신한다.
- Google key는 `VITE_GOOGLE_MAPS_API_KEY`만 참조하고 값은 하드코딩하지 않는다. key가 없으면 Google component와 SDK를 실행하지 않는다. DB·필터 구조·지도 높이·가로 비율·모바일 구조는 변경하지 않았다.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`, `npm test` 통과. client와 SSR 빌드에서 window/document/google 서버 오류 없음.
- 브라우저: 1366×768=425px, 1440×900=440px, 1920×1080=485px, 모바일 375px 통과. 3열 상·하단 정렬, 내부 scroll, 가로 overflow 없음, Featured/Korea 영역 유지.
- Bắc Ninh 3km 원의 계산상 화면 지름 0.65. wheel→radius, drag→radius, zoom +→radius에서 center/zoom 유지. 새 지역과 현재 위치에서만 재정렬.
- Google 가짜 key 환경에서 script abort, 12초 stall, `gm_authFailure`, map constructor 예외가 모두 Geoapify 한 개로 fallback. hydration 오류 없음. key 없는 빌드는 Google 요청 0건, Geoapify style 정상.
- 실제 Google 지도 검증은 Production/Preview 키가 없어 `PENDING_NO_KEY`. Production 전환 전 제한된 Preview 키로 ROADMAP/HYBRID·quota·billing을 확인해야 한다.

## 발견된 문제

- Google Maps 기본 지도는 모든 quota/billing/tile 실패를 일관된 JavaScript 오류로 제공하지 않는다. 코드 fallback은 loader/auth/init/timeout 신호를 처리하며, 운영 한계는 Google Cloud quota cap·budget alert·key 제한으로 보완해야 한다.
- 기존 Geoapify lazy chunk 크기 경고(약 1.04MB minified)는 유지된다. Google provider 추가로 key 없는 운영 초기 경로의 provider 실행 방식은 바뀌지 않는다.

## 다음 결정사항

- 검증 브랜치를 master에 통합하고 Production에서 Geoapify 유지, Google 요청 0건, 425/440/485px를 재확인한다.
- Google primary 전환은 별도 제한된 Preview 키를 준비한 뒤 진행한다. 허용 referrer는 안정된 Preview alias로 제한하고, Production 키는 `https://viecganban.vn/*`, `https://www.viecganban.vn/*`와 Maps JavaScript API만 허용한다.
