# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-07 — 길찾기 복구(좌표 링크) + KCN 영역 윤곽·이름표·축소 배율(상세·Phóng to)

- 요청: Google 길찾기 허용(좌표로만), 승인 근무지 "Chỉ đường"·KCN "Chỉ đường đến KCN …"+정문 아님 안내, 공단 영역 테두리+이름표, 축소 배율, Phóng to에도 적용, CLAUDE.md·HANDOFF 규칙 정정.
- 변경: jobCoords `hasApprovedPoint`(출입구→승인 전체, 테스트 갱신), industrialParkOutlines(OSM 윤곽 28개)·industrialParkDirectionsUrl(+test), JobVietMap 윤곽 레이어(`home-kcn-area*`, 스타일 전환 시 유지)·fitBounds·길찾기 note, JobDetail 버튼, CLAUDE.md 규칙 정정.
- 검증: tsc, tests 37/37, build. 헤드리스 Chrome(WebGL) 실제 렌더: #4682 윤곽·이름표·길찾기 버튼(href 좌표)·위성·Phóng to·닫기, acceptance 승인 근무지 "Chỉ đường"(좌표) 상세·Phóng to, Geoapify 0·콘솔 오류 0.
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: 사용자 PC·폰 확인, 길찾기 버튼은 Google 지도 새 탭(외부) — 실제 클릭 도착 화면은 미확인.

## 2026-10-07 — 상세 지도 빈 화면 수정 + "Phóng to" 전체화면 지도(홈 바로가기 제거)

- 요청: Preview에서 상세 지도가 빈 화면 → 원인 확인·수정, 홈 이동 링크 제거, Phóng to 전체화면 모달 지도(주변 POI, 길찾기는 승인 좌표만).
- 원인: 벤더 CSS 지연 로드가 지도 컨테이너 position/크기를 덮어씀(높이 0). 수정: 인라인 position/크기 + ResizeObserver. 홈 바로가기(mapDeepLink·HomeMapExplorer 변경)는 제거.
- 검증: tsc, tests 37/37, build. 헤드리스 Chrome(SwiftShader WebGL, CDP)으로 실제 렌더 확인: #4682 일반지도·위성·전체화면(POI·건물 표시)·닫기 복귀, 확인된 근무지(acceptance-pizza) 핀, 모바일 390px 전체화면, Geoapify 0·콘솔 오류 0.
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: 실제 사용자 PC·폰 확인, 길찾기 링크 표시(출입구 승인 좌표 공고가 없어 화면으로는 미확인).

## 2026-10-07 — 상세 근무지역 지도를 VietMap으로 + 출처 있는 KCN 중심 좌표 + 홈 생활지도 바로가기

- 요청: Leaflet/Geoapify 대신 VietMap(홈과 같은 스타일·Bản đồ/Vệ tinh), KCN 중심 좌표(출처 필수·핀/길찾기 없음), 지도 아래 홈 지도 이동 버튼.
- 변경: JobVietMap(신규), industrialParks(OSM way 28개, 출처 id 포함)·industrialPark 매칭(+test), mapDeepLink(+test)·HomeMapExplorer 읽기, JobDetail 연결·CSS.
- 검증: tsc, tests 38/38, build. 로컬(#4682): Geoapify 0·Leaflet 0, VietMap style/sprite/font 요청 확인, 핀 0, 홈 바로가기 → 홈 "KCN VSIP Bắc Ninh · 3 km". 지도 타일 실제 렌더링은 창 최소화(rAF 없음)로 미확인.
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: 타일 렌더링·위성 전환 실화면 확인, 표에 없는 KCN(좌표 출처 못 찾음)은 지도 없음, OSM way 중심이 공단 정문과 다를 수 있음.

## 2026-10-07 — 상세 탭 3개·분홍 테두리·상세요강 행·KCN 일대 지도·헤더 태그 정리

- 요청: 알바몬식 3탭(Điều kiện 묶음)·박스/제목 박스 #f5c6d0, 상세요강 행화(비면 숨김), KCN 수준 근무지 핀 없는 지도, 헤더 태그는 결정 요소만+Phúc lợi 행.
- 변경: JOB_TABS, jobDescriptionRows, benefitList/isKcnLevelText, JobLocationMap pinless, CSS.
- 검증: tsc, tests 36/36, build, 로컬 PC 1280px·모바일 375px(#4682). 공개 공고가 #4682 1건뿐이라 다른 형식은 단위 테스트로만 확인.
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: KCN 일대 지도는 지역 중심 좌표(공단 경계 아님), 실제 폰·여러 공고 형식 확인.

## 2026-10-07 — #4682 원문 추출 DB 반영 + 언어·출장 DDL + 리뷰 0건 숨김

- 요청: #4682 추출 결과 DB 반영(원문 백업 후), 언어(text)·출장(boolean) 컬럼 추가, BHXH는 태그로 대체, 리뷰 0건이면 숨김.
- 변경: migration 20261007031726(컬럼 2 + 백업 테이블), #4682 UPDATE(백업 1행·md5 일치 조건), jobSchema 36항목, 모집조건에 Ngoại ngữ·Đi công tác 행, CompanyReviews 0건 숨김.
- DB 전후: 새 컬럼 0→2, 백업 테이블 0→1(백업 행 0→1), #4682 갱신 1/1.
- 검증: tsc, tests 35/35, build. commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: 다른 공고 일괄 추출은 별도 승인, 리뷰 작성 경로, 모바일 실기기 확인.

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

