# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**근무지 정확 좌표 — VietMap 기준 관리자 검토 화면 + 직접 지정 + 자동 후보 생성(키 있을 때만) (2026-10-06).** 상태: IMPLEMENTED / VERIFIED(tsc·tests 31/31·build) / PREVIEW APPROVED(사용자, `jobi-4i40fr4nw`, 실제 관리자 화면·저장 테스트) / BRANCH PUSHED(`71acf9a`) / **MASTER PUSHED(`71acf9a`, fast-forward) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`, `dpl_GvH2AbDrcqdrL5wppJxUfNVs6fHo`) / 자동 확인 완료 / PRODUCTION VERIFIED(사용자, 2026-10-06: Production 관리자 > 📍 Vị trí 지도 클릭·위성 정상, 저장은 하지 않음)**. 승인 후 코드 수정 없음. DB 스키마(DDL) 변경 없음.

- 배경: 근무지 exact 좌표 0건(글자 지오코딩은 ward 수준까지). 생활지도에 이미 VietMap POI·건물이 정확히 표시되므로 이를 근무지 좌표의 기준으로 삼는다. 새 승인 체계는 만들지 않고 기존 8d30c0d(`job_location_candidates`·관리자 RPC·`jobCoords` 규칙)에 붙였다.
- branch: `feat/location-candidates-vietmap`(master `86812fb` 기반, master에 fast-forward 반영). 회사 PC worktree `C:\Users\HP\Downloads\jobi-wheel-fix`.
- 승인 Preview: https://jobi-4i40fr4nw-mshw1895-6089s-projects.vercel.app (미커밋 상태에서 CLI 배포 → 승인 후 같은 소스를 `71acf9a`로 commit·push, 배포 이후 소스 변경 없음).
- **기존 방향에서 바뀐 것**: 승인 후보 지도가 Leaflet(`JobLocationMap`) → **VietMap 일반지도·위성**. 승인·거절은 prompt 대신 1클릭(메모 선택, 비우면 승인은 기본 문구). 자동 후보는 **새 공고만**(기존 213곳 backfill 안 함, 사용자 결정).

## 변경 내용

- `AdminLocations.tsx` + `AdminVietMap.tsx`: 후보 카드에 VietMap 지도(Bản đồ/Vệ tinh), 후보 상태별 핀 색. 공단·지역(area) 후보, 회사명·주소가 바뀐 후보는 기존 규칙대로 승인 버튼 없음. 철회(revoked) 후보는 재승인 가능(DB 함수·PGlite 테스트·원래 화면 모두 의도된 동작, 같은 공고·주소의 기존 승인은 자동 철회돼 승인 1개 유지).
- "＋ Tự chọn vị trí trên bản đồ" 패널: 공고 검색 → 주소(근무지 목록) → 지도·위성 클릭으로 위치 지정(POI 클릭 시 이름을 근거에 자동 입력, source=map_listing) → 정밀도(building/site/entrance) → "Thêm ứng viên"(후보만) 또는 "Thêm và duyệt". 기존 RPC `admin_add_location_candidate` / `admin_review_location_candidate`만 사용. 비공개 공고도 선택 가능(관리자 읽기 권한).
- 클릭 처리: POI 이름 조회가 실패해도 클릭 좌표는 항상 전달. **`?mapDebug=1`이면 지도 아래에 클릭 수 진단 표시 — 옵트인이라 그대로 유지(기본 화면에는 보이지 않음).**
- `scripts/generate-location-candidates.ts` + `src/lib/locationCandidateMatch.ts(+test)`: 새 공고 근무지 → VietMap Search v4/Place v4로 POI 후보 생성. **`VIETMAP_SERVICE_KEY`가 없으면 아무것도 하지 않고 정상 종료(꺼진 상태, 확인함)**, 기본 dry-run, `--apply`일 때만 pending 저장, 자동 승인 없음. 회사명 유사도 ≥50%만 후보, 행정구역(phường/xã·quận/huyện·tỉnh) 일치를 match/partial/mismatch로 근거(`evidence`)에 기록 — DDL 없이 기존 컬럼 사용. 같은 공고·주소 30 m 안 후보(거절 포함) 재생성 안 함. 크롤러 워크플로에는 아직 연결하지 않음.
- 승인된 좌표의 사용 규칙은 그대로: building/site=지도 핀·거리검색, entrance만 길찾기, 공개 조회는 공개 중인 공고의 승인만.

