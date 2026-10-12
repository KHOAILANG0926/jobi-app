# CHATGPT_HANDOFF — 최신 작업 스냅샷

갱신: 2026-10-12 PR #49 후속 검토. 운영 숫자의 기준은 status 브랜치 STATUS.md이며 아래는 격리 검증이다.

## 1. 현재 상태

- [직접 확인] 기존 Draft PR #49 / `codex/job-posting-policy-implementation-20261012`에서만 수정. master 기준 `9157ced`. 최종 원격 SHA·CI는 PR에서 확인. 신규 PR·병합 없음.
- [직접 확인] 금융 전담과 부수 채권관리 구분, B2B 외근 주업무 제한·내근/매장 허용, 20M 단독 제외 없음. 기존 공개 목록의 소급 숨김 방지, 일반 수정·비공개 전환 허용, 내용 수정/재공개 실패 시 공개 차단. 상세는 docs/job-posting-policy-implementation.md.
- [직접 확인] 최종 tsc/npm 49개 파일/build 통과; Python 기존 21/21 + 신규 5/5, JS/Python/SQL 35사례의 전체 판정 일치와 메모리 DB 원자적 gate 통과. 독립 표적 재검토 통과. Facebook 전체 suite·운영 UI/RPC/권한은 미검증.
- [기존 기록] 과거 37건 및 #4394/#4455 예외는 master 주석 기록. 이번 원문 미확인; 해당 ID 재판정 없음.
- [직접 확인] PR #47과 병합 시뮬레이션은 HANDOFF만 충돌. 제안 순서 #49 → #47(별도 병합/수집 승인 필요). Vercel 브랜치 차단은 제거 시 배포 위험 때문에 유지; 승인된 병합 전 외부 차단 확인 후 제거 필요.
- [직접 확인] SQL은 pending/ROLLBACK 초안만. Production DB/DDL·기존 공고·유료 API·수집·배포 변경 없음. 직접 SQL/service-role 및 동시 수정 우회는 운영 trigger 없이는 미해결.

## 2. 다음 할 일 3개

1. Draft PR #49의 최종 SHA/CI와 변경 검토. 두 PR 병합 및 배포 금지 유지.
2. 향후 병합 승인 전 외부 배포 차단 확인·임시 브랜치 Vercel 설정 제거, #47 HANDOFF 충돌 통합.
3. DDL/운영 권한·RPC 원자성·원문은 별도 승인/자료로 검증. 자동 수집 재개·비공개 검토 저장도 별도 승인.

## 3. 필수 규칙

- 보고는 [직접 확인]/[기존 기록]/[추정] 구분. STATUS/status/scripts/status/status-* 및 기존 보호 검증 장치 변경 금지.
- 원래 checkout/기존 변경 보존. PC 키·토큰·데이터·백업 저장 및 gh auth login 금지.
- Production 쓰기·DDL·위치 승인 SQL·유료 호출·배포·병합·실제 수집 금지. 사용자 별도 승인 필요. 최종 보고 5줄 이내.
