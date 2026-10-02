# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**TomTom Orbis home map provider 후보 추가 (2026-10-02).** 상태: branch `codex/tomtom-orbis-provider` commit `654bdf4`, IMPLEMENTED / STATIC·NO-KEY FALLBACK VERIFIED / PREVIEW DEPLOYED·KEY PENDING / PRODUCTION UNCHANGED.

## 변경 내용

- `HomeMapCanvas`의 primary 후보를 TomTom으로 전환했다. `VITE_TOMTOM_API_KEY`가 있을 때만 `TomTomMapCanvas`를 lazy load하며, 키가 없거나 초기화·style/tile·12초 timeout 오류가 나면 Geoapify로 전환한다.
- TomTom은 기존 MapLibre를 재사용하고 공식 Orbis Assets API의 `basic_street-light` style을 사용한다. 새 SDK dependency는 추가하지 않았다.
- provider 전환 전 마지막 center/zoom을 저장해 Geoapify에 전달한다. origin, radius, marker, selected job, onSelect와 recenterRequest는 기존 공통 props를 그대로 사용한다.
- Google provider 관련 파일과 테스트는 보존했지만 `HomeMapCanvas` 선택 경로에서는 비활성이다.
- `TomTomPlacesClient` 타입 경계만 추가했다. Places URL, loader, fetch와 자동 POI 호출은 없다.
- 기본 반경, zoom 계산, 지도 높이·가로폭·필터·DB·모바일 UI는 변경하지 않았다.

## 테스트 결과

- `npm test`: 17/17 test files 통과. TomTom 우선 선택, 실패 후 Geoapify 전환, stale event 차단, viewport 승계, 공식 style URL을 검증한다.
- `npx tsc --noEmit`: 통과.
- `npm run build`: client + SSR 통과. 기존 MapLibre chunk 크기 경고만 유지.
- Preview env 기준 로컬 브라우저 1440×900: `VITE_TOMTOM_API_KEY` 부재로 `data-map-provider=geoapify`, TomTom 요청 0건, Geoapify 요청 15건, console error 0건.
- Vercel Preview `dpl_zy2AeR2sJ1ZFvAJB1rtRwCyf9HXE`: READY. Production 배포 없음.

## 발견된 문제

- Vercel Preview에는 아직 `VITE_TOMTOM_API_KEY`가 없다. 따라서 TomTom 실제 렌더링·품질 비교는 수행할 수 없다.
- TomTom Orbis Map Display/Assets API는 현재 public preview 서비스다.

## 다음 결정사항

- Preview에 `VITE_TOMTOM_API_KEY`를 추가한 뒤 Bắc Ninh 홈(21.1861, 106.0763), VSIP Bắc Ninh(21.0799208, 105.9807154), Yên Phong(21.1965731, 105.9932563)을 1366×768, 1440×900, 모바일 375px에서 Geoapify와 비교한다.
- 건물 형태, 회사·시설명, 도로명, JOBI 핀 가독성이 합격 기준을 넘기 전에는 Production에 적용하지 않는다.

## 최근 완료 작업 로그

- 2026-10-02 — Google VECTOR 전환 + 기본 반경 UX 검토 — PRODUCTION DEPLOYED
- 2026-10-02 — Google Native provider + Geoapify fallback 검증 — PRODUCTION DEPLOYED
- 2026-10-01 — 메인 지도 Geoapify 벡터 전환 — PRODUCTION DEPLOYED
- 2026-10-01 — 메인 지도 시각 높이·여백 축소 + 수동 시점 유지 — PRODUCTION DEPLOYED
