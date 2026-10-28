# CHATGPT_HANDOFF — 수집 입구 운영 적용·AI 제안만 (2026-10-28 밤)

## 1. 현재 상태 (코드·배포·DB)
- master 840834d(#305). 운영 viecganban.vn, deploy-verify 통과(run 40728704605, 840834d). 직전 9dc56b3(#304) deploy-verify는 "Vercel Production READY 확인" 단계 실패(run 40725500882) — DB·시험 파일만 바뀐 커밋이라 앱 배포가 없었던 것으로 추정, 다음 커밋에서 통과.
- 수집 입구 운영 적용(#304, migration 20261028160000, migrations-apply run 40723054027 성공): `ingest_job()`(원문 보존→중복→직업분류→위치→공개, SECURITY INVOKER, 받는 칸 정해짐), `job_ingest_raw`·`job_ingest_log`·`job_ai_suggestions`(service_role만). 위치 결과는 공개를 바꾸지 않음(Lee ①, 위치 보류 트리거 제거, 다시 공개될 대상 0건 run 40721734466). 위치 판정의 공고 삭제 없음(#300).
- AI 복리후생은 제안만(#305): 모든 AI 판정은 `job_ai_suggestions`에 저장. 셔틀·기숙사·식사 칸은 원문 단어 규칙(jobInspect BENEFIT_HINTS)이 같은 뜻일 때만 반영, 복수직무 식사는 반영 안 함.
- 아직 어떤 등록 경로도 `ingest_job`을 부르지 않음(SQL 파일·관리자 앱·크롤러 모두 기존 경로). 크롤러 정지 유지(`crawl.yml` if:false).
- 지도: 순서표 번지→회사+공단→공단 입구→거리 가운데→동→시(결정 0006). 핀 변경은 지도 재개 지시 전까지 금지. #288 Draft 보류(Goong 키 Vercel 미등록, Lee 문의 중).
- 결정 문서·CODEOWNERS 변경 PR은 현재 커밋에 Lee 승인 있어야 봇 병합(#298).
- Android TWA(#296·#297) 준비됨. 남은 것: GH_SECRETS_TOKEN 등록→업로드 키→.aab→Play 비공개 테스트→assetlinks.json. Lee 몫: Play 계정(25달러·본인 인증), 테스터 12명+·14일. docs/plans/2026-10-28-android-twa.md.

## 2. 다음 할 일 3개
1. 입구 전환 ①: SQL 파일 등록(`ops-insert-job.yml`)이 `ingest_job`을 거치게 변경.
2. 입구 전환 ②: 관리자 앱 등록 → 앱 계정에 `ingest_job` 권한을 여는 DB 변경(dry-run 보고 → Lee "적용" 후). 그다음 크롤러. 크롤링은 크롤러가 입구로 옮겨진 뒤에만 재개.
3. 후속: browser(KDA 틀) 시험 불안정 반복 원인, 시험 브랜치 `test/decision-gate-unapproved-20261028` 삭제(세션에서 원격 삭제 막힘).

## 3. 필수 규칙
- 운영 DB 직접 조회·SQL 금지(읽기 집계도 Lee 승인 또는 다른 세션). migration+production_check 정상 경로만. 위치는 공개를 안 바꿈, AI는 제안만.
- 공고는 하나씩 고치지 말고 규칙·시험으로. 화면 모양 변경은 글 모형 먼저. 보고 5줄, 직접 확인/기존 기록/추정 구분. 상세: WORK_LOG.md, docs/plans/2026-10-28-ingest-gateway.md.
