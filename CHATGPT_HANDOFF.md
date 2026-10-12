# CHATGPT_HANDOFF — 최신 작업 스냅샷

갱신: 2026-10-12. 상세 이력은 WORK_LOG.md. 아래 검증은 격리 환경만 해당한다.
숫자·운영 상태 기준은 [status 브랜치 STATUS.md](https://github.com/KHOAILANG0926/jobi-app/blob/status/STATUS.md)이며 이 파일이 대체하지 않는다.

## 1. 현재 상태

- [직접 확인] master `9157ced` 기반 `codex/job-posting-policy-implementation-20261012`에서 PR #46 문서 근거로 신규 공고 정책 구현. 공유 JSON/JS/Python, 등록·수정·재공개·수집 최종 gate, 공개 active/hidden 필터. 상세: docs/job-posting-policy-implementation.md.
- [직접 확인] tsc / npm 49/49 / build, Python 기존 21/21 + 신규 5/5, 메모리 PostgreSQL 정책 24사례 및 원자적 차단 테스트 통과. Production UI·RPC·권한 미확인. Facebook 전체 suite 미실행; writer만 격리 검증.
- [직접 확인] SQL evaluator/trigger는 pending/ROLLBACK 초안만. 직접 SQL/service-role·동시 수정 우회는 운영 DB trigger 없이 해결되지 않는다. 비공개 검토 저장도 설계만.
- [직접 확인] 기존 checkout·PR #47·보호 검증 장치 변경 없음. Production DDL/쓰기·기존 공고 변경·유료 API·실제 크롤링·배포 실행 없음. 이번 브랜치 자동 Vercel 배포만 차단.
- [기존 기록] PR #46/#47은 시작 시 Draft/open. 운영 위치 승인 B안·Goong 보류·과거 보고 정정은 이전 스냅샷을 WORK_LOG 보관에 유지. 운영 재확인으로 취급하지 말 것.
- 원격 최종 SHA·Draft PR·CI 상태는 해당 PR에서 확인. 이 작업은 master 병합·배포 승인 아님.

## 2. 다음 할 일 3개

1. Draft PR의 코드·CI와 정책 사례를 사용자 검토. PR #47·master 병합 금지 유지.
2. 별도 DDL 승인 전 운영 권한/RPC·trigger 배치 계획과 롤백을 검토. pending 위치 승인 SQL은 적용 금지.
3. 배포·자동 수집 재개·기존 공고 조치는 별도 지시를 기다린다. 비공개 검토 저장은 별도 설계 승인 필요.

## 3. 필수 규칙

- 각 보고는 [직접 확인]/[기존 기록]/[추정]을 구분. STATUS.md·status 브랜치·scripts/status·status-*·기존 보호 검증 장치 변경 금지.
- 기존 checkout/미커밋 변경 보존. PC 인증키·데이터·백업 저장 및 gh auth login 금지. master 직접 push/merge/배포 금지.
- DDL/Production DB 쓰기·유료 API·자동 수집 재개는 사용자 별도 승인 필요. 최종 보고 5줄 이내.
