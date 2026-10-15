# CHATGPT_HANDOFF — 공식 직업분류(34/2020) + R8
갱신: 2026-10-15

## 1. 현재 상태
- [직접 확인] master 51e4ee8: PR #87 병합. 운영 DB에 occupation_master 1505 / occupation_descriptions 603 / occupation_aliases 21 적용(run 38671967420 점검 통과). 화면 변화 없음.
- 작업 브랜치 feat/occupation-r8: R8 SQL(`supabase/pending/20261015120000_local_jobs_occupation_r8.sql`, 미적용) + `crawler/occupation_classifier.py`. PGlite·unittest 통과.
- 사용자 결정(2026-10-15): 직업군은 코드 기준(명칭 차이 무시), 구직자 화면은 공식 Cấp2 48개 기본.
- Codex 작업 환경은 외부·GitHub 접속 불가 → 다운로드는 Actions, 작업은 Claude.

## 2. 다음 할 일 3개
1. 사용자 승인 후 R8 SQL 운영 적용(local_jobs 칸 2개 + 트리거).
2. 적용 후: 크롤러(Facebook·TopCV)에 분류기 연결, #4824 분류 저장(근거 "làm linh kiện tai nghe", 공개 상태 불변).
3. 화면: 공고가 있는 Cấp2 직업군만 필터로 표시, 상세에 공식 직업명. 매달 관보 자동 확인.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. 원본에 없는 직업코드·명칭 생성 금지.
- 회사명·공단명으로 직업군 추정 금지. 미분류에 other 기본값 금지.
- 운영 DB 변경·Production 배포는 사용자 승인 전 금지. #4824 공개 상태 변경 금지.
