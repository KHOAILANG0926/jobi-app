## 2026-11-24 — 지도 W3b: 장애로 실패 상한에 닿은 위치 찾기를 영구 제외하지 않고 하루 뒤 다시 확인 (DB 함수 조건만)
- 요청(Lee): 일시 장애·한도 초과로 영구 재확인 제외가 생기는 문제 해결, 실제 검색 실패와 구분, 기존 재시도 상한 유지. W6과 별도 PR.
- 원인 [직접 확인 — 코드]: 위치 찾기 'failed'는 외부 API 장애·저장소 오류뿐이다(실제 '결과 없음'은 done). 처리권(map_r1_claim_job_v2)·매시 재시도(map_r1_retry_pending)는 같은 내용으로 실패 2번 또는 VietMap 호출 2번이면 다시 확인하지 않는다. W3a(#1007)로 장애 건은 '못 찾음'이 아닌 보류(pending)가 되어 매일 재판정(map_r1_retry_unlocated) 대상에도 없다 → 영구히 빠짐. 한도 초과는 deferred(1시간 간격, 상한 없음)라 원래 영구 제외가 아니다.
- 변경: migration 20261124140000_map_r1_failed_recheck — 두 함수의 그 조건만 바꿈(상한 2번은 그대로, 상한에 닿은 뒤에는 하루 지나 한 번씩 다시 확인 — 못 찾은 공고 재판정과 같은 하루 주기). done(실제 못 찾음)·deferred·VietMap 호출 한도(map_r1_reserve_call)·Google 월 한도·TS 코드는 그대로. 새 표·칸 없음.
- 검증 [직접 확인]: 로컬 폐기용 PostgreSQL 16 — 적용 전 시험 실패(이틀 지난 상한 건이 막힘) → 적용 뒤 local·production_check 통과, 다시 적용하면 '줄 없음'으로 전체 취소.
- 미완료: 운영 적용 뒤 실제 장애 건 재확인 실증(대상 건수는 운영 DB 조회 필요 — 직접 조회 금지), W4 운영 다시 수집 실증, W6(별도 PR, 방향 확정 — 진행 예정), W5·W7 범위 유지.

## 2026-11-24 — 지도 W4c: 수집기의 Geoapify 대략 좌표를 위치 원본에 보내지 않음
- 근거 [직접 확인 — 코드]: vieclam24h 수집기는 Geoapify로 구한 동·구·성 수준 좌표(ward/region)를 근무지 줄에 실어 보내 DB에 대략 위치(auto_area)로 남겼다. 핀·거리검색은 확정 좌표만 쓰고(#989), 확정 좌표는 Google → VietMap → Goong과 관리자 확정으로만 정한다(「위치 확인 우선순위」) — Geoapify는 그 순서에 없다.
- 변경: crawl_topcv._coordinate_accuracy_for_db가 원문 좌표로 검증되지 않은 줄의 좌표를 비움(주소 글자·주소 단계는 그대로). 행정단위·모집지역(resolved_*·matched_recruitment_regions)은 Geoapify와 무관해 영향 없음, 길찾기는 Google 출처 대략 점만 쓰므로 영향 없음. DB 변경 없음.
- 영향: 다음 다시 수집 때 기존 Geoapify 대략 줄은 좌표 없는 줄로 바뀐다(핀·거리검색에는 원래 안 쓰임). 사람이 확인한 줄(manual)·확정 줄은 그대로. 수동 CLI regeocode_work_locations.py는 이번 범위 아님.
- 검증 [직접 확인]: test_job_error_isolation 95건 통과(새 2건). 완료: W4a 2차 #1010 병합 d2f4f3f·deploy-verify 45391068111 성공. 미완료: #1008·#1009·#1010·이 PR의 운영 다시 수집 실증, W3b·W6(사전 보고 제출, Lee 승인 대기), W7.

## 2026-11-24 — 지도 W4a 2차: vieclam24h 다시 수집 근무지 줄을 입구(ingest_job)로 — 원문 기록 중복 없이
- 요청(Lee): 입구 경유 통일을 제외·완료 처리하지 말고, 원문 중복 저장 없이 공통 저장·트랜잭션 일관성을 확보하는 기존 구조 활용.
- 변경: crawl_topcv 다시 수집이 바뀐 칸 + 근무지 줄을 ingest_job 한 번(한 트랜잭션)으로 보냄(_recollect_rows_for_entry). 근무지 줄이 지금 DB와 실제로 다를 때만 부름(_work_locations_changed — 주소 열쇠 집합·미확정 줄의 좌표·주소 정확도·모집지역, 확정 줄 좌표는 DB가 지키므로 변화로 세지 않음) → 바뀐 것 없는 다시 수집은 입구를 부르지 않아 job_ingest_raw가 늘지 않는다. 기존 규칙(일시 오류 시 보류·이 지점 줄만·사람 확인 줄 다시 넣기 merge_protected_work_locations) 그대로, DB 변경 없음. 새 공고의 등록 뒤 근무지 쓰기(_replace_job_work_locations)는 그대로.
- 검증 [직접 확인]: test_job_error_isolation 93건 통과(새 4건 + 기존 다시 수집 시험이 입구 경로로 통과), CI 밖 통합 시험 test_address_pipeline_integration은 수정 전과 같은 53개 통과 뒤 같은 기존 실패(무관한 fetchJobsData 단언)에서 멈춤.
- 기록(누락 방지): W3b 미착수(지도 처리 failed 영구 건너뜀 기준 — DB 함수, W4 잔여 뒤 W6 사전 보고와 함께) / W6 사전 보고 준비(트리거 invalidate·번지 없는 공단 주소) / W7 범위 유지 / #1008·#1009·이 PR의 운영 다시 수집 검증 미완료 / W4 완료 시 R 1단계 충돌 확인, #6337 원인은 원문 재현 전 미확정.

## 2026-11-24 — 지도 W4a(1차): vieclam24h 다시 수집도 표기만 다른 주소로 확정 좌표를 지우지 않게
- 원인 [직접 확인 — 코드]: vieclam24h 다시 수집은 location을 바뀐 칸으로 고친다(UPDATE_TRACKED_FIELDS) → W4b와 같은 DB 트리거 invalidate 경로.
- 변경: crawl_topcv._keep_confirmed_location_text — Facebook과 같은 판정 한 곳(pin_guard.keeps_confirmed_location)으로 같은 지점·확정 줄이면 location 칸만 고칠 칸에서 뺌. DB 변경 없음, 기존 보호(merge_protected_work_locations) 그대로.
- 하지 않은 것(보고 대상): '다시 수집 근무지 쓰기를 ingest_job 경유로 통일'은 입구가 호출마다 원문 전체를 job_ingest_raw에 새 줄로 남겨(open_raw) 바뀐 것 없는 다시 수집까지 저장량이 늘어난다 — 같은 DB 함수(replace_job_work_locations)를 이미 쓰고 있어 이득은 한 트랜잭션뿐. Lee 판단 전까지 현행 유지.
- 검증 [직접 확인]: test_job_error_isolation 89건 통과(새 3건은 수정 전 실패). W3a #1007·W4b #1008은 병합·deploy-verify 성공(45384560861·45386872801).

## 2026-11-24 — 지도 W4b: Facebook 다시 수집이 표기만 다른 주소로 확정 좌표를 지우지 않게
- 원인 [직접 확인 — 코드]: 공고 location 글자가 바뀌면 DB 트리거 location_private.job_identity_changed가 그 글자의 근무지 줄을 invalidate(확정 좌표 포함, 확정 보호를 거치지 않음)한다. Facebook 다시 수집은 원문에서 다시 읽은 주소로 location을 고치므로 표기(지역 덧붙임)만 달라도 확정 좌표가 지워진다 — #1002 A(쓰기 함수 줄 찾기)가 막지 못하는 경로.
- 변경: crawler/pin_guard.keeps_confirmed_location(같은 지점 조건은 DB 쓰기 함수와 같게: 낱말 단위 앞부분 + 짧은 쪽 번지 숫자, 그 글자의 줄이 확정 좌표일 때만) + refresh_facebook_existing이 그 경우 location 칸을 고치지 않음. DB 변경 없음. 다른 지점·이전·확정 아님은 예전 동작.
- 검증 [직접 확인]: test_refresh_store_rows 새 사례 통과(다른 번지·거리 이름만·앞 글자·확정 아님은 유지 안 함). 미해결(W6, 사전 보고·승인 대상): DB 트리거의 invalidate 자체, 번지 없는 공단 주소, vieclam24h 경로(W4a).

## 2026-11-24 — 지도 W3a: 지도 처리 경로의 외부 API 장애·한도 오판 수정 + #1004 종료
- #1004 [직접 확인]: #1006 병합(ec35de6) 뒤 deploy-verify 45379834976 성공, #1006에 완료 댓글 실제 발송(7129560415), 승인 요청 댓글에 멘션·직접 링크(7129266251). 실패 알림 실제 발송·Lee 단말 수신은 미확인으로 분리 표기하고 이슈 종료.
- W3a 원인 [직접 확인 — 코드]: Google·Goong 장애·한도가 근거 문자열에만 남고 failed/deferred가 안 서서 map_r1에 done/unresolved로 저장 → applyLocationVerdict가 our_miss(비공개·저녁 목록)로 처리.
- 변경: autoLocationResolver 마지막 결과에서 checkBlocked로 failed/deferred 플래그, locationVerdict에 blocked(보류), applyLocationVerdict가 저장된 근거로 blocked 판정. 새 장치 없음(#1002의 checkBlocked 재사용). DB 변경 없음.
- 검증 [직접 확인]: 새 시험 3곳은 수정 전 실패·수정 후 통과, npm test 125/125·tsc·build 통과. 미완료: map_r1 failed 상태의 영구 스킵(calls/failures 기준, W3b DB)·운영 실제 건수는 이번 범위 아님.

## 2026-11-24 — #1004 실제 발송 검증 결함(완료 댓글 403) 보완 + W2 dry-run 결과 기록
- 검증 [직접 확인]: #1005 병합(12f5795) 뒤 deploy-verify 실행 45377084519 성공, 그러나 완료 댓글 단계가 `gh: Resource not accessible by integration (HTTP 403)`로 발송 실패(경고만, 운영 검사 결과는 성공 유지). 원인 = deploy-verify.yml 권한에 pull-requests: write 없음(issues: write만으로는 PR 댓글 403). #1005의 gh 대역 시험은 권한을 못 봄.
- 변경: deploy-verify.yml permissions에 pull-requests: write 한 줄 + deploy-notify.test.mjs에 권한 단언 추가(수정 전 실패·수정 후 통과 확인). 다른 변경 없음.
- W2 dry-run(Lee 실행, ops-run-sql 45344520708 성공) [Lee 보고 — 내가 실행하지 않음]: 삭제 이력 있는 확정 위치 1건(이미 확정 있음)·복구 대상 0·재판정 19 = 지점 분리 보류 2 + 회사명 AI 확인 불가 5 + 회사명 미확정 1 + 위치 원문 없음 2 + 위치 검색 실패 9. 복구 대상 0건은 이 dry-run 기준의 결과이며, W6·W7의 기존 작업 범위는 이것만으로 줄이지 않는다(Lee 2026-11-24 지시 — W6는 사전 보고·승인 뒤, W7은 복구 dry-run 검토·승인 뒤 기존 계획대로).
- 남은 것: 이 PR 병합 뒤 deploy-verify의 완료 댓글이 실제로 달리는지 확인 → #1004 종료. 실패 알림 실제 발송·Lee 단말 수신은 확인 불가(분리 표기).

## 2026-11-24 — #1004 승인·완료·장애 알림 경로 정상화 (기존 경로만 수정, 새 알림 장치 없음)
- 원인 [직접 확인 — 코드·실행 이력]: 승인 안내(github-actions[bot] 댓글)는 검사 통과 12~20초 뒤 발송됐지만(#1002: 05:26:03→05:26:23, 06:07:29→06:07:41) 본문에 멘션·직접 링크가 없었다. 운영 검사 성공 알림 경로는 없었고(다음 작업 큐 호출뿐), 실패 이슈는 중복 방지가 없어 고유 커밋 18개에 이슈 24건(같은 커밋 최대 3건).
- 변경: decision-approval-gate.mjs(approvalLinks — 저장소 주인 멘션+Files/PR 직접 링크, 형식 틀리면 예전 문구)·bot-pr-automerge.yml(PR_NUMBER 한 줄), scripts/ci/deploy-notify.sh 신규 1개(success: 병합 PR에 완료 댓글 1번·Lee 승인 요청 PR만 멘션·같은 커밋 표시로 중복 방지 / failure: 같은 제목 열린 이슈 있으면 안 만듦·실패 단계·조치·멘션, 이슈 조회 실패는 누락 방지로 생성), deploy-verify.yml 두 단계를 이 스크립트 호출로 교체, 시험 deploy-notify.test.mjs·gate 시험 추가, pr-checks.yml 연결.
- 검증 [직접 확인]: 신규 시험·기존 승인·병합 관련 시험 통과. 미확인: Lee 단말 수신(GitHub 알림 설정 의존), 실제 실패 알림(운영 실패를 일부러 만들지 않음 — 시험 대역으로만).

## 2026-11-24 — 지도 정상화 A(확정 위치 유실 방지)·C(API 오류 구분) + B dry-run 준비 (운영 변경 없음)
- 원인 [직접 확인]: write_location이 기존 줄을 admin_location_key 완전 일치로만 찾아, 지역을 덧붙여 저장된 기존 확정 줄("…, TP. Bắc Ninh")과 재수집 글자가 다르면 새 줄 취급 → replace가 확정 줄을 지움(retained_rows에만 남음). C: Google·Goong 장애(provider_failed)·VietMap 월 한도(deferred)가 '못 찾음(not_found)'으로 기록돼 7일 뒤 재확인·최대 2번 경로로 감.
- 변경: supabase/migrations/20261124130000_location_same_store_keep.sql(+tests setup·local·production_check) — 완전 일치 줄이 없을 때만 기존 같은 매장 규칙(addressReader.sameStore·pin_guard._same)을 '지역 덧붙임' 모양(한쪽이 다른 쪽의 낱말 단위 앞부분 + 짧은 쪽에 번지 숫자)으로 좁혀, 그리고 후보 1줄·확정 줄일 때만 그 줄 사용·주소 글자 유지(거리 이름만·12≠112·앞에 글자가 붙은 포함은 다른 지점, 시험 6~8번). src/lib/locationPrecheck.ts checkBlocked/providerErrorKind 한 곳(precheckVerdict·autoLocationResolver 공용), Goong 오류 기록, 매장 여러 곳 보류 일반화, crawler DEFERRED_REASONS에 provider_quota. B: scripts/ops/jobs/location-keep-recovery-preview.sql(읽기 전용).
- 검증 [직접 확인]: 로컬 PostgreSQL 16 fixture→setup→migration→local→production_check 통과, autoLocationResolver·googleQuotaCache·locationPrecheck·location-hook 시험·crawler test_ingest_gateway·tsc 통과, dry-run SQL은 run-sql-plan 검증 + 시험 DB 실행.
- 남은 것: A 병합·운영 적용 뒤 Lee가 ops-run-sql(name=location-keep-recovery-preview)로 dry-run 실행 → 결과 보고. 복구 migration은 대표 승인 뒤 별도.

## 2026-11-24 — 3순위 2차: DB 변경 PR의 격리 DB 전후 대조 (기존 migration-postgres 재사용)
- 변경: scripts/ci/public-location-snapshot.sql(읽기만)·public-location-diff.sh(+시험)를 check-postgres-migrations.sh의 migration 적용 전후에 연결, pr-checks 시험 1단계, 규칙 문서 3개 현재 구현 줄, 계획 문서 3·4절.
- 화면 연결(Lee 11-24): 적용 뒤 결과를 JSON으로 내 기존 격리 핀 검사(location-canonical-browser-fixtures, LOCATION_FIXTURE_DIR)에 넣음 — 공개 위치 응답(HEAD api 처리 코드)→메인 지도 점별 핀→상세→PC·모바일. migration-postgres 잡에서 결과가 있을 때만 빌드·실행.
- 화면 연결 검증 [직접 확인]: #999 → 공개 3건·핀 3개 PC·모바일 통과, 합성 0·1·여러 곳 그대로 통과, #1002 → 차이 6줄·화면 대상 0건(시험 공고 비공개).
- 검증 [직접 확인]: 로컬 PostgreSQL 16에서 #999 전환 migration 재적용 → 차이 6줄(#5992 위치 글자, 1776·1800 → 보류함) = 운영 결과와 같음, 판정 시험(변화 없음·조용히 잃음·보류함·비공개) 통과.
