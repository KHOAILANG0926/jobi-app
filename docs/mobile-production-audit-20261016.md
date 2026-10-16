# 운영 모바일 현황 — 2026-10-16 (검사만, 앱 수정 없음)

- 기준 master: eb36b53443e1a9a3a2077d18447c490921baa5bb. 검사 branch: audit/mobile-production-20261016. Draft PR #101, 병합 금지.
- [직접 확인] 운영 검사: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38833385035 (success, 검사 소스 172d8b3).
- 원본 PNG/JSON/실행 로그: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38833385035/artifacts/12017638181 (83 files, 14일 보관).
- 검토용 JPEG/분할 캡처/원본 JSON: https://github.com/KHOAILANG0926/jobi-app/actions/runs/38833854229/artifacts/12018457848. 원본을 서버에서 변환했으며 새 브라우저 검사 결과가 아님.
- 360×800, 390×844, 412×915, 1366×900 각각 prompt/granted/denied. 실제 운영 URL, 테스트 좌표 21.1861,106.0763. 지도/공고 모의 데이터 없음.

## 직접 확인한 결과
1. 모바일 최초 화면은 큰 한국 취업 배너가 차지한다. 첫 800/844px 안에 위치 선택과 베트남 공고가 보이지 않는다. PC는 첫 900px 안에 위치·지도·목록이 함께 보인다. 근거: *-prompt-first.png 및 검토용 slice-0.jpg.
2. 모바일 지도 영역이 필터 영역을 덮는다. 거절 후 390/412 캡처에서 급여 제목 아래의 필터가 지도 아래에 가려지며, 허용 후에는 반경 버튼 아래를 지도가 덮는다. 자동 버튼 겹침 후보(10M+/Zoom 등)와 일치. PC 캡처는 좌측 필터/중앙 지도/우측 목록이며 같은 겹침이 보이지 않는다. 근거: 390-denied-location.png, 412-denied-location.png, 390-granted-location.png, 1366-granted-location.png.
3. 모바일 360 메뉴 캡처에서 드롭다운 글자가 배너 뒤에 희미하게 비쳐 읽기 어렵다. PC 메뉴도 배너 글자가 메뉴 배경을 통해 비친다. 근거: 360-prompt-menu.png, 1366-prompt-menu.png. 첫 화면 내 가로 메뉴의 오른쪽 항목이 잘려 보인다(가로 스크롤 끝까지 이동하는 상호작용은 이번에 검사하지 않음).
4. 모바일 document.scrollWidth 및 innerWidth가 요청 viewport보다 각각 2px 크다(362/392/414). PC는 1366. 스크립트의 자동 통과 조건은 innerWidth와 비교하여 이 차이를 실패로 잡지 못했다. 따라서 Actions success는 시각 문제 없음이라는 뜻이 아니다. 요소별 overflow 후보에는 가로 스크롤 영역의 화면 밖 카드도 포함되므로 전부 결함으로 보고하지 않는다.
5. [직접 확인] 지역 메뉴 열기·selectOption 실행(기본 Hà Nội 재선택; 다른 지역으로 변경은 미검증), 허용 state=granted와 사용자 위치/8km 반경 표시, 거절 state=denied와 수동 지역 안내를 JSON/캡처에서 확인했다.
6. [직접 확인] 12개 시나리오 로그에서 console error/pageerror/HTTP>=400 없음. 360-prompt에 WebGL ReadPixels GPU stall 성능 경고 4건. renderer는 ANGLE/SwiftShader(소프트웨어 Vulkan). WebGL context 사용 가능, 이후 지도 타일과 위치 원/지도 화면이 실제 캡처에 표시됨. 지도 생성 실패나 앱 예외로 확인된 경고는 아님. 실제 단말 GPU 성능은 미검증.
7. 회사명/주소의 clipping 후보는 텍스트 생략 영역으로 기록되었다. 자동 후보만으로 비정상 글자 잘림이라고 확정하지 않았다.

## 미검증/해석 한계
- headless Chromium이므로 OS/브라우저 네이티브 위치 권한 팝업의 실제 시각·터치 동작, iOS Safari/실제 Android GPU는 미검증.
- 권한은 브라우저 API로 부여/거절했으며 앱 geolocation을 모의 함수로 바꾸지 않았다. granted/denied 상태는 개별 JSON에 기록.
- fullPage 캡처와 스크롤 시점의 레이아웃 결과. 지도는 초기 캡처에서 lazy-loading/타일 로딩 중일 수 있고 후속 map-list/location에서 확인했다. 초기 PC 빈 캔버스를 영구 지도 오류로 판정하지 않았다.
- 겹침 후보는 문서 좌표 교차이며 hit-test 증명은 아님. 캡처로 필터 가림은 확인했지만 모든 개별 버튼의 클릭 불가까지 확인하지 않음.
- 원본 검사 success는 수집 성공이며 시각 결함 부재 판정이 아니다. 수정·운영 DB 변경·master 병합·운영 배포 없음.
