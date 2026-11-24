## 2026-11-24 — Codex 무응답 감지(봇 PR Ready 후 15분, 알림만·병합 조건 아님)
- 요청(Lee): 봇 PR에 Codex 자동 검토가 실제로 달리는지 모르므로 15분 무응답을 감지해 라벨·알림.
- 변경: scripts/ci/codex-silent.sh 신설 + bot-pr-automerge.yml 병합 루프에 호출 1줄. 기준 = Ready 전환 시각(Draft는 Codex가 검토 안 함). Codex 리뷰·줄 댓글·댓글·반응 중 하나라도 있으면 정상, 없으면 `codex-silent` 라벨 + Lee 멘션 댓글 1번. 15분 전이면 기존 codex-wait.txt→codex-wait-timer로 재확인(새 타이머 없음). 조회 실패는 알림 없이 건너뜀, 병합 판정과 무관.
- 검증 [직접 확인]: automerge-recovery.test.mjs 7번 사례 통과(무응답·15분 전·Draft 기간·Codex 흔적 4종·봇 아님·조회 실패), tsc·build 통과.
- 미완료: 운영 실제 동작 확인(병합 뒤 다음 봇 PR), 반응(👀)이 API에 실제로 보이는지 실증.

## 2026-11-24 — R #872 1단계: 공고 6337 빈 이름표 'VỊ TRÍ:' 원문 재현·공통 수정 + W7 dry-run 결과 기록
- 원문 [직접 확인 — Lee 실행 45412211405 로그]: "VỊ TRÍ:" 줄 아래 글머리 없는 직무 줄("3 Nam & Nữ Phục Vụ : 7tr5~ 12tr" …). 저장된 상세요강은 업무 칸에 "VỊ TRÍ:"만, 직무 줄은 급여 칸.
- 원인 [직접 확인 — 재현]: 모집 소개 줄 규칙(jobDetailFill hiring_intro_heading, #5437)이 "… ĐANG TUYỂN:"·"Vị trí tuyển dụng:"은 알지만 "VỊ TRÍ:"만 있는 줄은 몰라 제목이 미분류 → AI 줄 칸이 제목과 직무 줄을 다른 칸으로 나눔 → 검사기 '빈 이름표' → 비공개 보류. (사전 조사의 '이름표·값 줄 갈라짐' 추정과 같은 현상이며, 고칠 단계는 줄 묶기(keepListBlocks)가 아니라 이 규칙이다 — 줄 묶기를 넓히는 안은 기존 시험 '값 없는 이름표는 계속 잡는다'와 충돌해 버림.)
- 변경: 그 규칙의 낱말에 'vị trí'로 끝나는 제목 줄 추가(한 곳). 운영 6337 원문 그대로 회귀 시험 추가(수정 전 실패 → 수정 뒤 통과, 검사기 예외 없음). 공고 번호 전용 처리 없음.
- W7 dry-run [직접 확인 — Lee 실행 45411918150]: 확정 좌표를 잃은 줄 882(삭제된 줄 874·다시 확정 5·복구 후보 1 = #6309 줄 1971·주소 달라짐 2 = #5599·#6043) / 지워진 확정 줄 1쌍(이미 확정 있음) / 확정 없는 공개 공고 6건(#5599·#5876·#5993·#6043·#6255·#6309, 모두 대략 줄) / 보류함 19(branch_split 2·company_ai_unavailable 5·company_unconfirmed 1·no_location_text 2·not_found 9) / 지도 처리 failed 상한 1·deferred 1 / 11-24 무효화 36건은 모두 E2E 시험 공고(실제 다시 수집 실증 아님).
- 미완료: 6337 다시 판정·공개·PC/모바일 화면 대조(#940), W7 복구 migration(처리 방안 보고 — 승인 뒤), W4·W6 실제 다시 수집 실증.

## 2026-11-24 — 지도 W7 dry-run 준비 + #6337 원문 조회(읽기 전용 SQL 2개, 운영 데이터 변경 없음)
- 요청(Lee): W7 dry-run 준비(W2 결과·ops-run-sql 재사용), W4·W6 재수집 실증·W7 복구 대상·#6337 원문 조회용 읽기 전용 실행을 함께 준비. 실제 복구는 결과 검토·승인 뒤.
- 변경: scripts/ops/jobs/location-w7-recovery-preview.sql(W2 조회를 넓힘 — 무효화로 확정 좌표를 잃은 줄 분류·목록, 지워진 확정 줄을 지금 판정 same_site_address로 재분류, 확정 없는 공개 공고 줄, 보류함 상태, W3b 지도 처리 상태, 11-24 뒤 쓰기 기록의 확정 유지·잃음) / scripts/ops/jobs/read-job-6337-source.sql(원문·상세요강 글자, 원본 사이트 주소는 조회 안 함).
- 검증 [직접 확인]: run-sql-plan 통과(읽기 전용 강제), 로컬 폐기용 PostgreSQL 16(운영 본문 함수 + W6 적용)에서 두 계획 모두 오류 없이 실행.
- 완료: W6 #1013 대표 Approve → 병합 20ea3ce → migrations-apply 45404543388 → deploy-verify 45404883130 성공.
- 미완료: 두 SQL의 운영 실행(Lee 계정 수동), 결과 검토, 복구 migration(승인 뒤), W4·W6 실제 다시 수집 실증, #6337 원인 확정.

## 2026-11-24 — 지도 W6: 같은 사업장의 확정 좌표는 주소·회사명 표기 변경으로 초기화하지 않음 (DB, 대표 Approve 대상)
- 요청(Lee): 확정 출처와 관계없이 같은 사업장 확정 좌표 보호 / 단순 주소·회사명 표기 변경으로 초기화 금지 / 실제 이전·다른 지점은 기존 절차 / 번지 없는 공단 주소도 범위(공단명·행정구역 일치만으로 같은 사업장 판정 금지) / Google 확정 정책 변경 없음. W3b와 별도 PR.
- 원인 [직접 확인 — 코드]: 트리거 job_identity_changed(20261026231445)가 공고 위치 글자가 바뀌면 그 줄을, 회사 이름이 조금이라도 바뀌면 모든 줄을 invalidate — 확정 줄 보호를 거치지 않는다. Facebook 다시 처리는 회사 이름도 고치는 칸이라 실제 자동 경로다.
- 변경(migration 20261124150000_location_same_site_keep): ⓐ 판정 한 곳 location_private.same_site_address — 열쇠 같음 / 앞부분 일치+번지 숫자(기존 규칙) / 번지 없으면 덧붙은 꼬리가 그 줄에 저장된 행정구역 이름 전체·단위 낱말뿐이고 숫자 없음(로트·번호·mở rộng이 다르면 같지 않음, 지역 정보가 줄에 없으면 추정하지 않음) ⓑ write_location의 같은 지점 줄 찾기(#1002)가 이 함수를 씀 → 다시 수집(replace)도 같은 판정 ⓒ 트리거가 같은 사업장 확정 줄(검증 좌표·관리자 확정·재사용)을 건너뜀, 줄 주소 글자는 그대로 ⓓ 관리자 확정 자격 view 두 개 — 이미 그 확정을 가진 줄은 회사 이름 표기(성조·대소문자·문장부호·띄어쓰기)만 바뀌어도 유지. 다른 공고로 새로 재사용하는 열쇠(같은 회사 이름+같은 주소 글자)는 그대로.
- 다루지 않은 것(보고): 법인 형태 줄임말(CTY↔Công ty) 같은 회사 이름 차이는 표기 변경으로 보지 않는다(DB에 회사 이름 정규화 함수가 없어 새 정규화를 만들지 않음) / 공단 정문(auto_gate)·대략 줄은 대상 아님 / 기존 보호 장치(pin_guard·merge_protected_work_locations) 제거 없음 / 기존 데이터 복구는 W7.
- 검증 [직접 확인]: 로컬 폐기용 PostgreSQL 16, 운영 본문(write_location + #1002 패치·자격 view·reconcile_company·트리거 글자 그대로) 위에서 적용 전 시험 실패 → 적용 뒤 local(판정 10건 + 공고 11경우)·production_check 통과, 적용 전후 대조(public-location-diff) 통과.
- 미완료: 대표 Approve·운영 적용·운영 확인, W4 운영 다시 수집 실증, W5·W7 범위 유지, R 1단계(#6337 원문 재현).

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
