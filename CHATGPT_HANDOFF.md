# CHATGPT_HANDOFF — 공고 등록 입구 하나로(2단계) (2026-10-29 새벽)

## 1. 현재 상태 (코드·배포·DB)
- master 0170c1a(#309, 입구 2단계). 운영 반영 완료: migrations-apply 성공(run 40786334886, 운영 점검 포함), Production 0170c1a READY, deploy-verify 통과(run 40786585971). 관리자 E2E 2개(위치 확정 run 40786436909, 고르기 run 40786434292)도 입구 경유 등록으로 통과.
- 입구 2단계(migration 20261029010000): 입구 밖 local_jobs INSERT를 모든 계정에서 DB가 거부(trg_000_ingest_gateway_only), 입구가 판정 칸만 빼고 모든 칸 받음, 기존 공고까지 중복 판정, 다시 수집(바뀐 칸만), 경로 사칭 금지, 관리자 등록 정책, admin_create_job 닫음, 게스트용 company_identity anon 실행. 관리자 화면·고용주/게스트·크롤러(TopCV·Facebook)·E2E 4개가 ingest_job 사용. 직접 등록 코드는 npm test(api/_ingest-one-door-guard.test.ts)가 막음. 설계·진행: docs/plans/2026-10-28-ingest-gateway.md.
- 기존 방향에서 바뀐 것(Lee 10-29): 길마다 PR을 나누지 않고 한 번에, "권한 회수"가 아니라 DB가 입구 밖 등록을 거부하는 구조. 입구 받는 칸은 허용 목록 → 판정 칸 제외 방식(SQL 파일 변환기는 1단계 목록 유지).
- 발견: 옛 관리자 화면 등록은 원문 없이 저장해 R3에 걸리는 상태였음(코드 확인). 크롤러 정지 유지(crawl.yml if:false).
- 지도: 순서표 번지→회사+공단→공단 입구→거리 가운데→동→시(결정 0006). 핀 변경은 지도 재개 지시 전까지 금지. #288 보류(Goong 키 없음, Lee 문의 중). Android TWA(#296·#297) 준비됨, Play 본인 인증·테스터 모집은 Lee 몫.

## 2. 다음 할 일 3개
1. 크롤링 재개 여부 Lee 결정(크롤러는 입구로 옮겨짐, crawl.yml if:false 유지 중).
2. 남은 결정: 기존 공고 수정(UPDATE)도 입구로 모을지, 크롤러 위치 동기화(보호 행 병합)를 입구 위치 단계로 옮길지.
3. 게스트 등록이 운영에서 실제로 되는지 다음 게스트 등록 때 확인(코드상 10-27 #279부터 막혔던 것으로 추정, 이번에 권한 수정).

## 3. 필수 규칙
- 운영 DB 직접 조회·SQL 금지. migration+production_check 정상 경로만. 위치는 공개를 안 바꿈, AI는 제안만. 공고 등록은 ingest_job만(직접 INSERT는 DB가 거부).
- 같은 작업을 두 세션이 동시에 하지 않기(10-29 #308과 겹침). 공고는 규칙·시험으로 고침. 보고 짧게, 직접 확인/기존 기록/추정 구분. 상세: WORK_LOG.md.
