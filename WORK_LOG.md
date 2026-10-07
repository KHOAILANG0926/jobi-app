# WORK_LOG

작업 단위 짧은 실행 기록. 최근 10개만 유지(넘으면 가장 오래된 것 삭제, 장기 이력은 git log). 규칙: CLAUDE.md "ChatGPT 추적용 기록".

## 2026-10-07 — chotot 100건 근무 회사 ↔ VietMap 타일 POI·OSM 좌표 후보 dry-run (DB 쓰기 없음)

- 요청: 서버 키 없이 `VITE_VIETMAP_TILEMAP_KEY`로 벡터 타일 POI + OSM(Overpass) 이름 있는 공장을 대조해 chotot 100건(4685~4784) 좌표 후보를 찾는다. 자동 승인 후보/검토 필요/없음 건수, 자동 후보는 위성 확인. dry-run만.
- 방법: ① VietMap 타일은 독자 형식(첫 바이트 `01 01 01 1b`, 표준 MVT 아님, 압축·XOR 시도 실패)이라 Node 직접 디코딩 불가 → 공식 SDK(@vietmap/vietmap-gl-js, CDN)를 viecganban.vn 탭에서 열어 `querySourceFeatures`로 읽음. 키는 사이트 지도가 이미 요청한 style URL에서 읽어 로컬 임시 파일에만 두고 작업 후 삭제(출력·커밋 없음). ② 탐색 범위: 공단 윤곽이 있는 KCN 13건은 윤곽 bbox 타일, 나머지는 Chợ Tốt 광고 대략 좌표(구·xã 수준, 탐색용으로만 사용·후보 좌표 아님) 주변 3×3 타일, 광고 좌표가 박닌 밖인 4건은 같은 구 중앙값(3건)/없음. 총 **z15 타일 298개**(소스 maxzoom이 15라 z16 요청도 z15 타일 데이터), 위치당 1타일·0.7초 간격·지도 캐시. 이름 있는 POI **12,187개**(회사 995·상점·ATM 등). ③ OSM Overpass 1회(박닌 bbox, 이름 있는 industrial/works/office/warehouse) 415개. ④ 매칭: `locationCandidateMatch.ts`(`companyTokens`·`nameSimilarity`) 재사용. 자동 승인 = 이름 정확 일치 + (공단 윤곽 안 | 광고 대략 위치 1.5 km 이내) + 후보 1곳.
- 요청 수: VietMap 타일 ≈298(+스타일·스프라이트·폰트 소량, 위성 확인 래스터 약 5화면), Overpass 1, Chợ Tốt 상세 HTML 100(대략 좌표 읽기, 번호 열기 없음).
- 결과: **자동 승인 후보 1 / 검토 필요 32 / 없음 67.** 자동 후보 = #4720 PIZZA HUT → "Pizza Hut Bắc Ninh"(VietMap, 광고 위치에서 1,078 m, 공고 주소 "Pizza Hut Bắc Ninh: 1A Lê Thái Tổ"와 같은 거리). 검토 필요: 이름이 비슷한 후보만 17, 회사명이 POI 이름에 포함 13(GOERTEK⊂"…Goertek Vina" 등), 이름 정확 일치지만 위치 불충족 2(#4773 Goertek 4.8 km, #4738 Goldsun 1.9 km). 없음: 범위 안 일치 없음 57, 근무 회사 없음(대행사 게시) 9, 구별 단어 없음 1.
- 위성 확인(VietMap Hybrid, z17~18, 5곳): #4720 Pizza Hut — 도심 Lê Thái Tổ 로터리 인근 건물, 공고 주소와 일치(간판은 위성으로 확인 불가) / #4773 Goertek — 핀이 대형 공장 지붕 단지 위(공장 위치로 타당) / #4738 Goldsun — OSM 중심점이 대형 청색 지붕 공장 옆 빈 부지 가장자리(근접하지만 건물 위는 아님) / #4779 Jang Won Tech — 공장 내 ATM 기준, 공단 도로변 공장 밀집지(공장 대문 위치는 아님). 자동 후보가 5건이 안 되어 검토 필요 중 이름이 가장 강한 후보로 대체.
- 판단: 이 방법은 **일부만 가능**. 이유 — 타일·OSM에 Getac·Amphenol·Avery Dennison·Yuzhan·Power Plus·Nae Tech 같은 외자 공장 이름 자체가 없음(회사명 일치 검색 0건), 있는 곳(Misumi·Goertek)도 광고 대략 좌표가 4~9 km 어긋나 거리 조건에서 탈락, 유통 브랜드(Hasaki·Pizza Hut·Vinamilk)는 지점이 여럿이라 주소 대조가 필요. KCN 31건 중 윤곽 매칭은 13건뿐(KCN 이름 표기 차이로 "Nam Sơn–Hạp Lĩnh" 등 일부 미매칭).
- 산출물(gitignore `out/`, 바탕화면 `bacninh_handoff/`에도 CSV): `chotot_poi_candidates.csv`(공고별 후보1·2, 상태, 사유, 거리, 공단 안 여부), `.json`. 스크립트(커밋): `bn_poi_plan.mjs`·`bn_poi_plan2.mjs`·`bn_poi_scan_browser.js`·`bn_overpass_fetch.mjs`·`bn_poi_match.mjs`.
- DB 쓰기 없음. 다음(승인 후): ① 자동 후보 1건·검토 후보를 사람이 확인 후 `job_location_candidates`에 pending으로 ② 나머지는 좌표 없는 상태 유지 또는 수동 지정/기존 관리자 VietMap 검토 화면 사용 ③ 서버용 VietMap 키(Search v4)가 생기면 이름 검색으로 재시도.

