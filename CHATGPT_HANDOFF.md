# HANDOFF — 2026-11-27 (Claude) · 이슈 #921 직무 이름 Full Time 빠짐·근무 형태 Khác (#6255)
## 1. 현재 작업
- 이슈 #921: sb-6255 상세에서 Vị trí tuyển dụng 이름에 Full Time이 빠져 빈 대시가 남고, Hình thức làm việc이 Khác로 나옴.
## 2. 변경 내용
- src/lib/sourceRecruitmentRoles.ts: 직무 이름에서 근무 형태 낱말을 줄 끝에 붙은 것만 뗀다(줄 중간은 이름의 일부). 뗀 낱말은 기존대로 workTypes로 간다.
- src/lib/jobDetailDerive.ts employmentText: 근무기간 값이 Khác(사이트 선택지 기본값)이면 원문 근무 형태를 가리지 않게 건너뜀. 웹 JobDetail·앱 detailModel 공용이라 한 곳 수정.
- 시험 추가: sourceRecruitmentRoles.test.ts(#6255 제목 줄), jobDetailDerive.test.ts(Khác).
- 수평 전개: 상세 웹·앱은 같은 두 함수 사용(바꿈). 카드·검사표는 이 두 함수를 쓰지 않아 해당 없음.
## 3. 테스트 결과
- 미실행: sandbox-run.sh(tsc·test·build)가 작업 디렉터리 밖 경로라 권한 설정에 막혀 실행하지 못함. 게시 단계·CI에서 확인 필요.
## 4. 발견된 문제
- Khác의 출처(job.workPeriod 값 등)는 코드 읽기로만 추정했고 실제 sb-6255 데이터로는 확인하지 못함.
## 5. 다음 결정사항
- 검사 통과 확인 뒤 병합. sb-6255 운영 화면 대조(PC·모바일)는 배포 뒤.
