# CHATGPT_HANDOFF — 관리자 E2E / R7 최소 수정안 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- master 436957e: PR #267·#268 모두 github-actions[bot] 병합. pg devDependency·lock, DB 생성 ID 사용, 원문·출처가 있는 비공개 fixture, 정리 검증 반영. Vercel run 40244309060·40244890104의 업로드 단계 skipped: 배포 안 함.
- [직접 확인] 위치 E2E 40244894578: 로그인·후보 실제 승인 클릭·두 공고 좌표/자동 재사용·기억/후보/공고 삭제 모두 PASS. job 121324274333 전 단계 success, 실패·skipped 없음. Vị trí 실제 DOM 4824·4828·4879·4878 각각 PASS 로그 확인.
- [직접 확인] 줄 선택 E2E 40244892760: 로그인·시험 줄 #4950 표시 성공, 저장 뒤 줄 미제거 timeout 실패. 정리 PASS, setup-node 후처리 skipped. 운영 API가 선택 저장 뒤 service_role로 ocr_check를 수정하여 R7에 걸리는 원인 실 DB rollback 시험으로 확인.
- 작업 fix/admin-line-pick-r7-signal-20261026: API의 section 선택 경로에서 불필요한 OCR 수정 제거, 기존 job_signal_queue 예약 유지. DB 규칙·권한·OCR 보호 유지. 회귀 시험은 수정 전 500 실패 → 수정 후 성공, 관리자 외 접근 거부 포함.
- 이 수정은 운영 API 변경: 사용자의 시험 코드만 변경/배포 없음 조건과 달라 Draft에서 검토. Lee의 배포 예외 결정 전 병합·배포 금지. 실제 줄 선택 최종 통과는 아직 아님.

## 2. 다음 할 일 3개
1. R7 API 수정안의 필수 CI·리뷰를 확인해 구체적 Draft PR 제시, 운영 API 배포 1회 예외에 대한 Lee 결정 받기.
2. 허용되면 PR 검사→봇 병합→운영 API 반영 후 줄 선택 실제 E2E 재실행. 로그인·선택 저장·원문 상세 재생성·정리 모두 확인할 때까지 수정.
3. 실제 통과와 워크플로 성공, 실패/건너뜀 단계를 구분해 최종 보고. 위치 시험·네 ID 노출은 이미 위 실행에서 직접 확인(근거 없이 반복하지 않음).

## 3. 필수 규칙
- 시험 공고 active=false, admin_hidden=true 유지. 공개 공고를 시험 승인하지 않음. Secret 출력·저장 금지. STATUS·운영 DB/권한·승인 화면 틀 보호.
- 코드 실수는 직접 수정, 권한·외부 서비스·Lee 결정이 필요할 때만 중단. 현재 배포 예외는 Lee 결정 필요.
- PR → 필수 검사 → 봇 병합. 미실행·skipped·실패를 통과로 보고하지 않음. R7을 완화하거나 service_role OCR 쓰기를 허용하지 않음.
