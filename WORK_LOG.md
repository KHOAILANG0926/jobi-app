# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-07 — 기존 크롤러 281건 정리 확인 + Chợ Tốt 100건 local_jobs 반영(비공개) 완료

- 정리 확인(사용자 실행 후): local_jobs 1건(#4682), source_url 0건, job_work_locations 0건 — 삭제 전 읽기 전용 재확인 후 진행.
- 반영: batch01만 먼저 → DB에서 10건 확인(admin_hidden=true 10, source_url NULL 10, job_work_locations 10, `source|회사|전화|급여` md5가 원본과 일치) → 이상 없어 batch02~10 실행. **실패·롤백 0건.** 방식: SQL 파일을 손으로 옮기지 않고 같은 데이터를 `scripts/research/bn_apply_chotot_rest.py`(PostgREST, 서비스 키는 crawler/.env에서 읽고 출력 안 함, `source` 중복이면 건너뜀·오류 시 즉시 중단)로 넣음. SQL batch 파일(`out/bn_chotot_insert_batch*.sql`)과 같은 값. 준비 스크립트는 `build_jobs()`로 분리.
- 결과: local_jobs 101행(#4682 + chotot 100), **chotot ID 범위 4685~4784**(10건씩 4685-4694, …, 4775-4784; 4683·4684는 identity가 건너뜀). 전부 admin_hidden=true·origin=crawler·active=true(공개 게이트 ok, 비공개라 안 보임), source_url NULL 100, `source='chotot:<광고번호>'`, job_work_locations 100행(100건 모두 lat/lng NULL·geocode pending, industrial_park 31, address_accuracy region_only/exact_text), recruitment_type=agency 18. 설명 본문(태그 제외)에 URL·사이트명 0건. 전체 체크섬(`source|회사|전화|급여` md5 294a6909…) 로컬 값과 일치.
- anon 조회(공개 API, 게시용 키): chotot 100건 조회 0건, id 4685~4784 0건, 위치 0건, source_url not null 0건, 공개로 보이는 공고 전체 1건(#4682).
- 크롤러: 정리 시점 점검 결과 그대로(GitHub Actions disabled, Supabase cron에 크롤러 없음, VPS crontab 미확인 — 9/28 이후 신규 크롤러 행 없음). 실행 후에도 신규 크롤러 행이 생기지 않았는지는 다음 세션에서 재확인 필요.
- commit/push: branch `feat/job-detail-sections`(실행기·분리 리팩터링·문서만, 데이터·백업 제외). master·Production 코드는 그대로(DB만 반영). 공개 전환은 사용자가 Preview를 보고 따로 승인.
- 남은 문제: 좌표(KCN 31건 영역 표시만, 69건 좌표 없음) 별도 작업, 공개 전환(admin_hidden=false) 승인 대기.

## 2026-10-07 — 기존 크롤러 공고 281건 정리 준비(백업·참조 조사·삭제 SQL dry-run) — 삭제·batch 미실행

- 요청: Chợ Tốt batch 전에 local_jobs에서 #4682를 뺀 281건을 백업→참조 조사→(0이면)삭제→확인, 크롤러 cron 점검, 그다음 batch01부터.
- 백업(완료): `backups/20261007T121508Z/`(gitignore 확인) — local_jobs 281 / job_work_locations 493 / job_location_candidates 1 / admin_audit_logs(job 대상) 3 + manifest(건수·sha256). 서비스 키는 crawler/.env에서 읽기 전용 GET에만 사용, 값은 어디에도 출력·저장 안 함. 스크립트 `scripts/research/backup_local_jobs_cleanup.py`.
- 참조 조사(완료): FK 참조 applications·interviews·message_threads·job_alert_notifications **0건**, local_jobs_description_backup 0, reports 0(북마크 전용 테이블 없음). 연쇄 삭제(ON DELETE CASCADE)는 job_work_locations 493·job_location_candidates 1. admin_audit_logs에 job 대상 3건이 id로 남아 있음(FK 아님 — 삭제해도 로그는 남고 가리키는 공고만 사라짐). 대상 281건은 전부 origin=crawler·employer 없음·전화 없음·공개 아님(active 또는 admin_hidden로 비공개)·source_url 278건.
- 삭제 SQL dry-run(완료, 읽기 전용): would_delete 281 / #4682 유지 1 / 가드 위반 0 / 참조 위반 0. 실행용 SQL `scripts/research/cleanup_local_jobs_delete.sql`(건수·참조 가드가 어긋나면 예외로 전체 중단, 끝에 남은 행·source_url 확인).
- **삭제는 실행하지 않음**: 영구 삭제는 내가 실행하지 않는 작업이라 사용자가 위 SQL을 직접 실행. 실행 후 `select count(*), count(source_url) from local_jobs` = 1 / 0이어야 함.
- 크롤러 점검: Supabase pg_cron은 `deactivate-expired-jobs-daily`·`job-alert-notifications` 2개뿐(크롤러 아님), Edge Function 0개, GitHub Actions `채용공고 자동 크롤링`은 **disabled_manually**(마지막 실행 8/28 실패). VPS crontab은 접속 불가라 **직접 확인 불가** — 다만 DB에 새 크롤러 행이 9/28 이후 0건(최근 7일 created 0, last_verified 9/24)이라 꺼져 있을 가능성이 높음. 사용자가 VPS에서 `crontab -l` 확인 필요(끄지 않음).
- Chợ Tốt batch: 삭제 완료 후 실행하기로 한 순서라 보류(SQL batch01~10 준비 완료, 변경 없음).
- commit/push: branch `feat/job-detail-sections`(백업 스크립트·삭제 SQL·문서, backups/·SQL 데이터 제외). master·Production·DB 미반영.

## 2026-10-07 — 박닌 Chợ Tốt 100건 표본 검증 + local_jobs 반영 SQL 준비(dry-run, DB 쓰기 없음)

- 요청: ① 채택 100건 중 20건 무작위(시드 고정)를 원문 페이지에서 다시 추출해 대조 ② 100건을 local_jobs에 admin_hidden=true로 넣는 SQL을 dry-run으로 준비(원문 링크는 공개 컬럼 금지, 기존 DB 중복 재확인) ③ 좌표는 반영 후 별도 작업.
- 표본 20건 결과: 전화·게시자·제목·주소 **20/20 일치(오류 0%)**(번호는 "Hiện số"를 다시 눌러 재확인). 판정 오류는 2건: ⓐ KCN 오매칭 1/9 — "gần khu công nghiệp Đông Thọ"(근처)를 KCN으로 잡음 → "gần/cạnh/đối diện … KCN" 표현은 근거에서 제외 ⓑ 대행사 근무 회사 모호 1/3 — "BÁN HÀNG SAMSUNG ĐIỆN MÁY XANH"처럼 브랜드(제품)와 고용주가 불명확한 공고. 유통 체인으로 대체하는 보정은 근거가 약해 시도 후 되돌림(AQUA 공고는 "Aqua 대표"라 고용주가 Mediamart라고 단정 불가) → 브랜드를 그대로 두고 모호 건으로만 기록.
- 표본 밖에서 추가로 고친 것: KCN 이름이 첫 글자("KCN Q")로 잘리던 버그(industrial_park에 들어갈 값) → 주소 단어 앞까지 전체 이름 / 근무지 줄에 다른 성(Hà Nội 등)이 있고 박닌이 없으면 제외(KCN Phú Minh·Đông Ngạc Hà Nội 2건, 다성 모집 3건) / 중복 기준을 회사+제목+전화로 일치(주소만 다른 2건 → 보류분으로 대체). 고친 뒤 100건 전체 재판정 → 채택 100(KCN 31, 대행사 게시 18, 같은 근무 회사 최대 2건).
- 반영 준비(실행 안 함): `scripts/research/bn_prepare_chotot_insert.py` → `out/bn_chotot_insert_batch01~10.sql`(10건씩 한 트랜잭션, `source='chotot:<광고번호>'`로 재실행 안전). local_jobs 100행 + job_work_locations 100행. 컬럼 채움: title/company/category/salary/location/employer_phone/description/posted_at/source/crawler_version/recruitment_regions 100, subcategory 64, recruitment_type(agency) 18, salary_min 85/max 90/currency·period 92/negotiable 99, industrial_park 31, **source_url 0**. active=true·admin_hidden=true(공개 게이트 ok, 비공개). 분류는 기존 `crawler/classifier.py`·`job_quality.validate_job_payload`(오류 0건).
- 원문 링크: **`source_url`은 NULL** — `anon`이 이 컬럼을 SELECT할 수 있어(컬럼 권한 확인) 비공개를 풀면 공개 API로 경쟁 사이트 링크가 나간다. 내부 추적은 링크가 아닌 광고 번호(`source`)만. description의 URL·사이트명 줄도 제거. (참고: 기존 크롤러 행 약 280건은 source_url에 원문 URL이 들어 있고 anon이 읽을 수 있음 — 별도 정리 필요, 권한 변경이라 이번엔 건드리지 않음)
- 중복 확인(운영 DB 읽기 전용): 전화 70종 일치 0 / 회사+제목 96종 일치 0 / 기존 chotot 행 0 → 빠지는 건 0건. 키는 체크섬으로 전달 일치 확인. INSERT는 `EXPLAIN`(미실행)으로 컬럼·타입 검증.
- 좌표: 100건 모두 lat/lng NULL(geocode pending). KCN 31건은 industrial_park·주소 텍스트로 KCN 영역 표시만 가능, 나머지 69건은 근무지 좌표 없음 → 반영 후 별도 작업.
- commit/push: branch `feat/job-detail-sections`(스크립트·문서만, SQL·CSV 제외). master·Production·DB 미반영.
- 남은 문제: 사용자 승인 후 batch SQL 실행(10회), 좌표 작업, 모호 건(Samsung·AQUA·Panasonic 등 브랜드 공고 5건 안팎, KCN만 근거인 대행사 공고는 회사명이 게시자) 검토.

## 2026-10-07 — 박닌 Chợ Tốt 재수집(1페이지부터) 연락처 있는 공고 100건 채움 (DB 쓰기 없음)

- 요청: 이 PC에서 Chợ Tốt 박닌을 1페이지부터 다시 수집, 연락처 있는 공고 100건까지. 옛 박장 제외, 대행 공고는 근무 회사·KCN 근거 있을 때만 채택, 같은 회사 최대 2건, 손으로 옮겨 쓰기 금지, DB 쓰기 금지. 이후 지시: 대기업·브랜드(Samsung·Coca-Cola·Amphenol 등)는 대행사가 아니라 "근무 회사", CSV에 "근무 회사"/"게시자" 분리.
- 결과: 목록 1~20페이지(399링크) 중 상세 279건 방문(데이터 274 / 상세 로드 실패 5) → 번호 확인 261건("Hiện số" 있음 263 중 2건 미열림, 버튼 없음 16건=게시자가 번호 비공개). **채택 100건**(연락처 있음, KCN 매칭 31, 대행사 게시 17, 고유 번호 71) + 목표 초과로 보류 15건. 제외: 같은 근무 회사 3번째 이후 55·대행사 근거 없음 56·개인명/상호 불명 27·연락처 없음 15·내부 중복 5·상세 실패 5·옛 박장 1.
- 변경: `bn_collect_chotot_ext.js`(화면 개편 대응 — 텍스트 파싱 대신 상세 `__NEXT_DATA__` ad 객체에서 제목·회사·주소·본문 추출, 번호 열기 연속 3건 실패 시 중단), 신규 `bn_build_chotot_csv.mjs`(판정·CSV). CSV는 `scripts/research/out/bacninh_chotot_review.csv`(gitignore)와 바탕화면 `bacninh_handoff/`.
- 판정 기준(애매하면 제외): 대행사 = 이름·계정에 nhân lực/tuyển dụng/việc làm/HR/RRD/GRGR/Adtek/Sức Bật/Almustech 등. 대행사는 본문에 알려진 대기업 브랜드 또는 "Công ty/Nhà máy + 이름"이 있거나 KCN 표기가 있어야 채택. 개인명은 성씨·이름 패턴(Nguyễn…, Anh Khoa…)으로만 판정, 3자 이하 상호('a','Hip')는 상호 불명 제외(단 LG 등 브랜드·대행사 이름은 예외).
- 한계: 옛 박장 판정은 주소·본문에 Bắc Giang·옛 박장 huyện 이름이 있을 때만(합병 후 신 지명 phường/xã만 쓰인 공고는 구분 불가). 대행사 근무 회사 추출은 브랜드 목록·정규식 기반이라 누락/오탐 가능 — 검토 시 "근무 회사" 열 확인 필요. 같은 번호가 여러 공고에 쓰임(고유 번호 71/100).
- 사고 기록: 화면 개편으로 기존 스크립트 파싱 실패(→ __NEXT_DATA__로 교체), 탭 멈춤 2회(navigate로 복구, 데이터는 localStorage 유지), 자동 다운로드 2회째 Chrome 차단·로컬 서버 전송 차단 → 클릭 제스처로 클립보드 복사 후 PowerShell로 파일 저장(전사 없음).
- commit/push: branch `feat/job-detail-sections`(스크립트·문서만, CSV 제외). master·Production 미반영.
- 남은 문제: 사용자 CSV 검토, 반영 방식 결정(승인 전 DB 금지), Muaban·Facebook은 이후.

## 2026-10-07 — 박닌 공고 100건 검토용 수집(Vieclam24h + Chợ Tốt, DB 쓰기 없음)

- 요청: 박닌만·회사명 없음 제외·원문 링크 미저장·천천히·**연락처 있는 공고 100건 기준**(CLAUDE.md "공고 수집 소스 규칙" 신설, 커밋 92df0a9). 산출물 CSV, 승인 전 DB 반영 금지.
- 변경: `scripts/research/bn_collect_v24h.py`(Vieclam24h, `province_ids[]=90`+상세 근무지 재검증), `bn_collect_chotot_ext.js`(Chợ Tốt, 로그인된 Chrome 탭 + 확장), `bn_build_csv.mjs`(제외·중복·KCN·연락처 유무→`out/bacninh_review.csv`). out/은 .gitignore(번호·경쟁사 데이터 포함).
- 결과: **연락처 있는 채택 80건 / 목표 100 → 20건 부족.** Chợ Tốt 목록 103건 방문(추출 성공 101, 번호 확인 92) → 채택 82(연락처 78)/제외 19(회사명 없음 10·내부 중복 9). Vieclam24h 121건 방문 → 채택 114(연락처 2)/제외 7(옛 박장 3·마감 2·기존 DB 중복 1·박닌 아님 1). 채택 합계 196, 그중 연락처 80(chotot 78 + v24h 2), KCN 매칭 10.
- 미수집: Chợ Tốt 목록 6페이지 이후(총 673건 중 103건만 링크 수집), Muaban·Facebook·TopCV·CareerViet·VietnamWorks 미실행.
- 검증: DB read-only 대조(v24h source id 1건 중복, Chợ Tốt는 DB에 소스 없음). 번호 확인은 로그인 계정으로 'Hiện số' 1회씩(경고·제한 신호 없음).
- 주의: Chợ Tốt "회사명"은 게시자명(RRD·ADTEK·GRGR·Sức Bật 등 인력/대행 성격 다수) — 같은 번호로 여러 회사명 공고. 직접채용 판정은 안 함. 헤드리스 접속은 Cloudflare 403(우회 안 함, 확장 방식 사용).
- 사고 기록: Chrome 탭이 가끔 멈춤(navigate로 새로고침), 경고 정규식 오탐 2회(고침). commit/deploy 없음(문서·스크립트 커밋만).
- 남은 문제: 20건 부족(Chợ Tốt 추가 페이지 또는 Muaban/Facebook), 옛 박장 포함 여부, 반영 방식 결정.

## 2026-10-07 — KCN 길찾기 목적지에서 도형 중심 제거(정문·관리사무소만) + VSIP Bắc Ninh 조사

- 요청: KCN 길찾기가 도형 중심(빈 부지)으로 안내됨 → 중심 사용 금지, 목적지 ① OSM 공단 정문 node ② KCN 관리사무소 POI(출처 id·위성 확인), 없으면 버튼 숨김, VSIP Bắc Ninh 결과 먼저 보고.
- 변경: industrialParks `destination`(kind·좌표·출처·위성 확인일, 현재 0개), industrialParkDirectionsUrl/Note(destination 없으면 null), JobDetail 버튼 조건부, 테스트(중심≠목적지·destination 구조 검증), CLAUDE.md·HANDOFF 규칙 정정.
- 조사: VSIP Bắc Ninh — 공단 way node 태그 0, 근처 lift_gate는 위성상 주거 단지 입구(제외), OSM·VietMap에 관리사무소/정문 이름 0 → 목적지 없음 → 버튼 숨김.
- 검증: tsc, tests 37/37, build, 헤드리스 Chrome(#4682 지도·윤곽·위성·Phóng to 정상, 길찾기 버튼 없음).
- commit/push: branch `feat/job-detail-sections`. master·Production 미반영.
- 남은 문제: 28개 KCN 모두 목적지 미조사(길찾기 숨김), VSIP 후보 결정.

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