## 테스트 결과

- tsc 통과, `npm test` 31/31(신규 `locationCandidateMatch.test.ts`), build 통과.
- 로컬 실제 마우스 클릭(브라우저 패널): 빈 곳 클릭→핀·좌표 문구·버튼 활성, POI 클릭→근거에 이름 자동 입력, 위성 모드·위성 전환 직후 클릭 모두 정상. 실제 패널을 dev/production build로, 공고 #4682로 열어 재현 시도 — 모두 정상.
- 사용자 실제 관리자 화면(Preview): #4613 지도 클릭·POI 클릭 정상. 처음 보고된 "클릭해도 핀이 안 나옴"은 로컬에서 재현되지 않았고 원인 미확정 — 방어 처리와 `?mapDebug=1` 진단을 넣은 Preview에서는 정상 확인됨.
- 저장 테스트(사용자가 Preview에서 #4613, building: 추가 → 승인 → 철회): 후보 id 3이 `revoked`로 남음, 감사 로그 3건(`location_candidate.add`/`.approve`/`.revoke`, id 32–34), `local_jobs` #4613(active=false, lat/lng null)·근무지 837(ward 21.002373,105.810476, location_verified=true) 기준값과 동일, 승인 후보 0건 → 공개 영향 없음. **Production DB에 테스트 후보 1건(revoked)과 감사 로그 3건이 영구히 남음(삭제 기능 없음).**
- Production 자동 확인: `https://viecganban.vn/admin` HTTP 200, 서빙 중인 번들에 관리자 chunk(`AdminDashboard`, `AdminVietMap`)와 직접 지정 패널 문구·`mapDebug` 포함. 관리자 로그인이 필요한 실제 화면(📍 Vị trí)은 확인하지 못함.

## 발견된 문제

- **VietMap 서버용 키 없음**: 기존 Tilemap 키로 Search v4 시험 호출 시 HTTP 423 "Your request is limited". Search v4 응답에는 좌표가 없어 Place v4가 추가로 필요(둘 다 1회 = 1 transaction). 자동 후보 생성은 서버용 키(Search·Place 허용)가 생길 때까지 꺼져 있음. Console 키 생성·수정 권한은 이전에 `UN_AUTHORIZED`.
- VietMap 지도 타일의 POI에는 주소가 없어 지점 판별에는 쓸 수 없음(직접 지정 패널의 이름 입력용으로만 사용).
- 현재 근무지 구조: 활성 공고 24건 중 공개 중인 근무지 0곳, 전체 근무지 493곳 중 exact 0·ward 213 — 이 화면으로 승인이 쌓이기 전까지 지도 핀·거리검색 대상은 늘지 않음.
- 클릭 문제 원인 미확정(위 참고). 회사 PC 메모리 부족으로 tsc/build가 간헐 OOM(`NODE_OPTIONS=--max-old-space-size=1536` + 재시도).

## 다음 결정사항

- **사용자 확인 완료(2026-10-06)**: Production 관리자 > 📍 Vị trí 화면이 열리고 지도 클릭·위성(Vệ tinh) 정상 — 저장 버튼은 누르지 않음(DB 쓰기 없음).
- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
- 지도 위 페이지 스크롤 수정 + VietMap 예비 지도 오전환 수정 — 2026-10-06 — MASTER PUSHED(`6d02be6`) / PRODUCTION DEPLOYED·VERIFIED. (cooperativeGestures 방식은 이후 작업에서 폐기)
- 생활지도 1차+2차(건물·근무지·생활시설 지도, 위성, 클릭 상세 패널) — 2026-10-06 — MASTER PUSHED(`106e8e4`) / PRODUCTION DEPLOYED·VERIFIED
- VietMap 메인 지도 + 공동 핀 동기화 — 2026-10-05 — MASTER PUSHED(`8f0498f`) / PRODUCTION DEPLOYED·VERIFIED. VietMap key 제한은 권한 부족으로 보류