## 2026-10-07 — #4682 비공개 전환 + chotot 근무 회사 VietMap 좌표 후보 — 키 없어 중단

- 요청(앞선 지도 스타일·시험 공개 3건 지시는 취소): ① #4682 비공개(회사명 자리표시자 = 공개 제외 규칙 위반) ② chotot 100건(4685~4784) 근무 회사를 VietMap POI와 연결해 좌표 후보 dry-run, `VIETMAP_SERVICE_KEY` 없으면 중단·보고.
- 완료: #4682 `admin_hidden=true`(DB 직접 수정 1행, 확인됨). 현재 공개로 보이는 local_jobs 0건(chotot 100 + #4682 모두 비공개).
- 중단: `VIETMAP_SERVICE_KEY`가 환경변수·`.env`·`crawler/.env`·Vercel Production/Preview 어디에도 없음(Vercel에는 `VITE_VIETMAP_TILEMAP_KEY`만 있고, 이 키는 Search v4가 HTTP 423으로 막힘 — 2026-10-06 시험 결과이며 이번에 쓰지 않음). 좌표 후보 조회·CSV·위성 대조는 시작하지 않음. DB 쓰기 없음.
- commit/push: 문서만(master).
- 다음: VietMap에서 서버용 키(Search v4·Place v4 허용) 발급 → `VIETMAP_SERVICE_KEY`를 로컬 환경에 설정(Vercel/크롤러 환경 설정은 별도) → `scripts/generate-location-candidates.ts` 구조로 chotot 100건 dry-run(공고별 후보 CSV, 자동 승인/검토 필요/없음 건수, 자동 승인 5건 위성 대조). 비용은 근무지 1곳당 최대 4 transaction이라 100건이면 최대 400회 — 일일 한도(Production 일 500) 확인 필요.

## 2026-10-07 — 공고 상세 개편(알바몬 구조) master 병합·Production 배포·검증 + Chợ Tốt 시험 공개 3건 되돌림

- 요청(사용자 승인): feat/job-detail-sections를 master에 병합 전 tsc·test·build 확인 → 병합·푸시·Production 배포 → #4682 상세 확인(탭·연락처 한 곳·문구 제거·KCN 지도). 시험 공개 3건은 보류하고 이걸 먼저.
- 시험 공개: 지시 직전에 #4751·#4714·#4774를 admin_hidden=false로 전환해 둔 상태였음 → "보류" 지시에 맞춰 즉시 true로 되돌림(chotot 100건 전부 비공개 재확인). 공개 전환 때 확인된 것: anon 3건 노출, `/viec-lam/sb-<id>` 3개 200·사이트맵 포함, HTML에 `chotot` 문자열 1회씩(설명 태그 추정, 링크 아님 — 재확인 예정).
- 검증: tsc 통과, 테스트 37/37, build 통과. 병합 파일에 SQL 데이터·CSV·백업·.env 없음(`cleanup_local_jobs_delete.sql`은 데이터 없는 실행 SQL로 의도적으로 포함, batch 데이터 SQL·CSV·backups/는 gitignore). master는 브랜치보다 앞서지 않아 fast-forward(충돌 없음).
- 배포: master `264d7d7` push → Vercel Production `jobi-8vizwbcra`(Ready, 58s) https://viecganban.vn. 이전 Production `jobi-1a2utn2n6`(롤백 대상, 필요 없었음).
- Production 확인(#4682, https://viecganban.vn/viec-lam/sb-4682, Chrome 1281px): 탭 2개(Điều kiện / Mô tả công việc — 회사 정보가 자리표시자라 Thông tin công ty 탭은 설계대로 숨김), 연락처는 오른쪽 박스 한 곳(Gọi 0344849982 + Zalo), "Xem cách liên hệ"·"chưa nhận hồ sơ" 없음, KCN VSIP Bắc Ninh 점선 윤곽+이름표+"Vị trí chính xác chưa xác minh"+OSM 출처, Bản đồ/Vệ tinh 전환·Phóng to 보임. 내장 브라우저 창이 가려져 첫 시도는 지도 캔버스 0 → Chrome 확장으로 재확인.
- 주의: 사용자가 기대한 "탭 3개"는 이 공고에서는 2개(설계상 회사 정보 없으면 숨김). 모바일 실화면은 미확인.
- 남은 문제: Chợ Tốt 시험 공개 3건 재진행(전화/Zalo 표시 확인 포함), 좌표 작업.

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

