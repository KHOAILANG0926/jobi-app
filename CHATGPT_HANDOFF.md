# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

승인 대기 중인 Home Hero·보조 카드 구성 개선을 `codex/home-hero-composition` 작업 브랜치에서 구현하고 검증했다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: 완료
- `APPROVED`: 사용자 최종 확인 대기
- `DEPLOYED`: 미완료, Production 배포 금지 유지

## 변경 내용

- Hero 배경의 강제 stretch를 제거하고 Desktop은 `cover`, Mobile은 원본 비율을 유지하는 `auto 70%`로 표시했다.
- Desktop/Mobile별 배경 위치와 흰색 fade를 조정해 서울타워·도심·한옥·태극기 구도를 유지했다.
- 중복 한국취업 카드를 제거하고 교육 및 로그인/CV 카드 2개를 컴팩트하게 재배치했다.
- `Việc làm mới nhất`를 보조 카드 바로 아래로 이동하고 기존 실제 공고와 링크를 유지했다.
- Hero 검색 제출 시 선택 지역이 초기화되던 오류를 최소 수정했다.
- Desktop/Mobile 레이아웃·검색·링크·overflow 회귀 검사 `scripts/test-home-composition.mjs`를 추가했다.
- Home 구현 커밋: `8e03ede`

## 테스트 결과

- Desktop 1440×1000 및 Mobile 390×844 실제 브라우저 화면 확인: 통과
- Hero 비율, 카드 수, 최신 영역 순서, 모바일 가로 overflow: 통과
- 키워드 `kế toán` + 지역 `hanoi` + 업종 `office` 검색 상태 유지 및 결과 이동: 통과
- 교육 `/dang-tin`, 로그인 `/dang-nhap`, 한국 채용 `/viec-han-quoc` 링크: 통과
- 실제 공고 데이터 567건 렌더링 확인: 통과
- `npx tsc --noEmit`: 통과
- `npm run build`: 통과

## 발견된 문제

- Home UI는 아직 사용자 최종 승인을 받지 않았으므로 master/production에 반영하지 않는다.
- `0003_interviews.sql` 운영 적용과 실제 E2E는 원격 DB 작업 보류 상태다.
- 기존 미추적 HTML과 중복 원본 PNG는 건드리지 않았다.

## 다음 결정사항

1. 사용자가 Desktop/Mobile 화면을 확인하고 Home UI 승인 여부를 결정한다.
2. 승인 전에는 작업 브랜치만 유지하고 Production 배포를 실행하지 않는다.
3. 승인 후 별도 배포 요청이 있을 때만 production 반영과 실제 운영 URL 확인을 진행한다.
