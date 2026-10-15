# CHATGPT_HANDOFF — 공식 직업분류(34/2020) + R8
갱신: 2026-10-15

## 1. 현재 상태
- [직접 확인] master 51e4ee8: PR #87 병합. 운영 DB에 occupation_master 1505 / occupation_descriptions 603 / occupation_aliases 21 적용(run 38671967420 점검 통과). 화면 변화 없음.
- PR #88(feat/occupation-r8): 사용자 승인(2026-10-15) → R8 SQL `supabase/migrations/20261015120000_local_jobs_occupation_r8.sql`, 병합 시 `occupation-r8-apply.yml`이 적용·기존 공고 자동 분류·공개 상태 전후 비교·점검.
- 사용자 결정: 신규 직업은 A안(매주 미분류 보고 → 규칙 추가 PR)으로 시작, 미분류가 많아지면 규칙에 안 걸린 공고만 AI 분류(B안) 추가.
- 사용자 결정(2026-10-15): 직업군은 코드 기준(명칭 차이 무시), 구직자 화면은 공식 Cấp2 48개 기본.
- Codex 작업 환경은 외부·GitHub 접속 불가 → 다운로드는 Actions, 작업은 Claude.

## 2. 다음 할 일 3개
1. R8 적용 결과 확인(Actions occupation-r8-apply).
2. 크롤러(Facebook·TopCV)에 분류기 연결 — R8 칸이 생긴 뒤 별도 PR. 매주 미분류 보고·매달 관보 확인 워크플로.
3. 화면: 공고가 있는 Cấp2 직업군만 필터로 표시, 상세에 공식 직업명. 매달 관보 자동 확인.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. 원본에 없는 직업코드·명칭 생성 금지.
- 회사명·공단명으로 직업군 추정 금지. 미분류에 other 기본값 금지.
- 운영 DB 변경·Production 배포는 사용자 승인 전 금지. #4824 공개 상태 변경 금지.
