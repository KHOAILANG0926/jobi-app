# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

홈 화면의 `Thương hiệu tuyển dụng` 아래 광고 카드 2개가 오른쪽 지역 패널 높이 때문에 아래로 밀려 큰 빈 공간이 생기던 레이아웃 문제를 수정함.

## 변경 내용

- `src/pages/Home.tsx`: 브랜드 섹션과 광고 카드 2개를 같은 왼쪽 컬럼(`home-brands-left`) 안에 배치함.
- `src/index.css`: 왼쪽 컬럼을 세로 flex 구조로 만들고, 브랜드/지역 그리드는 위쪽 정렬되도록 조정함.
- 기존 60:40 데스크톱 배치와 1024px 이하 반응형 동작은 유지함.

## 테스트 결과

- `npx tsc --noEmit`: 통과.
- `npm run build`: 통과(Vite production build 완료).
- 로컬 실제 화면 검증:
  - 768px 폭: 브랜드 박스 하단과 광고 카드 상단 간격 16px.
  - 1280px 폭: 브랜드 박스 하단과 광고 카드 상단 간격 16px.
  - 광고 카드가 큰 빈 공간 없이 브랜드 영역 바로 아래에 표시됨.

## 발견된 문제

- 이번 작업 범위에서 새로 발견된 문제 없음.
- 작업 폴더에는 이번 작업과 무관한 기존 미추적 이미지/HTML 파일이 남아 있으며 수정하거나 삭제하지 않음.

## 다음 결정사항

- 현재 상태: **IMPLEMENTED → VERIFIED → MASTER PUSHED → PRODUCTION DEPLOYED → PRODUCTION VERIFIED**.
- 코드 커밋: `845736a` (`fix: 광고 배너 2개를 Thương hiệu tuyển dụng 로고 목록 바로 아래로 이동`).
- 인수인계 문서 커밋: `f5c5696` (`docs: record verified home ad layout fix`).
- Vercel Production 배포가 `Ready` 상태이고 운영 도메인 실제 화면에서도 광고 카드가 브랜드 영역 바로 아래 표시되는 것을 확인함.
- 사용자 최종 화면 승인만 남음.
