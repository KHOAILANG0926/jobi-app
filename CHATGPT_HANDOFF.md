# CHATGPT_HANDOFF — 직업분류 공개 게이트
갱신: 2026-10-17 Asia/Bangkok

## 1. 현재 상태
- 사용자 요청: 실제 업무·공식 직업분류 확인을 등록 전 필수 절차로 연결. 기존 R8은 null 분류도 공개 허용했음.
- 구현: 모든 INSERT/UPDATE를 통과하는 DB 최종 공개 게이트 + OCR 분류/원문 근거 확인. 공식 4·5단계 코드와 source_text의 근거가 없으면 active=false. 임의 코드 의미를 자동 검증하는 장치라고 주장하지 않음.
- 기존 공개 미분류도 보류하는 SQL은 supabase/pending/20261017065122_occupation_publication_gate.sql. 사용자 ok 승인 후 운영 적용 완료(20261017070517). 사용자만 병합.
- 검증: 기존 코드에서 미분류 공개·OCR 재공개 실패 재현 → 수정 후 PostgreSQL 10개 시나리오 및 OCR 검사 통과. tsc, npm test 61/61, build 통과. 원격 PostgreSQL/OCR·PR checks 통과. 이전 화면 검사는 #4827 좌표 없는 길찾기로 실패, DB 적용 후 재검증 필요. CTY KDA의 기존 근거를 원문에 실제 있는 “linh kiện tai nghe”로 교정하는 내용 포함.
- UI/지도/Auth/RLS/STATUS 변경 없음. 기존 연락처 PR #118/#119와 별개 작업.

## 2. 다음 할 일 3개
1. 범위 PR #120 → 구현 PR #121 순서로 사용자 병합. DB 적용은 이미 완료.
2. 적용 SQL 보존: supabase/migrations/20261017070517_occupation_publication_gate.sql. 이전 pending 사본은 격리 CI 입력으로 유지(재적용 지시 아님).
3. 운영 DB 직접 검증: #4827 active=true 재시도에도 false 유지(rollback), #4824 active=true·근거 ok. 실제 화면/CI 재검증 진행.

## 3. 필수 규칙
- CTY KDA 틀·PC/모바일 보존, 사용자만 병합.
- 업무 미확인은 기타로 우회하지 않고 비공개·사유 보고. OCR은 업무 검증 아님.
- 회사 PC 저장 안내 금지. 원문/secret 공개 금지.
