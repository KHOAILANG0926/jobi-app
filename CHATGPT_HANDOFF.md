# CHATGPT_HANDOFF — FUSHAN 브랜치 전달 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- 사용자 최종 지시: 시험·빌드 후 새 브랜치 push만. PR은 Claude가 생성. 이번 작업에서 PR·운영 쓰기·병합·배포 금지.
- 브랜치 fix/fushan-source-rules-20261027, 시작 HEAD 1a05b64. FUSHAN 8줄을 공통 규칙으로 급여/고용형태/서류/환경·숙소에 분류; 원문 그대로 보존.
- 보너스는 급여에 합치지 않음. 중개 근거로 Tuyển qua nhà thầu 표시; 수수료 없음 문구는 중개 여부를 부정하지 않음. 공단명만으로 업무를 추정하지 않으며, 명시적 검토 안내는 재처리 시 보존.
- housing_search 번호표 추가, AI 재처리 hash에 번호표 정의 포함. 기존 화면틀/CSS 변경 없음.
- 공식 seed의 최상위 9와 FUSHAN 원문 증거 공개 게이트 시험 추가. DB 규칙 표 수정·production check SQL은 supabase/pending/fushan-20261027에 있음(운영 미적용).
- 최종 로컬 검증: npm test 82/82·tsc·build·PGlite 실제 사례+pending SQL/production check·approval scope 통과. 독립 검토 지적 수정, 남은 차단 없음.
- Git/npm 경로 정상. api.github.com은 환경 허용 목록에 없어 프록시가 차단. 토큰 만료는 확인되지 않았음.

## 2. 다음 할 일 3개
1. Claude가 전달 브랜치로 PR 생성하고 최종 HEAD 필수 CI 확인. 이번 브랜치의 로컬 검증 결과는 WORK_LOG 참고.
2. 후속 운영 작업: pending 규칙 SQL을 정상 migration으로 승격, 기존 등록 경로에서 실제 FUSHAN 등록·공식 코드 검증·회사+공단 기억 또는 공단 입구 위치 검증. 구직자 비용 요구 비공개 정책의 공통 집행은 별도 미구현 항목이며 등록 전 확인할 것.
3. 봇 병합→정상 migrations-apply→필요 시 배포 1회→deploy-verify·실제 검사표 전 항목 확인 후 연속기록 갱신. 로컬 fixture 성공을 운영 성공으로 보고하지 않음.

## 3. 필수 규칙
- 운영 DB 직접 조회/쓰기 금지. migration+production_check 정상 경로, 실패하면 원문 보고 후 중단.
- 공단 밖/공장 불명 기존 보류. 최상위 코드와 원문 부분문자열 존재는 공장 의미 검증의 자동 증명이 아님.
- 이번 작업은 브랜치 전달만. 공고 링크/좌표/연속기록은 아직 없음. 발견한 실패 때문에 0/10부터 다시 시작할 대상이나 운영 기록은 미갱신.
