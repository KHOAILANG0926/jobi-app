# CHATGPT_HANDOFF — 메인 지도 핀 후속 완료 (2026-10-21 12:58 VN)

## 1. 현재 상태
- PR #188 병합, 앱 소스 master `c5688ee`. 위치가 핀보다 먼저 도착하면 핀 첫 도착 때 내 위치+가까운 핀을 다시 맞춤. 취소된 조정은 완료로 기억하지 않음.
- [직접 확인] 운영 배포 success, deploy-verify 통과: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39552348589
- [직접 확인] 운영 https://www.viecganban.vn 에서 위치 권한 허용 + 21.10,106.07, GPS 먼저·핀 나중 순서 검증. 모바일390·PC1366 모두 VietMap 핀 2개가 지도 안에 표시됨. 캡처 PNG 2개 직접 열어 확인.
- 운영 핀 검사 통과·캡처: https://github.com/KHOAILANG0926/jobi-app/actions/runs/39552524255 (artifact 12323659389). 실제 공개 API 좌표 사용, 운영 지도 스타일 사용. PR CI만 지도 키가 없어 빈 배경 스타일 사용.
- [직접 확인] 타입·69/69·빌드·PC 기준 8/8 및 최종 PR 필수 검사 통과. 취소 회귀 기존안 0 !== 1 실패 → 수정 후 통과.
- PC/모바일 JSX·CSS·공고 틀·운영 DB 변경 없음. PC 기준 해시는 지도 effect 변경만 반영. 현재 데이터 2건 검사는 #188 가지/배포에 한정, 수동 실행도 가능.
- STATUS 기준 2026-10-21 12:56 VN: c5688ee 운영 success, 공개 2건. 별개 기존 공고 규칙 시험 실패 5건은 이번 지도 작업에서 수정하지 않음.
- 이전 상세·자동위치·줄 보충·예약 알림 이력 및 교체 전 HANDOFF는 WORK_LOG에 보존. #4828 공개 company는 빈칸이며 제목은 “Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng”.

## 2. 다음 할 일 3개
1. 핀 선택 창 B안 `demo/pin-panel-b`: Lee 데모 확인 대기. 확인 전 운영 반영 금지.
2. 등록 시 공식 occupation_code로 category 자동 결정(Lee 동의, 미착수).
3. 결정 문서 승인 방식 변경(#141·#175, Lee 1회 GitHub 승인 필요).

## 3. 필수 규칙
- AGENTS.md·CLAUDE.md 준수. 범위 밖 수정·운영 DB 변경 금지. STATUS 생성 장치 수정 금지.
- 공고 기준틀 보존. VietMap 메인, Google 길찾기. 키·데이터 PC 저장 안내 금지.
- 짧게 [직접 확인]/[기존 기록]/[추정] 구분. 코드·PR만으로 완료 금지. 실제 운영 화면과 deploy-verify 근거 필수.
