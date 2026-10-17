# CHATGPT_HANDOFF — 직업분류 공개 게이트
갱신: 2026-10-17 Asia/Bangkok

## 1. 현재 상태
- 사용자 요청: 실제 업무·공식 직업분류 확인을 등록 전 필수 절차로 연결. 기존 R8은 null 분류도 공개 허용했음.
- 구현: 모든 INSERT/UPDATE를 통과하는 DB 최종 공개 게이트 + OCR 분류/원문 근거 확인. 공식 4·5단계 코드와 source_text의 근거가 없으면 active=false. 임의 코드 의미를 자동 검증하는 장치라고 주장하지 않음.
- 기존 공개 미분류도 보류하는 SQL은 supabase/pending/20261017065122_occupation_publication_gate.sql. 운영 적용 전이며 사용자만 병합.
- 검증: 기존 코드에서 미분류 공개·OCR 재공개 실패 재현 → 수정 후 PostgreSQL 10개 시나리오 및 OCR 검사 통과. tsc, npm test 61/61, build 통과. 원격 CI 별도 확인. CTY KDA의 기존 근거를 원문에 실제 있는 “linh kiện tai nghe”로 교정하는 내용 포함.
- UI/지도/Auth/RLS/STATUS 변경 없음. 기존 연락처 PR #118/#119와 별개 작업.

## 2. 다음 할 일 3개
1. 범위 PR → 구현 PR 순서로 사용자 병합. CI 결과 확인.
2. pending SQL의 운영 영향 확인 후 사용자 승인으로 DB 적용하고 migration 기록/파일 위치 정리. 승인 전 적용 금지.
3. 운영 공개 재시도 차단·정상 공고 유지 및 실제 공개 화면 확인.

## 3. 필수 규칙
- CTY KDA 틀·PC/모바일 보존, 사용자만 병합.
- 업무 미확인은 기타로 우회하지 않고 비공개·사유 보고. OCR은 업무 검증 아님.
- 회사 PC 저장 안내 금지. 원문/secret 공개 금지.
