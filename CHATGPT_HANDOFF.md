# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**Google 지도 VECTOR 전환 + 기본 반경 UX 검토 (2026-10-02).** 상태: VECTOR 코드 `90bf841` IMPLEMENTED / STATIC·FALLBACK VERIFIED / PRODUCTION DEPLOYED. Google 키가 없는 현재 Production은 Geoapify를 유지하며 실제 Google 건물·POI 시각 비교는 `PENDING_NO_KEY`다.

## 변경 내용

- `HomeMapCanvas`는 provider 선택·12초 초기화 timeout·마지막 center/zoom 승계만 관리한다. `GoogleMapCanvas`는 Google Maps JavaScript API ROADMAP/HYBRID를, `GeoapifyMapCanvas`는 기존 MapLibre + Geoapify `osm-bright/style.json`을 담당한다.
- Google loader reject, 초기화 예외, `gm_authFailure`, timeout에서 Geoapify로 한 번만 전환한다. 전역 인증 callback은 기존 handler 보존·다중 구독·Strict Mode·외부 handler 교체를 안전하게 처리한다.
- 공고 marker는 job id identity의 독립 `GoogleJobMarkerLayer`로 분리했다. 동일 좌표 공고도 별도 record이며 향후 clustering/spiderfy/다른 renderer로 교체할 수 있다. 이번 작업에는 clustering을 추가하지 않았다.
- 검색 반경은 1/3/5/10km를 정확히 1000/3000/5000/10000m로 유지한다. 최초 진입·지역 선택·현재 위치에서만 원 지름이 화면의 약 65%가 되도록 zoom을 계산하며, radius 변경은 circle과 결과만 갱신한다.
- Google key는 `VITE_GOOGLE_MAPS_API_KEY`만 참조하고 값은 하드코딩하지 않는다. key가 없으면 Google component와 SDK를 실행하지 않는다. DB·필터 구조·지도 높이·가로 비율·모바일 구조는 변경하지 않았다.
- `GoogleMapCanvas`는 `renderingType: google.maps.RenderingType.VECTOR`를 명시한다. 기본 ROADMAP, ROADMAP/HYBRID 토글, Google 기본 도로·건물·POI 스타일을 유지하고 custom style은 적용하지 않았다. 공식 문서상 이 VECTOR 지정에는 Map ID가 필요하지 않다.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`, `npm test` 통과. client와 SSR 빌드에서 window/document/google 서버 오류 없음.
- 브라우저: 1366×768=425px, 1440×900=440px, 1920×1080=485px, 모바일 375px 통과. 3열 상·하단 정렬, 내부 scroll, 가로 overflow 없음, Featured/Korea 영역 유지.
- Bắc Ninh 3km 원의 계산상 화면 지름 0.65. wheel→radius, drag→radius, zoom +→radius에서 center/zoom 유지. 새 지역과 현재 위치에서만 재정렬.
- Google 가짜 key 환경에서 script abort, 12초 stall, `gm_authFailure`, map constructor 예외가 모두 Geoapify 한 개로 fallback. hydration 오류 없음. key 없는 빌드는 Google 요청 0건, Geoapify style 정상.
- 실제 Google 지도 검증은 Production/Preview 키가 없어 `PENDING_NO_KEY`. Production 전환 전 제한된 Preview 키로 ROADMAP/HYBRID·quota·billing을 확인해야 한다.
- Production `viecganban.vn`: Geoapify provider, Google 요청 0건, Geoapify style 성공, 425/440/485px, console/hydration 오류 없음.
- VECTOR 변경 후 `npx tsc --noEmit`, `npm run build`, `npm test` 16/16 통과. Google fixture에서 VECTOR/ROADMAP/HYBRID/no-custom-style와 네 실패 fallback을 확인했다. Vercel 배포 `dpl_FSNAYRTi8EfukY48TjHadNXZb77b` READY.
- 운영 1440×900 재검토: 기본 반경 8km, center Bắc Ninh, zoom 11.3428, 원 지름 비율 0.6500, Geoapify 응답 15건 실패 0, console/page 오류 0.

## 발견된 문제

- Google Maps 기본 지도는 모든 quota/billing/tile 실패를 일관된 JavaScript 오류로 제공하지 않는다. 코드 fallback은 loader/auth/init/timeout 신호를 처리하며, 운영 한계는 Google Cloud quota cap·budget alert·key 제한으로 보완해야 한다.
- 기존 Geoapify lazy chunk 크기 경고(약 1.04MB minified)는 유지된다. Google provider 추가로 key 없는 운영 초기 경로의 provider 실행 방식은 바뀌지 않는다.
- 기본 반경은 8km인데 빠른 선택은 5/10/20km라 시작값과 버튼 체계가 맞지 않는다. 8km를 65%로 표시하는 zoom 11.34는 지역·간선도로용 축척이며 건물 상세용 축척이 아니다. Google 기본 vector 3D 건물은 공식 문서상 zoom 17+에서 나타나므로 반경 자체를 줄이는 것만으로 건물 문제를 해결하면 검색 UX가 왜곡된다.

## 다음 결정사항

- Google primary 전환은 별도 제한된 Preview 키를 준비한 뒤 같은 Bắc Ninh center/zoom에서 raster ROADMAP·VECTOR ROADMAP·HYBRID를 캡처 비교한다. 허용 referrer는 안정된 Preview alias로 제한하고, Production 키는 운영 도메인과 Maps JavaScript API만 허용한다.
- 기본 반경은 빠른 선택과 일치하는 5km를 권장하되 제품 결정 전 값은 8km로 유지한다. 건물 상세는 사용자가 확대했을 때 확인하고, 기본 검색 viewport는 반경 원 65% 원칙을 유지한다.
