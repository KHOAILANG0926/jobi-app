# CHATGPT_HANDOFF — 공식 직업분류(34/2020) + R8
갱신: 2026-10-15

## 1. 현재 상태
- [직접 확인] master 51e4ee8: PR #87 병합. 운영 DB에 occupation_master 1505 / occupation_descriptions 603 / occupation_aliases 21 적용(run 38671967420 점검 통과). 화면 변화 없음.
- PR #88(feat/occupation-r8): 사용자 승인(2026-10-15) → R8 SQL `supabase/migrations/20261015120000_local_jobs_occupation_r8.sql`, 병합 시 `occupation-r8-apply.yml`이 적용·기존 공고 자동 분류·공개 상태 전후 비교·점검.
- 사용자 결정: 신규 직업은 A안(매주 미분류 보고 → 규칙 추가 PR)으로 시작, 미분류가 많아지면 규칙에 안 걸린 공고만 AI 분류(B안) 추가.
- 사용자 결정(2026-10-15): 직업군은 코드 기준(명칭 차이 무시), 구직자 화면은 공식 Cấp2 48개 기본.
- Codex 작업 환경은 외부·GitHub 접속 불가 → 다운로드는 Actions, 작업은 Claude.

## 2. 다음 할 일 3개
1. [직접 확인] R8 운영 적용 완료(#4824 = 82022). 크롤러 분류 연결·주간 미분류 보고·매달 관보 확인: PR feat/occupation-crawler.
2. 주간 보고 첫 실행 결과 확인(ANTHROPIC_API_KEY 없으면 보고만).
3. 화면(PR feat/occupation-ui): 지도 탐색 'Ngành nghề' = 공식 Cấp2 그룹(공고 있는 것만), 상세 = 공식 직업명. Preview 확인 후 Production.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. 원본에 없는 직업코드·명칭 생성 금지.
- 회사명·공단명으로 직업군 추정 금지. 미분류에 other 기본값 금지.
- 운영 DB 변경·Production 배포는 사용자 승인 전 금지. #4824 공개 상태 변경 금지.
