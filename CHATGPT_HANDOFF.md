# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**지도 제스처 재정비 + 모바일 생활지도 bottom sheet (2026-10-06).** 상태: IMPLEMENTED / VERIFIED(tsc·tests 30/30·build) / PREVIEW APPROVED(사용자, 실제 Android, `jobi-6msh3jqki`) / BRANCH PUSHED(`520031f`) / **MASTER PUSHED(`cccd767`, fast-forward) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`, `dpl_FzUtnYjhtcr3NUZuMkV8KHCnNbb7`) / 자동 검증 완료 / PRODUCTION VERIFIED(사용자, 2026-10-06: 실제 PC 마우스·Android 최종 확인)**. 승인 후 코드 수정 없음.

- 자동 검증(2026-10-06, viecganban.vn, 브라우저 자동화 — 실제 손가락·물리 마우스 아님): VietMap 로드(vietmap 요청 11, Geoapify 0), 콘솔 오류 0. 데스크톱 cooperativeGestures off·scrollZoom on·dragPan on. 모바일 에뮬레이션(375px) touch 기기 판정·760px 레이아웃 true, touchPitch off, 캔버스 touch-action none(SDK 지도 조작), 선택 전 sheet 없음, sheet 코드 번들 포함. 미검증: 실제 휠·드래그 체감, 패널 끝 휠→페이지, POI/건물 클릭, sheet 열기/닫기, 실제 터치 제스처.
- branch: `fix/map-wheel-page-scroll`(master `35b7cce` 기반, master에 fast-forward 반영). 회사 PC worktree `C:\Users\HP\Downloads\jobi-wheel-fix`.
- 승인 Preview: https://jobi-6msh3jqki-mshw1895-6089s-projects.vercel.app/?mapAcceptance=1 (이 worktree 미커밋 상태에서 CLI 배포 → 승인 후 같은 소스를 `520031f`로 commit·push, 배포 이후 소스 변경 없음).
- **기존 방향에서 바뀐 것(사용자 결정)**:
  - 6d02be6의 `cooperativeGestures`(휠/한 손가락=페이지, Ctrl+휠·두 손가락=지도)는 **폐기**. 실제 Windows 마우스·Android에서 불편/실패.
  - 데스크톱: 지도 위 일반 휠=지도 줌, 드래그=이동(SDK 기본). 페이지 스크롤은 지도 밖·좌우 패널 끝에서.
  - 모바일: 지도 조작 우선 — 한 손가락=지도 이동(상하좌우), 핀치=확대, 탭=선택(SDK 기본). 회전·기울기만 끔. 지도 위 페이지 스크롤을 위해 제스처를 바꾸지 않고, 상세는 하단 sheet로 해결.

## 변경 내용

- `homeMapGestures.ts`: `HOME_MAP_GESTURE_OPTIONS = { cooperativeGestures: false }`, `isTouchDevice()`(`(hover: none) and (pointer: coarse)`), 터치 기기만 `applyTouchMapDefaults`(회전·기울기 끔 — 나침반 버튼 없음), POI 탭 오차 상수.
- `VietMapMapCanvas.tsx`/`GeoapifyMapCanvas.tsx`: 위 옵션 사용 + 터치 기기 기본값 적용. POI 탭 판정: 탭 지점이 아이콘·라벨 상자 안이면 선택, 아니면 아이콘 중심 근처(반지름 9px + 마우스 2px/터치 6px)만, 아니면 건물(기존 ±8px 상자 → 빈 곳 오선택 수정).
- `pageScrollChain.ts` + `HomeMapExplorer`: 데스크톱 왼쪽 필터·오른쪽 패널이 끝에 닿으면 같은 휠로 페이지 스크롤(Chrome scroll latching 때문에 버려지던 휠).
- `MobileDetailSheet.tsx` + `mobileSheetGesture.ts`: 모바일(≤760px, `.hme` 기준) 장소·건물·공고 상세를 body portal 하단 sheet로. 접힘 약 38% / 펼침 약 85%, 손잡이 탭·드래그(위=펼침, 아래=접기→닫기), ✕ 닫기(선택 해제), 내부 스크롤(`overscroll-behavior: contain`), 페이지 자동 스크롤·지도 viewport 변경 없음. 데스크톱은 오른쪽 패널 그대로. `HomeMapExplorer`는 상세 JSX를 한 번 만들어 데스크톱 패널/모바일 sheet에 배치.
- `index.css`: sheet 스타일(z-index 700)만 추가.

## 테스트 결과

- tsc 통과, `npm test` 30/30(신규: pageScrollChain, mobileSheetGesture, homeMapGestures 갱신), build 통과.
- 사용자 실제 Android(승인 Preview): 상점/건물/공고 선택, sheet 표시·접기/펼치기·내부 스크롤, sheet 열린 상태 지도 이동/핀치, 닫은 뒤 지도 정상 — 전체 승인.
- 데스크톱: 일반 휠=지도 줌, 드래그=이동. Preview `jobi-danoopd0b` 이후 사용자가 "현재 desktop 동작 유지"를 지시했고 이후 데스크톱 코드 변경 없음. 데스크톱 실제 마우스 결과를 별도로 기록한 승인 문구는 없음 → Production 전 1회 확인 권장.

## 발견된 문제

- 실험 기록(재시도 금지): Android Chrome에서 `touch-action: pan-y`/`pan-x pan-y`는 첫 손가락이 움직이면 브라우저가 스크롤을 가져가 두 번째 손가락이 앱에 오지 않음(실기기 로그 n=2 없음). 직접 만든 Pointer 제스처·지도 조작 모드 버튼도 거쳐 최종적으로 SDK 기본 + bottom sheet로 결정.
- 모바일에서 지도 위 한 손가락은 지도 이동이라, 페이지는 지도 밖에서 스크롤해야 함(사용자 수용).
- 회사 PC 메모리 부족(여유 0.5GB 수준)으로 tsc/build가 간헐 OOM → `NODE_OPTIONS=--max-old-space-size=1536` + build 재시도로 통과.
- VietMap 데이터 한계·비용·휴대폰 GPS 실기기·반경 200m/300m 결정 — 이전과 동일.

## 다음 결정사항

- **사용자 최종 확인 완료(2026-10-06)**: 실제 PC 마우스(휠=줌, 드래그=이동, 좌우 패널 끝 휠→페이지, POI/건물 클릭)·Android(선택 시 sheet, 접기/펼치기, 내부 스크롤, 한 손가락 이동, 핀치) Production 확인 완료.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. VietMap에 Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- **모니터링**: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고).
- Vercel env(2026-10-05 정리): `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview.
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
- 지도 위 페이지 스크롤 수정 + VietMap 예비 지도 오전환 수정 — 2026-10-06 — MASTER PUSHED(`6d02be6`) / PRODUCTION DEPLOYED·VERIFIED. (cooperativeGestures 방식은 위 작업에서 폐기)
- 생활지도 1차+2차(건물·근무지·생활시설 지도, 위성, 클릭 상세 패널) — 2026-10-06 — MASTER PUSHED(`106e8e4`) / PRODUCTION DEPLOYED·VERIFIED
- VietMap 메인 지도 + 공동 핀 동기화 — 2026-10-05 — MASTER PUSHED(`8f0498f`) / PRODUCTION DEPLOYED·VERIFIED. VietMap key 제한은 권한 부족으로 보류
- Google 지도 VECTOR 전환 + 기본 반경 UX 검토 — 2026-10-02 — MASTER PUSHED / PRODUCTION DEPLOYED (`90bf841`)
