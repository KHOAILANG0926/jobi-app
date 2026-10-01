# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선 (2026-10-01, 집 PC).** 기존 기능/DB 로직은 그대로 유지. 상태: 로컬 VERIFIED, master push·Production 확인은 이 작업의 후속 단계.

## 변경 내용

- PC `.hme` 높이 `clamp(500px, 60vh, 580px)` → 1366×768=500px, 1440×900=540px, 1920×1080=580px.
- 3열을 단일 grid 행에 맞추고 Leaflet wrapper/container를 가운데 부모 높이에 고정. 좌·우 패널은 각각 내부 스크롤, 모바일 필터도 펼침 시 고정 높이 안에서 스크롤.
- Leaflet 지도 타일을 기존 Geoapify `osm-carto`에서 밝은 `osm-bright`로 교체. 기존 `VITE_GEOAPIFY_API_KEY` 재사용, Google 타일·신규 키 없음. 필수 OSM/OpenMapTiles/Geoapify 출처 표시.
- 수정 파일: `src/index.css`, `src/components/home/HomeMapCanvas.tsx` 및 이 인계 문서·`WORK_LOG.md`.

## 테스트 결과

- `npx tsc --noEmit` 통과, `npm run build` 통과.
- 로컬 브라우저 1366×768 / 1440×900 / 1920×1080 / 모바일 375×812: 높이, 3열 상·하단 정렬, Leaflet 크기, 조건 펼침 높이 유지와 좌·우 내부 스크롤, 반경 변경, verified 핀 클릭→오른쪽 패널 연결, 가로 넘침·페이지 오류 없음 확인. `osm-bright` 타일 URL 적용 확인.
- 로컬 `.env.local`에 Geoapify 키가 없어 타일 이미지 자체는 회색으로 표시됨. Production의 실제 키/타일 로딩은 배포 후 확인 필요.

## 발견된 문제

- 로컬 키 부재로 밝은 타일의 실제 색상은 로컬 브라우저에서 시각 검증하지 못함. Production 확인 필요.
- 기존 과제: 실제 공개 공고 핀 데이터 부족, `scripts/test-home-composition.mjs` 구식, 고용주 전체 수정 화면 없음(이번 범위 밖).

## 다음 결정사항

- master push 후 Vercel Production 배포와 실제 지도 타일·정렬 확인. 키가 Production에도 없으면 새 API 키를 임의로 만들지 않고 사용자에게 보고.
- Chợ Tốt 수집 전용 계정 테스트는 별도 보류. DB/크롤러/연락처 정책 변경 금지.

## 최근 완료 작업 로그 (최근 5개만 유지, CLAUDE.md 규칙 5 참고)

1. **2026-10-01 — 메인 지도 탐색 영역 UI 높이·정렬·타일 스타일 개선** — 로컬 VERIFIED(4종 브라우저·tsc·build), master push·Production 확인은 후속 단계.

2. **2026-10-01 — PC 메인 중간 영역 지도 탐색 개편** — MASTER PUSHED(`a7df8d8`) + PRODUCTION VERIFIED(빈 지도 + 안내, 한국 입구·Việc làm nổi bật 정상).
3. **2026-10-01 — ChatGPT 추적용 기록 규칙 + 한국 분리 규칙·장기 보강(문서)** — MASTER PUSHED(`1244c8c`, `6e0e32c`, `4d3a9f5`). 코드 변경 없음.
4. **2026-09-30~10-01 — 연락처 출처 조사(Chợ Tốt 수집 전용 계정 테스트 준비) + 메인 개편 논의** — MASTER PUSHED(`018a3c1`, `cc909bb`, `b79d94b`). 문서·조사 스크립트만, 테스트는 미실행.
5. **2026-09-30 — 공고 공개 기준 복원 표 + 인계 문서 정리** — MASTER PUSHED(`a88ac27`, `7ec8d5b`). 기존 공개 게이트(09-05, job_quality.gate_auto_publish) 복원, Facebook 게이트 우회(crawl_facebook.py:1070 active=True 고정)·지원 경로 기준 충돌 발견. 문서만, 코드·DB 변경 없음.
