# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

장기 AI/Agent 전략은 AI_DISCOVERY_STRATEGY.md 참고

**공고 상세 화면 개편 (알바몬 구조) (2026-10-07).** branch `feat/job-detail-sections`(master `5f596a4` 기반, worktree `C:\Users\HP\Downloads\jobi-wheel-fix`). 상태: IMPLEMENTED / VERIFIED(tsc·tests 37/37·build, 로컬 PC 1280px) / BRANCH PUSHED / **사용자 미승인 · master 미반영 · Production 미배포**. Preview는 SSO 보호.

- 구조(2026-10-07 갱신): 탭은 3개(Điều kiện / Mô tả công việc / Thông tin công ty, 칸 균등·칸마다 1px 테두리, 비선택=회색·선택=흰 배경+빨간 글씨+아래 테두리 없음). Điều kiện 탭이 근무조건·모집조건·근무지역 3구역을 묶고, 5구역은 한 페이지에 모두 노출(탭은 스크롤 이동만, 스크롤 위치로 활성 탭). 구역·탭 정의는 `src/data/jobSchema.ts`·`src/lib/jobDetailView.ts`(JOB_TABS). 구역 제목은 박스 밖 위에 크게, 박스·제목(헤더) 박스 테두리 #f5c6d0 1px, 요약 박스 #bcd7f5. "라벨 | 값" 2열 표(PC 2칸), 값 없는 행은 숨김. 급여 앞 Lương tháng/ngày/giờ 배지. 헤더 태그는 결정 요소만(통근버스·기숙사·식사·즉시출근·주급), BHXH 등 복리후생은 근무조건 "Phúc lợi" 행. 새 컬럼을 select·타입·화면에 연결.
- 상세요강: 제목 반복·소제목 제거, 남은 문장을 행으로(Ưu tiên / Yêu cầu khác / Quyền lợi · Môi trường làm việc, 수집 공고의 "## Mô tả" 본문은 Nội dung công việc, 소제목 없는 문장은 Thông tin khác) — `src/lib/jobDescriptionRows.ts`. 행이 없으면 구역·탭 숨김.
- 근무지역 지도(2026-10-07 갱신): 상세는 **VietMap**(`src/components/JobVietMap.tsx`, 홈 생활지도와 같은 provider·`applyLifeMapStyle`·Bản đồ/Vệ tinh 전환)만 사용 — 상세에서 Geoapify·Leaflet 요청 0. 확인된 근무지만 핀, 작은 지도는 휠 줌을 끄고 터치 기기에선 드래그·핀치도 꺼 페이지 스크롤을 막지 않음(+/- 버튼). 지도 위 "Phóng to" → 공고 화면 안 전체화면 모달 지도(Esc·Đóng로 닫으면 공고 복귀, 배경 스크롤 잠금). 빈 지도 원인(수정됨): 벤더 CSS 지연 로드가 컨테이너 position/크기를 덮어써 높이 0 → 인라인 position/크기 + ResizeObserver.
- 공단(KCN) 수준 근무지: **출처 있는 KCN 중심 좌표·영역만**(`src/data/industrialParks.ts` 28개 + `industrialParkOutlines.ts` — OpenStreetMap landuse=industrial way, Overpass 2026-10-07; 중심은 원본 `out center`와 28개 모두 일치 확인, 윤곽은 `out geom` 꼭짓점을 ~6 m로 단순화). 매칭 `src/lib/industrialPark.ts`(KCN 표기 바로 뒤 이름이 별칭과 정확히 같을 때만, 순번 다르면 불일치, 같은 이름 다른 지역은 `requires`). 표에 없으면 지도 없이 글자 안내. 화면: **KCN 윤곽 전체가 보이게 맞춘 배율 + 점선 테두리·옅은 면 + 이름표(핀 없음)**, 작은 지도·Phóng to·위성 모두 동일, "Vị trí chính xác chưa xác minh" + OSM 출처 표기. **기존 방향에서 바뀐 것**: 2026-09-30 "공단 중심 좌표로 대신 표시하지 않는다"를 사용자가 일부 변경(출처 있는 KCN 영역 표시 + KCN 길찾기 허용).
- **길찾기 규칙(2026-10-07 사용자 지시 2회 정정, CLAUDE.md 반영)**: Google 지도 길찾기 링크 허용(외부 링크 금지는 경쟁 채용사이트 공고 링크에만). 반드시 좌표 링크(`destination=lat,lng`), 이름 검색 금지(9/29 VSIP 오안내 재발 방지). 승인 근무지(출입구·건물·부지 무관) = "Chỉ đường"(승인 좌표, `jobCoords.hasApprovedPoint`) — 이전: 출입구 승인만. **KCN 수준: 목적지에 공단 도형 중심 사용 금지**(Preview 확인: 중심이 빈 부지·들판) — ① OSM 공단 정문 node(공단 way에 붙은 barrier=gate/entrance) ② OSM/VietMap KCN 관리사무소(Ban quản lý) POI의 좌표만(`industrialParks.ts` `destination`, 출처 id·위성 확인일 필수), ①②가 없는 KCN은 길찾기 버튼 숨김. 도형 중심·윤곽은 영역 표시용으로만 유지. 지금 `destination`이 채워진 KCN은 0개(28개 전부 길찾기 숨김).
- **VSIP Bắc Ninh 조사 결과(2026-10-07)**: ① 공단 way(642274405)에 붙은 태그 있는 node 0개. bbox 안 `barrier=gate` node는 다수지만 공장별 게이트·주거지 입구뿐 — 가장 가까운 `barrier=lift_gate`(node/8341469038, 21.0801689·105.9680027)는 위성으로 확인하니 서쪽 Lý Thái Tổ 변 주거 단지(타운하우스) 입구라 공단 정문 아님(제외). ② OSM에 이름에 "Ban quản lý/BQL/Cổng/Gate"가 들어간 feature 0개(office=… 는 UBND xã Đại Đồng·"VSIP Bắc Ninh - Nhà xưởng cao tầng"뿐), VietMap POI(z16 타일 6개로 공단 전체 조회)에도 관리사무소·정문 키워드 0개 — "KCN Việt Nam Singapore Bắc Ninh"(class industrial, 위도 21.0791944·경도 105.9801158)는 공단 영역 라벨 POI. 결론: **VSIP Bắc Ninh은 조건을 만족하는 목적지 없음 → 길찾기 숨김**(사용자 결정 대기: 다른 후보 탐색·수동 승인 좌표 등).
- 연락(2026-10-07 갱신): 연락처는 화면에 한 곳만 — PC(≥761px)는 오른쪽 요약 박스(옅은 파란 테두리 #bcd7f5·흰 배경)에 Gọi 번호·Zalo 버튼, 하단 고정 바는 모바일(≤760px)에서만. 연락처가 있으면 연락처가 있으면 별도 지원 버튼·"chưa nhận hồ sơ" 박스·"Xem cách liên hệ" 없음. 내부 지원(기업 계정 공고)이거나 연락처가 없을 때만 지원 영역 표시.
- 기업정보: 회사 정보·같은 회사 다른 공고가 없으면 구역(탭 포함) 숨김. 자리표시자 회사명("Nhà tuyển dụng Facebook")은 같은 회사로 묶지 않음. 리뷰는 0건이면 숨김.
- **원문 항목 추출 — #4682 1건 Production DB 반영 완료(2026-10-07, 사용자 승인)**: `jobDescriptionExtract.ts`(+test)·`scripts/extract-job-fields.ts`(dry-run 전용, 반영 기능은 없음 — 반영은 승인받은 SQL로 직접 실행). 원문에 있는 값만 뽑고 문장은 상세요강에서 이동(출처 태그 `[source:…]` 유지). #4682: hours·work_days·education·preference·gender_requirement·benefit_tags·contact_zalo·language_requirement·business_trip 채움, description 정리. **원문 백업**: 신규 테이블 `local_jobs_description_backup`(RLS 켬·공개 접근 없음, job_id·description·reason·backed_up_at) 1행(원문 md5 `3fcc74d0…`). 다른 공고에는 아직 적용하지 않음(승인 필요).
- DDL(20261007031726): `local_jobs.language_requirement text`, `business_trip boolean` + 백업 테이블. jobSchema 36항목·`NEW_DDL_COLUMNS_2`.
- 리뷰(CompanyReviews)는 0건이면 숨김(사용자 결정). 리뷰는 브라우저 localStorage 기반이라 숨김 상태에선 첫 리뷰를 쓸 방법이 없음 — 필요하면 재논의.
- 모바일은 기존 배치 유지(구역 제목·표 스타일만 공통 적용). 실제 폰 확인은 아직 못 함(화면 캡처 불가 환경).

## 변경 내용

`JobDetail.tsx` 재구성, `index.css`(jd2-sec/box/kv/tabs/하단 바), `jobRows.ts`·`JobsContext.tsx`·`fetchJobsData.ts`(select·매핑), `types/job.ts`, 신규 `jobDetailView.ts`·`jobDescriptionExtract.ts`(+tests), `scripts/extract-job-fields.ts`.

## 테스트 결과

tsc 통과, `npm test` 37/37, build 통과. 로컬 PC 1280px: 5구역 순서·고정 탭·활성 탭 전환·하단 Gọi/Zalo·구역 숨김 확인. 모바일 375px은 가로 넘침 없음·하단 바 정상(측정). Preview 200(상세·tim-kiem·sitemap).

## 발견된 문제

- 공개 공고 중 `salary_period` 값이 있는 공고가 없어 배지는 코드·테스트로만 확인.
- 이 환경은 창이 최소화되면 스크롤·rAF 이벤트가 지연돼 모바일 실화면 캡처 불가.

## 다음 결정사항

- **VietMap에 서버용 키 요청**(Search v4·Place v4 허용) 후: 키를 Vercel/크롤러 환경에 `VIETMAP_SERVICE_KEY`로 설정 → `node scripts/generate-location-candidates.ts`(dry-run) 결과 확인 → 별도 승인 후 `--apply`(Production DB 쓰기) → 크롤러 연결 여부 결정. match_meta 컬럼(DDL)은 보류.
- **VietMap 키 제한 — 권한 부족으로 보류(2026-10-05, 배포는 막지 않음)**: Console 변경 API가 `UN_AUTHORIZED`. Consumer/API key 수정·Referers·usage limit 권한 요청. 권한이 생기면 Referers `viecganban.vn; www.viecganban.vn`, 한도(Production 일 500/월 10,000, Preview 일 100/월 2,000), 가능하면 key 분리.
- 모니터링: VietMap Console → Daily Report 일 Transaction(일 100 이상 급증 시 보고). Search/Place 호출이 켜지면 근무지 1곳당 최대 4 transaction.
- Vercel env: `VITE_VIETMAP_TILEMAP_KEY` Production/Preview, `VITE_ZALO_APP_ID` Production/Preview (2026-10-05 정리).
- `D:\Codex\JOBI`(`feat/korea-home-p1`, 오래된 branch)의 미커밋 4개 — 별도 작업, 건드리지 않음.

## 최근 완료 작업 로그

- 공고 상세 화면 개편(알바몬 구조) — 2026-10-07 — BRANCH PUSHED(`feat/job-detail-sections`) / 사용자 미승인·master·Production 미반영
- 공고 항목 설계 + 즉시 수정 실행(jobSchema·DDL 9·로고 244·재분류 26) + SSR 번들 장애 복구 — 2026-10-07 — MASTER PUSHED(`cd0eeeb`) / PRODUCTION DEPLOYED·VERIFIED
- 공고 항목 설계 + 즉시 수정(출처 로고 차단·분류 개선) — 2026-10-06 — BRANCH PUSHED(`fix/source-logo-and-classifier`, Preview `jobi-xg3h9jbxb`) / master·Production·DB 미적용(승인 완료, 실행 대기)
- 근무지 좌표 VietMap 관리자 검토·직접 지정·자동 후보(꺼짐) — 2026-10-06 — MASTER PUSHED(`71acf9a`) / PRODUCTION DEPLOYED(`jobi-bo6e6kzkn`) / PRODUCTION VERIFIED(사용자)
- 지도 제스처 재정비 + 모바일 bottom sheet — 2026-10-06 — MASTER PUSHED(`cccd767`) / PRODUCTION DEPLOYED(`jobi-cx74ww02v`) / PRODUCTION VERIFIED(사용자)
