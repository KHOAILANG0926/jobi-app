# HANDOFF — 2026-11-22 (Claude) · 크롤링 정상화 Draft PR
## 1. 현재 상태
- 코드: master `f02306d`(#953). 이번 작업은 Draft PR(브랜치 `claude/vigilant-turing-s3wcrs`) — 병합·배포·정기 수집 없음, 운영 DB 변경 없음. #808 마감 상태(병합 조건 = 필수 기계 검사 + approval-gate + S6 배포 잠금)는 그대로.
- 크롤링(Lee 11-22 지시): ① 수집 판정을 '명백한 부적합'(FINAL)·'본문 못 읽음'(RETRY)·'판단 보류'(HOLD→보류함 review)로 구분 — 예전 ambiguous·missing_required 영구 제외 제거(연락처 없음·정책 제외·구직자 홍보만 최종) ② 보류함(위치 미확인·회사 이름 판독 실패·판단 보류) 다시 확인 입구 `crawl-facebook-one.yml` mode retry_held(쿠키·Facebook 접속 없음, 한 번에 5건) + 오류 줄이 대기열을 막지 않음(하루 뒤로, 5번이면 종결) ③ crawl-guard ⑧: Facebook 감시 추가, 수동 전용 경로는 실패만 검사(미리 보기 뒤 '신규 0건' 오보 제거).
- 자동 수집 정지 이유: 정기 실행 제거(Lee 11-17 #872)가 직접 이유. 그 밖에 vieclam24h GitHub 서버 403·본문 전화번호 숨김, Facebook 계정 잠금(쿠키 만료) [기존 기록 #946].
- DB: 이번 작업 변경 없음.
## 2. 다음 할 일 3개
1. Draft PR: 필수 검사 → Lee 확인(워크플로 2개 변경) → 봇 병합 → deploy-verify 확인. retry_held 첫 실행은 Lee 승인 뒤(Google 한도 안, 새 글 안 읽음).
2. Lee: Facebook 쿠키(FB_C_USER·FB_XS, ops-keys) 갱신 → 계정 잠금 해제 → dryrun 시험 1건. vieclam24h는 본문 전화번호 있는 공고가 나오면 publish_one(승인).
3. 정기 수집 재개는 별도 승인 PR(재개 때 crawl-guard watch 줄을 fail_and_new로, retry_held를 실행마다 호출).
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저. 확인한 것만 [직접 확인]/[기존 기록]/[추정], 5줄 이내.
- 운영 DB는 migration + production_check PR로만. 비밀값·권한·DB 삭제·검사 장치 변경은 Lee 공식 Approve. 새 검사·규칙·워크플로·대기열을 덧붙이지 않는다(기존 오류만 최소 수정).
- 위치를 모르면 핀을 찍지 않는다·못 찾은 공고는 등록하지 않는다(보류함에 보관). 정기 전체 수집은 승인 없이 켜지 않는다.
