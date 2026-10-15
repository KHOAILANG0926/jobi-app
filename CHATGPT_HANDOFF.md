# CHATGPT_HANDOFF — 공식 직업분류(34/2020) 원본 추출
갱신: 2026-10-15

## 1. 현재 상태
- 코드: master 22abc80(변경 없음). 작업 브랜치 feat/occupation-master-extract, PR #87(미병합). Production·DB 변경 없음.
- [직접 확인] 관보 .doc 6개 저장소 보관(`data/occupations/34-2020/source/`, MANIFEST에 SHA256). Actions run 38667313009 성공.
- [직접 확인] 추출: Cấp1~5 = 10/48/152/509/785(합계 1504), 무결성 검사 0건. 설명 연결 603. 명칭 차이 20건은 코드 기준 연결·alias_vi 보관. 원본 오타 row 52는 13300으로 보정.
- [직접 확인] 2단계 SQL: 사용자 승인(2026-10-15) → `supabase/migrations/20261015100000_occupation_master.sql`·`20261015100100_occupation_master_seed.sql`, 병합 시 `occupation-master-apply.yml`이 운영 적용·점검. 롤백 `supabase/pending/20261015100000_occupation_master_rollback.sql`.
- Codex 작업 환경은 외부·GitHub 접속 불가(proxy 8080) → 다운로드는 GitHub Actions, 추출은 Claude가 수행.
- 이전 메인 공고 카드 상태(PR #70, Production 반영)는 WORK_LOG 하단 "이전 HANDOFF 보존"으로 이동.

## 2. 다음 할 일 3개
1. 운영 적용 결과 확인(Actions occupation-master-apply).
2. 구직자 직업군: 공식 Cấp2 48개 기본(사용자 승인) → 화면·R8 연결.
3. 메인 공고 카드 운영 브라우저 검증(기존 남은 일) — viecganban.vn 네트워크 허용 후.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. 원본에 없는 직업코드·명칭 생성 금지.
- 운영 DB 변경·Production 배포는 사용자 승인 전 금지. #4824 포함 공고 데이터 변경 금지.
- PC 저장 금지, Secret 출력 금지, STATUS 검증 장치 수정 금지.
