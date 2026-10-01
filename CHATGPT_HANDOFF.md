# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**메인 지도 시각 높이·여백 축소 + 수동 지도 시점 유지 (2026-10-01, 집 PC).** 상태: VERIFIED → MASTER PUSHED(`a1560c9`) → PRODUCTION VERIFIED(Vercel Ready, viecganban.vn 확인).

## 변경 내용

- PC `.hme` 높이 `clamp(425px, calc(25vh + 215px), 485px)` → 1366×768=425px, 1440×900=440px, 1920×1080=485px. 가로 비율·3열 정렬 유지. Korea–지도 간격 8px, 지도–추천 영역 간격 33px. 모바일 여백/배치 별도 유지.
- 선택 공고 없는 오른쪽 패널에서 반복 정보 4행과 강조 배경을 덜고, 위치·반경 한 줄/작은 안내/가벼운 현재 위치 버튼으로 정리. 핀 선택 패널은 유지.
- `HomeMapCanvas` 반경 변경 시 `fitBounds` 제거. wheel·drag·줌 버튼은 수동 조작으로 기록; 반경은 원과 필터 결과만 변경. 지역·현재 위치를 명시적으로 선택하면 `recenterRequest`로 시점 재설정(같은 위치 재선택 포함). Geoapify provider·verified 정책·DB/필터 로직은 변경 없음.
- 수정 파일: `src/index.css`, `src/components/home/HomeMapExplorer.tsx`, `src/components/home/HomeMapCanvas.tsx`, 이 문서, `WORK_LOG.md`.

## 테스트 결과

- `npx tsc --noEmit`, `npm run build` 통과.
- 로컬 브라우저 PC 1366×768/1440×900/1920×1080: 목표 높이, 3열 상·하단선, Leaflet 부모 높이, 상·하 간격, 추천 영역 노출, 조건 더보기 기본 접힘/내부 스크롤, 핀→오른쪽 패널, 가로 넘침·페이지 오류 없음. 모바일 375px의 기존 세로 배치·핀 연동 유지.
- 지도 동작 재현 검사: 수정 전 wheel/drag/+ 버튼 후 radius 확대 시 줌 15→10 등으로 리셋됨. 수정 후 세 경우 줌·중심 유지, 초기 상태 radius 변경도 시점 유지. 지역 선택·현재 위치·같은 현재 위치 재선택은 재정렬 정상.
- Production: 세 PC 크기 425/440/485px, Korea–지도 8px·지도–추천 33px, 3열 정렬 확인. 1440에서 wheel 확대 후 radius 변경 시 줌·중심 유지. 추천 영역은 실제 데이터 로딩 뒤 세 크기에서 확인.

## 발견된 문제

- 이번 변경에서 새 미해결 문제 없음. 기존 공개 공고의 verified 핀 부족, 구식 `scripts/test-home-composition.mjs`, 로그인 고용주 전체 수정 화면 부재는 별도 과제.

## 다음 결정사항

- 이번 작업은 Production 확인 완료. Chợ Tốt 수집 전용 계정 테스트 등 다른 과제는 기존 보류 상태 유지.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-10-01 — 메인 지도 시각 높이·여백 축소 + 수동 시점 유지** — MASTER PUSHED(`a1560c9`) + PRODUCTION VERIFIED(425/440/485px, wheel+radius 시점 유지).
2. **2026-10-01 — 메인 지도 탐색 영역 PC 세로 높이 추가 축소** — MASTER PUSHED(`4817df2`) + PRODUCTION VERIFIED(440/470/510px, 3열 정렬, 추천 영역 첫 화면 노출).
3. **2026-10-01 — 메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선** — MASTER PUSHED(`3b69325`) + PRODUCTION VERIFIED(4종 로컬 브라우저·tsc·build, 실제 사이트 540px·타일 로딩).
4. **2026-10-01 — PC 메인 중간 영역 지도 탐색 개편** — MASTER PUSHED(`a7df8d8`) + PRODUCTION VERIFIED(빈 지도 + 안내, 한국 입구·Việc làm nổi bật 정상).
5. **2026-10-01 — ChatGPT 추적용 기록 규칙 + 한국 분리 규칙·장기 보강(문서)** — MASTER PUSHED(`1244c8c`, `6e0e32c`, `4d3a9f5`). 코드 변경 없음.
