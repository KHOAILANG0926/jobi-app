# HANDOFF — 2026-11-22 (Claude) · 크롤링 정상화 Draft PR #958 (1번 그룹 수정 반영)
## 1. 현재 상태
- 코드: master `f02306d`(#953). PR #958(브랜치 `claude/vigilant-turing-s3wcrs`)은 Draft — 병합·배포·정기 수집 없음, 운영 DB 변경 없음.
- 1번 그룹(수집·인식·제외, Lee PR 댓글 최종 지시): 판정 네 갈래(정상 / 인식 실패 review — 연락처 미기재 포함 / 명백한 제외+근거 기록 / 파서·수집기 오류 → JOB_ERRORS) · not_job·office 과도한 제외 완화 · dryrun 아티팩트에 review 후보(원문·출처·사유) · 선택 저장이 같은 판정(judge_text)으로 정상=등록, review=보류함 보관(성공 확인 뒤에만 완료), 명백한 제외=종결, 오류·아티팩트 만료=미완료(재수집 가능).
- 2~4번 그룹(이전 커밋의 retry_held 모드·crawl-guard·보류함 재판정/오류 줄 처리)은 PR에 남아 있으나 이번에 더 바꾸지 않음 — 분리 여부는 Lee 결정.
- 자동 수집 정지 이유: 정기 실행 제거(Lee 11-17 #872) + vieclam24h GitHub 서버 403·본문 전화번호 숨김, Facebook 계정 잠금(쿠키 만료) [기존 기록 #946].
- DB: 이번 작업 변경 없음.
## 2. 다음 할 일 3개
1. Draft PR: 필수 검사 → Lee 확인(워크플로 2개 변경) → 봇 병합 → deploy-verify 확인. retry_held 첫 실행은 Lee 승인 뒤(Google 한도 안, 새 글 안 읽음).
2. Lee: Facebook 쿠키(FB_C_USER·FB_XS, ops-keys) 갱신 → 계정 잠금 해제 → dryrun 시험 1건. vieclam24h는 본문 전화번호 있는 공고가 나오면 publish_one(승인).
3. 정기 수집 재개는 별도 승인 PR(재개 때 crawl-guard watch 줄을 fail_and_new로, retry_held를 실행마다 호출).
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve. 새 검사·규칙·워크플로·대기열을 덧붙이지 않는다(기존 오류만 최소 수정).
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 전체 수집은 승인 없이 켜지 않는다.
