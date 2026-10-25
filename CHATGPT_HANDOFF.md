# CHATGPT_HANDOFF — 상세요강 하나의 흐름·검사표·저장 순간 신호 (2026-10-25)

## 1. 현재 상태 (master 790bfda 이후, 운영 반영·DB 적용 확인)
- 상세요강: 원문이 있는 공고는 **기계가 원문에서 다시 만든다**(src/lib/jobDescriptionBuild.ts, scripts/ocr/detail-fill.mjs). AI가 상세요강 글을 쓰거나 고치지 않는다 — 고쳐도 다음 실행에서 원문 기준으로 덮인다. 원래 글은 local_jobs_description_backup(reason=rebuild-from-source-20261025).
- 칸 못 정한 줄·복리후생: AI(scripts/ocr/ai-classify.mjs)가 정해진 칸 01~07·복리후생 번호표 중에서만 고르고, 안전장치(src/lib/aiClassifyGuard.ts)가 목록 밖·원문 밖·부정 문장을 버림. 정한 줄은 detail_line_kinds에 저장(Lee가 정한 칸은 AI가 못 바꿈).
- 위쪽 칸(급여 총액·나이·성별·근무시간 등)과 같은 내용은 상세요강에서 반복하지 않음. 급여 칸이 비면 원문 급여를 글자 그대로 채움(src/lib/sourceSalary.ts). "Nhà máy Quế Võ III"처럼 공단 표 이름과 같은 공장 이름은 그 공단.
- 공고 검사표(src/lib/jobInspect.ts, scripts/ops/job-inspect.mjs): 11항목, 이슈 "공고 검사표"에 결과 + **연속 통과 N/10**(현재 4/10). 10/10이 크롤링 시작 조건(Lee 결정).
- 실행 시점: **공고 저장 순간 DB가 GitHub 작업을 시작**(migration 20261025160000, Vault github_dispatch_token, pg_cron 1분). GitHub 예약 실행은 실제로 몇 시간에 한 번만 돌아 믿지 않는다. 하루 1번(05:10) 안전망.
- 수집 자동 멈춤(20261025120000): 같은 소스·같은 원인 3건 연속 실패 → 그 소스만 DB가 저장 거부 → crawl-guard.yml 알림·자동 수리(최대 2번)·자동 재개. 크롤링은 아직 꺼져 있음(실제 끝까지 동작은 크롤링 재개 때 확인).
- 배포: GitHub Actions에서 빌드 → Vercel에 결과만 올림(vercel-deploy.yml, Secrets VERCEL_TOKEN). Vercel 자동 배포 꺼짐. **무료 한도 하루 100번** — 앱 파일(src·api·public·설정)이 바뀐 커밋만 배포, 한도 실패분은 2시간마다 따라잡기.
- 검사 규칙: migration은 결정 0002대로 삭제·되돌리기 어려운 것만 막음(scripts/check-repository-policy.mjs).

## 2. 다음 할 일 3개
1. Lee가 새 공고를 하나씩 올림 → 검사표 ❌ 항목이 나오면 원인 고치고 **그 공고를 실제 사례 시험으로 추가**(jobDescriptionBuild.fixtures.ts / jobInspect.test.ts 등). 연속 10개 통과까지.
2. 관리자 페이지 "고르기" 대기 목록: detail_line_kinds·검사표 ❌를 Lee가 클릭으로 정함(decided_by='lee'). 직접 입력 방식 금지.
3. 정리: 해결된 "운영 배포 검증/실패" 이슈 닫기, CLAUDE.md·AGENTS.md의 옛 결정(예: "자동 승인 핀은 두 경우뿐")을 Lee 최신 결정(핀 무조건·순서표)에 맞추기, 데모 고정 링크(전용 토큰은 alias 불가).

## 3. 필수 규칙
- AI가 상세요강·원문 글자를 고쳐 쓰지 않는다. 새 문제는 규칙·번호표·시험으로 고친다(공고 하나만 손으로 고치지 않는다).
- 완료 보고 = 운영 반영 + 실제 조회 근거([직접 확인]/[기존 기록]/[추정]). 실행 안 한 것을 했다고 쓰지 않는다. Claude가 원본(DB·GitHub 실행 결과)으로 검증한다.
- 배포 한도 아끼기: 작은 변경은 모아서 한 번에. 운영 DB·Auth·RLS·Secrets·STATUS 보호, 가짜 공고 금지, 회사 PC 저장 안내·현장 방문 제안 금지.
