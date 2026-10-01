# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**메인 지도 Geoapify 벡터 전환 (2026-10-01).** 상태: DEPLOYED. master 코드 커밋 `315eb91` push, Vercel Production Ready 및 viecganban.vn 실사이트 확인. 기존 확정 PC 높이·가로 비율·필터 정책 유지.

## 변경 내용

- 메인 `HomeMapCanvas`만 Leaflet raster → MapLibre GL + 기존 `VITE_GEOAPIFY_API_KEY`의 Geoapify `osm-bright/style.json` vector로 전환. Leaflet은 다른 지도 화면이 사용하므로 dependency 유지.
- 벡터 스타일의 주요 도로 계층, 지명 대비, 물·녹지·산업지역·건물 색상을 조정하고 소형 POI 2·3단계를 숨김. 공고 핀 빨강/선택 강조, 위치 점 파랑, 반경 원 연파랑 유지.
- 최초 로딩 및 지역/현재 위치 명시 선택에만 시점을 설정. 반경 변경은 원 데이터와 기존 필터 결과만 갱신하며 wheel·drag·+/− 조작 후 center/zoom 유지. MapLibre worker를 Vite 별도 청크로 번들링하고 기존 lazy import 및 ResizeObserver 유지.
- 수정 범위: `HomeMapCanvas.tsx`, `src/index.css`의 핀/위치점 스타일, `package.json`/lockfile, 이 문서와 `WORK_LOG.md`. DB·필터 로직·PC/모바일 레이아웃 수치 변경 없음.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build`, `npm test` 통과(기존 10개 테스트 파일). SSR 빌드 통과.
- 로컬 개발 서버와 Production 빌드 미리보기의 실제 Chrome: 1366×768=425px, 1440×900=440px, 1920×1080=485px, 모바일 375px 정상. 3열 상·하단 정렬과 canvas 부모 높이 일치. 콘솔/hydration 오류, Geoapify style/tile 요청 오류 없음.
- wheel→radius, drag→radius, + 버튼→radius에서 시점 유지. 새 지역 및 현재 위치 선택에서 재정렬. 브라우저 fixture로 핀 클릭→선택 상태/선택 핀 강조 확인.
- Production 1440×900: MapLibre 렌더링, 지도 높이 440px, Geoapify vector style HTTP 200, 위치점 표시, 콘솔 오류 없음.

## 발견된 문제

- 메인 지도 지연 청크는 Leaflet 때보다 커짐(약 1.04 MB minified, 282 KB gzip). 메인 페이지 초기 번들과 분리되어 로딩됨.
- Production의 실제 verified 핀이 현재 적어 브라우저 핀 테스트는 fixture로 검증. 기존 공개 데이터 제약.

## 다음 결정사항

- 현재 작업은 Production 확인 완료. 추후 실제 verified 공고 데이터가 늘면 운영 핀 분포를 확인할 수 있다.

## 최근 완료 작업 로그 (최근 5개)

1. **2026-10-01 — 메인 지도 시각 높이·여백 축소 + 수동 시점 유지** — MASTER PUSHED(`a1560c9`) + PRODUCTION VERIFIED.
2. **2026-10-01 — 메인 지도 탐색 영역 PC 세로 높이 추가 축소** — MASTER PUSHED(`4817df2`) + PRODUCTION VERIFIED.
3. **2026-10-01 — 메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선** — MASTER PUSHED(`3b69325`) + PRODUCTION VERIFIED.
4. **2026-10-01 — PC 메인 중간 영역 지도 탐색 개편** — MASTER PUSHED(`a7df8d8`) + PRODUCTION VERIFIED.
5. **2026-10-01 — ChatGPT 추적용 기록 규칙 + 한국 분리 규칙·장기 보강** — MASTER PUSHED(`1244c8c`, `6e0e32c`, `4d3a9f5`).
