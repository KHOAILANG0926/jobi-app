# HANDOFF — 2026-11-24 (Claude) · 2순위(기존 다중 지점 공고 전환) 완료
## 1. 현재 상태
- 대표 확정 순위(Lee 2026-11-24): **1순위** 자동 병합 실패 복구·작업 큐 연결 — 완료(#995·#996). **2순위** 기존 다중 지점 공고 전환 — 완료(#998 dry-run 45314812701 → #999 병합 d1096b5 → migrations-apply 45320415496·production_check 통과 → deploy-verify 45320987633 성공 → #4825·#5992·#5994 실제 결과 = 예상, 계획 문서 docs/plans/2026-11-24-multi-branch-conversion.md 8절). **3순위** 격리 Preview 차등 검증 — 1차 PR #1000(변경 영향 범위로 기존 검사 고르기, scripts/ci/change-impact.mjs·docs/plans/2026-11-24-isolated-preview-diff.md), 2순위 운영 검증 완료 뒤 병합.
- 전환 결과: #4825 그대로(비공개), #5992 줄 1798·#5994 줄 1778만 남고 핀 그대로, 나머지 지점(줄 1776·1800)은 위치 보류함(원래 줄은 retained_rows에 보존). 새 공고 0건.
- 지도 정상화(Lee 2026-11-24): A 확정 위치 유실 방지(write_location 같은 지점 확정 줄 보존)·C API 오류 구분(장애·한도 = 보류, 결과 없음 = 못 찾음) 한 PR, B 복구 dry-run SQL 준비(scripts/ops/jobs/location-keep-recovery-preview.sql, 운영 데이터 변경 없음). 제외: D·E·신규 검사기.
- R 트랙(#940·#872): 수집·저장 성공(공고 6337), 게시는 빈 이름표 'VỊ TRÍ:'로 비공개 보류 — 같은 유형 전체를 R 트랙에서 근본 해결. 최종 완료 조건 = 실제 수집·저장·게시·운영 화면 대조.
## 2. 다음 할 일 3개
1. 보류함 두 지점(#5992 152 Trần Hưng Đạo, #5994 Trần Phú)은 다음 보류 다시 확인(retry_held) 때 기존 정책대로 — 결과 확인.
2. 3순위 1차 #1000은 병합됨(master 4a45151). 다음 단계(DB 변경 격리 대조)는 Lee의 1~11단계 목록 확인 뒤.
3. 지도 정상화 PR #1002: 병합·운영 적용 뒤 dry-run(ops-run-sql location-keep-recovery-preview) 실행·보고, 복구는 Lee 승인 뒤.
4. R 트랙 #940 이어서.
## 3. 필수 규칙
- CLAUDE.md·.claude/RULES_CORE.md 먼저(「지점별 독립 공고」「위치 확인 우선순위」「지도 위치 절대 원칙」「운영 DB 직접 접근 금지」「자율 완주 및 승인 게이트 원칙」). 확인한 것만 [직접 확인]/[기존 기록]/[추정].
- 운영 DB 변경은 migration + production_check 경로만, 위치 줄은 write_location만, 새 공고는 ingest_job만. 데이터 삭제 금지.
