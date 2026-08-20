# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

승인된 Home UI를 재구현하지 않고 배포 단계로 이어갈 수 있도록 작업 상태 규칙을 영구 문서에 반영했다.

## 변경 내용

- `AGENTS.md`와 `CLAUDE.md`에 `IMPLEMENTED / VERIFIED / APPROVED / DEPLOYED` 상태 정의를 동일하게 추가했다.
- 재구현 방지, 승인 후 배포 전환, 운영 미반영 시 배포 상태 우선 확인, 새 세션 상태 복원 규칙을 추가했다.
- Home UI 현재 상태를 다음과 같이 고정했다.
  - `IMPLEMENTED`: 완료
  - `VERIFIED`: 완료
  - `APPROVED`: 완료
  - `DEPLOYED`: 미완료

## 테스트 결과

- 이번 변경은 문서 규칙만 수정했으며 Home UI 코드는 변경하지 않았다.
- `AGENTS.md`와 `CLAUDE.md`의 필수 작업 상태 규칙 동일성 확인: 통과
- Home UI의 기존 `VERIFIED` 결과를 유지한다.

## 발견된 문제

- Home UI는 사용자 승인까지 완료됐지만 아직 `DEPLOYED` 상태가 아니다.
- `0003_interviews.sql` 운영 적용과 실제 E2E는 원격 DB 작업 보류 상태다.
- 지정된 미추적 HTML 및 소유권이 불명확한 미추적 이미지는 건드리지 않았다.

## 다음 결정사항

1. Home UI를 다시 구현하지 않고 기존 승인 결과를 commit/push 및 Production 배포한다.
2. 실제 `https://viecganban.vn` 반영을 확인한 뒤에만 Home UI를 `DEPLOYED`로 변경한다.
3. 이후 원격 DB 작업이 다시 허용되는 시점에 최신 `0003_interviews.sql` 적용과 interviews E2E를 진행한다.
