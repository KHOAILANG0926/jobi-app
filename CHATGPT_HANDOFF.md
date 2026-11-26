# HANDOFF — 2026-11-26 (Claude) · 이슈 #934 지도 운영 검사 비동기 선택 실패

## 1. 현재 작업
- 이슈 #934: S8 기존 장애 #932(run 44445489206)의 원인 가설 검증 — scripts/ops/map-summary-check.mjs 의 마커 클릭 직후 detail.count() 와 단일 공고 마커에 없는 .hme-map__job-picker button 대기. PR #933과 별개.

## 2. 변경 내용
- 코드 변경 없음. 수정 대상 scripts/ops/map-summary-check.mjs 는 검사 스크립트라 이 자동 실행·게시 단계의 수정 범위 밖(Lee 승인·사람 세션 대상)이어서 고치지 않았다. 이 파일(핸드오프)과 PR 설명에 검증 결과와 최소 수정안만 남겼다.

## 3. 테스트 결과
- [직접 확인] 코드 읽기: 단일 공고 마커 클릭은 onSelect 호출만 하고(src/components/home/map/VietMapMapCanvas.tsx choose), 상세 버튼(.hme-job__actions a)은 React 상태 갱신 뒤 렌더(HomeMapExplorer.tsx·DesktopHomeMapExplorer.tsx). 여러 공고 마커만 DOM으로 .hme-map__job-picker 를 즉시 만든다.
- [직접 확인] 검사 스크립트: click 직후 detail.count() 는 기다리지 않는 조회라 0일 수 있고, 그러면 picker 버튼을 10초 기다린다.
- [미확인] 실패 로그(run 44445489206, 이슈 #932): 이 세션에서 gh 조회가 승인 필요로 막혀 읽지 못했다. 실제 실패가 이 경로였는지는 미확인.
- [미실행] tsc·test·build: sandbox-run.sh 경로가 이 세션 읽기 제한에 걸려 실행하지 못했다. 코드 변경이 없어 결과 영향은 없다고 보지만 실행 결과는 없다.
- [미실행] 운영 화면 재검사(map-summary-check): 병합·배포 뒤 deploy-verify 에서만 가능.

## 4. 발견된 문제
- 가설은 코드상 성립(경쟁 상태 가능)하나 로그로 확정하지 못했다. 지도 스타일 지연 등 다른 원인은 로그로 배제되지 않았다.

## 5. 다음 결정사항
- 사람 세션에서 #932 로그 확인 후, 맞으면 기존 테스트 안에서만 최소 수정: detail.count() 분기를 없애고 detail 과 picker 버튼 중 먼저 보이는 쪽을 기다린 뒤, picker 가 먼저면 클릭하고 detail 을 기다린다(시간 제한·검사 삭제·UI 변경 없음). 검사 스크립트 변경이라 Lee 승인 대상.
