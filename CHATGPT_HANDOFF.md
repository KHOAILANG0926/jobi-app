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

- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05 확인, 사용자 결정: 배포는 막지 않음).**
  - 계정 `viecganban` Console에서 Consumer 생성(화면은 성공 표시, 서버 목록 미반영), API key 생성, 기존 key(`…18ea45`, consumer `public tile`) Referers 수정, consumer 일/월 한도 수정 모두 API 응답 `UN_AUTHORIZED`. 실제 변경 0건.
  - 기존 key 유지(삭제·재생성 금지). 현재 Referers·한도 없음 → 임의 도메인에서도 사용 가능. Tilemap key는 브라우저 공개용이고 사용량 낮음(2026-10-05 기준 월 20 Transaction).
  - **VietMap에 요청할 권한**: Consumer/API key 수정, Referers 설정, 일/월 usage limit 설정.
  - **권한이 생기면 즉시**: Referers `viecganban.vn; www.viecganban.vn`(+ 필요 시 Preview branch alias `jobi-git-feat-home-map-vietmap-sync-mshw1895-6089s-projects.vercel.app`), usage limit 설정(합의안 Production 일 500/월 10,000, Preview 일 100/월 2,000 — 분리 불가 시 공용 600/12,000), 가능하면 Production/Preview key 분리 후 Vercel env 교체.
- **Production 배포 후 모니터링**: VietMap Console → Daily Report에서 일 Transaction 확인. 급증(일 100 이상 등) 시 사용자 보고.
- Vercel env 정리 완료(2026-10-05): `VITE_VIETMAP_TILEMAP_KEY` Production 추가(Preview와 동일 값, Config), `VITE_ZALO_APP_ID` Preview 추가(Production과 동일 값). 둘 다 다음 배포부터 반영.
- 위 작업 후: 이 branch를 master에 합치고 Production 배포.
- `D:\Codex\JOBI`(`feat/korea-home-p1`, master에 이미 병합된 오래된 branch)의 미커밋 4개 처리 — 별도 작업. 이 branch에서 건드리지 않음.

## 최근 완료 작업 로그

- VietMap 지도 Preview 소스 복원 + 공동 핀 동기화 — 2026-10-05 — BRANCH PUSHED(`feat/home-map-vietmap-sync`), Production 미배포
- Google 지도 VECTOR 전환 + 기본 반경 UX 검토 — 2026-10-02 — MASTER PUSHED / PRODUCTION DEPLOYED (`90bf841`)
