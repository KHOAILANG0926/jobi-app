# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**VietMap 지도 Preview 소스 복원 + 공동 핀 selectedJob 동기화 (2026-10-05).** 상태: IMPLEMENTED / VERIFIED(tsc·build·tests) / PREVIEW APPROVED(사용자) / BRANCH PUSHED. **master 미반영, Production 미배포.**

- branch: `feat/home-map-vietmap-sync` (master `ade2926` 기반, origin에 push). worktree: 집 PC `C:\Users\HP\Downloads\jobi-vietmap-sync`.
- 승인된 Preview: https://jobi-1cre9b7j6-mshw1895-6089s-projects.vercel.app/?mapAcceptance=1 (이 branch 작업 트리에서 CLI Preview 배포, 커밋 내용과 동일).
- Production은 기존 상태(Geoapify) 유지.
- 기존 방향에서 바뀐 것: 메인 지도 primary provider가 Google → **VIETMAP**(`VITE_VIETMAP_TILEMAP_KEY`)으로 바뀜. 키가 없거나 실패하면 기존 Geoapify fallback. Google provider 파일은 삭제하지 않았지만 더 이상 `HomeMapCanvas`에서 쓰지 않는다. TomTom 후보는 탈락, 코드 미포함.

## 변경 내용

- 원본: Codex가 미커밋 상태로 CLI 배포했던 검증 Preview `dpl_5vVjSum6NNQYVyFBf9vif4p8kgYE`의 source를 Vercel API로 회수해 master 위에 필요한 지도 파일만 반영. 격리 폴더(`qkd\work\jobi-shared-pin-sync`)는 일부 파일이 빠진 불완전 사본이라 기준으로 쓰지 않음.
- VietMap: `VietMapMapCanvas`, `vietMapStyle`, `vietMapDetail`, `vietMapError` 추가, `HomeMapCanvas`/`homeMapProviderState` provider 교체. dependency `@vietmap/vietmap-gl-js` 6.0.1(`npm install`로 lock 갱신).
- 공동 핀: `groupHomeMapMarkers`로 같은 좌표 공고를 숫자 핀 하나로 묶고 목록 팝업 표시. `sharedJobPopupOptions`(`focusAfterOpen: false`)로 팝업 첫 항목 자동 포커스가 선택처럼 보이던 문제 수정.
- 반경: `RADIUS_MIN_KM` 1 → 0.1, `homeMapSearch`(반경 정규화/표시, 위치 정확도 경고, 결과 카운트), 빠른 버튼 100m/300m/500m/1/3/5/10/20km, 관련 CSS. pan/zoom 후 반경 변경 시 viewport 유지.
- acceptance: `previewMapAcceptanceJobs` 5건은 Vercel Preview 빌드 + `?mapAcceptance=1`에서만 로드(`vite.config` `VITE_MAP_ACCEPTANCE`). Production 빌드에는 포함되지 않음을 확인.
- 제외: TomTom 파일, `vietMapDiagnostics`(+`VITE_MAP_DIAGNOSTICS`), 깨진 `Home.deployed.tsx`.
- CLAUDE.md에 "작업 브랜치·Preview·Git 종료 게이트 — MANDATORY" 추가.

## 테스트 결과

- `npx tsc --noEmit` 통과, `npm test` 23/23 파일 통과, `npm run build` 통과.
- Production 빌드에 acceptance 데이터 0건, Preview(`VERCEL_ENV=preview`) 빌드에는 포함. 더미 키 빌드에서 VietMap chunk(774kB) 정상 생성.
- Preview 동작 검증(Senna → 공동 핀 → Terminal 3건 → Pizza Hut)은 사용자가 확인·승인. Claude 브라우저는 Vercel 로그인 벽으로 직접 확인하지 못함.

## 발견된 문제

- Preview 환경에 `VITE_ZALO_APP_ID`가 없어 Preview 헤더에 Zalo 버튼이 안 보임(Production에는 있음). 코드 문제 아님, 별도 작업.
- 실제 휴대폰 GPS 검증 미완료.
- chunk 크기 경고: Geoapify 1.04MB(기존), VietMap 774kB(lazy).
- 반경 빠른 버튼 200m vs 300m 결정 보류.

## 다음 결정사항

- **진행 중(2026-10-05, 집 PC에서 이어서): VietMap 키 도메인 제한.** 순서: VietMap Console(https://maps.vietmap.vn/console/, Consumers → 프로젝트 Detail)에 사용자가 직접 로그인 → Production 전용 Tilemap key(허용: `viecganban.vn`, `www.viecganban.vn`) + Preview 전용 key 생성 → 두 키 일일 사용량 제한 → 기존 키는 삭제하지 않음 → Vercel env 교체(Production/Preview 각각) → style + 실제 tile 요청으로 live/preview 허용, 임의 도메인·Referer 없음 차단 재테스트. 결과 확인 전 master merge·Production deploy 금지. 제한이 tile에 적용되지 않으면 문서에 기록하고 사용량 한도·Daily Report 모니터링 추가 후 배포 진행.
- 현재 기존 VietMap 키는 임의 도메인·Referer 없음에서도 style.json 200(도메인 제한 미적용 상태).
- Vercel env 정리 완료(2026-10-05): `VITE_VIETMAP_TILEMAP_KEY` Production 추가(Preview와 동일 값, Config), `VITE_ZALO_APP_ID` Preview 추가(Production과 동일 값). 둘 다 다음 배포부터 반영.
- 위 작업 후: 이 branch를 master에 합치고 Production 배포.
- 집 PC 시작: `git fetch origin` → `feat/home-map-vietmap-sync` checkout(또는 worktree) → 이 문서 확인.
- `D:\Codex\JOBI`(`feat/korea-home-p1`, master에 이미 병합된 오래된 branch)의 미커밋 4개 처리 — 별도 작업. 이 branch에서 건드리지 않음.

## 최근 완료 작업 로그

- VietMap 지도 Preview 소스 복원 + 공동 핀 동기화 — 2026-10-05 — BRANCH PUSHED(`feat/home-map-vietmap-sync`), Production 미배포
- Google 지도 VECTOR 전환 + 기본 반경 UX 검토 — 2026-10-02 — MASTER PUSHED / PRODUCTION DEPLOYED (`90bf841`)
