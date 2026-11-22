# HANDOFF — 2026-11-22 (Claude) · 크롤링 정상화 Draft PR #958 (1번 그룹만)
## 1. 현재 상태
- 코드: master `f02306d`(#953). PR #958(브랜치 `claude/vigilant-turing-s3wcrs`)은 크롤링 정상화 **1번 그룹만** 남긴 Draft — 병합·배포·정기 수집 없음, 운영 DB 변경 없음. 2~4번 그룹(보류함 재판정·오류 줄 처리, retry_held 모드, crawl-guard)은 별도 Draft(`claude/crawl-group2-4-preserved`, base = 이 브랜치)로 보존.
- 1번 그룹(수집·인식·제외): 판정 네 갈래(정상 / 인식 실패 review — 연락처 미기재 포함 / 명백한 제외+근거 기록 / 파서·수집기 오류 → JOB_ERRORS) · not_job·office 과도한 제외 완화 · dryrun 아티팩트에 review 후보 · 선택 저장이 같은 판정으로 정상=등록, review=보류함 보관(성공 확인 뒤에만 완료), 명백한 제외=종결, 오류·아티팩트 만료=미완료. 연락처 미기재=review 결정은 CLAUDE.md·RULES_CORE에 Lee 11-22로 기록(정답 파일 변경 근거).
- 실제 GitHub dryrun→save는 아직 검증하지 않음. 자동 수집 정지 이유: 정기 실행 제거(Lee 11-17 #872) + vieclam24h GitHub 서버 403·본문 전화번호 숨김, Facebook 계정 잠금(쿠키 만료) [기존 기록 #946].
- DB: 이번 작업 변경 없음.
## 2. 다음 할 일 3개
1. PR #958: 필수 검사 → Lee 공식 Approve(결정 문서 변경 포함) → 봇 병합 → deploy-verify. 승인 전 병합·배포 금지.
2. Lee: 2~4번 그룹 Draft(`claude/crawl-group2-4-preserved`) 진행 여부 결정. 실제 dryrun→save는 Facebook 쿠키 갱신·계정 잠금 해제 뒤 Lee 승인으로 한 건만.
3. 정기 수집 재개는 별도 승인 PR.
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve. 새 검사·규칙·워크플로·대기열을 덧붙이지 않는다(기존 오류만 최소 수정).
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 전체 수집은 승인 없이 켜지 않는다.
