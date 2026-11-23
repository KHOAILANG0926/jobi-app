## 2026-11-23 — 1순위: 자동 병합 실패 복구(봇 병합 거절 사유 분류) — 영구 차단은 기록, 일시 오류만 한도 안 재시도 (Draft, 병합·운영 DB 없음)
- 원인 [직접 확인]: 봇이 병합 API 거절을 모두 "다음 실행에서 다시 봄"으로만 처리 — 영구 차단(충돌·승인/검사 대기·보호 규칙)이 매 실행 반복(#464 'merge conflicts' 405가 실행마다 나옴)되고 사유가 요약에 안 남음. 승인 직후 approval-gate 반영 지연으로 한 번 건너뛰는 것은 기존 6분 재확인 장치가 이미 처리(#992·#994 실제 병합 확인).
- 변경: scripts/ci/merge-reject-class.jq(거절 글 → permanent/transient/unknown) · bot-pr-automerge 거절 분기: 일시만 head 60분 안에서 6분 재확인 예약, 영구·분류 불가는 예약 없이 사유 원문을 실행 요약에 기록 · 시험 추가.
- 작업 큐: 이미 있음(claude-auto.yml task-pickup — `ai-task` 라벨 이슈, 3시간마다 가장 오래된 1건, `ai-task-running` 중복 방지) — 새 시스템 없음. 우선순위 순서는 Lee가 라벨로 정하는 것이라 코드로 만들지 않았다.

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

## 2026-11-21 — #808 S1~S8 마감: 독립 검토·4대 보고를 병합 조건에서 뺌, 병합 뒤 검사 2개 추가, PR 본문 형식 F12, MAP-1 지도 스타일 대기, ai-review 검사 삭제
- 요청(Lee 11-21): 공고 자동 수집→검증→공개에 필요한 것만 끝내고 #808 닫기. 결정 1 대안 거절 뒤 "최신 상태 요구 안 씀", 결정 2 독립 검토 선택화(11-14 결정 7①·#807 게이트 (3) 변경), 3 MAP-1 원인만, 4 vieclam24h 1건, 5 기록.
- 변경: approval-checks ai-review = neutral「필수 아님, 검토 안 함」·4대 보고 분기 삭제 / decision-approval-gate 4대 보고(highRiskReport 등) 삭제 / bot-pr-automerge 검토 대기·검토관 자동 호출 삭제, 병합 뒤 호출 목록에 ai-reader-calibration·job-ocr-check / merge-gate-ready.jq = approval-gate만 / check-pr-ready READY 줄 뒤 설명 허용·칸 경계 / vietMapStyle 상세·관리자 지도 스타일 대기 5·6초→15·20초(메인은 12초 예비지도 제한 안이라 5·6초 유지 — 검토관 지적 1, 시험으로 묶음) / map-summary-check 실패 증거 저장 / 안 쓰게 된 codexGate·needsSecondReview 삭제(검토관 지적 3) / BLOCKED·MERGED 줄도 같은 기준(지적 2) / CLAUDE.md·RULES_CORE.md·AGENTS.md·claude-auto 주석.
- MAP-1 [직접 확인 11-21]: 운영 대상 지도 검사 재현 — style.json 6번 200(0.24~1.9초) 뒤 2번 응답 없음(5·6초 제한 초과). 같은 주소 12번 중 3번 11~12초·1번 20초+(다른 VietMap 파일·사이트는 1초 안). 같은 순서 20번: 운영(옛 코드) 실패 10, 새 코드 실패 2(상세 35초+ 1·메인 예비지도 전환 1 — 이 환경은 예비지도 주소 막힘).
- 검증: 관련 시험 21개·npm test 124/124·tsc·build 통과(로컬). check-repository-policy는 CI 이벤트 필요(CI에서 확인).
- #808 최종 결과(11-21, 닫음): 끝 기준 1 완료 — PR #948 1a83668 봇 병합(run 44883022114)·vercel-deploy 44883059904·deploy-verify 44883165886(MAP-1 통과)·행정 핀 44883204814 성공, 잠금 #943·#945 풀림 조건 충족(이슈는 열린 채) / 끝 기준 2 보류 — vieclam24h 시험 2건(44879128739·44879875442) 본문에 전화번호 없어 공개 0 / Lee가 Ruleset에서 ai-review를 뺀 뒤(08:17Z) ai-review 검사 삭제 PR(approval-checks는 approval-gate만).

## 2026-11-21 — 이전 HANDOFF 본문(11-09~11-18 상태 목록) 이동 — HANDOFF를 1페이지로 덮어쓰며 옮김
- 11-18 vieclam24h 전화번호: 상세 공개 버튼 눌러 읽기 PR(로그인 필요하면 멈춤). 실제 화면 확인은 병합 뒤 VPS 시험 수집 1건. 저장·공개·정기 수집 없음.
- 11-17 #872 R: 회사 이름 동의 확정(규칙 + AI 3회, Facebook 원문 회사만) PR — Lee 승인 전 병합·운영 적용 금지. #886(저장 시험 분리)은 Lee 승인 대기, 운영 DB 저장 시험은 별도 승인 전 실행 안 함. #887은 평가 전용(병합 안 함).
- 11-14 공개 여부 쓰기 정리(#728 R4 4단계, #805): OCR 재공개 블록·canRepublish 삭제(OCR은 내리기만, 올리기는 검사표 한 곳), keepExisting 죽은 코드 삭제, 마감 공고를 공개 조회에서 제외(isJobOpen 한 곳, fetchJobsData). DB 변경 없음. 11-18 지금 master 위로 다시 올림, Lee 승인 전 병합 금지.
- 11-16 S4 B단계: Claude 앱 교환은 checks:write 발급 불가(run 43797922253) → 검사 전용 GitHub 앱(viecganban-checks, 기존 ops-keys 환경)으로 바꾸는 Draft PR. 대표님 앱 설정·Approve 뒤 두 검사 생성 확인 → 필수 지정 → 봇 켜기 → 실증 4건.
- 11-14 직업분류 게이트 비밀키 분리(#728 R4, Draft): publication-gate는 키 없는 시험만, AI 판독 교정은 신뢰된 ai-reader-calibration.yml, 판독 입력 변경 PR은 head 커밋 dispatch 성공 필요(ai-reader-guard). 승인 전 적용 금지.
- 11-13 R2 검증·승인 통제(#728): 병합 봇이 needs-lee 라벨·승인된 화면 틀 파일·결정 문서 PR을 현재 head Lee 승인 전엔 병합 안 함(#792, 원격 위반 PR #793·#794 차단 확인). R2 완료 아님 — 승인 필요 항목(#740·5157·고용주 관문·#764·#771·계정 분리)은 #728 장부.
- 11-12 밤 근무(2): #760 뒤 대기열이 sb-5942 HAIDILAO(원문 주소 없음)에서 실패 → 주소 못 읽으면 위치 칸만 그대로 두는 PR.
- 11-12 밤 근무: Facebook 기존 공고 찾기가 상세요강 다시 만든 공고를 놓쳐 "기존 0개"로 보던 것(#633 ZHAN AN) → is_facebook_row 한 곳(원문 주소 포함) PR.
- 11-11 밤 근무: 봇 병합이 gh 자체 판단(mergeStateStatus)으로 검사 통과 PR을 거절하던 것(#686) → 서버 병합 API로 바꿈 PR #710. 15:26~ 러너 ubuntu 저장소 주소 장애로 PR 검사(migration-postgres·app-screen) 실패 중(#711) — 풀리면 실패 작업 다시 실행.
- 11-11 밤 근무: 저녁 8시 보고에 'Google 이번 달 사용/한도' 줄 추가(#560 — 대량 수집 전 남은 몫 확인용) PR. 운영 출력은 다음 20시 실행에서 확인.
- 11-11 밤 근무 [직접 확인]: 주소 읽기 — 이름표 뒤 띄어 쓴 대시 칸(GOERTEK 'Làm việc tại: Nam Sơn / Quế Võ 1 - Bắc Ninh', #633) PR. WINMART+ 'khu vực' 뗌은 #668에 이미 있음.
- 11-11 새벽 [직접 확인]: 화면 대조가 비공개 공고를 한 번도 못 열던 것(화면 로그인이 상세에 안 넘어감) #670으로 고침 → 새 공고 sb-5938(Toàn Thắng)·sb-5942(HAIDILAO) 공개, PC·모바일 확인. sb-5931(KHVATEC)은 예전 실패 기록 재대조(3시간 규칙) 대기.
- 11-11 새벽: PR 「확인한 기록」 검사(#667, #666) — 바뀐 파일의 최근 14일 병합 PR·같은 파일 열린 PR을 검사가 찾아 줄마다 제목 낱말 포함 설명 요구, 회사·주소·급여 읽기 함수 수정은 시험 eq 사례 추가 필수. 한계: 읽었는지·채팅 제안·결정 변경 판정은 기계로 못 막음.
- 11-11 새벽: 회사·주소 읽기 따로 붙였던 단계 합침 + 미리 보기 2차 사례(#668), 미리 보기 로그 전화 가림(#661·#664).
- 11-10 밤 상세 ④ 꾸민 본문 + 업종별 13색(#655, Lee "가자") 운영 반영, deploy-verify 42837555553 통과 [직접 확인]. 최신 틀·10-30 구성 공고만, KDA·여러 직무 공고는 기존.
- 11-10 밤 상세 구성(#653, Lee 적용): 10-30 확정 자리로 원문 줄 나눔(① Phụ cấp·Thưởng, ② Yêu cầu khác, ④ 6칸) + #563 업종 그림 머리 + 급여 칸 정리. KDA·여러 직무 공고는 기존대로. deploy-verify 42827351625 통과 [직접 확인]. #563 이슈는 이 PR로 운영 반영.
- 11-10 밤 화면 대조(#646): #650(운영 화면 ↔ 원문·DB 대조, detail-read에 합침)·#651(공개 후보는 관리자 비공개 상세 대조 통과 뒤 공개) 병합, deploy-verify 42814545437 통과 [직접 확인]. 공개 22건 1회 점검 확정 오류 0 [직접 확인 run 42809331299].
- 11-10 병합: #616~#619·#624·#625·#628·#630~#632·#634·#635·#637·#639~#644 [직접 확인]. sb-5876 운영 확인: 제목 "TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT", 회사 "CÔNG TY TNHH ZHAN AN", Google 버튼 = 핀 좌표 21.1585515,106.0664443. 이전: 11-08 PR #542~#554, 밤 근무 #565·#568·#573·#570·#575·#566 운영 반영.
- 알바몬 따라 하기(Lee 11-08) 운영 반영:
  - 고객센터 /ho-tro(FAQ·공지·'Hỏi đáp 1:1' 작성), 벽보 /lam-poster, 테마 채용관 /chu-de/:slug 8개(src/pages/ServicePages.tsx).
  - 공고 등록 /dang-tin: 급여계산기 링크, 임시저장(브라우저), PC 오른쪽 체크 목록, 미리보기 PC·Mobile(/xem-truoc-tin = JobDetail previewJob, 단추 막힘), 새 입력 칸(초보 가능·친구와 함께·우대조건 7개·기간 Thỏa thuận·식대·수습·접수 방법·담당자 이름 → 기존 칸 preference·salary_note·상세요강 '채용 절차'), 추가 고용형태(employment_type_extra: contract·internship·collaborator).
  - 간편 템플릿 B안: 등록 화면 맨 아래 템플릿(src/components/template/AlbamonTemplate.tsx, 78틀) → local_jobs.description_html → 상세 ④가 그 모양 그대로(템플릿 안 쓴 공고·기존 공고는 글자 그대로). 머리 그림 = AI 팀 그림 담당이 그린 업종별 우리 그림(public/images/template, CATEGORY_IMAGES), 글자 모두 검정 + 제목 자리 왼쪽 흐림(새 템플릿 클래스 amt-visual--fade만, 예전 저장 공고 HTML은 그대로, #570). 같은 SHA 로컬 화면 확인 끝, 운영 주소 눈 확인만 남음(#571). 모바일 미리보기 새 창 치우침 고침(#577).
  - 1:1 문의: public.support_inquiries(넣기 누구나 5칸, 읽기·처리 관리자 RLS) + 관리자 탭 '💬 Hỏi đáp 1:1'. 권한은 #553에서 Supabase 기본 권한 걷음(#552 운영 점검 실패 후속 — 새 표 만들 때 revoke all 필수).
  - 머리 줄·메뉴·바닥(src/components/siteChrome.css, SiteFooter.tsx): 검색 칸, 메뉴 이모지 없음·펼침 4칸(col), 바닥 알바몬 구성. 메인 본문·공고 카드는 그대로(카드 변경 데모는 Lee 거부 — 카드 틀은 글 모형 먼저).
  - 이름: 화면·약관·SEO 전부 "Việc gần Bạn"(주소 viecganban.vn·이메일 그대로). scripts/layout/brand-name-check.mjs가 예전 이름 재유입을 막음.
- 이메일 support@viecganban.vn: ImprovMX 무료 전달 설정됨(support → Lee Gmail). Lee가 Mắt Bão DNS에 MX 2줄(mx1/mx2.improvmx.com, 10/20)·TXT 1줄(v=spf1 include:spf.improvmx.com ~all) 넣기 남음(A·CNAME 건드리지 않기).
- 데모 브랜치(운영 아님): demo/albamon-template, demo/site-chrome, demo/white-bg(바탕 흰색 — Lee "색깔은 그냥 놔둬"로 미적용), demo/template-detail.
- 11-09 아침(Lee "적용"): /dang-tin 흰 바탕·업직종 선택 창·근무기간 7칸·사진 4칸(+동영상 자리)·문구 정리, 고용주 사진이 공고에 연결 안 되던 버그 수정(image_url·images), 상세 템플릿 PC 가운데·빈 회사 이름 숨김. 상세 WORK_LOG. Lee 결정 대기: 동영상 유튜브 링크 저장 칸(DB), 빠른 등록 Tuyển liên tục.
- 11-09 오전 구조 단순화(Lee "덧붙이기 전에 고치기·합치기·지우기", CLAUDE.md 우선 원칙 8): 상세 틀 2개(KDA·4칸)로 합침, 안 쓰는 파일·자동화 정리, DB 검사 이름 규칙, 규칙 문서 축약. Lee 결정 대기: 운영 SQL 실행 작업 제한안, 동영상 저장 칸. CSS 대규모 정리는 보류(관련 기능 고칠 때 확실한 중복만).
- 11-09 밤 근무: 테마 채용관 모르는 주소 → 첫 테마로 바꿔 보냄·지역 칸 34개 성(#623). #594 P1 교대 누락은 #622(needs-lee).
- 그 외 이전 상태(회사 이름 읽기·카드 상호·급여 읽기·소개소 표시 등)는 WORK_LOG.md.
