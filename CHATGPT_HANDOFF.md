# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**메인 지도 탐색 영역 PC 세로 높이 추가 축소 (2026-10-01, 집 PC).** 상태: VERIFIED → MASTER PUSHED(`4817df2`) → PRODUCTION VERIFIED(Vercel Ready, viecganban.vn 세 크기 확인).

## 변경 내용

- `src/index.css`의 PC `.hme` 높이만 `clamp(440px, calc(25vh + 245px), 510px)`로 변경. 가로폭·3열 구조·내부 스크롤·Leaflet 100%·필터/지도 로직·모바일·Geoapify provider 변경 없음.
- 1366×768=440px, 1440×900=470px, 1920×1080=510px. 이전 500/540/580px보다 낮음.
- 이 문서와 `WORK_LOG.md`를 최신 상태로 갱신.

## 테스트 결과

- `npx tsc --noEmit` 및 `npm run build` 통과.
- 로컬 브라우저 PC 세 크기: 3열 상·하단 정렬, 조건 더보기 기본 접힘/펼침 후 높이 유지·왼쪽 내부 스크롤, 반경 변경, verified 핀 클릭→오른쪽 패널, 가로 넘침·페이지 오류 없음. 지도 아래 `Việc làm nổi bật` 제목이 첫 화면에 보임.
- Production `viecganban.vn` 브라우저에서도 PC 세 크기 440/470/510px, 3열 정렬, `Việc làm nổi bật` 첫 화면 노출, 가로 넘침·페이지 오류 없음 확인.

## 발견된 문제

- 이번 작업에서 새 문제 없음. 로컬 Geoapify 키 부재는 이전과 동일하며 Production에는 기존 키 설정됨.
- 기존 과제: 실제 공개 공고 핀 데이터 부족, `scripts/test-home-composition.mjs` 구식, 고용주 전체 수정 화면 없음(이번 범위 밖).

## 다음 결정사항

- 이 UI 조정은 Production 검증 완료. Chợ Tốt 수집 전용 계정 테스트 등 기존 별도 과제는 보류 유지.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-10-01 — 메인 지도 탐색 영역 PC 세로 높이 추가 축소** — MASTER PUSHED(`4817df2`) + PRODUCTION VERIFIED(440/470/510px, 3열 정렬, 추천 영역 첫 화면 노출).
2. **2026-10-01 — 메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선** — MASTER PUSHED(`3b69325`) + PRODUCTION VERIFIED(4종 로컬 브라우저·tsc·build, 실제 사이트 540px·타일 로딩).
3. **2026-10-01 — PC 메인 중간 영역 지도 탐색 개편** — MASTER PUSHED(`a7df8d8`) + PRODUCTION VERIFIED(빈 지도 + 안내, 한국 입구·Việc làm nổi bật 정상).
4. **2026-10-01 — ChatGPT 추적용 기록 규칙 + 한국 분리 규칙·장기 보강(문서)** — MASTER PUSHED(`1244c8c`, `6e0e32c`, `4d3a9f5`). 코드 변경 없음.
5. **2026-09-30~10-01 — 연락처 출처 조사(Chợ Tốt 수집 전용 계정 테스트 준비) + 메인 개편 논의** — MASTER PUSHED(`018a3c1`, `cc909bb`, `b79d94b`). 문서·조사 스크립트만, 테스트는 미실행.
