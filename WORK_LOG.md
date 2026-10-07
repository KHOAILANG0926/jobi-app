# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-07 — 공고 상세 개편(알바몬 구조) + 원문 항목 추출 dry-run

- 요청: 상세 화면 알바몬 구조·디자인, 연락처 중복 정리, 기업정보 숨김, description 항목 추출(#4682 dry-run 먼저).
- 변경: 5구역·고정 탭·"라벨|값" 표·급여 배지·하단 Gọi/Zalo 바, 새 컬럼 9개 연결, jobDescriptionExtract(+test)·extract-job-fields(dry-run).
- 검증: tsc, tests 35/35, build, 로컬 PC 확인, Preview 200. DB 쓰기 없음.
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영(미승인).
- 남은 문제: #4682 추출 결과 확인 후 DB 반영 결정, 언어·출장 컬럼(DDL) 결정, 리뷰 유지 여부, 모바일 실기기 확인.

## 2026-10-07 — master 반영 + Production SSR 500 장애 복구

- 요청: `7907b8b` master fast-forward·배포 확인 → 장애 발견 후 복구 승인.
- 원인/수정: SSR 함수 번들에 react-router dom-export.js 누락 → `vercel.json` includeFiles에 `node_modules/react-router/dist/**` 추가(Preview 대조 검증: 수정 없음 500 / 있음 200).
- 검증: tsc·tests 33/33·build, Production 상세·tim-kiem·tuyen-gap·sitemap·홈 200, 상세 로고 이니셜.
- commit/push: master `cd0eeeb`(fast-forward) → 자동 배포 Ready. 장애 약 1시간. 재발 시 로그의 `Cannot find module` 확인.

## 2026-10-07 — 공고 항목 jobSchema + Production DB 적용(DDL 9·로고 244·재분류 26)

- 요청: 승인된 즉시 수정 실행. master merge·배포 금지, DB는 전후 건수만 보고.
- 변경: jobSchema.ts(+test), migration 20261007013659(컬럼 9개), `local_jobs.image_url` 244건 null, 재분류 26건(#4577·#4594·#4598·#4601 제외, 소분류만 바뀌는 3건은 별도 승인 후 추가 적용: 소분류 null 0→3).
- 검증: tsc, tests 33/33. DB 전후: 컬럼 0→9, 로고 244→0, 재분류 26/26, 재dry-run 잔여 4(제외 건).
- commit/push: branch `fix/source-logo-and-classifier`. master·코드 배포 미반영.
- 남은 문제: 새 컬럼 미사용(상세 개편), 제외 4건 규칙 보완.

## 2026-10-06 — 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) Production 반영

- 요청: job_work_locations exact 좌표 0건 → VietMap 상가·회사(POI)를 근무지 좌표 기준으로 연결. 기존 승인 체계(8d30c0d)에 붙이고 새 체계는 만들지 않음.
- 변경: AdminLocations를 VietMap 지도·위성으로, 1클릭 승인·거절·철회, 지도·위성 클릭 직접 지정 패널(POI 이름 자동 입력), 자동 후보 생성 스크립트(VIETMAP_SERVICE_KEY 없으면 건너뜀, 기본 dry-run, 새 공고만), 회사명·행정구역 일치 판정. DDL 없음(근거는 evidence 텍스트).
- 검증: tsc, tests 31/31, build. 로컬 실제 클릭(핀·좌표·버튼·POI 이름·위성), 사용자 실제 관리자 화면·저장 테스트(#4613 추가→승인→철회, 감사 로그 3건, 공고·근무지 837 기준값 동일, 공개 영향 없음). 클릭 실패 최초 보고는 재현 안 됨(원인 미확정, 방어 처리+?mapDebug=1 진단 추가).
- commit/push/deploy: `71acf9a` → master fast-forward, Production `jobi-bo6e6kzkn`(`dpl_GvH2AbDrcqdrL5wppJxUfNVs6fHo`) Ready. `/admin` 200, 서빙 번들에 새 관리자 코드 확인(로그인 화면은 미확인).
- 사용자 확인: 2026-10-06 Production 관리자 > 📍 Vị trí 지도 클릭·위성 정상(저장 안 함) → PRODUCTION VERIFIED(사용자).
- 남은 문제: VietMap 서버용 키 없음(Search v4 HTTP 423) → 자동 후보 꺼짐, Production DB에 테스트 후보 1건(revoked)·감사 로그 3건 남음.

## 2026-10-06 — 지도 제스처 재정비 + 모바일 bottom sheet Production 반영 + AI 전략 문서

- 요청: 승인 Preview(`jobi-6msh3jqki`) 소스를 master 반영·Production 배포, AI_DISCOVERY_STRATEGY.md 추가.
- 변경: master `35b7cce` → `cccd767` fast-forward(코드 변경 없음). 문서: AI_DISCOVERY_STRATEGY.md(사용자 원문 그대로), CLAUDE.md에 "참고용 배경 문서, 임의 구현 금지" 한 줄, HANDOFF 전략 참고 한 줄.
- 검증: tsc, tests 30/30, build. Production `jobi-cx74ww02v` Ready(viecganban.vn). 자동 검증: VietMap 로드·Geoapify 0·콘솔 오류 0, 데스크톱 휠 줌·드래그 설정, 모바일 터치 설정·sheet 코드.
- commit/push/deploy: master `cccd767` push → Vercel Production 자동 배포 Ready.
- 사용자 확인: 2026-10-06 실제 PC 마우스·Android 최종 확인 완료 → PRODUCTION VERIFIED(사용자).
- 남은 문제: VietMap 키 제한 권한 대기.

## 2026-10-06 — 지도 제스처 재정비 + 모바일 생활지도 bottom sheet — PREVIEW APPROVED, BRANCH PUSHED

- 요청: 6d02be6 cooperativeGestures 방식이 실제 마우스·Android에서 실패 → 데스크톱 휠=지도 줌, 모바일 지도 조작 우선 + 상세 하단 sheet.
- 변경: cooperativeGestures 폐기(SDK 기본 제스처), 터치 기기 회전·기울기만 끔, POI 탭 판정 정밀화, 데스크톱 좌우 패널 끝 휠→페이지(pageScrollChain), 모바일(≤760px) 상세 bottom sheet(접힘 38%/펼침 85%, 손잡이 드래그, 내부 스크롤).
- 이유: Android Chrome은 pan-y 계열 touch-action에서 첫 손가락 이동 후 두 번째 손가락을 앱에 전달하지 않음(실기기 로그). 직접 제스처·지도 조작 모드도 거쳐 SDK 기본 + sheet로 확정.
- 검증: tsc, tests 30/30, build. 사용자 실제 Android 승인(Preview `jobi-6msh3jqki`). 실패 Preview: mxku84k2y, 2c0mhtph5, fycayo97n, f5g8m0ji5, hdwhiwnd7 등.
- commit/push: `520031f` → `origin/fix/map-wheel-page-scroll`. master·Production 미반영.
- 남은 문제: master merge·Production 배포 결정, 데스크톱 실제 마우스 1회 확인 권장, VietMap 키 제한 권한 대기.

## 2026-10-06 — 스크롤 수정 + 예비 지도 오전환 수정 Production 반영

- 요청: 승인된 `6d02be6`(Preview `jobi-jkuypvkg8`)를 master·Production 반영 후 검증.
- merge/push: master `f84a02a` → `6d02be6` fast-forward(merge commit 없음), branch·master 양쪽 tsc·tests 28/28·build 통과. Vercel Production `jobi-oo9vd5ibp` Ready.
- Production 검증: 일반 휠 페이지 스크롤(+312px, zoom 불변), Ctrl+휠 확대(합성 이벤트, 11.28→12.28), 숨겨진 탭 25초 → vietmap 유지·활성화 후 준비·Geoapify 0, 클릭 A~E·G 통과, 위성 전환 유지, 콘솔 오류 0.
- 미검증(실기기): 모바일 1손가락 페이지 스크롤(touch-action `pan-x pan-y`만 확인), 실제 위치 권한 현재 위치. 공고 핀 관련은 Production 확인 좌표 공고 0건이라 미검증(기존).

## 2026-10-06 — 생활지도 회귀(POI 클릭 안 됨·POI 밀도 감소) 수정 — PREVIEW APPROVED, BRANCH PUSHED

- 원인: 메인 지도가 VietMap 대신 Geoapify 예비 지도로 전환된 상태(장소 클릭 패널·생활지도 스타일·위성 없음). 전환 경로 ① 숨겨진 탭에서 로드 시 SDK rAF 정지로 준비 안 됨 → 12초 timeout(숨겨진 동안에도 흐름) → 탭을 열어도 예비 지도 유지(로컬 재현) ② VietMap style.json 간헐 지연(Production 실측 12.3초, 평소 46~274ms).
- 변경: `visibleTimeout.ts`(+test) 보이는 시간만 세는 초기화 timeout, `fetchVietMapStyle`(5초 제한 후 1회 재시도, HTTP 오류는 즉시 실패, +test). 스타일·클릭 로직 변경 없음.
- 검증: tsc, tests 28/28, build. 숨겨진 탭 20초 후에도 vietmap, 탭 표시 후 준비 완료. 실제 마우스 A 카페 아이콘·B 라벨·C 회사·D 생활시설·E 이름 없는 건물·F 공고 핀(공고 패널)·G 빈 곳 닫힘 통과.
- 밀도(같은 좌표·줌·463x419): Production VietMap = 로컬 동일(예 BN 중심 z15 POI 27/회사 13/식음 5), Production 예비 지도는 같은 지점 z16 POI 4·회사 0·식음 0 vs VietMap 8·3·2.
- commit/push: 통합 Preview `jobi-jkuypvkg8` 승인 후 소스 그대로 branch `fix/page-scroll-map` commit·push. master·Production 안 함.

## 2026-10-06 — 지도 위 페이지 스크롤 막힘 수정 — PREVIEW APPROVED, BRANCH PUSHED

- 원인: VietMap/MapLibre 기본 제스처(휠=지도 확대·preventDefault, 한 손가락 드래그=지도 이동, 캔버스 `touch-action: none`). Production 실측: 지도 위 휠 시 scrollY 변화 0·지도 zoom 11.28→10.88.
- 변경: `homeMapGestures.ts`(+test) `cooperativeGestures: true` + 베트남어 안내, VietMap·Geoapify 지도 옵션에 적용. 레이아웃/CSS 변경 없음.
- 검증: tsc, tests 27/27, build. 로컬: 지도 위 휠 → 페이지 +300px·zoom 불변, Ctrl+휠 확대, 마우스 드래그 이동, 최상단→하단(1939px) 연속, 위성·상세패널 열린 상태 동일, 375px 캔버스 `touch-action: pan-x pan-y`·핀 탭 선택·가로 넘침 0.
- commit/push: 회귀 수정과 함께 통합 Preview `jobi-jkuypvkg8`로 승인, branch `fix/page-scroll-map` commit·push(master `f84a02a` 기반). 실기기 1손가락 스크롤 미검증.

## 2026-10-06 — 생활지도 1차+2차 Production 반영

- 요청: 승인된 `106e8e4`(Preview `jobi-ifofpmbdx`)를 master merge·Production 배포·검증.
- 확인: 코드 파일 최종 수정(10-05 21:28) < Preview 생성(21:32), 승인 후 변경은 문서뿐. branch·master에서 tsc, tests 26/26, build 통과.
- merge/push: master `a01f3c6` → `106e8e4` fast-forward(merge commit 없음), push 완료. Vercel Production `jobi-pi2g7lxz1` Ready.
- Production 검증: VietMap·Geoapify 0·콘솔 오류 0, 건물/회사/생활시설 클릭 패널·강조, 위성 전환 유지, 375px 넘침 0.
- 남은 문제: Production 확인된 근무지 좌표 공고 0건 → 공동 핀·선택 공고 동기화·공고 연결은 Production 실데이터 미검증. VietMap key 권한 문제(기존).

