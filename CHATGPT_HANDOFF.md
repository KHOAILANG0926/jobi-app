# CHATGPT_HANDOFF — 전체 검사 마지막 좌표 로더 수정
갱신: 2026-10-16 Asia/Bangkok

## 1. 현재 상태
- master5664d1f: 공고3개/중복0/중첩0, 실제 상세위치3/3 통과. PR 위치9종 및 공고6종 회귀 성공.
- 마지막 jobCoords 단독 CI명령만 로더가 없어 ERR_MODULE_NOT_FOUND 발생. 기존 npm test 공식 TS로더 명령으로 통일. 해당명령 로컬14/14 통과.
- 앱/CSS/DB/좌표정책 변경 없음. workflow2파일의2영역만 변경. 사전범위 PR#116 후 구현/최종CI 진행.
- 모든 최종workflow·운영검사가 성공하기 전 전체완료 보고 금지.

## 2. 다음 할 일 3개
1. 사전범위 PR#116 병합 후 정확한2영역 수정 PR검사/병합.
2. Job card integrity workflow 모든 단계와 Production READY/PCmobile smoke 성공 확인.
3. 관리자우회 차단 복구는 사용자 설정 확인 필요. 최종근거는 구현PR 기록.

## 3. 필수 규칙
- 기준 CTY KDA 틀 유지, 지시 범위 밖 UI/데이터 변경 금지.
- 범위표 먼저고정 후 코드변경. 실패검사 생략/성공위조 금지.
- 회사PC 저장 안내·DB/Auth/RLS/STATUS 변경 금지.
