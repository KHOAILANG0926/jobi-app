## 2026-11-24 — 확정 순위 기록 + 2순위(기존 다중 지점 공고 전환) dry-run 준비 (운영 변경 없음)
- 요청: Lee 확정 순위 저장(1순위 완료·2순위 다중 지점 전환·3순위 격리 Preview 차등 검증), 2순위 착수.
- 변경: docs/plans/2026-11-24-multi-branch-conversion.md(대상 정의·기존 장치로 전환·복구·순서), scripts/ops/jobs/multi-branch-conversion-preview.sql(읽기 전용 집계, ops-run-sql), CHATGPT_HANDOFF.md.
- 검증 [직접 확인]: run-sql-plan 통과, 로컬 PostgreSQL 16 합성 자료로 집계 결과 확인. 운영 대상 건수는 미확인(운영 DB 읽기 권한 없음 — Lee가 ops-run-sql 실행).
- 이전 HANDOFF(#988 지점별 독립 공고 구현 스냅샷)는 git 이력에 있음.

## 2026-11-24 — #995 실전 검증 후속: approval-gate 대기 기준 시각 조회 실패를 '60분 초과'로 오판 수정 (병합·운영 DB 없음)
- 원인 [직접 확인 — 실행 45293080396 로그]: 대표 Approve 직후(23:56:50) pull_request_review 실행은 PR 브랜치의 봇 워크플로로 돌고 scripts는 master 사본(체크아웃 ref master)이라 새 판정 파일 recheck-since.jq가 없어 jq 실패 → 기준 시각 빈 값 → 재확인 대신 '60분 초과 판정 불가'로 보류. 그 시점 approval-gate는 아직 옛 판정이었고(approval-checks 45293102602가 23:57~23:58 갱신) pending 판독 자체는 맞음. 병합은 00:03:30 다른 실행(45293892608)이 함.
- 수정: 기준 시각 조회 실패 → head 커밋 시각으로 대신, 그것도 없으면 6분 재확인(판정 불가로 보지 않음). 60분 상한·승인 판정·approval-gate 확인은 그대로.
- 운영 연결 [직접 확인]: 41fb3f8 배포 → deploy-verify 45294048081 성공 → 작업 큐 호출 → claude-auto 45294331261 task-pickup "시작할 ai-task 이슈 없음"(대기 이슈 0건).

## 2026-11-24 — 1순위: 자동 병합 실패 복구 + 운영 성공 뒤 다음 작업 1건 연결 (#995 이어서, 병합·운영 DB 없음)
- 원인 [직접 확인 — run 45288046609·#955 check-runs]: 포크 PR(#955·#874)은 approval-checks가 판정하지 않아 approval-gate가 없는데, 봇은 '판정 대기'로 보고 6분 재확인을 상한 없이 예약 → 11-22부터 7분 간격 무한 반복. 같은 경로에 60분 상한이 없었음. 병합 거절은 모두 같은 '다음에 다시'(11-23 #995에서 분류 추가).
- 공통 수정: 봇 병합 — 재시도로 안 풀리는 차단(포크 PR·영구 거절·approval-gate 60분 넘게 무판정)은 재확인 예약 없이 사유를 실행 요약+PR 댓글(커밋·사유당 1번)에 기록, 일시 지연은 head 커밋/이 커밋 최신 리뷰 뒤 60분 안에서만 6분 재확인(recheck-since.jq).
- 다음 작업 연결: deploy-verify 마지막 단계(앞 단계 모두 성공 시만) → deploy-success-pickup.sh → 기존 task-pickup(pickup=true) 1번. 재실행·같은 커밋 두 번째 성공·master 아닌 옛 커밋은 안 부름. 봇 병합이 부른 deploy-verify는 workflow_run 계기를 못 만들어(administrative-pin-check 11-23 기록) 직접 호출로 함.
- 시험: scripts/ci/automerge-recovery.test.mjs(실제 YAML 쉘+가짜 gh, AMR_BEFORE_REF=f3bd111로 수정 전 실패 재현) + 기존 봇·승인·후속 연결 시험.

## 2026-11-23 — #992 대조 후 승인 기준 보완: 재확인 상한 60분·DB 구조(DDL)·pull_request_target 수동 (Draft, 병합·운영 DB 없음)
- 대조 결과 [직접 확인]: #992에 이미 반영 — 규칙 문서 3개·결정 문서·CODEOWNERS·필수 검사 구성(필수 이름 잡 정의 워크플로)·워크플로 경계(on·permissions·environment·runs-on·uses·secrets)·고권한(실제 설정) 명령 변경·STRICT·화면 틀 수동, 조회 실패 자동 재확인. 빠짐: ① 재확인 상한 없음 ② DB 구조(DDL)가 권한 신호만 보아 자동 ③ pull_request_target를 고권한으로 안 봄 ④ 격리 Preview 차등 검증(미구현, 후속).
- 변경: decision-approval-gate(RETRY_LIMIT_MINUTES=60 초과 시 '판정 불가' 사유 기록·대표 판단, DDL 신호는 supabase/migrations만, pull_request_target 고권한) · approval-checks·bot-pr-automerge가 head 나이를 넘김 · 규칙 문서 3개.
- 검증: 신규 시험 + S4 우회 시험·approval-checks·callpath·claude-publish·scope 통과, 최근 병합 42건 재판정 전환 0건(보안 미탐 0).

## 2026-11-23 — 이슈 #990 후속: 행정구역 핀 검사 6건·OCR 검사 2회 실패 원인별 수정 + PR 단계 읽기 전용 검사 (Draft→Ready, 병합·운영 DB 없음)
- 원인(공개 캐시·원본 불일치): #991이 공개 위치 요약 API를 확정 좌표만으로 맞춰 해결, 병합 커밋 deploy-verify 성공이 증거. 원인(핀 6건 5599·5876·5993·6043·6255·6309): #989 규칙(대략 area는 핀 아님) 뒤 확정 좌표가 없는 공개 공고를 행정구역 검사가 아직 '핀 없음 = 실패'로 봄. 원인(OCR 2회 실패): 공고 6311의 외부 사진 주소 HTTP 403(영구 접근 거부)이 매 실행 exit 2.
- 변경: oracle — 근무지 줄이 있으나 확정 좌표 없는 공고는 실패가 아니라 `unconfirmedLocationJobs`로 출력(줄 없는 공고·확정 좌표의 성 밖은 그대로 실패) / ocr-compare `imageFetchPermanent`(외부 주소 403·404·410만 건너뜀, 일시 오류·우리 저장소 오류는 실패 유지) + ocr-check 사용 / app-screen-check에 읽기 전용 운영 위치 검사 단계(PR 단계).
- 검증: 신규 시험 3종(수정 전 import 실패·수정 후 통과), 운영 읽기는 CI에서만(이 환경 운영 접근 없음). 미검증: 6건이 실제로 area/unresolved 줄만 가지는지는 CI 출력의 unconfirmedLocationJobs로 확인.

## 2026-11-23 — 이슈 #990: 공개 위치 요약(/api/map-locations)이 대략(area) 점을 내보내 운영 검증 실패(공고 5599) 수정 (Draft→Ready, 병합·운영 DB 없음)
- 원인 [직접 확인 — 코드]: #989가 핀 원천을 확정 좌표(exact·gate)로 좁히면서 원본 대조(oracle sourcePoints)와 화면 코드는 맞췄지만, 공개 캐시 읽기 `api/map-locations.js`의 허용 종류가 아직 exact·gate·area라 5599의 대략 줄이 응답에 남아 deploy-verify '지도 요약'(map-summary-check) 대조가 어긋남. 5599만의 문제가 아니라 area 줄이 있는 모든 공고.
- 변경: `api/map-locations.js` 허용 종류 exact·gate만(캐시 표·DB 줄은 그대로 보존), `api/map-locations.test.ts`·`api/_map-r1.test.ts` 기대값을 확정 좌표만으로(수정 전 실패 재현: area 포함 → 1 !== 2).
- 검증: tsc · npm test 125/125. 운영 화면·핀 검사는 병합 뒤 deploy-verify로 확인(미실행).

## 2026-11-23 — 이슈 #988: 지점별 독립 공고 + 위치 우선순위(Google→VietMap→Goong) 구현 + 자율 완주 규정 (Draft→Ready, 병합·운영 DB 없음)
- 요청: Lee 2026-11-23 — #987 규정의 실제 구현(지점별 독립 공고, Google→VietMap→Goong, 확정 좌표만 핀·거리검색)과 「자율 완주 및 승인 게이트 원칙」 문서 반영.
- 수정 전 실패 [직접 확인]: ① 옛 resolver는 Google이 찾아도 VietMap으로 다시 번지 확인하고 못 하면 대략(area) 위치로 낮춤(시험 'Google place adopted as confirmed exact' 실패, source=VietMap) ② 같은 글의 새 지점 find_existing이 첫 지점 공고를 돌려줌(1) ③ 같은 회사·일·공단 형제 지점 공고 중복 판정 `duplicate:1:same_company_job_location`(꺼짐) ④ 수집 입구는 지점 2곳을 공고 1개+근무지 2줄로 등록.
- 변경: autoLocationResolver(Google 채택·VietMap·Goong 순, 번지 재확인 단계 삭제) · locationPrecheck(area 회사 장소 분기 삭제) · jobCoords.resolveMapLocations(확정 좌표 exact+확인·gate만 → 핀·거리검색 한 곳) · ingest_gateway(지점마다 ingest_job 1회, branch_location) · migration 20261124000000_branch_job_identity(ingest_job 해시·find_existing에 지점 위치, verdict 같은 글 형제 면제) · 시험 갱신.
- 검증: tsc · npm test 125/125 · build · 크롤러 파이썬 시험 · branch_job_identity.pglite(운영 함수 본문에 줄 바꾸기 적용) · 로컬 PostgreSQL 16에서 CI와 같은 순서(fixture→setup→migration→local→production_check) 통과.
- TopCV·vieclam24h 지점 분리·Facebook refresh 형제 지점 분리·재수집 지점 누락 비종료는 구현+단위 시험(test_job_error_isolation·test_pin_guard). 미완료(범위 밖/미검증): 관리자 위치 확정 대기열(#985·#986 보류) · 기존 다중 근무지 공고 전환(dry-run·승인 필요) · 운영에서 ingest_job 전체 실행·기존 area 핀이 사라지는 건수는 운영 DB 조회 불가라 미확인.

## 2026-11-22 — JOBI 1-B(Lee 승인): 마감·연락처·필수 항목 기준 불일치 해소 — 코드·시험 Draft PR + DB cron Draft PR (병합·운영 DB 없음)
- 실제 실패 [직접 확인, 1-A 측정]: ① 마감 당일을 크롤러는 만료·Facebook은 기한 버림(→상시 공고로 등록), 화면·알림은 열림, 공개 판정 기본 날짜는 UTC ② 연락처: DB 8자리인데 Facebook·job_quality·화면은 값이 있기만 하면 통과(`0912345`·`abc`·`---`도) ③ 필수 9개 목록이 점검 코드·작성 화면·문서에 따로 있음(점검기는 독립성 규칙상 공유 불가 → 일치 시험으로 고정). 정책 평가기 3벌은 4,057건 불일치 0(F1).
- 변경(코드 PR): policy/job-criteria.json(마감·연락처·필수 9개 단일 원천) · crawler/job_criteria.py · src/lib/jobCriteria.mjs(+d.mts) · crawl_facebook/crawl_topcv/job_quality/finalize_reprocess_queue(베트남 날짜·마감 당일 열림·연락처 8자리) · jobInspect.ts(공개 판정 기본 날짜 = 베트남 — 검사기 독립성 시험(R2 #753) 때문에 공유 모듈을 import하지 않고 직접 계산, 필수 9개 목록은 jobCriteria.test.ts가 JSON과 일치를 고정) · 시험: 마감·연락처 경계, 정상 연락처 표기 회귀, 정책 판정기 Python·JS·SQL 일치 2,057건(job_posting_rules.pglite.test.mjs, 기존 CI 단계).
- 건드리지 않음: 화면 연락 버튼 표시(승인된 틀), 필수 여부·PostJob 12개, Facebook 지난 마감 새 제외, F4 khac·F5 review(기존 결정 미확정 → 코드 변경 없음), F6 원문 롤백·F8 위치 보호(1-C).
- 검증: 수정 전 새 시험 실패 재현(py 4·TS 1) → 수정 후 통과. npm test 125/125·tsc·py 시험·PGlite 일치 시험 통과(로컬). 변이 시험으로 일치 시험이 불일치를 잡는 것 확인. 운영 DB 조회 불가(프록시) → 운영 확인은 별도 보류.
- DB PR(별도 Draft): deactivate_expired_jobs 만료 기준 = 베트남 날짜(함수 한 개 교체, 되돌리기 = 이전 본문 복원 migration).
- 1-C(별도 Draft PR #972, Lee 승인): Facebook이 DB 규칙(job_rule_R*·정책 제외)으로 거부된 공고의 원문·출처·규칙 코드·사유를 기존 보류함에 rejected(종결, 자동 재시도 없음)로 보존 — crawler/ingest_gateway.py 포장(hold=True)만 변경. 보관 실패는 HoldStoreError → JOB_ERRORS → '본 글' 기록 안 됨. hold=False(TopCV·vieclam24h)·관리자·고용주 위치·DB ingest_job·공개 정책 변경 없음. 세 PR의 작업 기록은 이 PR에만 둠(병합 충돌 방지).
- 남은 결정·운영 확인 보류: 이슈 #973.

## 2026-11-22 — 크롤링 정상화 1번 그룹(Lee PR #958 최종 지시): 수집·인식·제외 규칙, 미리 보기 → 선택 저장 연결 (Draft, 2~4번 그룹은 별도 Draft로 분리)
- 실제 원인 [직접 확인]: ① 연락처 미기재가 FINAL(영구 제외, missing_required) ② not_job·office 사전 거름이 정상 구인 글을 영구 제외 — "Quán trả 8 triệu…"처럼 보수 문구가 든 구인 글(not_job), 본문에 kỹ sư·trưởng phòng을 언급한 공장 모집글(office) ③ 파서 예외가 `evaluate_post` 밖으로 나가 글 한 건에 가두지 못함 ④ 선택 저장(`save_selected_from_dryrun`)이 `is_ambiguous_job`만 직접 써서 일반 수집과 판정이 다르고, 미리 보기 아티팩트에는 review 후보가 없어 보류함에 보관 불가, 아티팩트 없음·고른 글 없음이 조용히 성공(종료 0)이었음.
- 변경: crawler/crawl_facebook.py(판정 네 갈래 정상/인식 실패 review/명백한 제외+근거 기록/파서·수집기 오류 parser_error→JOB_ERRORS · 연락처 없음 → review · not_job 약한 근거(보수 문구)는 직무 낱말 없을 때만·모집 인원 문구 구인 인정 · office는 모집 직무 줄(앞 두 줄)의 낱말+직무 낱말 없을 때만 · early_verdict·judge_read 공용(evaluate_post·judge_text) · evaluate_post_isolated · hold_review_posts(보관 성공 뒤에만 '본 글') · dry-run 아티팩트 review_jobs · 선택 저장: 정상=등록 / review=보류함 보관(성공 확인 뒤에만 완료) / 명백한 제외=종결 / 오류·만료·없는 키=미완료(종료 1), 본 글 기록 안 만듦) · crawler/ingest_gateway.py(REVIEW_STATUS 상태 값만) · 결정 문서(CLAUDE.md·RULES_CORE) 한 줄: 연락처 미기재=review 결정 기록(Lee 11-22, check-repository-policy가 정답 파일 변경 근거로 읽는 정식 기록).
- 검증 [직접 확인]: 수정 전(3742c14 기준) 새 시험 20건 실패·오류 → 수정 후 통과. 운영 DB·수집·병합 없음. 실제 GitHub dryrun→save는 아직 실행·검증하지 않음.
- 분리: 보류함 재판정·오류 줄 처리·`--retry-held`·workflow 변경·crawl-guard(2~4번 그룹)는 `claude/crawl-group2-4-preserved` Draft PR에 그대로 보존(유실 없음).

## 2026-11-21 — VietMap 지도 스타일 사본 먼저(메인·상세·관리자), 배포 빌드 때 사본 갱신 (#950, #946 MAP-1)
- 요청(Lee 11-21): style.json 멈춤은 실제 사용자 화면 문제 — 대기 시간을 더 늘리지 않고(같은 종류 두 번째), 약관 확인 뒤 사본을 우리 쪽에서 제공, 사본 없거나 실패할 때만 원본. 갱신은 기존 예약 작업에, 새 워크플로 없음. 검사 기준 그대로, deploy-verify 통과가 완료.
- 약관 [직접 확인]: VietMap 개발 문서 map-api overview "You may implement caching or response filtering as appropriate."(베트남어판 같은 뜻). 금지 조항 못 찾음(사이트 '약관' 링크는 개인정보 정책뿐).
- 변경: vietMapStyle.loadVietMapStyle(사본 4초 1번 → 실패·형식 오류면 원본, 기존 재시도 그대로)·stripStyleKey·withStyleKey 한 곳 — 메인·상세·관리자 처음 지도와 일반↔위성 교체 모두 사용. 사본 public/vietmap/styles/{tm,hm}.json(열쇠 값 비움 — 원본에서 열쇠는 타일 주소에만). scripts/ops/vietmap-style-copy.mjs를 vercel-deploy 빌드 직전에 실행(못 받으면 저장소 사본 그대로). map-summary-check는 사본 요청도 증거에 기록(판정 그대로).
- 검증 [직접 확인]: 운영 deploy-verify 44886908964 실패 2번(상세 sb-5876 지도 실패 / 재실행은 메인 핀 화면 밖 — 여기서 재현하니 메인 style 5·6초 두 번 멈춤 → 예비 지도). 같은 순서 20번: 운영(옛 코드) 실패 7·원본 요청 멈춤 17 → 새 코드(로컬 빌드) 실패 0·사본 20·원본 0. tsc·npm test 124/124·build 통과.
- 남은 것: PR 병합(Lee Approve) → 배포 → deploy-verify 통과로 #950 잠금 풀림 확인. 사본 갱신은 배포할 때만(배포가 없으면 갱신도 없음) — 타일 판 번호가 바뀌어도 옛 판이 계속 제공되는지는 미확인(hm은 2026-01 판 사용 중).
