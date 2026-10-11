# CHATGPT_HANDOFF — 최신 스냅샷

갱신: 2026-10-11 (Codex). 상세 근거/이전 스냅샷: WORK_LOG.md.
숫자·Production 기준은 status 브랜치 STATUS.md이며 이번 작업은 운영 DB 조회를 하지 않았다.

## 1. 현재 상태

- [직접 확인] 기준 master `9157ced522d024b2c378958f623beffbdfeb1aba`. 작업 branch `codex/crawler-cli-confirmation`; Draft PR #47: https://github.com/KHOAILANG0926/jobi-app/pull/47. 코드 HEAD `8ac985632c753602dd653762e99a9a0f5eff9f79`, 이후 문서 커밋만 추가(최종 HEAD는 PR).
- [직접 확인] 예약 caller 확인 인자 추가, Actions 수동 확인 default false, CLI 안전장치 유지/모드 충돌·축약 인자 차단. 신규 offline regression/별도 PR workflow. PR #46·보호 검증 장치·location guard SQL 변경 없음.
- [직접 확인] code HEAD Actions: offline CLI 14/14(기존 안전 21개 포함), 타입 검사 성공, npm test 47/47 파일, client+SSR build 성공. run 38151634507 / 38151634480 원문 로그 확인. 로컬 실행 도구 초기화 실패로 로컬 실행·clean 상태 미확인.
- [직접 확인] GitHub branch에 보존, 실제 master 병합·배포·외부 수집·Production DB 쓰기 없음. VERIFIED/DEPLOYED 또는 운영 장애 해결 완료로 선언하지 않음.
- [추정/미확인] VPS SHA/crontab/로그, 최신 실제 수집, browser 설치/import runtime 상태. 이 PR은 수집 재개 승인 아님.
- [기존 기록] 위치 승인 B안, #4750 숨김·핀 철회, location guard SQL 미적용은 이전 기록; 운영 데이터는 이번 재조회하지 않음.

## 2. 다음 할 일 3개

1. PR #47 최종 HEAD 검사 결과 확인·사용자 코드 검토. 병합/배포/수집 실행은 별도 지시 전 금지.
2. 승인된 읽기 연결로 VPS SHA·crontab·로그와 browser 설치 실패 원인을 확인. 전체 수집으로 확인하지 않는다.
3. 제외 정책은 PR #46 기준 별도 구현 승인 후 진행. 고소득 금액만 제외하지 않음; 모호한 역할 검토 저장 방식/DB trigger는 아직 미승인.

## 3. 필수 규칙

- [직접 확인] AGENTS.md·CLAUDE.md 최상단 보고 검증 규정 우선; 모든 결과 근거/상태 표시, 미실행을 통과로 보고하지 않음.
- STATUS/status 브랜치/scripts/status/status-* 및 기존 보호 검증 장치 수정 금지. location_approval_evidence_guard.sql 적용 금지.
- --confirm-full-crawl 제거 금지. 외부 수집·Production DB 쓰기·DDL/Auth/RLS·공고 변경·배포·병합은 별도 승인 전 금지.
- PC에 키·수집/검토 데이터·백업·결과 파일 저장 금지; secret 출력 금지. GitHub branch 보존과 Production 반영을 구분.
